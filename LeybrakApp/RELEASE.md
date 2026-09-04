# Release del APK — LeybrakApp

Guía para publicar una nueva versión de la app móvil (APK directo, sin Play Store).
Cómo funciona el gate de actualización forzada: [CLAUDE.md](../CLAUDE.md#release-de-la-app-móvil-apk--actualización-forzada).

## Forma rápida (recomendada): script automatizado

`scripts/release-apk.ps1` hace todo el flujo de punta a punta: sube versión,
compila, sube al servidor, copia al contenedor, verifica y actualiza la BD.

```powershell
# Actualización opcional (no interrumpe a nadie, aparece como disponible)
.\LeybrakApp\scripts\release-apk.ps1 -VersionName 1.0.25 -VersionCode 26

# Actualización forzada (bloquea la app hasta actualizar — usar solo si hay
# un fix crítico o rompe compatibilidad con el backend)
.\LeybrakApp\scripts\release-apk.ps1 -VersionName 1.0.25 -VersionCode 26 -Forzar
```

Pasos que ejecuta (`scripts/release-apk.ps1`):

1. **Sube versionCode/versionName** en `android/app/build.gradle` y
   `src/config/version.js` (lee/escribe con `System.IO.File` + UTF-8 sin BOM —
   ver Gotcha más abajo, **no** cambiar a `Get-Content`/`Set-Content`).
2. **Compila** `gradlew.bat assembleRelease` vía el junction `C:\LB` (firma
   con `leybrak-release.keystore`, credenciales en `android/keystore.properties`).
3. **Sube** el APK al servidor por `scp` como `leybrak-<version>.apk`
   (nombre versionado — ver Gotcha caché de Cloudflare).
4. **Copia** el archivo dentro del contenedor `backend` (`docker compose cp`
   → `/app/media/`, volumen compartido con `frontend`/nginx).
5. **Verifica** que `https://pos.leybrak.com/media/leybrak-<version>.apk`
   responda `200` (detrás de Cloudflare).
6. **Actualiza `VersionApp`** en la base de datos vía el management command
   `actualizar_version_app` por SSH (sin pasar por Django admin).

Requiere: `gradlew.bat` vía el junction `C:\LB`, `scp`/`ssh` (OpenSSH de
Windows) con acceso ya configurado al servidor (`root@5.161.56.61` por
default, param `-SshTarget` para cambiarlo).

## Forma manual (si el script falla o hace falta un paso suelto)

```powershell
# 1. Subir versión — 3 lugares en +1, si no se desincroniza (ver Gotcha #4 en CLAUDE.md):
#    - LeybrakApp/android/app/build.gradle       -> versionCode, versionName
#    - LeybrakApp/src/config/version.js          -> APP_VERSION_CODE, APP_VERSION_NAME
#    (el gate compara la CONSTANTE JS, no el versionCode nativo del APK)

# 2. Compilar (genera app/build/outputs/apk/release/app-release.apk, ~62 MB)
& C:\LB\android\gradlew.bat -p C:\LB\android assembleRelease --no-daemon

# 3. Subir al servidor con nombre versionado (evita caché de Cloudflare)
scp LeybrakApp\android\app\build\outputs\apk\release\app-release.apk root@5.161.56.61:~/leybrak-1.0.25.apk

# 4. Copiar dentro del contenedor backend (volumen media/)
ssh root@5.161.56.61 "cd leybrakPOS && sudo docker compose cp ~/leybrak-1.0.25.apk backend:/app/media/leybrak-1.0.25.apk"

# 5. Verificar que responde 200
curl -I https://pos.leybrak.com/media/leybrak-1.0.25.apk

# 6. Actualizar VersionApp — o bien por SSH con el management command:
ssh root@5.161.56.61 "cd leybrakPOS && sudo docker compose exec -T backend python manage.py actualizar_version_app --version-code 26 --version-name 1.0.25 --apk-url https://pos.leybrak.com/media/leybrak-1.0.25.apk"
# ... o desde Django admin -> "Versión de la App" (modelo VersionApp, fila plataforma='android'):
#     version_code_minima, version_name_ultima, apk_url, activa ✅
```

## Gotchas

- **Versión en 3 lugares, +1 cada vez.** Si `build.gradle`, `version.js` y la
  BD (`VersionApp.version_code_minima`) se desincronizan, el gate de
  actualización forzada puede entrar en **bucle infinito** (instala el APK
  nuevo y vuelve a pedir actualización) porque compara contra la constante
  JS `APP_VERSION_CODE`, no el versionCode nativo del build.
- **Caché de Cloudflare en `/media/leybrak.apk`.** Si se resube un APK con el
  mismo nombre de archivo, Cloudflare puede seguir sirviendo el viejo
  (`cf-cache-status: HIT`) sin purgar. Por eso el nombre va versionado
  (`leybrak-1.0.25.apk`) — URL nueva = cache miss garantizado, sin tocar el
  panel de Cloudflare.
- **PowerShell 5.1 + BOM.** `Get-Content` (sin `-Encoding`) lee con la
  codepage del sistema y garabatea UTF-8 multibyte (tildes, `⚠️`, cajas
  `──`); `Set-Content -Encoding utf8` además antepone un BOM que el parser
  de Groovy/Gradle rechaza (`Unexpected character: '?' @ line 1, column 1`).
  El script usa `[System.IO.File]::ReadAllText/WriteAllText` con
  `UTF8Encoding($false)` para evitar esto — si se toca esa sección, mantener
  ese patrón.
- **La contraseña del keystore es irreemplazable.** `leybrak-release.keystore`
  (alias `leybrak`) firma todas las actualizaciones; perder la contraseña
  significa no poder firmar updates nunca más para los usuarios ya
  instalados. Debe estar respaldada por el dueño, fuera del repo.
- **Actualización forzada (`-Forzar` / `version_code_minima`) bloquea a
  todos los usuarios hasta actualizar.** Usar solo cuando hay un fix crítico
  o un cambio que rompe compatibilidad con el backend actual; para mejoras
  normales dejarla opcional (default del script).

## Verificar versión de un APK ya compilado

```powershell
aapt dump badging <ruta-al-apk> | findstr versionCode
```
