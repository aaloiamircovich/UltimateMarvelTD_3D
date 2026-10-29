param([string]$Version = '4.5.15')
$ErrorActionPreference = 'Stop'
$storeBlender = Get-AppxPackage BlenderFoundation.Blender -ErrorAction SilentlyContinue
if ($storeBlender) {
    Write-Output "Blender de Microsoft Store detectado ($($storeBlender.Version)). No se instala otra copia."
    Write-Output 'Verificar automatización con: npm run art -- doctor'
    exit 0
}
if ($Version -notmatch '^4\.5\.\d+$') { throw 'Usar una versión de Blender 4.5 LTS.' }
$toolsRoot = Join-Path $env:LOCALAPPDATA 'UltimateMarvelTD\tools'
$archiveName = "blender-$Version-windows-x64.zip"
$installPath = Join-Path $toolsRoot "blender-$Version-windows-x64"
$executable = Join-Path $installPath 'blender.exe'
if (-not (Test-Path -LiteralPath $executable)) {
    New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
    $archivePath = Join-Path $toolsRoot $archiveName
    $checksumText = (Invoke-WebRequest -Uri "https://download.blender.org/release/Blender4.5/blender-$Version.sha256" -UseBasicParsing).Content
    if ($checksumText -is [byte[]]) { $checksumText = [System.Text.Encoding]::UTF8.GetString($checksumText) }
    $checksumLine = ($checksumText -split "`n" | Where-Object { $_.Trim().EndsWith($archiveName) })
    if (-not $checksumLine) { throw 'No se encontró la firma SHA-256 oficial del archivo.' }
    $expectedHash = ($checksumLine.Trim() -split '\s+')[0]
    if ($expectedHash -notmatch '^[a-fA-F0-9]{64}$') { throw 'Firma SHA-256 inválida.' }
    Write-Output "Descargando Blender $Version LTS desde blender.org..."
    Invoke-WebRequest -Uri "https://download.blender.org/release/Blender4.5/$archiveName" -OutFile $archivePath -UseBasicParsing
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'La descarga no coincide con la firma oficial. No se ejecutará.' }
    Write-Output 'Firma verificada. Extrayendo Blender portable...'
    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsRoot -Force
}
& $executable --background --factory-startup --version
if ($LASTEXITCODE -ne 0) { throw 'Blender no pudo iniciarse.' }
Write-Output "BLENDER_PATH=$executable"
