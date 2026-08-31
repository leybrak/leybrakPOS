# Cómo levantar el proyecto en local (Windows)

Guía rápida para prender el backend y el frontend web en tu máquina. Pensada
para copiar/pegar los comandos tal cual.

## 1. Backend (Django)

Usa siempre el Python del **venv**, no el del sistema.

```bash
cd C:\Users\leybr\Desktop\Leybrak\POS\leybrakPOS

# Aplica migraciones pendientes (hazlo cada vez que haya una migración nueva)
venv/Scripts/python.exe manage.py migrate

# Levanta el servidor en el puerto 8001 (el frontend está configurado para ese puerto, NO el 8000 por defecto)
venv/Scripts/python.exe manage.py runserver 8001
```

Verificar que responde:

```bash
curl http://127.0.0.1:8001/api/health/
```

Debe devolver `200`.

## 2. Frontend web (Vite + React)

```bash
cd C:\Users\leybr\Desktop\Leybrak\POS\leybrakPOS\pos-frontend
npm run dev
```

Se sirve en `http://localhost:5173`. Lee `VITE_API_URL` de
`pos-frontend/.env.development` (apunta a `http://localhost:8001`).

> Si usás Claude Code: ya existe `.claude/launch.json` con la config
> `pos-frontend`, así que se puede levantar con el comando de preview del
> agente en vez de `npm run dev` manual.

## 3. Entrar

- **Web (dueño / staff):** `http://localhost:5173` → botón "Panel de
  Control" → login con usuario y contraseña.
- **Admin de Django:** `http://localhost:8001/admin/`.
- **Panel de staff (Leybrak):** es la misma URL de la web (`http://localhost:5173`),
  no una ruta aparte — cae ahí automáticamente si el usuario logueado es
  superusuario.

### Crear un superusuario si no existe uno

```bash
venv/Scripts/python.exe manage.py shell -c "
from django.contrib.auth import get_user_model
U = get_user_model()
u = U.objects.create_user(username='admin', email='tu-email@ejemplo.com', is_staff=True, is_superuser=True)
u.set_password('elige-una-contraseña')
u.save()
"
```

## Gotchas

- **Base de datos local:** `DATABASE_URL=sqlite:///db.sqlite3` en `.env` —
  es un archivo local, no el Postgres de producción. Los datos de prueba
  que crees acá no afectan el servidor real.
- **Puerto del backend:** siempre `8001` en local (no el 8000 default de
  `runserver`), porque `pos-frontend/.env.development` está fijado a ese
  puerto.
- **`psutil`:** lo usa el endpoint de salud del servidor (`/api/staff/salud-servidor/`,
  panel de staff). Si el venv es viejo y no lo tiene: `venv/Scripts/python.exe -m pip install psutil`.
- **El backend se cae solo a veces (exit code 4) en sesiones largas de
  background:** si dejó de responder, simplemente volvé a correr el paso 1
  (`runserver 8001`) — no hace falta reinstalar nada.
- **`requirements.txt` está en UTF-16** (no UTF-8) — es así desde antes,
  probablemente por un `pip freeze` hecho en PowerShell. Si lo editás a
  mano, no lo reescribas con una herramienta que fuerce UTF-8 o vas a
  corromper el archivo; usa PowerShell con `-Encoding Unicode`.
