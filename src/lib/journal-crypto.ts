/**
 * Cifrado de extremo a extremo del diario (Web Crypto, funciona en Safari/iOS).
 *
 *   frase ──PBKDF2-SHA256 (600k)──▶ clave AES-GCM 256 (no exportable)
 *   texto ──AES-GCM + IV aleatorio──▶ "v1:<iv base64>:<cifrado base64>"
 *
 * La frase y la clave nunca salen del dispositivo. En Supabase solo viven la
 * sal, las iteraciones y un "verificador" (un texto conocido cifrado) para
 * comprobar si la frase es correcta.
 */

export const KDF_ITERATIONS = 600_000;
const VERIFIER_PLAINTEXT = "ascendhabit-journal-v1";
const PREFIX = "v1";

export interface JournalKeyParams {
  salt: string;
  iterations: number;
  verifier: string;
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

export async function deriveKey(passphrase: string, saltB64: string, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", enc.encode(passphrase.normalize("NFC")), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltB64), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false, // no exportable: ni siquiera la app puede leer la clave en bruto
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return `${PREFIX}:${toBase64(iv)}:${toBase64(new Uint8Array(data))}`;
}

export async function decryptText(key: CryptoKey, payload: string): Promise<string> {
  const [version, ivB64, dataB64] = payload.split(":");
  if (version !== PREFIX || !ivB64 || !dataB64) throw new Error("Formato de cifrado desconocido");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(ivB64) }, key, fromBase64(dataB64));
  return dec.decode(plain);
}

/** Crea los parámetros de una frase nueva (sal aleatoria + verificador) */
export async function createKeyParams(passphrase: string): Promise<{ key: CryptoKey; params: JournalKeyParams }> {
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const verifier = await encryptText(key, VERIFIER_PLAINTEXT);
  return { key, params: { salt, iterations: KDF_ITERATIONS, verifier } };
}

/** Devuelve la clave si la frase es correcta, o null si no */
export async function unlockKey(passphrase: string, params: JournalKeyParams): Promise<CryptoKey | null> {
  const key = await deriveKey(passphrase, params.salt, params.iterations);
  try {
    return (await decryptText(key, params.verifier)) === VERIFIER_PLAINTEXT ? key : null;
  } catch {
    return null; // AES-GCM falla la autenticación con una clave incorrecta
  }
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
