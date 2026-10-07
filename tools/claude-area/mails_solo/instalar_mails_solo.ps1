# instalar_mails_solo.ps1 - deja andando de nuevo SOLO la subida de los mails de trabajo de una persona a la nube de
# Ingenieria, en una PC que quedo sin el asistente por area. Caso: Carlos, 07/10/2026 (la "actualizacion limpia" saco la
# tarea "Barack - Claude por area", que era la que subia sus mails; Fak quiere seguir recibiendolos).
# No toca nada mas de esa actualizacion: ni la configuracion de Claude, ni las reglas, ni el plugin.
#
# Lo lanza Mails-<persona>.cmd (doble clic, sin permisos de administrador):
#   powershell -NoProfile -ExecutionPolicy Bypass -File instalar_mails_solo.ps1 -Pc CARLOS -Nombre Carlos
# Que hace (y si algo falla antes del paso 3, no copio nada):
#   1) busca la carpeta de mails de siempre en la biblioteca de Ingenieria
#   2) las listas: quien sube (la fila de ESTA PC y de ESTE usuario tiene que decir "sube") y lo que no sale nunca
#   3) instala el programa de mails (el mismo, con un agregado: subir a esa carpeta aunque el resto este en cuarentena)
#   4) Node propio en %LOCALAPPDATA%\BarackMails
#   5) lo ya subido, para no subir dos veces lo mismo (de la tarea vieja, o leido de la nube; sin eso no sigue)
#   6) la tarea "Barack - mails de <persona>": al iniciar sesion (10 minutos despues) y cada 4 horas, sin ventana
#   7) mira si esta abierto el Outlook clasico (los mails se leen de ahi) y corre la primera pasada
param(
  [Parameter(Mandatory = $true)][string]$Pc,
  [Parameter(Mandatory = $true)][string]$Nombre
)
$ErrorActionPreference = 'Stop'
$aqui = $PSScriptRoot
$casa = 'C:\ClaudeBarack'
$programas = Join-Path $casa 'publicado\programas'
$comun = Join-Path $casa 'publicado\conocimiento\comun'
$estado = Join-Path $env:LOCALAPPDATA 'BarackMails'
$viejo = Join-Path $env:LOCALAPPDATA 'BarackEquipo'
$TAREA = 'Barack - mails de ' + $Nombre

function Ok([string]$t) { Write-Host ('  OK   ' + $t) -ForegroundColor Green }
function Ojo([string]$t) { Write-Host ('  OJO  ' + $t) -ForegroundColor Yellow }
function Mal([string]$t) {
  Write-Host ''
  Write-Host ('  NO SE PUDO: ' + $t) -ForegroundColor Red
  Write-Host '  Avisale a Facundo Santoro (Ingenieria).'
  Write-Host ''
  exit 1
}
function Leer-Json([string]$p) {
  try { return (Get-Content -LiteralPath $p -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop) } catch { return $null }
}
function Sin-Espacios([string]$s) { return (($s -replace '\s+', ' ').Trim().ToLowerInvariant()) }

Write-Host ''
Write-Host ('  MAILS DE ' + $Nombre.ToUpper() + ' A LA NUBE DE INGENIERIA') -ForegroundColor Cyan
Write-Host ''
if ($env:COMPUTERNAME -ne $Pc) { Mal ('esto es para la PC ' + $Pc + ' y esta PC es ' + $env:COMPUTERNAME) }

# 1) la biblioteca de Ingenieria y la carpeta de mails de siempre
$org = Join-Path $env:USERPROFILE 'BARACK ARGENTINA SRL'
$bib = $null
$destino = $null
foreach ($b in @(Get-ChildItem -LiteralPath $org -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'Ingenier*a y Proyecto - General' })) {
  foreach ($n in @('Claude Barack', '_CUARENTENA_Claude Barack')) {
    $m = Join-Path $b.FullName ($n + '\mails')
    if (Test-Path -LiteralPath $m -PathType Container) { $bib = $b.FullName; $destino = $m; break }
  }
  if ($destino) { break }
}
if (-not $destino) { Mal 'no encuentro en esta PC la carpeta de mails de la nube de Ingenieria (Claude Barack\mails). Revisar que la biblioteca de Ingenieria este sincronizada.' }
Ok ('carpeta de la nube: ' + $destino)

