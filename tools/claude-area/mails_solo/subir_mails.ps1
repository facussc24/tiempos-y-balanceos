# subir_mails.ps1 - la tarea de Windows "Barack - mails de <persona>": sube a la nube de Ingenieria los mails de trabajo
# de ESTA PC y nada mas. Es el paso 5 de la tarea del asistente por area (sync_area.ps1) corrido solo, para una PC que
# quedo sin el asistente pero sigue compartiendo sus mails (Carlos, 07/10/2026: la "actualizacion limpia" saco la tarea
# completa y Fak quiere seguir recibiendo sus mails).
#
# Corre el MISMO programa y el MISMO filtro de lo privado (mails_area.mjs con las listas instaladas en la PC): sube solo si
# la lista de personas dice "mails": "sube" para esta persona en esta PC, y lo de Direccion y RRHH no sale nunca.
# Lee el Outlook CLASICO abierto (solo lectura). Si esta el nuevo, o esta cerrado, no sube y lo intenta en la proxima pasada.
#
# Este camino no tiene la firma del paquete publicado, asi que de las listas publicadas en la nube toma SOLO lo que apaga o
# endurece: si la fila de esta PC ya no dice "sube", se apaga (y la persona recibe su aviso); la lista de lo privado se
# toma solo si tiene todo lo de la instalada. Prender de nuevo o aflojar el filtro es volver a correr el instalador.
#
# Deja: <aca>\mails.log (un renglon por pasada) y <carpeta de mails>\_salud\<PC>.json (el resultado y las cuentas, sin
# ningun mail adentro), para que desde Ingenieria se vea si anda.
param([string]$Casa = 'C:\ClaudeBarack')   # -Casa solo para la prueba en una carpeta de mentira
$ErrorActionPreference = 'SilentlyContinue'
$estado = $PSScriptRoot
$casa = $Casa
$programa = Join-Path $casa 'publicado\programas\mails_area.mjs'
$comun = Join-Path $casa 'publicado\conocimiento\comun'
$log = Join-Path $estado 'mails.log'

