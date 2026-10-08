<#
  Instala el Claude de Ingenieria para la persona de persona.json, SIN los frenos del asistente por area.
  Se corre con doble clic en el .cmd de al lado. Nada se borra: lo viejo va a la Papelera (se puede restaurar) y lo
  que se reemplaza en ~\.claude queda copiado en ~\.claude\respaldos (el desinstalador lo devuelve).

  Opciones (para probar; la persona no usa ninguna):
    -Ensayo          muestra lo que haria y no toca nada
    -CarpetaUsuario  la carpeta del usuario de Windows (por defecto, la de quien lo corre)
    -CarpetaBarack   la carpeta del asistente por area (por defecto C:\ClaudeBarack)
    -ConfigApp       la configuracion de la app de Claude (solo se LEE, para avisar si falta un clic)
    -CarpetaHerramientas  donde van los programas de las habilidades (por defecto C:\BarackHerramientas)
    -SinTarea        no toca las tareas de Windows
    -SinPath         no toca el PATH del usuario (para probar en una PC que no es la de la persona)
    -SinPreguntar    no pregunta si la PC no es la de la persona ni pide cerrar Claude

  Archivo en ASCII a proposito: PowerShell 5.1 lee mal los acentos de un .ps1 sin BOM.
#>
param(
  [switch]$Ensayo,
  [string]$CarpetaUsuario = $env:USERPROFILE,
  [string]$CarpetaBarack = 'C:\ClaudeBarack',
  [string]$ConfigApp = '',
  [string]$CarpetaHerramientas = 'C:\BarackHerramientas',
  [switch]$SinTarea,
  [switch]$SinPath,
  [switch]$SinPreguntar
)
$ErrorActionPreference = 'Stop'
if (-not $ConfigApp) { $ConfigApp = Join-Path $env:APPDATA 'Claude\claude_desktop_config.json' }
if (-not $CarpetaHerramientas) { $CarpetaHerramientas = 'C:\BarackHerramientas' }
if (-not $CarpetaUsuario) { $CarpetaUsuario = $env:USERPROFILE }
if (-not $CarpetaBarack) { $CarpetaBarack = 'C:\ClaudeBarack' }
$aqui = $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Leer([string]$ruta) { return [System.IO.File]::ReadAllText($ruta, [System.Text.Encoding]::UTF8) }
function Escribir([string]$ruta, [string]$texto) {
  $dir = Split-Path $ruta -Parent
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  [System.IO.File]::WriteAllText($ruta, $texto, $utf8)
}
function Prop($obj, [string]$nombre) { if ($null -ne $obj -and $obj.PSObject.Properties[$nombre]) { return $obj.$nombre }; return $null }
function Poner($obj, [string]$nombre, $valor) { $obj | Add-Member -NotePropertyName $nombre -NotePropertyValue $valor -Force }
function Sacar($obj, [string]$nombre) { if ($null -ne $obj -and $obj.PSObject.Properties[$nombre]) { $obj.PSObject.Properties.Remove($nombre); return $true }; return $false }
function AJson($obj) { return (ConvertTo-Json -InputObject $obj -Depth 50) }
function Titulo([string]$texto) { Write-Host ''; Write-Host $texto -ForegroundColor Cyan }

