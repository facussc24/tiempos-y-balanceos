<#
.SYNOPSIS
  Instala en esta PC la base de Claude de Ingenieria de Barack Mercosul (lo corre el companero con
  doble click en Instalar.cmd, desde el pendrive). No hace falta ser administrador.

  1) Pide nombre y apellido y sector (una ventanita) y los guarda: con eso se identifican sus aportes.
  2) Elige la carpeta: C:\Dev\BarackMercosul si ya existe, si no crea C:\Dev\BarackIngenieria.
  3) Copia la base del pendrive SIN PISAR nada de lo que ya tenga (usa la misma logica que la
     actualizacion por la nube: `_paquete.mjs --actualizar`; nunca borra).
  4) Agrega la linea @CLAUDE.equipo.md al CLAUDE.md de la carpeta (lo crea si no existe; no borra nada).
  5) Revisa Node, Python y pywin32 y avisa si falta alguno.
  6) Deja UNA tarea de Windows, "Barack - Base Claude y mails": al iniciar sesion y cada 4 h, sin
     ventana (conhost --headless), prioridad baja, tambien a bateria, tope de 30 min y una sola
     corrida a la vez. Corre tools\paquete-equipo\sync_equipo.ps1.

  Parametros (para probar):
    -Destino <carpeta>   instala ahi en vez de elegir sola
    -Nombre / -Sector    saltean la ventanita
    -Base <carpeta>      carpeta Base del pendrive (por defecto, la que esta junto a este script)
    -EstadoDir <carpeta> donde se guarda el perfil y el log (por defecto %LOCALAPPDATA%\BarackEquipo)
    -SinTareas           no registra la tarea de Windows
    -VerTarea            muestra como quedaria la tarea y sale (no registra nada)
    -NoArrancar          no arranca la tarea al final
    -SinChequeos         salta los avisos de Python, pywin32, Claude Code y restos del intento anterior

  Solo ASCII en este archivo (powershell.exe 5.1 sin BOM lee UTF-8 como ANSI).
#>
[CmdletBinding()]
param(
  [string]$Destino,
  [string]$Nombre,
  [string]$Sector,
  [string]$Base,
  [string]$EstadoDir,
  [switch]$SinTareas,
  [switch]$VerTarea,
  [switch]$NoArrancar,
  [switch]$SinChequeos
)
$ErrorActionPreference = 'Stop'
$TAREA = 'Barack - Base Claude y mails'
$TAREA_VIEJA = 'Claude Barack - sync'
if (-not $Base) { $Base = Join-Path $PSScriptRoot 'Base' }
if (-not $EstadoDir) { $EstadoDir = Join-Path $env:LOCALAPPDATA 'BarackEquipo' }
$avisos = New-Object System.Collections.ArrayList

