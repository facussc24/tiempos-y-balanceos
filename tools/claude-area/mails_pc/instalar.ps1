# instalar.ps1 - deja andando en ESTA PC la copia de los mails de las cuentas de Calidad a la nube de Ingenieria.
# Caso: la notebook de Calidad que le dieron a Facundo Santoro (08/10/2026): todos los mails de las cuentas de Calidad que
# hay en esa PC tienen que aparecer en su PC de Ingenieria. Es el mismo programa y el mismo filtro de lo privado que usa la
# PC de Carlos (mails_area.mjs), corrido una vez por cada cuenta de Calidad del Outlook (mails_pc.mjs).
#
# Lo lanza Mails-PC-Calidad.cmd (doble clic, sin permisos de administrador). Se puede volver a correr cuando se quiera: no
# repite lo ya subido y deja todo como la primera vez.
# Que hace (y si algo falla antes de copiar, no deja nada a medias):
#   1) encuentra la biblioteca de Ingenieria y la carpeta de mails de la nube (desde donde esta este archivo)
#   2) copia el programa, la lista de lo privado y Node a %LOCALAPPDATA%\BarackMailsPC
#   3) deja la configuracion de ESTA PC (de quien es y que cuentas entran) y mira que cuentas tiene el Outlook
#   4) la tarea de Windows "Barack - mails de Calidad": al iniciar sesion (10 minutos despues) y cada 2 horas, sin ventana
#   5) que el Outlook clasico se abra solo al prender la PC (minimizado): sin el abierto no se puede leer nada
#   6) corre la primera pasada
# Solo ASCII en este archivo (PowerShell 5.1 lee mal las tildes de un archivo sin marca).
param(
  [string]$Raiz = '',
  [string]$Biblioteca = '',   # solo para la prueba
  [switch]$SinTarea,          # solo para la prueba: no registra la tarea ni toca el inicio de Windows
  # Otra PC con otras cuentas (08/10/2026: la PC de Ingenieria de Fak sube SU casilla): que cuentas entran (en vez de las de
  # casillas.json) y como se llama la tarea. Sin esto, es la notebook de Calidad como siempre.
  [string[]]$SoloCasillas = @(),
  [string]$NombreTarea = ''
)
$ErrorActionPreference = 'Stop'
$aqui = $PSScriptRoot
if (-not $Raiz) { $Raiz = Join-Path $env:LOCALAPPDATA 'BarackMailsPC' }
$TAREA = 'Barack - mails de Calidad'
if ($NombreTarea) { $TAREA = $NombreTarea }

function Ok([string]$t) { Write-Host ('  OK   ' + $t) -ForegroundColor Green }
function Ojo([string]$t) { Write-Host ('  OJO  ' + $t) -ForegroundColor Yellow }
function Mal([string]$t) {
  Write-Host ''
  Write-Host ('  NO SE PUDO: ' + $t) -ForegroundColor Red
  Write-Host '  No hace falta copiar nada: avisale a Ingenieria que esta ventana dice esto.'
  Write-Host ''
  exit 1
}
function Leer-Json([string]$p) {
  try { return (Get-Content -LiteralPath $p -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop) } catch { return $null }
}
function Escribir-Texto([string]$ruta, [string]$texto) {
  [System.IO.File]::WriteAllText($ruta, $texto, (New-Object System.Text.UTF8Encoding $false))
}

Write-Host ''
if ($SoloCasillas.Count -gt 0) { Write-Host ('  MAILS DE ' + ($SoloCasillas -join ', ') + ' A LA NUBE DE INGENIERIA') -ForegroundColor Cyan } else { Write-Host '  MAILS DE CALIDAD A LA NUBE DE INGENIERIA' -ForegroundColor Cyan }
Write-Host ''

# 1) la biblioteca de Ingenieria: la que contiene este archivo (o la de la carpeta del usuario)
$bib = $null
if ($Biblioteca) { $bib = $Biblioteca }
else {
  $d = $aqui
  while ($d) {
    if ((Split-Path -Leaf $d) -like 'Ingenier*a y Proyecto - General') { $bib = $d; break }
    $padre = Split-Path -Parent $d
    if (-not $padre -or $padre -eq $d) { break }
    $d = $padre
  }
  if (-not $bib) {
    $org = Join-Path $env:USERPROFILE 'BARACK ARGENTINA SRL'
    foreach ($b in @(Get-ChildItem -LiteralPath $org -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'Ingenier*a y Proyecto - General' })) { $bib = $b.FullName; break }
  }
}
if (-not $bib -or -not (Test-Path -LiteralPath $bib -PathType Container)) { Mal 'no encuentro en esta PC la biblioteca de Ingenieria. Tiene que estar sincronizada (en el Explorador: BARACK ARGENTINA SRL > Ingenieria y Proyecto - General).' }

