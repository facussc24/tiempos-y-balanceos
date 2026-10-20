# instalar_mi_pc.ps1 - deja en ESTA PC el asistente COMPLETO de Facundo Santoro: el repo (reglas, skills del proyecto,
# CLAUDE.md), y lo que viaja por la nube de Ingenieria (memoria, reglas, skills, agentes, hooks y settings globales, claves).
# Es el "protocolo de PC nueva" del repo (CLAUDE.md, punto 0) hecho con doble clic:
#   git clone (o el zip de GitHub)  +  node scripts\_nube.mjs --bajar --aplicar
# Ademas apaga el asistente "por area" si alguien lo instalo antes (08/10/2026: en la notebook de Calidad quedo ese, sin
# skills ni memoria, y contestaba que instalar programas era de la administracion).
#
# Lo lanza Instalar-Mi-PC.cmd (doble clic, sin permisos de administrador). Se puede volver a correr: no pisa nada que
# sea mas nuevo en esta PC (la bajada no borra) y el repo solo se actualiza si no tiene cambios sin guardar.
#   -Ensayo  no escribe ni baja nada: dice que haria.
# Solo ASCII en este archivo (PowerShell 5.1 lee mal las tildes de un archivo sin marca).
param(
  [switch]$Ensayo,
  [string]$Repo = 'C:\Dev\BarackMercosul',
  [string]$Biblioteca = ''    # solo para la prueba
)
$ErrorActionPreference = 'Stop'
$aqui = $PSScriptRoot
$claudeDir = Join-Path $env:USERPROFILE '.claude'
$URL = 'https://github.com/facussc24/tiempos-y-balanceos'
$TAREA_POR_AREA = 'Barack - Claude por area'
$advertencias = New-Object System.Collections.Generic.List[string]

function Ok([string]$t) { Write-Host ('  OK   ' + $t) -ForegroundColor Green }
function Ojo([string]$t) { Write-Host ('  OJO  ' + $t) -ForegroundColor Yellow; $advertencias.Add($t) }
function Haria([string]$t) { Write-Host ('  [ensayo] haria: ' + $t) -ForegroundColor DarkGray }
function Mal([string]$t) {
  Write-Host ''
  Write-Host ('  NO SE PUDO: ' + $t) -ForegroundColor Red
  Write-Host '  No hace falta copiar nada: avisale a Ingenieria que esta ventana dice esto.'
  Write-Host ''
  exit 1
}

Write-Host ''
Write-Host '  MI ASISTENTE COMPLETO EN ESTA PC' -ForegroundColor Cyan
if ($Ensayo) { Write-Host '  (ENSAYO: no se escribe ni se baja nada)' -ForegroundColor DarkGray }
Write-Host ''

