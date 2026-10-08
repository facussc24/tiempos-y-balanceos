# _nubeSync.ps1 - tarea de Windows "Barack - mi asistente al dia" (08/10/2026).
#
# Corre `node scripts/_nube.mjs --sincronizar --aplicar` en las PC de Fak (la de Ingenieria y la
# notebook de Calidad) al iniciar sesion (con 5 minutos de demora, para que OneDrive llegue a bajar la
# nube) y cada 2 horas. Gana el archivo mas nuevo, nada se borra, los conflictos se guardan antes
# (scripts/_lib/nubeSincronizar.mjs). La registra `node scripts/_nube.mjs --registrar-tarea`.
#
# Solo ASCII en este archivo: powershell.exe 5.1 sin BOM lee UTF-8 como ANSI.

$ErrorActionPreference = 'Continue'
$raiz   = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $raiz '.claude\state'
$log    = Join-Path $logDir 'nube-sync.log'

function Escribir($txt) {
  $linea = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $txt
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
  Add-Content -Path $log -Value $linea -Encoding UTF8
}

# El log no crece sin tope: pasado 1 MB se queda con la mitad final.
if ((Test-Path $log) -and ((Get-Item $log).Length -gt 1MB)) {
  $lineas = Get-Content $log
  $lineas | Select-Object -Last ([int]($lineas.Count / 2)) | Set-Content $log -Encoding UTF8
}

# node: el del PATH, o las rutas tipicas de una instalacion por usuario o por maquina.
$node = $null
$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd) { $node = $cmd.Source }
if (-not $node) {
  foreach ($c in @((Join-Path $env:ProgramFiles 'nodejs\node.exe'), (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe'))) {
    if (Test-Path $c) { $node = $c; break }
  }
}
if (-not $node) { Escribir 'ERROR: no encuentro node.exe (ni en el PATH ni en las carpetas de siempre)'; exit 1 }

# Si OneDrive no esta corriendo, la copia local de la nube puede estar vieja. Se avisa y se sigue:
# sincronizar contra una copia vieja no rompe nada (gana el mas nuevo y nada se borra).
if (-not (Get-Process -Name OneDrive -ErrorAction SilentlyContinue)) { Escribir 'OJO: OneDrive no esta corriendo; la nube puede estar atrasada' }

Escribir 'inicio'
Push-Location $raiz
$salida = & $node 'scripts\_nube.mjs' --sincronizar --aplicar 2>&1
$codigo = $LASTEXITCODE
Pop-Location
foreach ($l in $salida) { $t = [string]$l; if ($t.Trim()) { Escribir ('  ' + $t) } }
if ($codigo -eq 0) { Escribir 'RESULTADO OK' } else { Escribir ('RESULTADO ERROR (codigo ' + $codigo + ')') }
exit $codigo