$script:cambios = 0
$script:fallas = New-Object System.Collections.ArrayList
function Hacer([string]$queHago, [scriptblock]$bloque) {
  if ($Ensayo) { Write-Host ('  haria: ' + $queHago); return }
  try { & $bloque; $script:cambios++; Write-Host ('  ok: ' + $queHago) -ForegroundColor Green }
  catch { [void]$script:fallas.Add($queHago + ' -> ' + $_.Exception.Message); Write-Host ('  NO SE PUDO: ' + $queHago + ' -> ' + $_.Exception.Message) -ForegroundColor Red }
}
# Mueve (o copia, con -Copiar) una ruta a la carpeta de respaldo, conservando su ruta relativa a $base.
function AlRespaldo([string]$ruta, [string]$respaldo, [string]$base, [switch]$Copiar) {
  $rel = $ruta.Substring($base.TrimEnd('\').Length).TrimStart('\')
  $destino = Join-Path $respaldo $rel
  $padre = Split-Path $destino -Parent
  if (-not (Test-Path -LiteralPath $padre)) { New-Item -ItemType Directory -Path $padre -Force | Out-Null }
  if ($Copiar) { Copy-Item -LiteralPath $ruta -Destination $destino -Recurse -Force } else { Move-Item -LiteralPath $ruta -Destination $destino }
}

$persona = (Leer (Join-Path $aqui 'persona.json')) | ConvertFrom-Json
$claudeDir = Join-Path $CarpetaUsuario '.claude'
$sello = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$respUsuario = Join-Path $claudeDir ('respaldos\antes-de-instalar-' + $sello)
$memDir = Join-Path $claudeDir 'projects\C--ClaudeBarack\memory'
$conDir = Join-Path $claudeDir 'conocimiento-barack'
$herrZip = Join-Path $aqui 'herramientas'
$hayHerr = Test-Path -LiteralPath (Join-Path $herrZip 'repo.zip')
$progDir = Join-Path $CarpetaUsuario 'AppData\Local\BarackHerramientas'
$pyDir = Join-Path $progDir 'python'
$nodeDir = Join-Path $progDir 'node'
$pwDir = Join-Path $CarpetaUsuario 'AppData\Local\ms-playwright'
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
# Abre un .zip encima de una carpeta (reemplaza lo que trae; lo demas queda). tar de Windows: mucho mas rapido.
function Abrir([string]$zip, [string]$destino) {
  if (-not (Test-Path -LiteralPath $destino)) { New-Item -ItemType Directory -Path $destino -Force | Out-Null }
  $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
  if (Test-Path -LiteralPath $tar) {
    & $tar -xf $zip -C $destino
    if ($LASTEXITCODE -ne 0) { throw ('no se pudo abrir ' + (Split-Path $zip -Leaf)) }
  } else { Expand-Archive -LiteralPath $zip -DestinationPath $destino -Force }
}

Write-Host ''
Write-Host '=====================================================================' -ForegroundColor Cyan
Write-Host ('  Claude para ' + $persona.nombre + ' (' + $persona.puesto + ') - sin restricciones') -ForegroundColor Cyan
if ($Ensayo) { Write-Host '  ENSAYO: muestra lo que haria y no toca nada' -ForegroundColor Yellow }
Write-Host '=====================================================================' -ForegroundColor Cyan

# ---------------------------------------------------------------------------------------------
Titulo '1. Reviso que el paquete este completo'
$manifiesto = (Leer (Join-Path $aqui 'paquete.json')) | ConvertFrom-Json
$faltan = @()
foreach ($a in $manifiesto.archivos) {
  $p = Join-Path $aqui $a.ruta
  if (-not (Test-Path -LiteralPath $p)) { $faltan += $a.ruta; continue }
  if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLower() -ne $a.sha256) { $faltan += ($a.ruta + ' (distinto)') }
}
# y nada de mas: lo que no esta en la lista no se revisa, asi que no se instala (p. ej. un _instalador copiado encima de otro)
$enLista = @{}; foreach ($a in $manifiesto.archivos) { $enLista[$a.ruta.ToLower()] = $true }
$base = $aqui.TrimEnd('\').Length + 1
foreach ($f in @(Get-ChildItem -LiteralPath $aqui -Recurse -File -Force)) {
  $rel = $f.FullName.Substring($base)
  if ($rel -ieq 'paquete.json') { continue }
  if (-not $enLista.ContainsKey($rel.ToLower())) { $faltan += ($rel + ' (de mas: no estaba en el paquete)') }
}
if ($faltan.Count) {
  Write-Host ('  El paquete esta incompleto o mezclado: ' + $faltan.Count + ' archivos faltan, cambiaron o sobran. No se toco nada.') -ForegroundColor Red
  $faltan | Select-Object -First 10 | ForEach-Object { Write-Host ('   - ' + $_) }
  exit 3
}
Write-Host ('  ok: ' + $manifiesto.archivos.Count + ' archivos, todos bien')

# ---------------------------------------------------------------------------------------------
Titulo ('2. Reviso que sea la PC de ' + $persona.nombre)
$usr = $env:USERNAME; $pc = $env:COMPUTERNAME
if ($usr -eq $persona.usuario_windows -and $pc -eq $persona.pc) {
  Write-Host ('  ok: usuario de Windows ' + $usr + ', PC ' + $pc)
} else {
  Write-Host ('  OJO: esta PC no parece la de ' + $persona.nombre + '.') -ForegroundColor Yellow
  Write-Host ('       Usuario de Windows: ' + $usr + ' (se esperaba ' + $persona.usuario_windows + ')') -ForegroundColor Yellow
  Write-Host ('       PC: ' + $pc + ' (se esperaba ' + $persona.pc + ')') -ForegroundColor Yellow
  if (-not $Ensayo -and -not $SinPreguntar) {
    $r = Read-Host ('  Si igual es la PC de ' + $persona.nombre_corto + ', escribi SI y apreta Enter (cualquier otra cosa cancela)')
    if ("$r".Trim().ToUpper() -ne 'SI') { Write-Host '  Cancelado. No se toco nada.'; exit 2 }
  }
}
$abiertos = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -ieq 'claude' })
if ($abiertos.Count -and -not $Ensayo -and -not $SinPreguntar) {
  Write-Host '  Claude esta abierto. Cerralo del todo (tambien el icono al lado del reloj, clic derecho > Salir) y apreta Enter.' -ForegroundColor Yellow
  Read-Host | Out-Null
  if (@(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -ieq 'claude' }).Count) {
    Write-Host '  Sigue abierto: igual sigo. Al terminar, cerralo del todo y abrilo de nuevo.' -ForegroundColor Yellow
  }
}