# 1) de donde sale mi memoria y mi configuracion: de este pendrive (carpeta "nube" al lado de "programa"), o si no, de la
#    biblioteca de Ingenieria (la que contiene este archivo)
$paquete = Split-Path -Parent $aqui
# 20/10/2026: las skills y la configuracion ya no estan en la nube (viven en las PC de Fak y viajan por pendrive, lo arma
#    scripts/_pendriveAsistente.mjs): alcanza con la memoria para reconocer el pendrive y la nube.
$desdePendrive = Test-Path -LiteralPath (Join-Path $paquete 'nube\claude-memoria')
$bib = $null
$nube = $null
if ($desdePendrive) {
  $nube = Join-Path $paquete 'nube'
  $env:BARACK_NUBE_CEREBRO = $nube
  Ok ('tu memoria y tu configuracion vienen en este pendrive: ' + $nube)
}
elseif ($Biblioteca) { $bib = $Biblioteca }
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
if (-not $desdePendrive) {
  if (-not $bib -or -not (Test-Path -LiteralPath $bib -PathType Container)) { Mal 'no encuentro en esta PC la biblioteca de Ingenieria. Tiene que estar sincronizada con tu cuenta (Explorador: BARACK ARGENTINA SRL > Ingenieria y Proyecto - General).' }
  # La carpeta de la memoria: primero su lugar nuevo (mudanza del 17/10/2026; la fuente es scripts/_lib/nubeCarpetas.data.json,
  # clave facundo: este archivo corre en otra PC sin el repo y lleva el nombre adentro) y despues las carpetas de primer nivel.
  $basesMemoria = @(Join-Path $bib 'ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)')
  $basesMemoria += @(Get-ChildItem -LiteralPath $bib -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
  foreach ($d in $basesMemoria) {
    if (Test-Path -LiteralPath (Join-Path $d 'claude-memoria')) { $nube = $d; break }
  }
  if (-not $nube) { Mal 'no veo en la nube de Ingenieria la carpeta con tu memoria y tu configuracion. Tiene permiso solo para tu cuenta: sincroniza la biblioteca con tu cuenta (SharePoint > Documentos > Sincronizar) y espera a que termine.' }
  Ok ('tu memoria y tu configuracion: ' + $nube)
  $esperada = Join-Path $env:USERPROFILE 'BARACK ARGENTINA SRL'
  if (-not $bib.StartsWith($esperada, [System.StringComparison]::OrdinalIgnoreCase)) { Ojo ('la biblioteca esta en ' + $bib + ' y el programa que baja la memoria la busca en ' + $esperada + ': si no la encuentra, avisa.') }
}

# 2) Node (para bajar la memoria) y Git (para bajar el repo)
$node = $null
$c = Get-Command node -ErrorAction SilentlyContinue
if ($c) { $node = $c.Source }
if (-not $node) {
  foreach ($p in @((Join-Path $paquete 'node\node.exe'), (Join-Path $env:LOCALAPPDATA 'BarackMailsPC\node\node.exe'), (Join-Path $env:LOCALAPPDATA 'MiAsistente\node\node.exe'))) { if (Test-Path -LiteralPath $p) { $node = $p; break } }
}
if (-not $node -and $bib) {
  # Node del paquete publicado: primero su lugar nuevo (mudanza del 17/10/2026; la fuente es scripts/_lib/nubeCarpetas.data.json,
  # clave area_vieja: este archivo corre en otra PC sin el repo y lleva el nombre adentro) y despues las carpetas de primer nivel.
  $basesNode = @(Join-Path $bib 'ASISTENTE INGENIERIA\9- VIEJO (no usar)\_CUARENTENA_CLAUDE POR AREA')
  $basesNode += @(Get-ChildItem -LiteralPath $bib -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
  foreach ($base in $basesNode) {
    $n = Join-Path $base '1- PUBLICADO\contenido\marketplace\plugins\barack-area\bin\node.exe'
    if (Test-Path -LiteralPath $n) {
      $propio = Join-Path $env:LOCALAPPDATA 'MiAsistente\node\node.exe'
      if ($Ensayo) { Haria ('copiar Node de la nube a ' + $propio); $node = $n }
      else {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $propio) | Out-Null
        Copy-Item -LiteralPath $n -Destination ($propio + '.nuevo') -Force
        Move-Item -LiteralPath ($propio + '.nuevo') -Destination $propio -Force
        $node = $propio
      }
      break
    }
  }
}
if (-not $node) { Mal 'no encuentro Node.js (ni en esta PC ni en la nube) para bajar la memoria.' }
Ok ('Node: ' + $node)
$hayNpm = [bool](Get-Command npm -ErrorAction SilentlyContinue)

$git = $null
$c = Get-Command git -ErrorAction SilentlyContinue
if ($c) { $git = $c.Source }
else { foreach ($p in @((Join-Path $env:ProgramFiles 'Git\cmd\git.exe'), (Join-Path ${env:ProgramFiles(x86)} 'Git\cmd\git.exe'), (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd\git.exe'))) { if ($p -and (Test-Path -LiteralPath $p)) { $git = $p; break } } }
if ($git) { Ok 'Git' } else { Ojo 'esta PC no tiene Git: el repo se baja como zip de GitHub (anda igual, pero sin historial; para subir cambios hace falta instalar Git).' }

# 3) el repo (reglas, skills del proyecto, CLAUDE.md, scripts)
$ErrorActionPreference = 'Continue'
if (Test-Path -LiteralPath (Join-Path $Repo 'scripts\_nube.mjs')) {
  Ok ('el repo ya esta en ' + $Repo)
  if ($git -and (Test-Path -LiteralPath (Join-Path $Repo '.git'))) {
    $sucio = (& $git -C $Repo status --porcelain 2>$null)
    if ($sucio) { Ojo 'el repo tiene cambios sin guardar: no lo actualizo.' }
    elseif ($Ensayo) { Haria 'git pull --ff-only' }
    else { & $git -C $Repo pull --ff-only 2>&1 | Out-Null; Ok 'repo al dia con GitHub' }
  }
}
elseif ($Ensayo) {
  if (Test-Path -LiteralPath (Join-Path $paquete 'repo.zip')) { Haria ('abrir el repo.zip del pendrive en ' + $Repo) }
  elseif ($git) { Haria ('git clone --depth 1 ' + $URL + ' ' + $Repo) } else { Haria ('bajar el zip de ' + $URL + ' y dejarlo en ' + $Repo) }
}
else {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Repo) | Out-Null
  if (Test-Path -LiteralPath (Join-Path $paquete 'repo.zip')) {
    Write-Host '  Abriendo el repo que viene en el pendrive (sin internet)...'
    try { Expand-Archive -LiteralPath (Join-Path $paquete 'repo.zip') -DestinationPath $Repo -Force } catch { Mal ('no pude abrir el repo del pendrive: ' + $_.Exception.Message) }
    if (-not (Test-Path -LiteralPath (Join-Path $Repo 'scripts\_nube.mjs'))) { Mal 'el repo del pendrive no trae scripts\_nube.mjs.' }
    if ($git) { Ojo 'el repo viene del pendrive, sin historial de git: para sincronizarlo con GitHub mas adelante hay que conectarlo (se hace despues).' }
  }
  elseif ($git) {
    Write-Host '  Bajando el repo de GitHub (puede tardar unos minutos)...'
    & $git clone --depth 1 ($URL + '.git') $Repo
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath (Join-Path $Repo 'scripts\_nube.mjs'))) { Mal 'no pude bajar el repo con git. Puede ser que la red de la empresa bloquee GitHub.' }
  } else {
    try {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $zip = Join-Path $env:TEMP 'mi_pc_repo.zip'
      $tmp = Join-Path $env:TEMP 'mi_pc_repo'
      Write-Host '  Bajando el repo de GitHub (zip)...'
      Invoke-WebRequest -Uri ($URL + '/archive/refs/heads/main.zip') -OutFile $zip -UseBasicParsing
      Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
      Move-Item -LiteralPath (Join-Path $tmp 'tiempos-y-balanceos-main') -Destination $Repo
    } catch { Mal ('no pude bajar el repo de GitHub: ' + $_.Exception.Message) }
  }
  Ok ('repo en ' + $Repo)
}

# 4) la memoria y la configuracion (lo que escribe el programa del repo: nunca borra nada de esta PC)
if (Test-Path -LiteralPath (Join-Path $Repo 'scripts\_nube.mjs')) {
  Write-Host ''
  Write-Host '  Trayendo tu memoria y tus claves...'
  Push-Location $Repo
  if ($Ensayo) { & $node 'scripts\_nube.mjs' --bajar 2>&1 | ForEach-Object { Write-Host ('    ' + $_) -ForegroundColor DarkGray } }
  else {
    & $node 'scripts\_nube.mjs' --bajar --aplicar 2>&1 | ForEach-Object { Write-Host ('    ' + $_) }
    if ($LASTEXITCODE -ne 0) { Pop-Location; Mal 'no pude traer la memoria de la nube (el detalle esta arriba).' }
  }
  Pop-Location
  if (-not $Ensayo) { Ok 'memoria y claves en su lugar' }
} else { Haria 'traer la memoria y la configuracion con scripts\_nube.mjs --bajar --aplicar' }

# 4 bis) las skills, reglas, agentes, comandos, hooks y planes: solo vienen en el pendrive (20/10/2026, no estan en la nube).
#        Se copian sin borrar nada de esta PC (robocopy /E).
$config = Join-Path $nube 'claude-config'
if (Test-Path -LiteralPath $config -PathType Container) {
  foreach ($sub in @('rules', 'skills', 'agents', 'commands', 'hooks', 'plans')) {
    $o = Join-Path $config $sub
    if (-not (Test-Path -LiteralPath $o -PathType Container)) { continue }
    if ($Ensayo) { Haria ('copiar ' + $sub + ' a ' + (Join-Path $claudeDir $sub)); continue }
    & robocopy $o (Join-Path $claudeDir $sub) /E /COPY:DAT /R:1 /W:1 /NP /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { Ojo ('no pude copiar ' + $sub + ' (robocopy ' + $LASTEXITCODE + ')') } else { Ok ($sub + ' en su lugar') }
  }
} else { Ojo 'tus skills, reglas y hooks no vienen aca (no estan en la nube desde el 20/10): traelos con el pendrive (node scripts\_pendriveAsistente.mjs en la PC principal).' }

# 5) el settings.json de Claude: el tuyo, sin lo que es de la otra PC, y con el asistente por area apagado
$ajuste = Join-Path $aqui 'ajustar_settings.mjs'
$origenSettings = Join-Path $nube 'claude-config\settings.json'
if (Test-Path -LiteralPath $origenSettings) {
  $args2 = @($ajuste, '--origen', $origenSettings, '--destino', (Join-Path $claudeDir 'settings.json'), '--home', $env:USERPROFILE)
  if ($Ensayo) { $args2 += '--ensayo' }
  $salida = (& $node @args2 2>&1 | Select-Object -Last 1)
  $r = $null
  try { $r = $salida | ConvertFrom-Json } catch { $r = $null }
  if ($r -and ($r.resultado -eq 'ok' -or $r.resultado -eq 'ensayo')) {
    foreach ($ch in @($r.cambios)) { Write-Host ('    ' + $ch) }
    if ($Ensayo) { Haria 'dejar tu settings.json de Claude' } else { Ok 'settings.json de Claude: el tuyo' }
    if ($r.respaldo) { Ok ('lo que habia quedo guardado en ' + $r.respaldo) }
  } else { Ojo ('no pude dejar tu settings.json de Claude: ' + $salida) }
} else { Ojo 'tu settings.json de Claude no viene aca (desde el 20/10 viaja solo por pendrive).' }

# 6) el asistente "por area": si esta, se apaga (no se borra nada)
$tarea = Get-ScheduledTask -TaskName $TAREA_POR_AREA -ErrorAction SilentlyContinue
if ($tarea) {
  if ($Ensayo) { Haria ('sacar la tarea "' + $TAREA_POR_AREA + '"') }
  else { try { Unregister-ScheduledTask -TaskName $TAREA_POR_AREA -Confirm:$false; Ok 'saque la tarea del asistente por area' } catch { Ojo ('no pude sacar la tarea del asistente por area: ' + $_.Exception.Message) } }
}

# 6 bis) la tarea que mantiene esta PC y la de Ingenieria iguales (08/10/2026): corre
#        node scripts\_nube.mjs --sincronizar --aplicar al iniciar sesion y cada 2 h (gana el mas nuevo, nada se borra).
if ($Ensayo) { Haria 'registrar la tarea "Barack - mi asistente al dia" (sincroniza tu memoria y configuracion cada 2 h)' }
elseif (Test-Path -LiteralPath (Join-Path $Repo 'scripts\_nube.mjs')) {
  try {
    Push-Location $Repo
    $salidaTarea = (& $node 'scripts\_nube.mjs' --registrar-tarea 2>&1 | Out-String)
    $codigoTarea = $LASTEXITCODE
    Pop-Location
    if ($codigoTarea -eq 0) { Ok 'tarea "Barack - mi asistente al dia" registrada: tu memoria y tu configuracion se mantienen iguales en las dos PC' }
    else { Ojo ('no pude registrar la tarea que sincroniza las dos PC: ' + (($salidaTarea.Trim() -split "`n") | Select-Object -Last 1)) }
  } catch { Ojo ('no pude registrar la tarea que sincroniza las dos PC: ' + $_.Exception.Message) }
}

# 7) los programas que usan los scripts del repo (npm install): solo si hay npm
if ((Test-Path -LiteralPath (Join-Path $Repo 'package.json')) -and -not (Test-Path -LiteralPath (Join-Path $Repo 'node_modules'))) {
  if (-not $hayNpm) { Ojo 'esta PC no tiene Node completo (npm): los scripts que usan Supabase no van a andar hasta instalar Node LTS (nodejs.org) y correr "npm install" en la carpeta del repo.' }
  elseif ($Ensayo) { Haria 'npm install' }
  else {
    Write-Host '  Instalando los programas del repo (npm install, puede tardar)...'
    Push-Location $Repo
    & npm install --no-audit --no-fund 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Host ('    ' + $_) -ForegroundColor DarkGray }
    Pop-Location
  }
}
$ErrorActionPreference = 'Stop'

Write-Host ''
if ($Ensayo) { Write-Host '  ENSAYO TERMINADO: no se toco nada.' -ForegroundColor Cyan; Write-Host ''; exit 0 }
Write-Host '  LISTO.' -ForegroundColor Green
Write-Host ('  Cerra el Claude que tengas abierto, abrilo de nuevo y elegi la carpeta  ' + $Repo) -ForegroundColor Green
Write-Host '  (la primera vez te pide confiar en la carpeta: decile que si).'
if ($desdePendrive) { Write-Host '  Ya podes sacar el pendrive.' -ForegroundColor Green }
if ($advertencias.Count -gt 0) {
  Write-Host ''
  Write-Host '  Para tener en cuenta:' -ForegroundColor Yellow
  foreach ($a in $advertencias) { Write-Host ('   - ' + $a) -ForegroundColor Yellow }
}
Write-Host ''
exit 0
