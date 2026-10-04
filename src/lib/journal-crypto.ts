/**
 * Cifrado de extremo a extremo del diario (Web Crypto, funciona en Safari/iOS).
 *
 * Esquema de "clave envuelta" (v2):
 *   clave del diario (DEK, 256 bits aleatorios) ──AES-GCM──▶ cifra los textos
 *   frase ──PBKDF2-SHA256 (600k) + sal──▶ KEK ──AES-GCM──▶ envuelve la DEK ("wrapped_key")
 *
 * Cambiar la frase = volver a envolver la DEK con una KEK nueva. Los textos no
 * se tocan, así que es instantáneo aunque haya años de diario.
 *
 * Diarios creados antes (v1, sin wrapped_key): la DEK ES la clave derivada de la
 * frase. Al cambiar la frase por primera vez se obtienen esos mismos 256 bits con
 * deriveBits y se envuelven: los textos antiguos siguen descifrándose igual.
 *
 * Nada de esto sale del dispositivo: en Supabase solo viven la sal, las
 * iteraciones, la DEK envuelta y un "verificador" (texto conocido cifrado con la DEK).
 */

export const KDF_ITERATIONS = 600_000;
const VERIFIER_PLAINTEXT = "ascendhabit-journal-v1";
const PREFIX = "v1";

export interface JournalKeyParams {
  salt: string;
  iterations: number;
  verifier: string;
  /** DEK envuelta con la frase; null en diarios v1 (anteriores a esta versión) */
  wrapped_key?: string | null;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function newSalt() {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}

async function pbkdf2Material(passphrase: string) {
  return crypto.subtle.importKey("raw", enc.encode(passphrase.normalize("NFC")), "PBKDF2", false, [
    "deriveKey",
    "deriveBits",
  ]);
}

/** Clave derivada de la frase (KEK en v2; en v1 era directamente la clave del diario) */
export async function deriveKey(passphrase: string, saltB64: string, iterations: number): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltB64), iterations },
    await pbkdf2Material(passphrase),
    { name: "AES-GCM", length: 256 },
    false, // no exportable: ni siquiera la app puede leer la clave en bruto
    ["encrypt", "decrypt"],
  );
}

/** Los mismos 256 bits que deriveKey, pero en bruto (solo para migrar diarios v1) */
async function deriveRaw(passphrase: string, saltB64: string, iterations: number): Promise<Uint8Array> {
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltB64), iterations },
    await pbkdf2Material(passphrase),
    256,
  );
  return new Uint8Array(bits);
}

/** La DEK se importa como NO exportable para usarla y recordarla en el dispositivo */
function importDek(raw: Uint8Array) {
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptBytes(key: CryptoKey, bytes: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes as BufferSource);
  return `${PREFIX}:${toBase64(iv)}:${toBase64(new Uint8Array(data))}`;
}

async function decryptBytes(key: CryptoKey, payload: string): Promise<Uint8Array> {
  const [version, ivB64, dataB64] = payload.split(":");
  if (version !== PREFIX || !ivB64 || !dataB64) throw new Error("Formato de cifrado desconocido");
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(ivB64) }, key, fromBase64(dataB64)));
}

export async function encryptText(key: CryptoKey, plaintext: string): Promise<string> {
  return encryptBytes(key, enc.encode(plaintext));
}

export async function decryptText(key: CryptoKey, payload: string): Promise<string> {
  return dec.decode(await decryptBytes(key, payload));
}

async function verifies(dek: CryptoKey, verifier: string) {
  try {
    return (await decryptText(dek, verifier)) === VERIFIER_PLAINTEXT;
  } catch {
    return false; // AES-GCM falla la autenticación con una clave incorrecta
  }
}

/** Frase nueva desde cero: DEK aleatoria envuelta con la frase */
export async function createKeyParams(passphrase: string): Promise<{ key: CryptoKey; params: JournalKeyParams }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const salt = newSalt();
  const kek = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const dek = await importDek(raw);
  const params: JournalKeyParams = {
    salt,
    iterations: KDF_ITERATIONS,
    verifier: await encryptText(dek, VERIFIER_PLAINTEXT),
    wrapped_key: await encryptBytes(kek, raw),
  };
  raw.fill(0);
  return { key: dek, params };
}

/** Obtiene la DEK en bruto con la frase actual (v2: desenvolver; v1: derivar). null si la frase es incorrecta */
async function rawDekFor(passphrase: string, params: JournalKeyParams): Promise<Uint8Array | null> {
  try {
    if (params.wrapped_key) {
      const kek = await deriveKey(passphrase, params.salt, params.iterations);
      return await decryptBytes(kek, params.wrapped_key);
    }
    return await deriveRaw(passphrase, params.salt, params.iterations);
  } catch {
    return null;
  }
}

/** Devuelve la clave del diario si la frase es correcta, o null si no */
export async function unlockKey(passphrase: string, params: JournalKeyParams): Promise<CryptoKey | null> {
  const raw = await rawDekFor(passphrase, params);
  if (!raw) return null;
  const dek = await importDek(raw);
  raw.fill(0);
  return (await verifies(dek, params.verifier)) ? dek : null;
}

/**
 * Cambia la frase sin tocar los textos: misma DEK, envuelta con la frase nueva.
 * Devuelve null si la frase actual es incorrecta.
 */
export async function rewrapKey(
  currentPassphrase: string,
  newPassphrase: string,
  params: JournalKeyParams,
): Promise<{ key: CryptoKey; params: JournalKeyParams } | null> {
  const raw = await rawDekFor(currentPassphrase, params);
  if (!raw) return null;
  const dek = await importDek(raw);
  if (!(await verifies(dek, params.verifier))) {
    raw.fill(0);
    return null;
  }
  const salt = newSalt();
  const kek = await deriveKey(newPassphrase, salt, KDF_ITERATIONS);
  const next: JournalKeyParams = {
    salt,
    iterations: KDF_ITERATIONS,
    verifier: params.verifier, // mismo verificador: la DEK no cambia
    wrapped_key: await encryptBytes(kek, raw),
  };
  raw.fill(0);
  return { key: dek, params: next };
}

// ---------------------------------------------------------------------
// "Recordar en este dispositivo": la CryptoKey (no exportable) se guarda en
// IndexedDB. Se identifica por usuario + sal, así una frase nueva invalida la anterior.
// ---------------------------------------------------------------------
const DB_NAME = "ascendhabit";
const STORE = "journal-keys";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function storeKeyId(userId: string, salt: string) {
  return `${userId}:${salt}`;
}

export async function rememberKey(userId: string, salt: string, key: CryptoKey) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear(); // una sola clave recordada por dispositivo
      tx.objectStore(STORE).put(key, storeKeyId(userId, salt));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Navegación privada o almacenamiento bloqueado: se pedirá la frase cada vez
  }
}

export async function loadRememberedKey(userId: string, salt: string): Promise<CryptoKey | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(storeKeyId(userId, salt));
      req.onsuccess = () => resolve((req.result as CryptoKey | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function forgetKeys() {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // nada que olvidar
  }
}
