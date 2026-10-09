<#
  Saca de esta PC todo lo que instalo Ingenieria para Claude: lo del instalador de la persona (quien es, memoria,
  habilidades, ayudantes, fichas, Python, Node, los programas) y lo que quedaba del asistente por area
  (C:\ClaudeBarack, sus reglas, su tarea de Windows, sus restos). Todo va a la PAPELERA: se puede restaurar.
  Y DEVUELVE lo que el instalador habia reemplazado (lo que estaba guardado en ~\.claude\respaldos).

  NO toca lo de la persona: los archivos de C:\ClaudeBarack\Trabajo, lo que ella le hizo anotar a Claude y las
  habilidades que ella le enseno (esas pasan a ~\.claude\skills si estaban en el asistente por area).

    sin opciones   muestra la lista de lo que haria y no toca nada
    -Aplicar       lo hace

  Opciones para probar: -CarpetaUsuario, -CarpetaBarack, -CarpetaHerramientas, -SinTarea, -SinPath.
  Archivo en ASCII a proposito (PowerShell 5.1).
#>
param(
  [switch]$Aplicar,
  [string]$CarpetaUsuario = $env:USERPROFILE,
  [string]$CarpetaBarack = 'C:\ClaudeBarack',
  [string]$CarpetaHerramientas = '',
  [switch]$SinTarea,
  [switch]$SinPath
)
$ErrorActionPreference = 'Stop'
if (-not $CarpetaUsuario) { $CarpetaUsuario = $env:USERPROFILE }
if (-not $CarpetaBarack) { $CarpetaBarack = 'C:\ClaudeBarack' }
# Parado adentro de una carpeta, Windows no la deja mover a la Papelera: se trabaja desde la carpeta temporal.
Set-Location -LiteralPath $env:TEMP
[Environment]::CurrentDirectory = $env:TEMP
Add-Type -AssemblyName Microsoft.VisualBasic
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Leer([string]$ruta) { return [System.IO.File]::ReadAllText($ruta, [System.Text.Encoding]::UTF8) }
function Escribir([string]$ruta, [string]$texto) { [System.IO.File]::WriteAllText($ruta, $texto, $utf8) }
function Prop($obj, [string]$nombre) { if ($null -ne $obj -and $obj.PSObject.Properties[$nombre]) { return $obj.$nombre }; return $null }
function Poner($obj, [string]$nombre, $valor) { $obj | Add-Member -NotePropertyName $nombre -NotePropertyValue $valor -Force }
function Sacar($obj, [string]$nombre) { if ($null -ne $obj -and $obj.PSObject.Properties[$nombre]) { $obj.PSObject.Properties.Remove($nombre); return $true }; return $false }
function APapelera([string]$ruta) {
  if (Test-Path -LiteralPath $ruta -PathType Container) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($ruta, 'OnlyErrorDialogs', 'SendToRecycleBin') }
  elseif (Test-Path -LiteralPath $ruta) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($ruta, 'OnlyErrorDialogs', 'SendToRecycleBin') }
}
function LeerPathUsuario {
  $k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment')
  if ($null -eq $k) { return '' }
  try { return [string]$k.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) } finally { $k.Close() }
}
function EscribirPathUsuario([string]$valor) {
  $k = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment')
  try { $k.SetValue('Path', $valor, [Microsoft.Win32.RegistryValueKind]::ExpandString) } finally { $k.Close() }
  if (-not ('Barack.Entorno' -as [type])) {
    Add-Type -Namespace Barack -Name Entorno -MemberDefinition '[DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);'
  }
  $res = [UIntPtr]::Zero
  [void][Barack.Entorno]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$res)
}

