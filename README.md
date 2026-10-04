# AscendHabit

Hábitos individuales con panel de accountability entre socios.
Stack: **Next.js 16 (App Router) · Tailwind CSS v4 · Supabase · Vercel**.

---

## Paso 1 · Puesta en marcha

### 0. Requisitos
- Node.js 20 o superior (`node -v`)
- Git (`git --version`)
- Cuentas en GitHub, Supabase y Vercel

### 1. Instalar dependencias
Desde la carpeta del proyecto (PowerShell o terminal de VS Code):

```bash
npm install next@latest react@latest react-dom@latest @supabase/supabase-js @supabase/ssr
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss supabase
```

### 2. Crear el proyecto en Supabase
1. https://supabase.com/dashboard → **New project** → nombre `ascendhabit`, región **East US (North Virginia)**, la más cercana a Colombia. Guarda la contraseña de la base de datos.
2. **Project Settings → API Keys**: copia la *Project URL* y la *Publishable key*.
3. En la raíz del proyecto crea un archivo llamado **`.env.local`** con este contenido (Git lo ignora, así que tus claves no se suben):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
   ```

### 3. Aplicar la migración (elige una opción)

**Opción A: CLI (recomendada, deja historial de migraciones)**
```bash
npx supabase login
npx supabase init            # crea supabase/config.toml (responde "N" a las preguntas)
npx supabase link --project-ref TU_PROJECT_REF   # el ref es lo que va antes de .supabase.co
npx supabase db push
```

**Opción B: Panel web**
SQL Editor → pega y ejecuta, en orden:
1. `supabase/migrations/20261002000001_initial_schema.sql`
2. `supabase/migrations/20261002000002_seed_categories_templates.sql`

### 4. Probar en local
```bash
npm run dev
```
Abre http://localhost:3000. Debe aparecer un punto **verde** con el texto
"Supabase conectado · migración aplicada · RPC protegidas".

### 5. GitHub
1. Crea un repo **privado** vacío llamado `ascendhabit` (sin README ni .gitignore).
2. Ejecuta:
   ```bash
   git init
   git add .
   git commit -m "Paso 1: inicialización del proyecto y esquema de base de datos"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/ascendhabit.git
   git push -u origin main
   ```
3. Settings → Collaborators → invita a Santiago.

### 6. Vercel
1. https://vercel.com/new → **Import** el repo `ascendhabit`. Vercel detecta Next.js automáticamente.
2. En **Environment Variables** añade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. **Deploy**. Cada `git push` a `main` vuelve a desplegar.
4. Copia la URL de producción (p. ej. `https://ascendhabit.vercel.app`) y en Supabase
   ve a **Authentication → URL Configuration**:
   - *Site URL*: la URL de Vercel
   - *Redirect URLs*: `http://localhost:3000/**` y `https://ascendhabit.vercel.app/**`

---

## Paso 2 · Login y pantalla "Hoy"

### Qué incluye
- **Login sin contraseña con código de 6 dígitos por email.** Funciona dentro de la app instalada en el iPhone; un enlace abriría Safari y la sesión no llegaría a la app.
- **Rutas protegidas:** sin sesión → `/login`; con sesión, `/login` → `/today`.
- **Pantalla Hoy:** % del día, racha de Día Perfecto, hábitos agrupados por Mañana / Tarde / Noche, botón ✓ o `+N` y hoja de detalle para ajustar cantidades. Los cambios se ven al instante (actualización optimista).
- **Crear hábito:** desde una de las 7 plantillas o a medida (Sí/No, cantidad o tiempo; diario, días concretos o X por semana; prioridad, categoría y visibilidad para el socio).
- **Ajustes:** nombre, zona horaria y cerrar sesión. **Socio:** muestra tu código (el panel llega en el Paso 3).

### Configuración en Supabase (una sola vez)
1. **SQL Editor** → ejecuta `supabase/migrations/20261003000001_today_screen.sql`
   (o `npx supabase db push` si usas la CLI).
2. **Authentication → Emails → Templates**: en **Magic Link** y en **Confirm signup**, pega
   `supabase/templates/codigo-acceso.html`. Asunto sugerido: `Tu código de AscendHabit: {{ .Token }}`
3. **Authentication → URL Configuration**: confirma que *Site URL* es `https://ascendhabit.vercel.app`.

