<#
.SYNOPSIS
    Automatiza el release del APK de LeybrakApp: sube versionCode/versionName,
    compila el APK firmado, lo sube al servidor, lo copia dentro del contenedor
    del backend y actualiza el registro VersionApp (sin pasar por el admin).

.EXAMPLE
    .\release-apk.ps1 -VersionName 1.0.24 -VersionCode 25

.EXAMPLE
    # Fuerza la actualizacion a todos los usuarios apenas se publica
    .\release-apk.ps1 -VersionName 1.0.24 -VersionCode 25 -Forzar

.NOTES
    Requiere: gradlew.bat vía el junction C:\LB, scp/ssh (OpenSSH de Windows),
    y acceso SSH al servidor ya configurado (misma clave que usa el deploy).
    Ver CLAUDE.md -> "Release de la app móvil" para el detalle de cada paso.
#>
param(
    [Parameter(Mandatory = $true)][string]$VersionName,
    [Parameter(Mandatory = $true)][int]$VersionCode,
    [string]$SshTarget = "root@5.161.56.61",
    [switch]$Forzar
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path

Write-Host "== 1/6: Subiendo versionCode/versionName ($VersionCode / $VersionName) ==" -ForegroundColor Cyan

$versionJsPath = Join-Path $repoRoot "LeybrakApp\src\config\version.js"
(Get-Content $versionJsPath -Raw) `
    -replace 'APP_VERSION_CODE = \d+', "APP_VERSION_CODE = $VersionCode" `
    -replace "APP_VERSION_NAME = '[^']+'", "APP_VERSION_NAME = '$VersionName'" `
    | Set-Content $versionJsPath -Encoding utf8 -NoNewline

$buildGradlePath = Join-Path $repoRoot "LeybrakApp\android\app\build.gradle"
(Get-Content $buildGradlePath -Raw) `
    -replace 'versionCode \d+', "versionCode $VersionCode" `
    -replace 'versionName "[^"]+"', "versionName `"$VersionName`"" `
    | Set-Content $buildGradlePath -Encoding utf8 -NoNewline

Write-Host "== 2/6: Compilando APK release (assembleRelease) ==" -ForegroundColor Cyan
& C:\LB\android\gradlew.bat -p C:\LB\android assembleRelease --no-daemon
if ($LASTEXITCODE -ne 0) { throw "El build de Gradle fallo (exit $LASTEXITCODE)." }

$apkLocal = Join-Path $repoRoot "LeybrakApp\android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apkLocal)) { throw "No se encontro el APK compilado en $apkLocal" }

$apkNombreRemoto = "leybrak-$VersionName.apk"
$apkUrl = "https://pos.leybrak.com/media/$apkNombreRemoto"

Write-Host "== 3/6: Subiendo $apkNombreRemoto al servidor ==" -ForegroundColor Cyan
scp $apkLocal "${SshTarget}:~/$apkNombreRemoto"
if ($LASTEXITCODE -ne 0) { throw "scp fallo (exit $LASTEXITCODE)." }

Write-Host "== 4/6: Copiando dentro del contenedor backend (volumen media/) ==" -ForegroundColor Cyan
ssh $SshTarget "cd leybrakPOS && sudo docker compose cp ~/$apkNombreRemoto backend:/app/media/$apkNombreRemoto"
if ($LASTEXITCODE -ne 0) { throw "docker compose cp fallo (exit $LASTEXITCODE)." }

Write-Host "== 5/6: Verificando que responde 200 detras de Cloudflare ==" -ForegroundColor Cyan
$resp = Invoke-WebRequest -Uri $apkUrl -Method Head -UseBasicParsing
if ($resp.StatusCode -ne 200) { throw "El APK no respondio 200 (status $($resp.StatusCode))." }
Write-Host "OK: $apkUrl -> $($resp.StatusCode)" -ForegroundColor Green

Write-Host "== 6/6: Actualizando VersionApp (version_name_ultima, apk_url$(if ($Forzar) { ', version_code_minima' })) ==" -ForegroundColor Cyan
$forzarArg = if ($Forzar) { "--forzar" } else { "" }
ssh $SshTarget "cd leybrakPOS && sudo docker compose exec -T backend python manage.py actualizar_version_app --version-code $VersionCode --version-name $VersionName --apk-url $apkUrl $forzarArg"
if ($LASTEXITCODE -ne 0) { throw "actualizar_version_app fallo (exit $LASTEXITCODE)." }

Write-Host ""
Write-Host "Listo: version $VersionName (code $VersionCode) publicada en $apkUrl" -ForegroundColor Green
if (-not $Forzar) {
    Write-Host "La actualizacion quedo OPCIONAL (no se forzo version_code_minima)." -ForegroundColor Yellow
}