# la carpeta de mails: la que tiene "mails\_entrada" (si hay mas de una, la que no esta en cuarentena)
$candidatas = @()
foreach ($d in @(Get-ChildItem -LiteralPath $bib -Directory -ErrorAction SilentlyContinue)) {
  $m = Join-Path $d.FullName 'mails'
  if (Test-Path -LiteralPath (Join-Path $m '_entrada') -PathType Container) { $candidatas += $m }
}
$destino = $null
if ($candidatas.Count -gt 0) {
  $sin = @($candidatas | Where-Object { (Split-Path -Leaf (Split-Path -Parent $_)) -notlike '_CUARENTENA_*' })
  if ($sin.Count -ge 1) { $destino = $sin[0] } else { $destino = $candidatas[0] }
}
if (-not $destino) { Mal 'no encuentro en la nube de Ingenieria la carpeta de mails. Revisar que la biblioteca este sincronizada del todo.' }
Ok ('carpeta de la nube: ' + $destino)

# la lista de lo privado publicada (la mas nueva) y el Node del paquete publicado
$privados = $null
$nodeNube = $null
foreach ($d in @(Get-ChildItem -LiteralPath $bib -Directory -ErrorAction SilentlyContinue)) {
  $p = Join-Path $d.FullName '1- PUBLICADO\contenido\conocimiento\comun\mails_privados.json'
  if ((Test-Path -LiteralPath $p) -and ((-not $privados) -or ((Get-Item -LiteralPath $p).LastWriteTime -gt (Get-Item -LiteralPath $privados).LastWriteTime))) { $privados = $p }
  $n = Join-Path $d.FullName '1- PUBLICADO\contenido\marketplace\plugins\barack-area\bin\node.exe'
  if ((-not $nodeNube) -and (Test-Path -LiteralPath $n)) { $nodeNube = $n }
}
if (-not $privados -or -not (Leer-Json $privados)) { Mal 'no encuentro la lista de lo privado en la nube de Ingenieria (sin ella no se copia nada, a proposito).' }

# 2) el programa, la lista de lo privado y Node a esta PC
$programas = Join-Path $Raiz 'programas'
$comun = Join-Path $Raiz 'casa\publicado\conocimiento\comun'
$estado = Join-Path $Raiz 'estado'
try {
  foreach ($d in @($programas, $comun, $estado)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
  foreach ($f in @('mails_pc.mjs', 'mails_area.mjs', 'mails_outlook.ps1')) { Copy-Item -LiteralPath (Join-Path $aqui $f) -Destination (Join-Path $programas $f) -Force }
  Copy-Item -LiteralPath (Join-Path $aqui 'subir.ps1') -Destination (Join-Path $Raiz 'subir.ps1') -Force
  Copy-Item -LiteralPath $privados -Destination (Join-Path $comun 'mails_privados.json') -Force
} catch { Mal ('no pude copiar el programa a ' + $Raiz + ': ' + $_.Exception.Message) }
Ok 'programa y lista de lo privado instalados'

$nodePropio = Join-Path $Raiz 'node\node.exe'
if (-not (Test-Path -LiteralPath $nodePropio)) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $nodePropio) | Out-Null
  if ($nodeNube) {
    try { Copy-Item -LiteralPath $nodeNube -Destination ($nodePropio + '.nuevo') -Force; Move-Item -LiteralPath ($nodePropio + '.nuevo') -Destination $nodePropio -Force } catch { }
  }
}
if (Test-Path -LiteralPath $nodePropio) { $node = $nodePropio; Ok 'Node' }
else {
  $c = Get-Command node -ErrorAction SilentlyContinue
  if ($c) { $node = $c.Source; Ok 'Node (el de la PC)' } else { Mal 'no encuentro Node.js para correr el programa (ni en la nube ni en esta PC).' }
}

# 3) la configuracion de ESTA PC
$cas = Leer-Json (Join-Path $aqui 'casillas.json')
$incluir = @('calidad')
$dias = 3650
if ($cas) {
  if ($cas.incluir) { $incluir = @($cas.incluir) }
  if ($cas.dias_atras) { $dias = [int]$cas.dias_atras }
}
if ($SoloCasillas.Count -gt 0) { $incluir = @($SoloCasillas) }
$config = [ordered]@{
  nombre = 'Facundo Santoro'; pc = $env:COMPUTERNAME; usuario = $env:USERNAME; biblioteca = $bib
  incluir = $incluir; dias_atras = $dias; gracia_horas = 0; instalada = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')
}
try { Escribir-Texto (Join-Path $estado 'config.json') ($config | ConvertTo-Json -Depth 4) } catch { Mal ('no pude dejar la configuracion: ' + $_.Exception.Message) }
Ok ('configuracion: PC ' + $env:COMPUTERNAME + ', usuario ' + $env:USERNAME)