> El servicio de email incluido en Supabase es para pruebas y envía muy pocos correos por hora.
> Para dos usuarios es suficiente porque la sesión dura semanas. Si llegan a ese límite, se configura
> un SMTP propio (por ejemplo, Resend) en *Authentication → Emails → SMTP Settings*.

### Probar
```bash
npm run dev
```
Entra con tu email, crea 2 o 3 hábitos y márcalos. Luego `git add . && git commit -m "Paso 2: login y pantalla Hoy" && git push`
y Vercel lo despliega solo.

### Instalar en el iPhone
Safari → `ascendhabit.vercel.app` → botón Compartir → **Añadir a pantalla de inicio**.

---

## Paso 3 · Panel de Accountability y rescates

### Qué incluye
- **Socio → vincularse:** cada uno ve su código de 8 caracteres (con botón para compartir) y escribe el del otro.
- **Panel "Tú vs socio":** % de hoy, % de la semana y racha de Día Perfecto de cada uno, más los hábitos que el socio marcó como visibles.
- **Pantalla Hoy → "Racha en riesgo":** lista los días fallados de las últimas 48 h que aún se pueden rescatar, con un botón **Pedir rescate** (motivo + mensaje).
- **Bandeja de rescates:** el socio recibe un aviso en Hoy y aprueba o rechaza desde Socio. Si aprueba, la racha se restaura al instante.
- La app vuelve a cargar los datos al volver a ella (útil en el iPhone).

### Configuración
**SQL Editor** → ejecuta `supabase/migrations/20261004000001_partner_recovery.sql`.

---

## Paso 4 · Gestión de hábitos

### Qué incluye
- **Pestaña Hábitos:** lista de hábitos activos con su racha y frecuencia (🔒 = privado), y una sección de **Archivados** con botón Restaurar.
- **Detalle del hábito** (`/habits/[id]`): racha actual, mejor racha, % de cumplimiento de los últimos 30 días (4 semanas en los semanales), total completados y **calendario mensual** navegable (hecho, 🛡 rescatado, parcial y fallado, con leyenda).
- **Editar:** el mismo formulario de creación. Si cambias la meta, el día de hoy usa la nueva y los días pasados conservan la suya.
- **Archivar:** saca el hábito de Hoy sin perder el historial. **Restaurar** lo reactiva con la racha empezando ese día, para que los días archivados no cuenten como fallos.
- **Eliminar:** borra el hábito y todo su historial (pide confirmación).
- Desde la hoja de un hábito en Hoy: enlace "Ver calendario y estadísticas".

### Configuración
**SQL Editor** → ejecuta `supabase/migrations/20261005000001_habit_management.sql`.

---

## Fase 5 · Rediseño editorial + Diario cifrado

### Diseño
- **Estricto blanco y negro.** Tokens en `src/app/globals.css` (`bg`, `surface`, `ink`, `ink-2`, `ink-3`, `line`), usados como `bg-bg`, `text-ink-2`, `border-line`…
- **Tipografía:** Newsreader (serif) para títulos y cifras, Inter para texto e interfaz.
- **Piezas:** `btn btn-primary`, `btn btn-ghost`, `field` (campo tipo libreta), `eyebrow` (etiqueta), `mono` (emoji en grises), `ruled` (papel pautado).
- **Tema:** botón luna/sol en la cabecera y selector Normal / Noche / Sistema en Ajustes. Se guarda en el dispositivo y se aplica antes de pintar, sin parpadeo.
- **Estados sin color:** relleno = hecho, contorno doble = rescatado, discontinuo = parcial, barra diagonal = fallado.

### Diario + Bitácora (pestaña Diario)
- **Cifrado de extremo a extremo.** Cada uno crea una *frase del diario*; los textos se cifran en el dispositivo (AES-256-GCM, clave PBKDF2 de 600k iteraciones) y la base de datos rechaza cualquier texto sin cifrar. **Si se olvida la frase, los textos no se pueden recuperar** (sí la energía y la emoción).
- **Autoguardado:** cada campo se guarda a los ~1 s de dejar de escribir y al salir de la app.
- **Bitácora:** energía 1–5, emoción principal, gratitud/victoria, conciencia y aprendizaje.
- **Historial:** flechas entre días con entrada y lista del mes (fecha, energía, emoción).