function Log([string]$t) {
  try {
    if ((Test-Path -LiteralPath $log) -and ((Get-Item -LiteralPath $log).Length -gt 200KB)) { Move-Item -LiteralPath $log -Destination ($log + '.anterior') -Force }
    Add-Content -LiteralPath $log -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ' + $t) -Encoding UTF8
  } catch { }
}
function Leer-Json([string]$p) {
  try { return (Get-Content -LiteralPath $p -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop) } catch { return $null }
}
# El resultado, a la nube (sin ningun mail: el resultado, las cuentas y el detalle)
function Dejar-Salud([string]$destino, $codigo, $resultado) {
  try {
    $salud = [ordered]@{ pc = $env:COMPUTERNAME; escrito = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'); codigo = $codigo; resultado = $resultado }
    $carpetaSalud = Join-Path $destino '_salud'
    if (-not (Test-Path -LiteralPath $carpetaSalud)) { New-Item -ItemType Directory -Path $carpetaSalud -Force | Out-Null }
    [System.IO.File]::WriteAllText((Join-Path $carpetaSalud ($env:COMPUTERNAME + '.json')), ($salud | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding $false))
  } catch { Log ('no pude dejar la salud en la nube: ' + $_.Exception.Message) }
}

# Node: el propio de esta carpeta; si no esta, el del asistente; si no, el de la PC
$node = Join-Path $estado 'node\node.exe'
if (-not (Test-Path -LiteralPath $node)) { $node = Join-Path $env:LOCALAPPDATA 'BarackEquipo\node\node.exe' }
if (-not (Test-Path -LiteralPath $node)) {
  $c = Get-Command node -ErrorAction SilentlyContinue
  if ($c) { $node = $c.Source } else { Log 'sin Node: no subo nada'; exit 0 }
}
if (-not (Test-Path -LiteralPath $programa)) { Log ('no esta el programa de mails: ' + $programa); exit 0 }

# La carpeta de mails de la biblioteca de Ingenieria: la de siempre, se llame "Claude Barack" o "_CUARENTENA_Claude Barack"
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
if (-not $destino) { Log 'sin nube: no veo la carpeta de mails de la biblioteca de Ingenieria (se reintenta)'; exit 0 }

# Si volvio la tarea del asistente y ve su carpeta de la nube, los mails los sube ella: dos tareas subirian dos veces
if ((Get-ScheduledTask -TaskName 'Barack - Claude por area' -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath (Join-Path $bib 'CLAUDE POR AREA') -PathType Container)) {
  Log 'la tarea del asistente esta de vuelta y ve su carpeta: los mails los sube ella, esta no'
  Dejar-Salud $destino 0 @{ resultado = 'lo_sube_el_asistente' }
  exit 0
}

# Las listas publicadas: solo lo que apaga o endurece
$comunNube = $null
foreach ($raiz in @('CLAUDE POR AREA', '_CUARENTENA_CLAUDE POR AREA')) {
  $cn = Join-Path $bib ($raiz + '\1- PUBLICADO\contenido\conocimiento\comun')
  if (Test-Path -LiteralPath $cn -PathType Container) { $comunNube = $cn; break }
}
if ($comunNube) {
  $pNube = Join-Path $comunNube 'personas.json'
  $pn = Leer-Json $pNube
  # solo con la lista publicada leida entera (una lectura cortada no apaga nada)
  if ($pn -and $pn.personas) {
    $filas = @($pn.personas | Where-Object { $_.pc -eq $env:COMPUTERNAME -and -not $_.baja })
    if ($filas.Count -ne 1 -or $filas[0].mails -ne 'sube') {
      try {
        Copy-Item -LiteralPath $pNube -Destination (Join-Path $comun 'personas.json') -Force -ErrorAction Stop
        Log 'la lista publicada ya no dice que esta PC sube sus mails: tomada (se apaga)'
      } catch { Log ('no pude tomar la lista publicada de personas: ' + $_.Exception.Message) }
    }
  }
  $vNube = Join-Path $comunNube 'mails_privados.json'
  $vLocal = Join-Path $comun 'mails_privados.json'
  if ((Test-Path -LiteralPath $vNube) -and (Test-Path -LiteralPath $vLocal) -and ((Get-FileHash -LiteralPath $vNube).Hash -ne (Get-FileHash -LiteralPath $vLocal).Hash)) {
    $vn = Leer-Json $vNube
    $vl = Leer-Json $vLocal
    $tieneTodo = ($null -ne $vn) -and ($null -ne $vl)
    if ($tieneTodo) {
      foreach ($k in @('direcciones', 'dominios', 'nombres', 'apellidos', 'palabras_extra')) {
        $enNube = @(@($vn.$k) | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() })
        foreach ($x in @($vl.$k)) { if ($null -ne $x -and ($enNube -notcontains ([string]$x).Trim().ToLowerInvariant())) { $tieneTodo = $false } }
      }
    }
    if ($tieneTodo) {
      try { Copy-Item -LiteralPath $vNube -Destination $vLocal -Force -ErrorAction Stop; Log 'lista de lo privado: tomada la publicada (tiene todo lo de antes)' } catch { Log ('no pude tomar la lista publicada de lo privado: ' + $_.Exception.Message) }
    } else { Log 'lista de lo privado: la publicada no tiene todo lo de esta PC; sigo con la instalada' }
  }
}

# La corrida (el programa corta solo a los 10 minutos; lo que falta sigue en la proxima; esta tarea lo corta a los 15)
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $node
$psi.Arguments = '"' + $programa + '" --home "' + $casa + '" --carpeta-mails "' + $destino + '" --estado "' + $estado + '" --max-minutos 10'
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.StandardOutputEncoding = New-Object System.Text.UTF8Encoding $false
$psi.WorkingDirectory = $estado
$ultimo = ''
$codigo = -1
try {
  $p = [System.Diagnostics.Process]::Start($psi)
  $lectura = $p.StandardOutput.ReadToEndAsync()
  $errores = $p.StandardError.ReadToEndAsync()
  if (-not $p.WaitForExit(15 * 60 * 1000)) { try { $p.Kill() } catch { }; [void]$p.WaitForExit(10000); Log 'el programa paso de 15 minutos y lo corte' }
  $codigo = $p.ExitCode
  $ultimo = (($lectura.Result -split '\r?\n') | Where-Object { $_.Trim() } | Select-Object -Last 1)
} catch { $ultimo = 'no pude correr el programa: ' + $_.Exception.Message }
Log ('codigo ' + $codigo + ' ' + $ultimo)

$res = $null
try { $res = $ultimo | ConvertFrom-Json -ErrorAction Stop } catch { $res = $null }
if ($null -eq $res) { $res = [string]$ultimo }
Dejar-Salud $destino $codigo $res
exit 0