# ---- ayudas -------------------------------------------------------------------------------------
function Plano([string]$t) {
  # Para mostrar en consola: sin tildes ni simbolos raros (cmd no los dibuja bien).
  if (-not $t) { return '' }
  $n = $t.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($c in $n.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -eq 'NonSpacingMark') { continue }
    if ([int]$c -ge 32 -and [int]$c -lt 127) { [void]$sb.Append($c) }
    elseif ($c -eq "`r" -or $c -eq "`n" -or $c -eq "`t") { [void]$sb.Append($c) }
  }
  return $sb.ToString()
}
function Decir([string]$m) { Write-Host $m }
function Aviso([string]$m) { [void]$avisos.Add($m); Write-Host "AVISO: $m" -ForegroundColor Yellow }
function Parar([string]$m) {
  Write-Host ''
  Write-Host "NO SE INSTALO: $m" -ForegroundColor Red
  exit 1
}
function Correr([string]$exe, [string[]]$argumentos, [int]$minutos = 10) {
  $r = @{ Codigo = -1; Salida = '' }
  try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.Arguments = ($argumentos | ForEach-Object { if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ } }) -join ' '
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [Text.Encoding]::UTF8
    $psi.CreateNoWindow = $true
    $psi.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'
    $p = [System.Diagnostics.Process]::Start($psi)
    $so = $p.StandardOutput.ReadToEndAsync()
    $se = $p.StandardError.ReadToEndAsync()
    if (-not $p.WaitForExit($minutos * 60 * 1000)) { try { $p.Kill() } catch {}; $r.Salida = "paso de $minutos min"; return $r }
    $p.WaitForExit()
    $r.Codigo = $p.ExitCode
    $r.Salida = ($so.Result + $se.Result).Trim()
  } catch { $r.Salida = "no arranco: $($_.Exception.Message)" }
  return $r
}
function Buscar-Exe([string]$nombre, [string]$prueba) {
  # Python de la Microsoft Store (WindowsApps) es un atajo que abre la tienda: se descarta.
  $cands = @(Get-Command $nombre -All -ErrorAction SilentlyContinue | Where-Object { $_.Source -and ($_.Source -notmatch 'WindowsApps') })
  foreach ($c in $cands) {
    $t = Correr $c.Source @($prueba) 3
    if ($t.Codigo -eq 0) { return $c.Source }
  }
  return $null
}
function Escribir-Utf8([string]$ruta, [string]$texto) {
  $dir = Split-Path -Parent $ruta
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [IO.File]::WriteAllText($ruta, $texto, (New-Object System.Text.UTF8Encoding($false)))
}

function Nueva-Definicion {
  $conhost = Join-Path $env:SystemRoot 'System32\conhost.exe'
  $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $sync = Join-Path $Destino 'tools\paquete-equipo\sync_equipo.ps1'
  $yo = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  # pythonw/powershell lanzados directo por el Programador de tareas se traban o muestran ventana en
  # estas PC: lo que anda, sin ventana, es conhost --headless <programa> <argumentos>.
  $argTarea = '--headless "' + $ps + '" -NoProfile -ExecutionPolicy Bypass -File "' + $sync + '" -Destino "' + $Destino + '"'
  $accion = New-ScheduledTaskAction -Execute $conhost -Argument $argTarea -WorkingDirectory $Destino
  $alEntrar = New-ScheduledTaskTrigger -AtLogOn -User $yo
  $cada4 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(10) -RepetitionInterval (New-TimeSpan -Hours 4)
  $ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
               -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -Priority 6
  $quien = New-ScheduledTaskPrincipal -UserId $yo -LogonType Interactive -RunLevel Limited
  return @{ Accion = $accion; Triggers = @($alEntrar, $cada4); Ajustes = $ajustes; Principal = $quien; Usuario = $yo }
}

Decir ''
Decir '=== Base de Claude - Ingenieria Barack Mercosul ==='