### Configuración
**SQL Editor** → ejecuta `supabase/migrations/20261006000001_journal.sql`.

---

## Fase 6 · Diario extenso con calendario + Progreso

### Diario
- Pestañas **Diario | Bitácora**. El Diario es una página pautada para escribir largo (hasta ~150.000 caracteres por día), con contador de palabras y autoguardado cifrado.
- Los días pasados se abren en **modo lectura**; con **Editar** se pueden modificar.
- **Ver historial** abre un calendario: año ‹ ›, tira de 12 meses con los días escritos de cada uno y la rejilla del mes (relleno = diario escrito, contorno = solo bitácora). Tocar un día lo abre.

### Progreso (Hábitos → Progreso)
- Resumen: % de esta semana, tendencia (últimas 4 semanas completas frente a las 4 anteriores), días perfectos en 30 días y racha de Día Perfecto.
- Gráficos: cumplimiento semanal (12 semanas), energía media semanal (de la bitácora) y cumplimiento por día de la semana. Al tocar una barra se ve su valor, y cada gráfico tiene "Ver tabla".
- Ranking por hábito con su % a 30 días y sus rachas.

### Configuración
**SQL Editor** → ejecuta, en orden:
1. `supabase/migrations/20261006000002_journal_history.sql`
2. `supabase/migrations/20261006000003_stats.sql`

---

## Estructura

```
supabase/migrations/   Esquema SQL versionado (tablas, RLS, rachas, recuperación)
src/proxy.ts           Refresca la sesión en cada petición (antes "middleware")
src/lib/supabase/      Clientes: client.ts (navegador) · server.ts (servidor) · proxy.ts
src/app/               Rutas (App Router) · manifest.ts = PWA
public/icons/          Iconos de la app (provisionales)
```

## API de base de datos (RPC)

| Función | Uso |
|---|---|
| `get_today()` | Todo lo de la pantalla Hoy en una llamada |
| `log_habit(p_habit_id, p_value)` | Fija el progreso de HOY (fecha calculada en el servidor) |
| `get_partner_info()` | Mi código de socio y con quién estoy vinculado |
| `get_recoverable_misses()` | Días fallados que aún se pueden rescatar |
| `get_habit_detail(p_habit_id, p_month)` | Calendario de un mes + estadísticas de un hábito |
| `set_habit_archived(p_habit_id, p_archived)` | Archivar o restaurar un hábito |
| `save_journal_entry(p_date, p_patch)` | Guarda solo los campos enviados del diario/bitácora (textos ya cifrados) |
| `get_journal_day(p_date)` | Entrada de un día + navegación + parámetros de la clave |
| `get_journal_month(p_month)` | Resumen del mes (energía, emoción; sin texto) |
| `setup_journal_key` / `reset_journal_key` | Crear o restablecer la frase del diario |
| `get_journal_year(p_year)` | Días con entrada por mes de un año |
| `get_stats(p_weeks)` | Tendencia semanal, por día de la semana, por hábito y resumen |
| `get_my_summary()` | % de hoy y de la semana, racha de Día Perfecto y hábitos con sus rachas |
| `get_my_habit_streaks()` | Racha actual y mejor racha de cada hábito |
| `get_partner_summary()` | Panel de accountability (solo agregados + hábitos compartidos) |
| `connect_partner(p_invite_code)` | Vincularse con el socio usando su código |
| `end_partnership()` | Terminar la relación de socios |
| `request_streak_recovery(p_habit_id, p_missed_date, p_reason, p_message)` | Pedir rescate de racha |
| `resolve_streak_recovery(p_request_id, p_approve)` | Aprobar o rechazar (solo el socio) |
| `get_recovery_requests()` | Bandeja de solicitudes enviadas y recibidas |

## Reglas de negocio implementadas en la base de datos
- Los registros solo se crean o editan para **hoy**, en la zona horaria del usuario.
- La racha se rompe si no se cumple la meta. El día en curso no la rompe hasta que termina.
- **Día Perfecto**: 100 % de los hábitos programados del día. Los días sin hábitos son neutros y los hábitos de "veces por semana" no participan.
- **Recuperación**: se pide como máximo 48 h después del día fallado, hay un máximo de 2 por hábito al mes y expira a las 72 h sin respuesta.
- El socio **nunca** lee las tablas del otro. Los porcentajes incluyen los hábitos privados, pero no muestran su nombre.