# ---------------------------------------------------------------------------------------------
# Todo lo que se LEE va antes de tocar nada: si algo no se puede leer, se corta sin cambios.
$sp = Join-Path $claudeDir 'settings.json'
$s = $null
if (Test-Path -LiteralPath $sp) {
  $raw = Leer $sp
  if ($raw.Trim()) {
    try { $s = $raw | ConvertFrom-Json } catch { Write-Host ('  No pude leer ' + $sp + ' (no es una configuracion valida). No se toco nada.') -ForegroundColor Red; exit 4 }
  }
}
if ($null -eq $s) { $s = New-Object PSObject }
# los valores que habia antes (el desinstalador los devuelve); si ya se instalo antes, valen los de la primera vez
$marcaPrevia = $null
$marcaRuta = Join-Path $claudeDir 'barack-instalado.json'
if (Test-Path -LiteralPath $marcaRuta) { try { $marcaPrevia = (Leer $marcaRuta) | ConvertFrom-Json } catch { $marcaPrevia = $null } }
$previo = Prop $marcaPrevia 'previo'
if ($null -eq $previo) {
  $previo = [pscustomobject]@{ defaultMode = (Prop (Prop $s 'permissions') 'defaultMode'); skipDangerousModePermissionPrompt = (Prop $s 'skipDangerousModePermissionPrompt'); autoMemoryDirectory = (Prop $s 'autoMemoryDirectory') }
}
$queCambia = @()
$ep = Prop $s 'enabledPlugins'; if ($null -eq $ep) { $ep = New-Object PSObject }
$apagar = @('barack-area@barack') + @($ep.PSObject.Properties | Where-Object { $_.Name -like '*@barack' } | ForEach-Object { $_.Name })
foreach ($n in ($apagar | Select-Object -Unique)) { if ((Prop $ep $n) -ne $false) { $queCambia += ('apagar ' + $n) }; Poner $ep $n $false }
Poner $s 'enabledPlugins' $ep
$ekm = Prop $s 'extraKnownMarketplaces'
if (Sacar $ekm 'barack') { $queCambia += 'sacar el lugar de donde se reinstalaba' }
$perm = Prop $s 'permissions'; if ($null -eq $perm) { $perm = New-Object PSObject }
if ((Prop $perm 'defaultMode') -ne 'bypassPermissions') { $queCambia += 'modo sin carteles de permiso' }
Poner $perm 'defaultMode' 'bypassPermissions'
Poner $s 'permissions' $perm
if ((Prop $s 'skipDangerousModePermissionPrompt') -ne $true) { $queCambia += 'sin el cartel de advertencia de ese modo' }
Poner $s 'skipDangerousModePermissionPrompt' $true
if ((Prop $s 'autoMemoryDirectory') -ne $memDir) { $queCambia += 'la memoria en un solo lugar, abra la carpeta que abra' }
Poner $s 'autoMemoryDirectory' $memDir
$settingsNuevo = AJson $s

$km = Join-Path $claudeDir 'plugins\known_marketplaces.json'
$kmNuevo = $null
if (Test-Path -LiteralPath $km) {
  try { $ko = (Leer $km) | ConvertFrom-Json; if (Sacar $ko 'barack') { $kmNuevo = AJson $ko } }
  catch { Write-Host '  aviso: no pude leer la lista de complementos; queda como esta (el asistente por area igual queda apagado)' -ForegroundColor Yellow }
}
$ip = Join-Path $claudeDir 'plugins\installed_plugins.json'
$ipNuevo = $null
if (Test-Path -LiteralPath $ip) {
  try {
    $j = (Leer $ip) | ConvertFrom-Json; $obj = Prop $j 'plugins'; if ($null -eq $obj) { $obj = $j }
    $sacados = @($obj.PSObject.Properties | Where-Object { $_.Name -like '*@barack' } | ForEach-Object { $_.Name })
    foreach ($n in $sacados) { [void](Sacar $obj $n) }
    if ($sacados.Count) { $ipNuevo = AJson $j }
  } catch { }
}