# ---- 1) carpeta destino -------------------------------------------------------------------------
if (-not $Destino) {
  if (Test-Path 'C:\Dev\BarackMercosul') { $Destino = 'C:\Dev\BarackMercosul' } else { $Destino = 'C:\Dev\BarackIngenieria' }
}
$Destino = $Destino.TrimEnd('\')

if ($VerTarea) {
  $def = Nueva-Definicion
  Decir ''
  Decir "Tarea '$TAREA' (con -VerTarea no se instala ni se registra nada):"
  Decir "  Programa : $($def.Accion.Execute)"
  Decir "  Argumentos: $($def.Accion.Arguments)"
  Decir "  Disparadores: al iniciar sesion de $($def.Usuario) + cada $($def.Triggers[1].Repetition.Interval)"
  Decir "  Prioridad: $($def.Ajustes.Priority)  Bateria: permitido=$(-not $def.Ajustes.DisallowStartIfOnBatteries) sigue=$(-not $def.Ajustes.StopIfGoingOnBatteries)"
  Decir "  Tope: $($def.Ajustes.ExecutionTimeLimit)  Instancias multiples: $($def.Ajustes.MultipleInstances)"
  Decir "  Inicio de sesion: $($def.Principal.LogonType)  Nivel: $($def.Principal.RunLevel)"
  exit 0
}

if ((Test-Path (Join-Path $Destino 'scripts\_lib\paquete.data.json')) -and -not (Test-Path (Join-Path $Destino '.claude\.paquete-instalado.json'))) {
  Parar "$Destino es la copia COMPLETA del repositorio de Fak (la PC de origen): ahi la base no se instala desde un pendrive."
}
Decir "Carpeta: $Destino"

# ---- 2) el pendrive trae la base ----------------------------------------------------------------
if (-not (Test-Path (Join-Path $Base 'VERSION.json'))) { Parar "no encuentro la carpeta Base del pendrive (busque en $Base). Deja Instalar.cmd junto a la carpeta Base." }
$paqueteBase = Join-Path $Base 'contenido\scripts\_paquete.mjs'
if (-not (Test-Path $paqueteBase)) { Parar "la carpeta Base esta incompleta: falta $paqueteBase" }

# ---- 3) programas que hacen falta ---------------------------------------------------------------
$node = Buscar-Exe 'node' '--version'
if (-not $node) { Parar 'falta Node.js (se baja de nodejs.org). Instalalo y volve a hacer doble click en Instalar. Si no sabes como, avisale a Fak.' }
$python = $null
if ($SinChequeos) {
  Decir '(-SinChequeos: no reviso Python, pywin32, Claude Code ni restos del intento anterior)'
} else {
  $python = Buscar-Exe 'python' '--version'
  if (-not $python) {
    Aviso 'falta Python 3: la base se instala igual, pero los scripts del arb y la sincronizacion de mails no van a andar hasta instalarlo.'
  } else {
    $t = Correr $python @('-c', 'import win32com.client') 3
    if ($t.Codigo -ne 0) { Aviso 'a Python le falta pywin32 (python -m pip install pywin32): sin eso no se puede leer Outlook ni manejar el arb.' }
  }
  if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { Aviso 'no encuentro el comando "claude" (Claude Code): instalalo para usar la base.' }
  if (Test-Path 'C:\Program Files\ClaudeCode\managed-settings.json') { Aviso 'esta PC tiene una politica vieja de Claude (managed-settings.json, del intento anterior): avisale a Fak, la saca el.' }
  $vieja = Correr 'schtasks.exe' @('/Query', '/TN', $TAREA_VIEJA) 2
  if ($vieja.Codigo -eq 0) { Aviso "esta PC tiene la tarea vieja '$TAREA_VIEJA' (intento anterior): avisale a Fak, no la toco yo." }
}

# ---- 4) quien sos -------------------------------------------------------------------------------
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
function Pedir-Perfil([string]$nombre0, [string]$sector0, [string]$problema) {
  $f = New-Object System.Windows.Forms.Form
  $f.Text = 'Base de Claude - Ingenieria'
  $f.StartPosition = 'CenterScreen'
  $f.FormBorderStyle = 'FixedDialog'
  $f.MaximizeBox = $false
  $f.MinimizeBox = $false
  $f.TopMost = $true
  $f.ClientSize = New-Object System.Drawing.Size(400, 230)
  $l0 = New-Object System.Windows.Forms.Label
  $l0.Text = 'Escribi tu nombre y apellido y tu sector. Se piden una sola vez.'
  $l0.SetBounds(16, 14, 368, 20)
  $l1 = New-Object System.Windows.Forms.Label
  $l1.Text = 'Nombre y apellido (ej: Federico Leonardo Lattanzi)'
  $l1.SetBounds(16, 44, 368, 18)
  $t1 = New-Object System.Windows.Forms.TextBox
  $t1.SetBounds(16, 64, 368, 24)
  $t1.Text = $nombre0
  $l2 = New-Object System.Windows.Forms.Label
  $l2.Text = 'Sector (ej: Ingenieria, Calidad, Compras)'
  $l2.SetBounds(16, 98, 368, 18)
  $t2 = New-Object System.Windows.Forms.TextBox
  $t2.SetBounds(16, 118, 368, 24)
  $t2.Text = $sector0
  $lp = New-Object System.Windows.Forms.Label
  $lp.Text = $problema
  $lp.ForeColor = [System.Drawing.Color]::Firebrick
  $lp.SetBounds(16, 150, 368, 32)
  $ok = New-Object System.Windows.Forms.Button
  $ok.Text = 'Aceptar'
  $ok.SetBounds(214, 190, 84, 28)
  $ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
  $no = New-Object System.Windows.Forms.Button
  $no.Text = 'Cancelar'
  $no.SetBounds(304, 190, 84, 28)
  $no.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
  $f.AcceptButton = $ok
  $f.CancelButton = $no
  $f.Controls.AddRange(@($l0, $l1, $t1, $l2, $t2, $lp, $ok, $no))
  $res = $f.ShowDialog()
  if ($res -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
  return @{ Nombre = $t1.Text.Trim(); Sector = $t2.Text.Trim() }
}
function Validar-Perfil([string]$nombre, [string]$sector) {
  # Devuelve '' si esta bien, o el problema. La validacion de fondo es la de _paquete.mjs --perfil.
  $autor = "$nombre - $sector"
  if ($autor -match '["%&|<>^`$]') { return 'Usa solo letras y espacios, sin comillas ni simbolos.' }
  New-Item -ItemType Directory -Force -Path (Join-Path $Destino '.claude') | Out-Null
  $r = Correr $node @($paqueteBase, '--perfil', $autor, '--destino', $Destino) 1
  if ($r.Codigo -eq 0) { return '' }
  $msg = (Plano $r.Salida) -replace '^\s+', ''
  if (-not $msg) { $msg = 'Nombre o sector invalido.' }
  return $msg
}

$guardado = $null
$pPerfil = Join-Path $EstadoDir 'perfil.json'
if (Test-Path $pPerfil) { try { $guardado = [IO.File]::ReadAllText($pPerfil, [Text.Encoding]::UTF8) | ConvertFrom-Json } catch {} }
$n0 = if ($Nombre) { $Nombre } elseif ($guardado) { $guardado.nombre } else { '' }
$s0 = if ($Sector) { $Sector } elseif ($guardado) { $guardado.sector } else { '' }
$problema = ''
$nombreFinal = $null
$sectorFinal = $null
$interactivo = -not ($Nombre -and $Sector)
for ($intento = 0; $intento -lt 4; $intento++) {
  if ($interactivo -or $problema) {
    $dato = Pedir-Perfil $n0 $s0 $problema
    if (-not $dato) { Parar 'cancelaste la ventana de nombre y sector.' }
    $n0 = $dato.Nombre; $s0 = $dato.Sector
  } else { $n0 = $Nombre; $s0 = $Sector }
  $problema = Validar-Perfil $n0 $s0
  if (-not $problema) { $nombreFinal = $n0; $sectorFinal = $s0; break }
  if (-not $interactivo) { Parar "el nombre o el sector no sirven: $problema" }
  $interactivo = $true
}
if (-not $nombreFinal) { Parar "no pude validar tu nombre y sector: $problema" }
$autor = "$nombreFinal - $sectorFinal"
Decir "Perfil: $autor"
$perfilJson = [ordered]@{ autor = $autor; nombre = $nombreFinal; sector = $sectorFinal; instalado = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'); destino = $Destino }
Escribir-Utf8 $pPerfil (($perfilJson | ConvertTo-Json) + "`r`n")

# ---- 5) copiar la base (sin pisar, sin borrar) --------------------------------------------------
Decir 'Copiando la base...'
$r = Correr $node @($paqueteBase, '--actualizar', '--nube', $Base, '--destino', $Destino) 10
if ($r.Codigo -ne 0) { Parar ("la copia de la base fallo (codigo $($r.Codigo)): " + (Plano $r.Salida)) }
foreach ($ln in ((Plano $r.Salida) -split '\r?\n')) { if ($ln.Trim()) { Decir "  $ln" } }

# ---- 6) CLAUDE.md: agrega la linea, nunca borra -------------------------------------------------
$cm = Join-Path $Destino 'CLAUDE.md'
$linea = '@CLAUDE.equipo.md'
$utf8 = New-Object System.Text.UTF8Encoding($false)
if (-not (Test-Path $cm)) {
  [IO.File]::WriteAllText($cm, ("# Ingenieria - Barack Mercosul`r`n`r`n" + $linea + "`r`n"), $utf8)
  Decir 'CLAUDE.md creado con la linea @CLAUDE.equipo.md'
} else {
  $actual = [IO.File]::ReadAllText($cm, [Text.Encoding]::UTF8)
  if ($actual -match '(?m)^\s*@CLAUDE\.equipo\.md\s*$') {
    Decir 'CLAUDE.md ya tenia la linea @CLAUDE.equipo.md'
  } else {
    $eol = if ($actual.Contains("`r`n")) { "`r`n" } else { "`n" }
    $prefijo = if ($actual.Length -eq 0 -or $actual.EndsWith("`n")) { '' } else { $eol }
    [IO.File]::AppendAllText($cm, ($prefijo + $eol + $linea + $eol), $utf8)
    Decir 'Agregue la linea @CLAUDE.equipo.md al final de tu CLAUDE.md (no toque nada de lo que ya tenia)'
  }
}

# ---- 7) la tarea de Windows ---------------------------------------------------------------------
$tareaOk = $false
if ($SinTareas) {
  Decir "(-SinTareas: no registro la tarea '$TAREA')"
} else {
  try {
    $def = Nueva-Definicion
    Register-ScheduledTask -TaskName $TAREA -Action $def.Accion -Trigger $def.Triggers -Principal $def.Principal -Settings $def.Ajustes -Force | Out-Null
    $t = Get-ScheduledTask -TaskName $TAREA -ErrorAction Stop
    $bien = ($t.Settings.Priority -eq 6) -and (-not $t.Settings.DisallowStartIfOnBatteries) -and (-not $t.Settings.StopIfGoingOnBatteries) -and ([string]$t.Settings.MultipleInstances -eq 'IgnoreNew')
    if (-not $bien) { Aviso "la tarea '$TAREA' quedo registrada pero con ajustes distintos a los pedidos: avisale a Fak." }
    $tareaOk = $true
    Decir "Tarea '$TAREA' registrada: al iniciar sesion y cada 4 horas, sin ventana."
  } catch {
    Aviso "no pude crear la tarea '$TAREA' ($($_.Exception.Message)): la base quedo instalada, pero no se va a actualizar sola. Avisale a Fak."
  }
}

# ---- 8) rastro y cierre -------------------------------------------------------------------------
$inst = [ordered]@{
  fecha = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'); destino = $Destino; autor = $autor; base = $Base
  node = $node; python = $python; tarea = $(if ($tareaOk) { $TAREA } else { '' }); avisos = @($avisos)
}
Escribir-Utf8 (Join-Path $EstadoDir 'instalado.json') (($inst | ConvertTo-Json) + "`r`n")

if ($tareaOk -and -not $NoArrancar) {
  $antes = Get-Date
  try { Start-ScheduledTask -TaskName $TAREA } catch {}
  $corrio = $false
  $log = Join-Path $EstadoDir 'sync.log'
  for ($i = 0; $i -lt 30 -and -not $corrio; $i++) {
    Start-Sleep -Seconds 2
    if ((Test-Path $log) -and ((Get-Item $log).LastWriteTime -gt $antes)) { $corrio = $true }
  }
  if ($corrio) { Decir 'Probe la tarea: arranca sola y en segundo plano.' }
  else { Aviso 'la tarea no dejo rastro en un minuto (puede estar esperando a que termine de cargar la PC). Si en un dia no hay novedades, avisale a Fak.' }
}

Decir ''
Decir "LISTO. Abri Claude Code en la carpeta: $Destino"
if ($avisos.Count -gt 0) { Decir ''; Decir "Quedaron $($avisos.Count) aviso(s) arriba: mandaselos a Fak." }
exit 0