$claudeDir = Join-Path $CarpetaUsuario '.claude'
$progDir = Join-Path $CarpetaUsuario 'AppData\Local\BarackHerramientas'
$pwDir = Join-Path $CarpetaUsuario 'AppData\Local\ms-playwright'
$marcaRuta = Join-Path $claudeDir 'barack-instalado.json'
$marca = $null
if (Test-Path -LiteralPath $marcaRuta) { try { $marca = (Leer $marcaRuta) | ConvertFrom-Json } catch { $marca = $null } }
if (-not $CarpetaHerramientas) { $CarpetaHerramientas = Prop $marca 'herramientas'; if (-not $CarpetaHerramientas) { $CarpetaHerramientas = 'C:\BarackHerramientas' } }
$memDir = Prop $marca 'memoria_dir'; if (-not $memDir) { $memDir = Join-Path $claudeDir ('projects\' + ($CarpetaBarack -replace '[:\\/]', '-') + '\memory') }
# la primera copia que dejo el instalador tiene lo que habia ANTES de todo: de ahi se devuelve
$respaldos = @(Get-ChildItem -LiteralPath (Join-Path $claudeDir 'respaldos') -Directory -Filter 'antes-de-instalar-*' -ErrorAction SilentlyContinue | Sort-Object Name)
$primero = $null; if ($respaldos.Count) { $primero = $respaldos[0].FullName }

# ---- la lista: [ruta, que es] ------------------------------------------------------------------------
$lista = New-Object System.Collections.ArrayList
function Anotar([string]$ruta, [string]$que) { if ($ruta -and (Test-Path -LiteralPath $ruta)) { [void]$lista.Add(@($ruta, $que)) } }

$cm = Join-Path $claudeDir 'CLAUDE.md'
if ((Test-Path -LiteralPath $cm) -and ((Leer $cm).Contains('<!-- barack-instalador -->'))) { Anotar $cm 'quien sos (lo que dejo el instalador)' }
foreach ($s in @(Prop $marca 'skills')) { if ($s) { Anotar (Join-Path $claudeDir ('skills\' + $s)) ('habilidad ' + $s) } }
foreach ($a in @(Prop $marca 'agentes')) { if ($a) { Anotar (Join-Path $claudeDir ('agents\' + $a)) ('ayudante ' + $a) } }
Anotar (Join-Path $claudeDir 'conocimiento-barack') 'fichas de la empresa'
$nuestras = @(Prop $marca 'memorias' | Where-Object { $_ -and $_ -ne 'MEMORY.md' })
foreach ($m in $nuestras) { Anotar (Join-Path $memDir $m) 'memoria de Ingenieria' }
if ((Prop $marca 'herramientas_creada') -ne $false) { Anotar $CarpetaHerramientas 'programas de las habilidades' }
foreach ($d in @(Prop $marca 'playwright_creadas')) { if ($d) { Anotar (Join-Path $pwDir $d) 'navegador de los flujogramas' } }
# lo del asistente por area (las habilidades que la persona le enseno se pasan antes a ~\.claude\skills)
$skillsSuyas = @(Get-ChildItem -LiteralPath (Join-Path $CarpetaBarack '.claude\skills') -Directory -ErrorAction SilentlyContinue)
if (Test-Path -LiteralPath $CarpetaBarack) {
  foreach ($e in @(Get-ChildItem -LiteralPath $CarpetaBarack -Force)) {
    if ($e.Name -ieq 'Trabajo') {
      $propios = @(Get-ChildItem -LiteralPath $e.FullName -Recurse -File -Force | Where-Object { $_.Name -ne 'LEEME.txt' -and $_.FullName -notlike '*\.claude\*' })
      if ($propios.Count -eq 0) { Anotar $e.FullName 'carpeta Trabajo (vacia)' }
      else { Anotar (Join-Path $e.FullName '.claude') 'reglas viejas del asistente por area'; Anotar (Join-Path $e.FullName 'LEEME.txt') 'LEEME del asistente por area' }
    } else { Anotar $e.FullName 'asistente por area' }
  }
}
Anotar (Join-Path $CarpetaUsuario 'AppData\Local\BarackEquipo') 'estado del asistente por area'
foreach ($sub in @('plugins\cache', 'plugins\marketplaces')) {
  foreach ($c in @(Get-ChildItem -LiteralPath (Join-Path $claudeDir $sub) -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'barack*' })) { Anotar $c.FullName 'complemento del asistente por area' }
}
# la carpeta de los programas va ULTIMA: adentro esta este mismo archivo (ya cargado: se puede mover)
Anotar $progDir 'Python, Node y este desinstalador'

# ---- lo que se devuelve del primer respaldo (lo que habia antes de instalar) ---------------------------
$devolver = @()
if ($primero) {
  foreach ($f in @(Get-ChildItem -LiteralPath $primero -Recurse -File -Force)) {
    $rel = $f.FullName.Substring($primero.TrimEnd('\').Length + 1)
    if ($rel -ieq 'settings.json' -or $rel -like 'plugins\*') { continue }   # esos se arreglan por clave, abajo
    $devolver += ,@($f.FullName, (Join-Path $claudeDir $rel), $rel)
  }
}

# ---- lo que se cambia sin borrar --------------------------------------------------------------------
$cambios = @()
$previo = Prop $marca 'previo'
$sp = Join-Path $claudeDir 'settings.json'
$sNuevo = $null
if (Test-Path -LiteralPath $sp) {
  try {
    $s = (Leer $sp) | ConvertFrom-Json
    $perm = Prop $s 'permissions'
    foreach ($par in @(@('autoMemoryDirectory', $s), @('skipDangerousModePermissionPrompt', $s), @('defaultMode', $perm))) {
      $clave = $par[0]; $obj = $par[1]
      if ($null -eq $obj) { continue }
      $antes = Prop $previo $clave
      if ($null -ne $antes) { Poner $obj $clave $antes } else { [void](Sacar $obj $clave) }
    }
    $ep = Prop $s 'enabledPlugins'
    foreach ($n in @($ep.PSObject.Properties | Where-Object { $_.Name -like '*@barack' } | ForEach-Object { $_.Name })) { [void](Sacar $ep $n) }
    [void](Sacar (Prop $s 'extraKnownMarketplaces') 'barack')
    $sNuevo = ConvertTo-Json -InputObject $s -Depth 50
    $cambios += 'configuracion de Claude: vuelve a como estaba antes de instalar'
  } catch { Write-Host ('  aviso: no pude leer ' + $sp + '; la configuracion queda como esta') -ForegroundColor Yellow }
}
$km = Join-Path $claudeDir 'plugins\known_marketplaces.json'
$kmNuevo = $null
if (Test-Path -LiteralPath $km) { try { $k = (Leer $km) | ConvertFrom-Json; if (Sacar $k 'barack') { $kmNuevo = ConvertTo-Json -InputObject $k -Depth 50; $cambios += 'lista de complementos: sin el del asistente por area' } } catch { } }
$ip = Join-Path $claudeDir 'plugins\installed_plugins.json'
$ipNuevo = $null
if (Test-Path -LiteralPath $ip) {
  try {
    $j = (Leer $ip) | ConvertFrom-Json; $obj = Prop $j 'plugins'; if ($null -eq $obj) { $obj = $j }
    $sac = @($obj.PSObject.Properties | Where-Object { $_.Name -like '*@barack' } | ForEach-Object { $_.Name })
    foreach ($n in $sac) { [void](Sacar $obj $n) }
    if ($sac.Count) { $ipNuevo = ConvertTo-Json -InputObject $j -Depth 50; $cambios += 'complementos instalados: sin el del asistente por area' }
  } catch { }
}
# indice de la memoria: el que habia antes (del respaldo) + lo que la persona anoto despues
$idx = Join-Path $memDir 'MEMORY.md'
$idxNuevo = $null
if ((Test-Path -LiteralPath $idx) -and $nuestras.Count) {
  $quedan = @()
  foreach ($l in ((Leer $idx) -split "`r?`n")) {
    if (-not $l.Trim() -or $l -match '^(# |## (Conocimiento de la empresa|Proyectos \(|Lo que ya estaba anotado)|> )') { continue }
    $dest = $null
    if ($l -match '\]\(([^)]+\.md)\)') { $dest = $Matches[1] } elseif ($l -match '^\s*[-*]\s*([^\s\[\]]+\.md)(\s|$)') { $dest = $Matches[1] }
    if ($dest -and ($nuestras -contains $dest -or $dest -eq 'feedback_principios_de_trabajo.md')) { continue }
    $quedan += $l
  }
  $original = $null
  if ($primero -and $memDir.StartsWith($claudeDir, [System.StringComparison]::OrdinalIgnoreCase)) {
    $o = Join-Path $primero ($memDir.Substring($claudeDir.TrimEnd('\').Length).TrimStart('\') + '\MEMORY.md')
    if (Test-Path -LiteralPath $o) { $original = Leer $o }
  }
  if ($null -ne $original) {
    $lineasOrig = @($original -split "`r?`n")
    $extra = @($quedan | Where-Object { $lineasOrig -notcontains $_ })
    $idxNuevo = $original.TrimEnd() + $(if ($extra.Count) { "`n" + ($extra -join "`n") }) + "`n"
    $devolver = @($devolver | Where-Object { $_[1] -ne $idx })
  } elseif ($quedan.Count) { $idxNuevo = "# Memoria`n`n" + ($quedan -join "`n") + "`n" }
  if ($null -ne $idxNuevo) { $cambios += 'indice de la memoria: queda lo que la persona habia anotado' }
  else { [void]$lista.Add(@($idx, 'indice de la memoria de Ingenieria')) }
}
$pathNuevo = $null
if (-not $SinPath) {
  $pu = LeerPathUsuario
  if ($pu) {
    $partes = @($pu.Split(';') | Where-Object { $_ })
    $resto = @($partes | Where-Object { -not $_.StartsWith($progDir, [System.StringComparison]::OrdinalIgnoreCase) })
    if ($resto.Count -ne $partes.Count) { $pathNuevo = $resto -join ';'; $cambios += 'PATH del usuario: sin Python ni Node de Ingenieria' }
  }
}
$tareas = @()
if (-not $SinTarea) { foreach ($t in @('Barack - Claude por area', 'Claude Barack - sync')) { if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) { $tareas += $t; $cambios += ("tarea de Windows '" + $t + "'") } } }

# ---- mostrar -----------------------------------------------------------------------------------------
Write-Host ''
Write-Host '  Lo que instalo Ingenieria para Claude en esta PC' -ForegroundColor Cyan
if (-not $Aplicar) { Write-Host '  (solo la lista: no se toca nada. Para hacerlo: -Aplicar)' -ForegroundColor Yellow }
Write-Host ''
Write-Host '  Va a la Papelera:'
foreach ($i in $lista) { Write-Host ('   - ' + $i[1] + ': ' + $i[0]) }
if ($devolver.Count -or $skillsSuyas.Count) {
  Write-Host ''; Write-Host '  Vuelve a como estaba:'
  foreach ($d in $devolver) { Write-Host ('   - ' + $d[2]) }
  foreach ($k in $skillsSuyas) { Write-Host ('   - habilidad que la persona le enseno al asistente anterior: ' + $k.Name + ' (pasa a ~\.claude\skills)') }
}
if ($cambios.Count) { Write-Host ''; Write-Host '  Se cambia:'; foreach ($c in $cambios) { Write-Host ('   - ' + $c) } }
Write-Host ''
Write-Host '  Queda: los archivos de la persona (C:\ClaudeBarack\Trabajo) y lo que ella le hizo anotar a Claude.'
if (-not $Aplicar) { exit 0 }

# ---- hacer -------------------------------------------------------------------------------------------
$script:fallas = 0
function Hacer([string]$queHago, [scriptblock]$bloque) {
  try { & $bloque; Write-Host ('  ok: ' + $queHago) -ForegroundColor Green }
  catch { $script:fallas++; Write-Host ('  NO SE PUDO: ' + $queHago + ' -> ' + $_.Exception.Message) -ForegroundColor Red }
}
Write-Host ''
foreach ($t in $tareas) { $tn = $t; Hacer ("sacar la tarea '" + $tn + "'") { Unregister-ScheduledTask -TaskName $tn -Confirm:$false } }
foreach ($k in $skillsSuyas) {
  $hab = $k; $dst = Join-Path $claudeDir ('skills\' + $hab.Name)
  if (Test-Path -LiteralPath $dst) { $dst = $dst + '-propia' }
  if (-not (Test-Path -LiteralPath $dst)) { Hacer ('pasar la habilidad de la persona ' + $hab.Name + ' a ~\.claude\skills') { New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force | Out-Null; Copy-Item -LiteralPath $hab.FullName -Destination $dst -Recurse } }
}
if ($sNuevo) { Hacer 'configuracion de Claude' { Escribir $sp $sNuevo } }
if ($kmNuevo) { Hacer 'lista de complementos' { Escribir $km $kmNuevo } }
if ($ipNuevo) { Hacer 'complementos instalados' { Escribir $ip $ipNuevo } }
if ($null -ne $pathNuevo) { Hacer 'PATH del usuario' { EscribirPathUsuario $pathNuevo } }
foreach ($i in $lista) { $r = $i[0]; Hacer ('a la Papelera: ' + $r) { APapelera $r } }
foreach ($d in $devolver) {
  $de = $d[0]; $a = $d[1]
  if (Test-Path -LiteralPath $a) { continue }   # algo de la persona ya esta en ese lugar: no se pisa
  Hacer ('devolver ' + $d[2]) { New-Item -ItemType Directory -Path (Split-Path $a -Parent) -Force | Out-Null; Copy-Item -LiteralPath $de -Destination $a }
}
if ($null -ne $idxNuevo) { Hacer 'indice de la memoria' { New-Item -ItemType Directory -Path $memDir -Force | Out-Null; Escribir $idx $idxNuevo } }
foreach ($r0 in $respaldos) { $rr = $r0.FullName; Hacer ('a la Papelera: copia del instalador ' + $r0.Name) { APapelera $rr } }
if (Test-Path -LiteralPath $marcaRuta) { Hacer 'marca de instalado' { APapelera $marcaRuta } }
Write-Host ''
if ($script:fallas) { Write-Host ('  TERMINO CON ' + $script:fallas + ' COSAS QUE NO SALIERON (arriba dice cuales).') -ForegroundColor Red }
else { Write-Host '  LISTO: todo lo de Ingenieria se fue a la Papelera y lo que habia antes volvio. Cerra Claude y abrilo de nuevo.' -ForegroundColor Green }
Write-Host '  Si te arrepentis, se restaura desde la Papelera de reciclaje.'
if ($script:fallas) { exit 1 }
exit 0