# El asistente por area entero va a la Papelera (Fak, 08/10/2026: la carpeta vieja no queda). Queda solo lo de la
# persona: sus archivos de C:\ClaudeBarack\Trabajo.
$deBarack = @()
if (Test-Path -LiteralPath $CarpetaBarack) {
  foreach ($e in @(Get-ChildItem -LiteralPath $CarpetaBarack -Force)) {
    if ($e.Name -ieq 'Trabajo') {
      foreach ($rel in @('.claude', 'LEEME.txt')) { $p = Join-Path $e.FullName $rel; if (Test-Path -LiteralPath $p) { $deBarack += $p } }
    } else { $deBarack += $e.FullName }
  }
}
foreach ($p in @((Join-Path $CarpetaUsuario 'AppData\Local\BarackEquipo'))) { if (Test-Path -LiteralPath $p) { $deBarack += $p } }
foreach ($sub in @('plugins\cache', 'plugins\marketplaces')) {
  foreach ($c in @(Get-ChildItem -LiteralPath (Join-Path $claudeDir $sub) -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'barack*' })) { $deBarack += $c.FullName }
}
Add-Type -AssemblyName Microsoft.VisualBasic
function APapelera([string]$ruta) {
  if (Test-Path -LiteralPath $ruta -PathType Container) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($ruta, 'OnlyErrorDialogs', 'SendToRecycleBin') }
  elseif (Test-Path -LiteralPath $ruta) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($ruta, 'OnlyErrorDialogs', 'SendToRecycleBin') }
}

