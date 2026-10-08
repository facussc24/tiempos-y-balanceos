# Noche de Claude (API): corre scripts\_nocturno.mjs y deja el resultado en el log.
#
# Lo corre el Programador de tareas de Windows todos los dias a las 06:30 (tarea
# "Barack - Noche de Claude (API)", la registra `node scripts\_nocturno.mjs --agendar`).
# Si la notebook estaba apagada a esa hora, corre al prenderla (StartWhenAvailable).
# Se puede correr a mano:
#     powershell -ExecutionPolicy Bypass -File scripts\_nocturno.ps1
#
# Mismo armado que _syncMailsDiario.ps1. Lo que aprendimos de la auto-mejora nocturna
# anterior (apagada el 04/08/2026: 47.522 timeouts y un fork bomb de `claude -p`):
#   - un solo `node`, con tope de 55 minutos; si se pasa, se corta ESE proceso y queda ERROR;
#   - stdout y stderr van al log, siempre;
#   - "resultado vacio" es error: si node sale 0 pero no escribio .claude\state\nocturno.json,
#     el resultado es ERROR, no OK.
# No toca el repo, ni Supabase (solo lectura), ni el arb, ni Outlook. Solo ASCII en este
# archivo (powershell.exe lo lee como ANSI).

$ErrorActionPreference = 'Stop'
$raiz   = Split-Path -Parent $PSScriptRoot
$log    = Join-Path $raiz '.sgc-cache\api\nocturno-diario.log'
$estado = Join-Path $raiz '.claude\state\nocturno.json'

function Escribir($txt) {
  $linea = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $txt
  Write-Host $linea
  $dir = Split-Path -Parent $log
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Add-Content -Path $log -Value $linea -Encoding UTF8
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Escribir 'RESULTADO: ERROR - no encuentro node en el PATH de esta sesion'; exit 1 }

$inicio = Get-Date
Escribir 'Arranca la noche de Claude'
$env:PYTHONIOENCODING = 'utf-8'
$out = Join-Path $env:TEMP 'barack_nocturno.out'
$err = Join-Path $env:TEMP 'barack_nocturno.err'
$p = Start-Process -FilePath $node.Source -ArgumentList 'scripts\_nocturno.mjs' -WorkingDirectory $raiz `
       -NoNewWindow -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
$null = $p.Handle    # sin esto PowerShell pierde el ExitCode (30/09: 'ERROR (codigo )' con el proceso OK)
if (-not $p.WaitForExit(55 * 60 * 1000)) {
  $p.Kill()
  Escribir 'RESULTADO: ERROR - _nocturno.mjs no termino en 55 min; se corto ese proceso. Se reintenta manana.'
  exit 4
}
$code   = $p.ExitCode
$salida = @()
foreach ($f in @($out, $err)) { if (Test-Path $f) { $salida += Get-Content $f -Encoding UTF8 } }
foreach ($l in $salida) { Escribir ('  | {0}' -f $l) }

$escribio = (Test-Path $estado) -and ((Get-Item $estado).LastWriteTime -ge $inicio)
if ($code -eq 0 -and -not $escribio) {
  Escribir 'RESULTADO: ERROR - node salio bien pero no escribio .claude\state\nocturno.json (resultado vacio)'
  exit 5
} elseif ($code -eq 3) {
  Escribir 'RESULTADO: ERROR - falta la clave de la API (node scripts\_claude.mjs --check)'
} elseif ($code -ne 0) {
  Escribir ('RESULTADO: ERROR (codigo {0})' -f $code)
} else {
  Escribir 'RESULTADO: OK'
}
exit $code