# 2) las listas: las del ultimo paquete publicado (si estan), si no las que ya tiene la PC
$listas = @{}
foreach ($f in @('personas.json', 'mails_privados.json')) {
  $listas[$f] = $null
  foreach ($raiz in @('CLAUDE POR AREA', '_CUARENTENA_CLAUDE POR AREA')) {
    $pub = Join-Path $bib ($raiz + '\1- PUBLICADO\contenido\conocimiento\comun\' + $f)
    if ((Test-Path -LiteralPath $pub) -and (Leer-Json $pub)) { $listas[$f] = $pub; break }
  }
  if (-not $listas[$f] -and (Test-Path -LiteralPath (Join-Path $comun $f)) -and (Leer-Json (Join-Path $comun $f))) { $listas[$f] = Join-Path $comun $f }
  if (-not $listas[$f]) { Mal ('no encuentro la lista ' + $f + ' (ni publicada ni en esta PC)') }
}
$personas = Leer-Json $listas['personas.json']
$fila = @($personas.personas | Where-Object { $_.pc -eq $Pc -and -not $_.baja })
if ($fila.Count -ne 1 -or $fila[0].mails -ne 'sube') { Mal 'en la lista de personas la fila de esta PC no dice que sus mails se suben' }
if ((Sin-Espacios $fila[0].usuario_windows) -ne (Sin-Espacios $env:USERNAME)) { Mal ('la fila es del usuario de Windows "' + $fila[0].usuario_windows + '" y esta abierto "' + $env:USERNAME + '"') }
# la carpeta de la persona en la nube: lo de antes de la arroba de su casilla (como autorDe de mails_area.mjs)
$casilla = ([string]$fila[0].mail).Trim().ToLowerInvariant()
if ($casilla -notmatch '^[^@\s]+@[^@\s]+$') { Mal 'la fila de esta PC no trae una casilla de mail' }
$partes = $casilla.Split('@')
$autor = $partes[0] -replace '[^a-z0-9._-]', '-'
if ($partes[1] -ne 'barackmercosul.com') { $autor = $autor + '@' + ($partes[1] -replace '[^a-z0-9._-]', '-') }
Ok ('listas: ' + $fila[0].nombre + ' comparte sus mails (acordado el ' + $fila[0].mails_acordado + ')')

# 3) el programa de mails y las listas, a la PC
try {
  New-Item -ItemType Directory -Force -Path $programas | Out-Null
  New-Item -ItemType Directory -Force -Path $comun | Out-Null
  foreach ($f in @('mails_area.mjs', 'mails_outlook.ps1')) { Copy-Item -LiteralPath (Join-Path $aqui $f) -Destination (Join-Path $programas $f) -Force }
  foreach ($f in @('personas.json', 'mails_privados.json')) {
    if ($listas[$f] -ne (Join-Path $comun $f)) { Copy-Item -LiteralPath $listas[$f] -Destination (Join-Path $comun $f) -Force }
  }
} catch { Mal ('no pude copiar el programa de mails a ' + $programas + ': ' + $_.Exception.Message) }
Ok 'programa de mails instalado'

# 4) Node propio
$nodePropio = Join-Path $estado 'node\node.exe'
if (-not (Test-Path -LiteralPath $nodePropio)) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $nodePropio) | Out-Null
  $origenes = @((Join-Path $viejo 'node\node.exe'))
  foreach ($raiz in @('CLAUDE POR AREA', '_CUARENTENA_CLAUDE POR AREA')) { $origenes += (Join-Path $bib ($raiz + '\1- PUBLICADO\contenido\marketplace\plugins\barack-area\bin\node.exe')) }
  foreach ($o in $origenes) {
    if (Test-Path -LiteralPath $o) {
      try { Copy-Item -LiteralPath $o -Destination ($nodePropio + '.nuevo') -Force; Move-Item -LiteralPath ($nodePropio + '.nuevo') -Destination $nodePropio -Force; break } catch { }
    }
  }
}
if (Test-Path -LiteralPath $nodePropio) { Ok 'Node' }
elseif (Get-Command node -ErrorAction SilentlyContinue) { Ok 'Node (el de la PC)' }
else { Mal 'no encuentro Node.js para correr el programa' }

