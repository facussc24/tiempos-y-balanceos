# subir.ps1 - la tarea de Windows "Barack - mails de Calidad": sube a la nube de Ingenieria los mails de las cuentas de
# Calidad que tiene el Outlook de ESTA PC, y nada mas. Lo instala instalar.ps1 en %LOCALAPPDATA%\BarackMailsPC.
#
# Corre el MISMO programa y el MISMO filtro de lo privado que la PC de Carlos (mails_area.mjs), una vez por cuenta
# (mails_pc.mjs). Lee el Outlook CLASICO abierto (solo lectura). Si esta el nuevo, o esta cerrado, no sube y lo intenta
# en la proxima pasada.
#
# De la nube toma SOLO lo que apaga o endurece: el archivo <mails>\_control\<PC>.json lo lee el programa (solo puede apagar
# o sacar cuentas) y la lista de lo privado publicada se toma solo si tiene todo lo de la instalada.
#
# Deja: <aca>\mails.log (un renglon por pasada) y <carpeta de mails>\_salud\<PC>.json (el resultado y las cuentas, sin
# ningun mail adentro), para que desde Ingenieria se vea si anda.
# Solo ASCII en este archivo.
$ErrorActionPreference = 'SilentlyContinue'
$raiz = $PSScriptRoot
$node = Join-Path $raiz 'node\node.exe'
$programa = Join-Path $raiz 'programas\mails_pc.mjs'
$comun = Join-Path $raiz 'casa\publicado\conocimiento\comun'
$log = Join-Path $raiz 'mails.log'

function Log([string]$t) {
  try {
    if ((Test-Path -LiteralPath $log) -and ((Get-Item -LiteralPath $log).Length -gt 200KB)) { Move-Item -LiteralPath $log -Destination ($log + '.anterior') -Force }
    Add-Content -LiteralPath $log -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ' + $t) -Encoding UTF8
  } catch { }
}
function Leer-Json([string]$p) {
  try { return (Get-Content -LiteralPath $p -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop) } catch { return $null }
}
function Dejar-Salud([string]$destino, $codigo, $resultado) {
  try {
    $salud = [ordered]@{ pc = $env:COMPUTERNAME; escrito = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'); codigo = $codigo; resultado = $resultado }
    $carpetaSalud = Join-Path $destino '_salud'
    if (-not (Test-Path -LiteralPath $carpetaSalud)) { New-Item -ItemType Directory -Path $carpetaSalud -Force | Out-Null }
    [System.IO.File]::WriteAllText((Join-Path $carpetaSalud ($env:COMPUTERNAME + '.json')), ($salud | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding $false))
  } catch { Log ('no pude dejar la salud en la nube: ' + $_.Exception.Message) }
}

if (-not (Test-Path -LiteralPath $node)) {
  $c = Get-Command node -ErrorAction SilentlyContinue
  if ($c) { $node = $c.Source } else { Log 'sin Node: no subo nada'; exit 0 }
}
if (-not (Test-Path -LiteralPath $programa)) { Log ('no esta el programa de mails: ' + $programa); exit 0 }

# La biblioteca de Ingenieria y su carpeta de mails (la que tiene "mails\_entrada"; si hay dos, la que no esta en cuarentena).
# La que vio el instalador (config.json); si ya no esta ahi, la de la carpeta del usuario.
$bib = $null
$cfg = Leer-Json (Join-Path $raiz 'estado\config.json')
if ($cfg -and $cfg.biblioteca -and (Test-Path -LiteralPath ([string]$cfg.biblioteca) -PathType Container)) { $bib = [string]$cfg.biblioteca }
if (-not $bib) {
  $org = Join-Path $env:USERPROFILE 'BARACK ARGENTINA SRL'
  foreach ($b in @(Get-ChildItem -LiteralPath $org -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'Ingenier*a y Proyecto - General' })) { $bib = $b.FullName; break }
}
if (-not $bib) { Log 'sin nube: no veo la biblioteca de Ingenieria (se reintenta)'; exit 0 }
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
if (-not $destino) { Log 'sin nube: no veo la carpeta de mails (se reintenta)'; exit 0 }

# La lista de lo privado publicada: solo si tiene todo lo de la instalada (puede agregar gente, nunca sacar)
$vLocal = Join-Path $comun 'mails_privados.json'
foreach ($d in @(Get-ChildItem -LiteralPath $bib -Directory -ErrorAction SilentlyContinue)) {
  $vNube = Join-Path $d.FullName '1- PUBLICADO\contenido\conocimiento\comun\mails_privados.json'
  if (-not (Test-Path -LiteralPath $vNube)) { continue }
  if ((Test-Path -LiteralPath $vLocal) -and ((Get-FileHash -LiteralPath $vNube).Hash -ne (Get-FileHash -LiteralPath $vLocal).Hash)) {
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
  break
}

# La corrida (el programa reparte 20 minutos entre las cuentas; esta tarea la corta a los 30)
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $node
$psi.Arguments = '"' + $programa + '" --raiz "' + $raiz + '" --carpeta-mails "' + $destino + '" --max-minutos 20'
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.StandardOutputEncoding = New-Object System.Text.UTF8Encoding $false
$psi.WorkingDirectory = $raiz
$ultimo = ''
$codigo = -1
try {
  $p = [System.Diagnostics.Process]::Start($psi)
  $lectura = $p.StandardOutput.ReadToEndAsync()
  $errores = $p.StandardError.ReadToEndAsync()
  if (-not $p.WaitForExit(30 * 60 * 1000)) { try { $p.Kill() } catch { }; [void]$p.WaitForExit(10000); Log 'el programa paso de 30 minutos y lo corte' }
  $codigo = $p.ExitCode
  $ultimo = (($lectura.Result -split '\r?\n') | Where-Object { $_.Trim() } | Select-Object -Last 1)
} catch { $ultimo = 'no pude correr el programa: ' + $_.Exception.Message }
Log ('codigo ' + $codigo + ' ' + $ultimo)

$res = $null
try { $res = $ultimo | ConvertFrom-Json -ErrorAction Stop } catch { $res = $null }
if ($null -eq $res) { $res = [string]$ultimo }
Dejar-Salud $destino $codigo $res
exit 0