$cm = (Leer (Join-Path $aqui 'CLAUDE.md'))
$cm = $cm.Replace('{{NOMBRE_CORTO}}', $persona.nombre_corto).Replace('{{NOMBRE}}', $persona.nombre).Replace('{{PUESTO}}', $persona.puesto)
$cm = $cm.Replace('{{MAIL}}', $persona.mail).Replace('{{MEMORIA}}', $memDir).Replace('{{CONOCIMIENTO}}', $conDir).Replace('{{FECHA}}', $persona.fecha_paquete)
$cm = $cm.Replace('{{HERRAMIENTAS}}', $CarpetaHerramientas).Replace('{{PYTHON}}', (Join-Path $pyDir 'python.exe')).Replace('{{NODE}}', (Join-Path $nodeDir 'node.exe'))
$desinstalador = Join-Path $progDir 'desinstalar.ps1'
$cm = $cm.Replace('{{DESINSTALAR}}', $desinstalador)
# lo que ya habia antes de instalar (el desinstalador saca solo lo que puso este instalador)
$herrCreada = (-not (Test-Path -LiteralPath $CarpetaHerramientas)) -or ((Prop $marcaPrevia 'herramientas_creada') -eq $true)
$pwAntes = @(Get-ChildItem -LiteralPath $pwDir -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
$pwPrevias = @(Prop $marcaPrevia 'playwright_creadas' | Where-Object { $_ })
# la parte de las herramientas va solo si el paquete las trae
if ($hayHerr) { $cm = $cm -replace '(?m)^<!-- /?herramientas -->\r?\n', '' }
else { $cm = $cm -replace '(?s)<!-- herramientas -->.*?<!-- /herramientas -->\r?\n', '' }
$memFiles = @(Get-ChildItem -LiteralPath (Join-Path $aqui 'memoria') -File)
$nuestros = @($memFiles | ForEach-Object { $_.Name })
# Del indice que habia queda TODO lo que no es del paquete (renglones con link, sin link o texto suelto: lo anoto la
# persona) y va ARRIBA, para que no caiga despues del renglon 200 que Claude deja de leer. Lo mismo con las memorias
# que la persona hizo abriendo Claude en otras carpetas: se copian aca (el original queda) y suman sus renglones.
$propioIdx = @((Leer (Join-Path $aqui 'memoria\MEMORY.md')) -split "`r?`n")
$deNuestroIdx = '^(# |## (Conocimiento de la empresa|Proyectos \(|Lo que ya estaba anotado)|> (Lo de abajo lo aprendi|Es conocimiento de la empresa|tu usuario es|Los "falta"|Cada rengl))'
function DestinoIdx([string]$l) {
  if ($l -match '\]\(([^)]+\.md)\)') { return $Matches[1] }
  if ($l -match '^\s*[-*]\s*([^\s\[\]]+\.md)(\s|$)') { return $Matches[1] }
  return $null
}
$suyas = New-Object System.Collections.ArrayList
function SumarRenglones([string]$idxRuta) {
  foreach ($l in ((Leer $idxRuta) -split "`r?`n")) {
    if (-not $l.Trim() -or $propioIdx -contains $l -or $l -match $deNuestroIdx) { continue }
    $d = DestinoIdx $l
    if ($d -and $nuestros -contains $d) { continue }
    if ($suyas -notcontains $l) { [void]$suyas.Add($l) }
  }
}
$idxPrevio = Join-Path $memDir 'MEMORY.md'
if (Test-Path -LiteralPath $idxPrevio) { SumarRenglones $idxPrevio }
$otrasMemorias = @()
foreach ($d in @(Get-ChildItem -LiteralPath (Join-Path $claudeDir 'projects') -Directory -ErrorAction SilentlyContinue)) {
  $m = Join-Path $d.FullName 'memory'
  if ($m -eq $memDir -or -not (Test-Path -LiteralPath $m)) { continue }
  foreach ($f in @(Get-ChildItem -LiteralPath $m -File -Filter '*.md')) {
    if ($f.Name -eq 'MEMORY.md') { SumarRenglones $f.FullName; continue }
    if ($nuestros -notcontains $f.Name -and -not (Test-Path -LiteralPath (Join-Path $memDir $f.Name))) { $otrasMemorias += $f.FullName }
  }
}
# lo que la persona le enseno al asistente por area (skill "aprender"): pasa a su Claude nuevo, no a la Papelera
$skillsSuyas = @(Get-ChildItem -LiteralPath (Join-Path $CarpetaBarack '.claude\skills') -Directory -ErrorAction SilentlyContinue)
$cmViejo = Join-Path $CarpetaBarack 'CLAUDE.md'
$cmViejoPropio = $false
if (Test-Path -LiteralPath $cmViejo) {
  $resto = @((Leer $cmViejo) -split "`r?`n" | Where-Object { $_.Trim() -and $_ -notmatch '^# Claude de Barack Mercosul' -and $_ -notmatch 'Tus archivos van en la carpeta' })
  $cmViejoPropio = $resto.Count -gt 0
}
$skills = @(Get-ChildItem -LiteralPath (Join-Path $aqui 'skills') -Directory)
$fichas = @(Get-ChildItem -LiteralPath (Join-Path $aqui 'conocimiento') -Recurse -File).Count

# ---------------------------------------------------------------------------------------------
Titulo '3. Saco los frenos del asistente por area'
if (-not $SinTarea) {
  foreach ($t in @('Barack - Claude por area', 'Claude Barack - sync')) {
    $tk = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
    if ($tk) { $tarea = $t; Hacer ("sacar la tarea de Windows '" + $tarea + "' (la que lo volvia a poner solo)") { Unregister-ScheduledTask -TaskName $tarea -Confirm:$false } }
    else { Write-Host ("  -- no hay tarea '" + $t + "'") }
  }
}
if (Test-Path -LiteralPath $sp) { Hacer 'guardar una copia de la configuracion de Claude' { AlRespaldo $sp $respUsuario $claudeDir -Copiar } }
if ($queCambia.Count) { Hacer ('configuracion de Claude: ' + ($queCambia -join '; ')) { Escribir $sp $settingsNuevo } }
else { Write-Host '  -- la configuracion ya estaba bien' }
if ($kmNuevo) { Hacer 'sacar el asistente por area de la lista de complementos' { AlRespaldo $km $respUsuario $claudeDir -Copiar; Escribir $km $kmNuevo } }
if ($ipNuevo) { Hacer 'sacar el asistente por area de los complementos instalados' { AlRespaldo $ip $respUsuario $claudeDir -Copiar; Escribir $ip $ipNuevo } }
foreach ($k in $skillsSuyas) {
  $hab = $k
  $destHab = Join-Path $claudeDir ('skills\' + $hab.Name)
  if ((Test-Path -LiteralPath $destHab) -or (Test-Path -LiteralPath (Join-Path $aqui ('skills\' + $hab.Name)))) { $destHab = $destHab + '-propia' }
  if (-not (Test-Path -LiteralPath $destHab)) { Hacer ('pasar al Claude nuevo la habilidad que ' + $persona.nombre_corto + ' le enseno al anterior: ' + $hab.Name) { New-Item -ItemType Directory -Path (Split-Path $destHab -Parent) -Force | Out-Null; Copy-Item -LiteralPath $hab.FullName -Destination $destHab -Recurse } }
}
if ($cmViejoPropio) { Hacer ('guardar lo que ' + $persona.nombre_corto + ' le habia escrito al asistente anterior en Trabajo\Notas del asistente anterior.md') { Escribir (Join-Path $CarpetaBarack 'Trabajo\Notas del asistente anterior.md') (Leer $cmViejo) } }
foreach ($p in $deBarack) { $ruta = $p; Hacer ('a la Papelera: ' + $ruta + ' (asistente por area)') { APapelera $ruta } }

# ---------------------------------------------------------------------------------------------
Titulo '4. Instalo quien sos y lo que sabe'
$cmDest = Join-Path $claudeDir 'CLAUDE.md'
if (Test-Path -LiteralPath $cmDest) { Hacer 'guardar una copia del CLAUDE.md que habia' { AlRespaldo $cmDest $respUsuario $claudeDir -Copiar } }
Hacer ('quien sos: ' + $persona.nombre + ', ' + $persona.puesto + ', ' + $persona.mail) { Escribir $cmDest $cm }
Hacer ('memoria: ' + $memFiles.Count + ' archivos' + $(if ($suyas.Count) { ', y quedan arriba los ' + $suyas.Count + ' renglones que ya tenia' } else { '' })) {
  if (-not (Test-Path -LiteralPath $memDir)) { New-Item -ItemType Directory -Path $memDir -Force | Out-Null }
  foreach ($o in $otrasMemorias) { Copy-Item -LiteralPath $o -Destination (Join-Path $memDir (Split-Path $o -Leaf)) }
  foreach ($f in $memFiles) {
    $dst = Join-Path $memDir $f.Name
    if (Test-Path -LiteralPath $dst) { AlRespaldo $dst $respUsuario $claudeDir -Copiar }
    if ($f.Name -eq 'MEMORY.md') {
      $idx = Leer $f.FullName
      if ($suyas.Count) { $idx = $idx.Replace('## Conocimiento de la empresa', ("## Lo que ya estaba anotado en esta PC`n" + ($suyas -join "`n") + "`n`n## Conocimiento de la empresa")) }
      Escribir $dst $idx
    } else { Copy-Item -LiteralPath $f.FullName -Destination $dst -Force }
  }
}
if ($suyas.Count -and (@((Leer (Join-Path $aqui 'memoria\MEMORY.md')) -split "`n").Count + $suyas.Count + 2) -gt 195) {
  Write-Host '  aviso: el indice de la memoria quedo largo; Claude lee los primeros 200 renglones (lo de la persona va arriba).' -ForegroundColor Yellow
}
Hacer ('habilidades: ' + (($skills | ForEach-Object { $_.Name }) -join ', ')) {
  $skDest = Join-Path $claudeDir 'skills'
  if (-not (Test-Path -LiteralPath $skDest)) { New-Item -ItemType Directory -Path $skDest -Force | Out-Null }
  foreach ($k in $skills) {
    $dst = Join-Path $skDest $k.Name
    if (Test-Path -LiteralPath $dst) { AlRespaldo $dst $respUsuario $claudeDir }
    Copy-Item -LiteralPath $k.FullName -Destination $dst -Recurse -Force
  }
}
Hacer 'ayudantes: investigador y explorador' {
  $ad = Join-Path $claudeDir 'agents'
  if (-not (Test-Path -LiteralPath $ad)) { New-Item -ItemType Directory -Path $ad -Force | Out-Null }
  foreach ($g in (Get-ChildItem -LiteralPath (Join-Path $aqui 'agentes') -File)) {
    $dst = Join-Path $ad $g.Name
    if (Test-Path -LiteralPath $dst) { AlRespaldo $dst $respUsuario $claudeDir -Copiar }
    Copy-Item -LiteralPath $g.FullName -Destination $dst -Force
  }
}
Hacer ('fichas de la empresa: ' + $fichas + ' archivos') {
  if (Test-Path -LiteralPath $conDir) { AlRespaldo $conDir $respUsuario $claudeDir }
  Copy-Item -LiteralPath (Join-Path $aqui 'conocimiento') -Destination $conDir -Recurse -Force
}
if ($hayHerr) {
  Titulo '5. Instalo las herramientas: Python, Node y los programas de las habilidades (tarda unos minutos)'
  Hacer ('programas de las habilidades en ' + $CarpetaHerramientas) {
    Abrir (Join-Path $herrZip 'repo.zip') $CarpetaHerramientas
    Abrir (Join-Path $herrZip 'node_modules.zip') $CarpetaHerramientas
    Copy-Item -LiteralPath (Join-Path $herrZip 'CAJA_CLAUDE.md') -Destination (Join-Path $CarpetaHerramientas 'CLAUDE.md') -Force
  }
  Hacer ('Python con los paquetes de oficina en ' + $pyDir) { Abrir (Join-Path $herrZip 'python.zip') $pyDir }
  Hacer ('Node en ' + $nodeDir) { Abrir (Join-Path $herrZip 'node.zip') $nodeDir }
  Hacer 'el navegador sin ventana que dibuja los flujogramas' { Abrir (Join-Path $herrZip 'playwright.zip') $pwDir }
  if (-not $SinPath) {
    # Se lee y se escribe en el registro tal cual (con sus %VARIABLES% sin reemplazar y como ExpandString), y despues
    # se avisa a Windows: con [Environment]::SetEnvironmentVariable el PATH quedaba con las rutas ya reemplazadas.
    $pathUsuario = LeerPathUsuario
    $partes = @(); if ($pathUsuario) { $partes = @($pathUsuario.Split(';') | Where-Object { $_ }) }
    $faltanPath = @(@($pyDir, (Join-Path $pyDir 'Scripts'), $nodeDir) | Where-Object { $partes -notcontains $_ })
    if ($faltanPath.Count) {
      $pathNuevo = (@($faltanPath) + $partes) -join ';'
      Hacer 'que python y node se encuentren desde cualquier carpeta (PATH del usuario)' { EscribirPathUsuario $pathNuevo }
    } else { Write-Host '  -- python y node ya estaban en el PATH' }
  }
}
Hacer ('el desinstalador, por si quiere sacar todo: ' + $desinstalador) {
  if (-not (Test-Path -LiteralPath $progDir)) { New-Item -ItemType Directory -Path $progDir -Force | Out-Null }
  Copy-Item -LiteralPath (Join-Path $aqui 'desinstalar.ps1') -Destination $desinstalador -Force
}
Hacer 'anotar lo que se instalo (lo usa el desinstalador)' {
  $pwNuevas = @(Get-ChildItem -LiteralPath $pwDir -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name } | Where-Object { $pwAntes -notcontains $_ })
  $marca = [pscustomobject]@{
    persona = $persona.nombre; puesto = $persona.puesto; instalado = (Get-Date -Format s); paquete = $persona.fecha_paquete
    pc = $env:COMPUTERNAME; usuario = $env:USERNAME
    memoria_dir = $memDir; memorias = @($nuestros); skills = @($skills | ForEach-Object { $_.Name }); agentes = @('investigador.md', 'explorador.md')
    herramientas = $CarpetaHerramientas; herramientas_creada = [bool]($hayHerr -and $herrCreada)
    playwright_creadas = @(@($pwPrevias) + @($pwNuevas) | Select-Object -Unique)
    previo = $previo
  }
  Escribir $marcaRuta (AJson $marca)
}

# ---------------------------------------------------------------------------------------------
$appOk = $null
if (Test-Path -LiteralPath $ConfigApp) {
  try {
    $oi = Prop (Prop ((Leer $ConfigApp) | ConvertFrom-Json) 'preferences') 'bypassPermissionsOptInByAccount'
    $appOk = ($null -ne $oi) -and (@($oi.PSObject.Properties | Where-Object { $_.Value -eq $true }).Count -gt 0)
  } catch { $appOk = $null }
}

if ($Ensayo) {
  Write-Host ''
  Write-Host '=====================================================================' -ForegroundColor Yellow
  Write-Host '  ENSAYO TERMINADO: no se toco nada.' -ForegroundColor Yellow
  if ($appOk -ne $true) { Write-Host '  Al instalar va a faltar un clic en Claude: Configuracion > Claude Code > "Allow bypass permissions mode".' -ForegroundColor Yellow }
  Write-Host '=====================================================================' -ForegroundColor Yellow
  exit 0
}

Titulo '6. Controlo que haya quedado bien'
$controles = @()
try {
  $v = (Leer $sp) | ConvertFrom-Json
  $controles += ,@('asistente por area apagado', ((Prop (Prop $v 'enabledPlugins') 'barack-area@barack') -eq $false))
  $controles += ,@('ya no se reinstala solo', (-not (Prop (Prop $v 'extraKnownMarketplaces') 'barack')))
  $controles += ,@('sin carteles de permiso', ((Prop (Prop $v 'permissions') 'defaultMode') -eq 'bypassPermissions'))
  $controles += ,@('memoria en un solo lugar', ((Prop $v 'autoMemoryDirectory') -eq $memDir))
} catch { $controles += ,@('la configuracion se puede leer', $false) }
$controles += ,@('sabe quien sos', ((Test-Path -LiteralPath $cmDest) -and ((Leer $cmDest).Contains($persona.nombre))))
$controles += ,@('memoria copiada', (@(Get-ChildItem -LiteralPath $memDir -File -ErrorAction SilentlyContinue).Count -ge $memFiles.Count))
$controles += ,@('habilidades copiadas', (@($skills | Where-Object { -not (Test-Path -LiteralPath (Join-Path $claudeDir ('skills\' + $_.Name + '\SKILL.md'))) }).Count -eq 0))
$controles += ,@('ayudantes copiados', ((Test-Path -LiteralPath (Join-Path $claudeDir 'agents\investigador.md')) -and (Test-Path -LiteralPath (Join-Path $claudeDir 'agents\explorador.md'))))
$controles += ,@('reglas del asistente por area afuera', (-not (Test-Path -LiteralPath (Join-Path $CarpetaBarack '.claude\rules\casa.md'))))
if (-not $SinTarea) { $controles += ,@('tarea de Windows afuera', ($null -eq (Get-ScheduledTask -TaskName 'Barack - Claude por area' -ErrorAction SilentlyContinue))) }
if ($hayHerr) {
  $okPy = $false
  try { $o = & (Join-Path $pyDir 'python.exe') -c "import pptx, openpyxl, fitz, PIL, numpy, win32com.client; print('anda')" 2>&1; $okPy = ($LASTEXITCODE -eq 0) -and ("$o" -match 'anda') } catch { $okPy = $false }
  $controles += ,@('Python abre PowerPoint, Excel, PDF, imagenes y Office', $okPy)
  $okNode = $false
  $jsPrueba = "require('" + ($CarpetaHerramientas -replace '\\', '/') + "/node_modules/playwright-core/package.json'); console.log('anda')"
  try { $o = & (Join-Path $nodeDir 'node.exe') -e $jsPrueba 2>&1; $okNode = ($LASTEXITCODE -eq 0) -and ("$o" -match 'anda') } catch { $okNode = $false }
  $controles += ,@('Node y las dependencias de los programas', $okNode)
  $controles += ,@('programas de las habilidades', ((Test-Path -LiteralPath (Join-Path $CarpetaHerramientas 'scripts\_flujograma.mjs')) -and (Test-Path -LiteralPath (Join-Path $CarpetaHerramientas 'scripts\_leerPlano.py'))))
  $controles += ,@('navegador de los flujogramas', (@(Get-ChildItem -LiteralPath $pwDir -Directory -Filter 'chromium*' -ErrorAction SilentlyContinue).Count -gt 0))
}
foreach ($c in $controles) {
  if ($c[1]) { Write-Host ('  ok: ' + $c[0]) -ForegroundColor Green }
  else { Write-Host ('  FALLA: ' + $c[0]) -ForegroundColor Red; [void]$script:fallas.Add('control: ' + $c[0]) }
}

Write-Host ''
Write-Host '=====================================================================' -ForegroundColor Cyan
if ($script:fallas.Count) {
  Write-Host ('  TERMINO, PERO HAY ' + $script:fallas.Count + ' COSAS QUE NO SALIERON. Avisale a Ingenieria con una foto de esta ventana.') -ForegroundColor Red
} else {
  Write-Host '  LISTO' -ForegroundColor Green
}
Write-Host ''
Write-Host '  Que cambio:'
Write-Host '   - Se apagaron los frenos del asistente por area, en cualquier carpeta.'
Write-Host ('   - Claude sabe que sos ' + $persona.nombre + ' (' + $persona.puesto + ').')
Write-Host ('   - Tiene ' + ($memFiles.Count - 1) + ' temas de memoria de la empresa, ' + $fichas + ' fichas, ' + $skills.Count + ' habilidades y 2 ayudantes.')
if ($hayHerr) { Write-Host ('   - Tiene Python, Node y los programas de las habilidades (en ' + $CarpetaHerramientas + ').') }
Write-Host ''
Write-Host '  Falta, una sola vez:'
Write-Host '   1. Cerrar Claude del todo (tambien el icono al lado del reloj) y volver a abrirlo.'
if ($appOk -ne $true) {
  Write-Host '   2. En Claude: Configuracion > Claude Code > prender "Allow bypass permissions mode".' -ForegroundColor Yellow
  Write-Host '      Asi no pide permiso para cada cosa.' -ForegroundColor Yellow
}
Write-Host ''
Write-Host '  No se borro nada: el asistente anterior esta en la Papelera (se puede restaurar), y la'
Write-Host '  configuracion que habia quedo copiada en:'
if (Test-Path -LiteralPath $respUsuario) { Write-Host ('   ' + $respUsuario) }
Write-Host ('  Para sacar todo esto mas adelante: pedirselo a Claude, o ' + $desinstalador)
Write-Host '=====================================================================' -ForegroundColor Cyan
if ($script:fallas.Count) { exit 1 }
exit 0