# el Outlook: que este el clasico, y que cuentas tiene (sin leer ningun mail)
$hayClasico = Test-Path -LiteralPath 'Registry::HKEY_CLASSES_ROOT\Outlook.Application'
$clasicoAbierto = @(Get-Process -Name 'OUTLOOK' -ErrorAction SilentlyContinue).Count -gt 0
$nuevoAbierto = @(Get-Process -Name 'olk' -ErrorAction SilentlyContinue).Count -gt 0

function Correr-Programa([string[]]$argumentos, [int]$segundos) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node
  $psi.Arguments = (($argumentos | ForEach-Object { '"' + $_ + '"' }) -join ' ')
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.StandardOutputEncoding = New-Object System.Text.UTF8Encoding $false
  $psi.WorkingDirectory = $Raiz
  $ultimo = ''
  $codigo = -1
  try {
    $p = [System.Diagnostics.Process]::Start($psi)
    $lectura = $p.StandardOutput.ReadToEndAsync()
    $errores = $p.StandardError.ReadToEndAsync()
    if (-not $p.WaitForExit($segundos * 1000)) { try { $p.Kill() } catch { }; [void]$p.WaitForExit(10000) }
    $codigo = $p.ExitCode
    $ultimo = (($lectura.Result -split '\r?\n') | Where-Object { $_.Trim() } | Select-Object -Last 1)
  } catch { $ultimo = 'no pude correr el programa: ' + $_.Exception.Message }
  return @{ codigo = $codigo; ultimo = $ultimo }
}