# 5) lo ya subido: para no subir dos veces lo mismo
New-Item -ItemType Directory -Force -Path $estado | Out-Null
$ids = Join-Path $estado 'mails-area-subidos.txt'
if (-not (Test-Path -LiteralPath $ids)) {
  if (Test-Path -LiteralPath (Join-Path $viejo 'mails-area-subidos.txt')) {
    Copy-Item -LiteralPath (Join-Path $viejo 'mails-area-subidos.txt') -Destination $ids -Force
    if (Test-Path -LiteralPath (Join-Path $viejo 'mails-area-estado.json')) { Copy-Item -LiteralPath (Join-Path $viejo 'mails-area-estado.json') -Destination (Join-Path $estado 'mails-area-estado.json') -Force }
    Ok 'lo ya subido: de la tarea anterior'
  } else {
    # la actualizacion limpia borro la lista local: se arma de nuevo con lo que ya esta en la nube
    $lista = New-Object System.Collections.Generic.List[string]
    $re = [regex]'^\{"id":"((?:[^"\\]|\\.)*)"'
    $suyos = Join-Path $destino ('_entrada\' + $autor)
    if (Test-Path -LiteralPath $suyos) {
      foreach ($a in @(Get-ChildItem -LiteralPath $suyos -Filter '*.jsonl' -File)) {
        foreach ($ln in [System.IO.File]::ReadLines($a.FullName, [System.Text.Encoding]::UTF8)) {
          $mm = $re.Match($ln)
          if ($mm.Success) { $v = $mm.Groups[1].Value; if ($v.Contains('\')) { $v = [regex]::Unescape($v) }; $lista.Add($v) }
        }
      }
    }
    # sin lo ya subido, la primera pasada volveria a subir todo: no se sigue
    if ($lista.Count -eq 0) { Mal ('no encuentro los mails que ya subio esta PC (' + $suyos + '): para no subirlos de nuevo, no sigo') }
    [System.IO.File]::WriteAllLines($ids, $lista, (New-Object System.Text.UTF8Encoding $false))
    Ok ('lo ya subido: ' + $lista.Count + ' mails que ya estan en la nube no se vuelven a subir')
  }
} else { Ok 'lo ya subido: ya estaba' }

# 6) la tarea de Windows: al iniciar sesion (10 minutos despues, para que Outlook ya este abierto) y cada 4 horas
try {
  Copy-Item -LiteralPath (Join-Path $aqui 'subir_mails.ps1') -Destination (Join-Path $estado 'subir_mails.ps1') -Force
  $conhost = Join-Path $env:SystemRoot 'System32\conhost.exe'
  $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $yo = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $accion = New-ScheduledTaskAction -Execute $conhost -Argument ('--headless "' + $ps + '" -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $estado 'subir_mails.ps1') + '"') -WorkingDirectory $estado
  $alEntrar = New-ScheduledTaskTrigger -AtLogOn -User $yo
  $alEntrar.Delay = 'PT10M'
  $cada4 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 4)
  $ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -Priority 6
  $quien = New-ScheduledTaskPrincipal -UserId $yo -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $TAREA -Action $accion -Trigger @($alEntrar, $cada4) -Principal $quien -Settings $ajustes -Force | Out-Null
} catch { Mal ('Windows no dejo registrar la tarea: ' + $_.Exception.Message) }
Ok ('tarea "' + $TAREA + '": al iniciar sesion y cada 4 horas, sin ventana')

# 7) Outlook clasico (los mails se leen de ahi)
if (Get-Process -Name 'OUTLOOK' -ErrorAction SilentlyContinue) { Ok 'Outlook clasico abierto' }
elseif (Get-Process -Name 'olk' -ErrorAction SilentlyContinue) { Ojo 'esta abierto el Outlook NUEVO. Los mails se leen del Outlook CLASICO: mientras se use el nuevo, no suben.' }
else { Ojo 'Outlook esta cerrado. Los mails suben en la proxima pasada con el Outlook clasico abierto.' }
try { Start-ScheduledTask -TaskName $TAREA } catch { }

Write-Host ''
Write-Host '  LISTO. La primera pasada ya arranco en segundo plano (puede tardar unos minutos).' -ForegroundColor Green
Write-Host '  Esta ventana se puede cerrar.'
Write-Host ''
exit 0
