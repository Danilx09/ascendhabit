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
3. Crea tu archivo de entorno:
   ```bash
   copy .env.local.example .env.local     # Windows
   # cp .env.local.example .env.local     # Mac/Linux
   ```
   y pega ahí los dos valores.

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