function Dejar-Salud($codigo, $resultado) {
  try {
    $salud = [ordered]@{ pc = $env:COMPUTERNAME; escrito = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'); codigo = $codigo; resultado = $resultado; instalador = $true }
    $carpetaSalud = Join-Path $destino '_salud'
    if (-not (Test-Path -LiteralPath $carpetaSalud)) { New-Item -ItemType Directory -Path $carpetaSalud -Force | Out-Null }
    Escribir-Texto (Join-Path $carpetaSalud ($env:COMPUTERNAME + '.json')) ($salud | ConvertTo-Json -Depth 6)
  } catch { }
}

Write-Host ''
Write-Host '  Mirando que cuentas tiene el Outlook (no se lee ningun mail)...'
$inv = Correr-Programa @((Join-Path $programas 'mails_pc.mjs'), '--raiz', $Raiz, '--carpeta-mails', $destino, '--inventario') 240
$res = $null
try { $res = $inv.ultimo | ConvertFrom-Json -ErrorAction Stop } catch { $res = $null }
if ($null -eq $res) { $res = [string]$inv.ultimo }
Dejar-Salud $inv.codigo $res

$MOTIVO = @{
  sin_casilla = 'no pude saber su casilla'; carpeta_publica = 'es una carpeta publica'; otro_dominio = 'no es una cuenta de la empresa'
  no_es_de_calidad = 'no es una cuenta de Calidad'; privada = 'es de lo privado'; excluida = 'Ingenieria la saco'; repetida = 'esta repetida'
}
$suben = @()
$problema = $null
if ($res -is [string]) { $problema = 'el programa no contesto como debia: ' + $res }
elseif ($res.resultado -eq 'inventario') {
  $suben = @($res.suben)
  Write-Host ''
  foreach ($c in $suben) { Write-Host ('    SE COPIA     ' + $c) -ForegroundColor Green }
  foreach ($o in @($res.omitidas)) {
    $que = $o.casilla
    if (-not $que) { $que = '(' + $o.nombre + ')' }
    $porque = $MOTIVO[[string]$o.motivo]
    Write-Host ('    no se copia  ' + $que + ' - ' + $porque) -ForegroundColor DarkGray
  }
  if ($suben.Count -eq 0) {
    if ($SoloCasillas.Count -gt 0) { $problema = 'ninguna de las cuentas de este Outlook es ' + ($SoloCasillas -join ', ') } else { $problema = 'ninguna de las cuentas de este Outlook es de Calidad' }
  }
}
elseif ($res.resultado -eq 'outlook_cerrado') { $problema = 'el Outlook clasico esta cerrado: abrilo y volve a correr este archivo' }
elseif ($res.resultado -eq 'outlook_nuevo') { $problema = 'esta abierto el Outlook NUEVO y los mails se leen del CLASICO: en el Outlook nuevo, arriba a la derecha, apaga el interruptor "Nuevo Outlook" para pasar al clasico' }
elseif ($res.resultado -eq 'sin_outlook') { $problema = 'esta PC no tiene el Outlook clasico instalado' }
elseif ($res.resultado -eq 'outlook_no_responde') { $problema = 'el Outlook esta abierto pero no contesta (puede haber un cartel en la pantalla): cerralo, abrilo de nuevo y corre este archivo otra vez' }
else { $problema = 'no pude mirar las cuentas (' + $res.resultado + '): ' + $res.detalle }

# 4) la tarea de Windows: al iniciar sesion (10 minutos despues, para que Outlook ya este abierto) y cada 2 horas
if (-not $SinTarea) {
  try {
    $conhost = Join-Path $env:SystemRoot 'System32\conhost.exe'
    $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $yo = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $accion = New-ScheduledTaskAction -Execute $conhost -Argument ('--headless "' + $ps + '" -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $Raiz 'subir.ps1') + '"') -WorkingDirectory $Raiz
    $alEntrar = New-ScheduledTaskTrigger -AtLogOn -User $yo
    $alEntrar.Delay = 'PT10M'
    $cada2 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 2)
    $ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 40) -Priority 6
    $quien = New-ScheduledTaskPrincipal -UserId $yo -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TAREA -Action $accion -Trigger @($alEntrar, $cada2) -Principal $quien -Settings $ajustes -Force | Out-Null
  } catch { Mal ('Windows no dejo registrar la tarea: ' + $_.Exception.Message) }
  Ok ('tarea "' + $TAREA + '": al iniciar sesion y cada 2 horas, sin ventana')

  # 5) el Outlook clasico se abre solo al prender la PC, minimizado (si no, no hay de donde leer)
  try {
    $exe = $null
    foreach ($p in @((Join-Path $env:ProgramFiles 'Microsoft Office\root\Office16\OUTLOOK.EXE'), (Join-Path ${env:ProgramFiles(x86)} 'Microsoft Office\root\Office16\OUTLOOK.EXE'))) { if ($p -and (Test-Path -LiteralPath $p)) { $exe = $p; break } }
    if (-not $exe) { try { $exe = [string](Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\OUTLOOK.EXE' -ErrorAction Stop).'(default)' } catch { $exe = $null } }
    if ($exe -and (Test-Path -LiteralPath $exe)) {
      $inicio = [Environment]::GetFolderPath('Startup')
      $ya = $false
      $sh = New-Object -ComObject WScript.Shell
      foreach ($l in @(Get-ChildItem -LiteralPath $inicio -Filter '*.lnk' -ErrorAction SilentlyContinue)) { try { if ($sh.CreateShortcut($l.FullName).TargetPath -like '*OUTLOOK.EXE') { $ya = $true } } catch { } }
      if ($ya) { Ok 'el Outlook clasico ya se abre solo al prender la PC' }
      else {
        $a = $sh.CreateShortcut((Join-Path $inicio 'Outlook clasico (mails de Calidad).lnk'))
        $a.TargetPath = $exe
        $a.WindowStyle = 7
        $a.Save()
        Ok 'el Outlook clasico se va a abrir solo al prender la PC (minimizado)'
      }
    } else { Ojo 'no encontre el Outlook clasico para dejarlo abriendose solo' }
  } catch { Ojo ('no pude dejar el Outlook abriendose solo: ' + $_.Exception.Message) }
}

# 6) la primera pasada
if (-not $SinTarea) { try { Start-ScheduledTask -TaskName $TAREA } catch { } }

Write-Host ''
if ($problema) {
  Write-Host '  TODAVIA NO COPIA NADA.' -ForegroundColor Yellow
  Write-Host ('  Motivo: ' + $problema) -ForegroundColor Yellow
  Write-Host '  Lo que falta ya queda instalado: cuando se arregle eso, empieza solo (o volve a correr este archivo).'
  Write-Host '  No hace falta copiar nada: el resultado ya quedo en la nube de Ingenieria.'
  Write-Host ''
  exit 2
}
Write-Host '  LISTO. La primera pasada ya arranco en segundo plano.' -ForegroundColor Green
Write-Host '  Trae primero lo mas nuevo y sigue con lo viejo cada 2 horas, hasta tener todo (puede llevar un par de dias).'
Write-Host '  Mientras tanto, el Outlook clasico tiene que estar abierto. Esta ventana se puede cerrar.'
Write-Host ''
exit 0
