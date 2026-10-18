<#
.SYNOPSIS
  Tarea "Barack - Claude por area": corre como el usuario, sin ventana, al iniciar sesion y cada 4 h.
  Cero tokens: solo copia archivos y corre programas locales. Parte de tools\paquete-equipo\sync_equipo.ps1.

    1) ACTUALIZAR  node _paquete.mjs --actualizar --proyecto area   (baja lo nuevo, firmado; nunca pisa ni borra;
                                                                     deja la salud de la PC en el buzon de la nube)
    2) AVISOS      sube la cola local de avisos del plugin (<estado>\avisos-pendientes\<pc>\) al buzon (mover, no copiar)
    3) INVENTARIO  una vez por semana, inventario.ps1 -> 4- BUZON\inventario\<pc>.json
    4) SALUD       completa en 4- BUZON\salud\<pc>.json lo que el programa de la base no sabe (disco, Y:, Z:, Python, politica)
    5) MAILS       node mails_area.mjs: sube a la nube de Ingenieria los mails de trabajo de ESTA PC, SOLO si la lista
                   de personas publicada dice "mails": "sube" para su persona (apagado por defecto; sin Claude; solo lee
                   Outlook). Corre antes de la salud, que anota como le fue. Solo con la nube de Barack a la vista.

  No borra nada en ningun lado. Sale siempre con 0: el detalle queda en <estado>\sync.log y estado.json.
  -Simular es el dry-run de los avisos: escribe en el log "origen -> destino" de cada uno y no mueve nada.

  LA NUBE RECORDADA (03/10/2026). Si la nube no se encuentra por nombre (un OneDrive de otra cuenta, una carpeta de
  red, un pendrive), el programa de la base usa la carpeta de la que se instalo esta PC (<estado>\origen.json), si hoy
  esta a la vista. Aca NO se le pasa --nube en ese caso: la elige el. Esta tarea mira origen.json solo para saber si
  esa carpeta trae buzon: avisos, inventario y salud van a su "4- BUZON" unicamente si tiene la forma de la nube
  (CLAUDE POR AREA\1- PUBLICADO); en una copia con otro nombre no se escribe nada y los avisos quedan en la cola.

  Parametros (para probar):
    -HomeDir     la carpeta de la PC (por defecto CLAUDE_AREA_HOME, o la de arriba de publicado\programas, o C:\ClaudeBarack)
    -Nube        la carpeta CLAUDE POR AREA o directamente su 1- PUBLICADO (por defecto CLAUDE_AREA_NUBE o se la pide al programa)
    -EstadoDir   donde viven log, estado y la clave publica (por defecto CLAUDE_AREA_ESTADO o %LOCALAPPDATA%\BarackEquipo)
    -SinActualizar / -SinAvisos / -SinInventario / -SinMails   saltean un paso     -ForzarInventario  lo corre aunque no haya pasado la semana
    -ClavesInventario <claves del registro>         SOLO PRUEBAS: se las pasa a inventario.ps1 -Claves
    -PrioridadNormal   no baja la prioridad del proceso (para pruebas)   -Verbose2  muestra el log en pantalla
  La tarea de Windows se registra SOLO con -RegistrarTarea (lo llama "_paquete.mjs --instalar" al terminar una
  instalacion de verdad, sin ninguna carpeta indicada); -VerTarea la muestra sin registrar nada; -SinTarea es lo que
  pasa por defecto y existe para que las pruebas lo digan explicito. -RegistrarTarea con CUALQUIER ruta indicada
  (-HomeDir, -Nube, -EstadoDir o sus variables CLAUDE_AREA_*) se niega: sale con 2 y no registra ni escribe nada. Y hay una
  barrera que no depende de como se lo llame: solo registra si ESTE programa corre desde la copia instalada de verdad,
  C:\ClaudeBarack\publicado\programas (desde el repo, un temporal o un pendrive: 2 y nada registrado).

  EL NODE (03/10/2026): primero el propio de la PC (<estado>\node\node.exe, copia del que viaja con el plugin instalado,
  que se repone si no es igual: por tamano y por hash); si el propio ni arranca lo repone una vez y reintenta; el del PATH
  solo si no hay ninguno propio o si sigue sin arrancar. estado.json dice cual uso (node) y el log tambien.

  UNA CARPETA RECORDADA (la nube no se ve por nombre ni se indico) recibe algo de esta PC (avisos, inventario, salud) SOLO si
  la firma verifico en esta corrida: el programa de la base salio con 0. Con cualquier otro resultado no se escribe nada
  ahi (estado.json: sin_verificar; los avisos esperan en la cola local). La nube por nombre o la indicada lo reciben todo
  aunque la firma falle.

  Solo ASCII en este archivo (powershell.exe 5.1 sin BOM lee UTF-8 como ANSI).
#>
[CmdletBinding()]
param(
  [string]$HomeDir,
  [string]$Nube,
  [string]$EstadoDir,
  [switch]$SinActualizar,
  [switch]$SinAvisos,
  [switch]$SinInventario,
  [switch]$ForzarInventario,
  [string[]]$ClavesInventario,
  [switch]$Simular,
  [switch]$SinTarea,
  [switch]$RegistrarTarea,
  [switch]$VerTarea,
  [int]$MinutosActualizar = 10,
  [int]$MinutosInventario = 5,
  [switch]$SinMails,
  [int]$MinutosMails = 12,
  [switch]$PrioridadNormal,
  [switch]$Verbose2
)
$ErrorActionPreference = 'Continue'
$TAREA = 'Barack - Claude por area'
$DIAS_INVENTARIO = 7

# ---- todo o nada (CONTRATO): o las tres rutas son las reales o las tres son de prueba ---------------------
# Una mezcla (una PC de prueba con la nube real, o el estado real) escribiria salud o avisos falsos en la nube
# de verdad, o claves de prueba en el estado real. Se decide ANTES de crear o escribir nada. -VerTarea no escribe.

# La carpeta de la que se instalo esta PC (<estado>\origen.json), solo si HOY trae una publicacion. Solo lee.
function Leer-Recordada([string]$dirEstado) {
  if (-not $dirEstado) { return $null }
  try {
    $o = Get-Content -LiteralPath (Join-Path $dirEstado 'origen.json') -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json
    $c = [string]$o.publicado
    if ($c -and [IO.Path]::IsPathRooted($c) -and (Test-Path -LiteralPath (Join-Path $c 'VERSION.json') -PathType Leaf) -and (Test-Path -LiteralPath (Join-Path $c 'MANIFIESTO.json') -PathType Leaf)) { return $c.TrimEnd('\') }
  } catch {}
  return $null
}

$homeIndicado = [bool]($HomeDir -or $env:CLAUDE_AREA_HOME)
$nubeIndicada = [bool]($Nube -or $env:CLAUDE_AREA_NUBE)
$estadoIndicado = [bool]($EstadoDir -or $env:CLAUDE_AREA_ESTADO)

# -RegistrarTarea solo vale en una instalacion de VERDAD: sin ninguna ruta indicada. La tarea es una por usuario de
# Windows y se llama siempre igual: registrarla con carpetas de prueba (aunque sean las tres) pisaria la tarea real de
# esta PC y la dejaria apuntando a un programa de prueba que despues se borra. Se niega ANTES de crear o escribir nada.
# -VerTarea no registra ni escribe, asi que sigue valiendo; -SinTarea es lo que pasa por defecto y tampoco registra.
if ($RegistrarTarea -and -not $SinTarea -and -not $VerTarea -and ($homeIndicado -or $nubeIndicada -or $estadoIndicado)) {
  $indicadas = @()
  if ($homeIndicado) { $indicadas += 'la carpeta de la PC (-HomeDir / CLAUDE_AREA_HOME)' }
  if ($nubeIndicada) { $indicadas += 'la nube (-Nube / CLAUDE_AREA_NUBE)' }
  if ($estadoIndicado) { $indicadas += 'el estado (-EstadoDir / CLAUDE_AREA_ESTADO)' }
  Write-Host ('No registro nada: -RegistrarTarea solo vale en una instalacion de verdad, sin ninguna ruta indicada, y esta corrida trae carpetas de prueba: ' + ($indicadas -join ', ') + '. Una tarea no se registra desde carpetas de prueba: pisaria la tarea real de esta PC.')
  exit 2
}

# La BARRERA que no depende de como se lo llame (auditoria del 04/10/2026): "ninguna ruta indicada" no alcanza (una opcion
# vacia, una variable definida y vacia o una PC entera armada en una carpeta temporal cuentan como "ninguna"). La tarea solo
# se registra si ESTE programa corre desde la copia instalada de verdad, <C:\ClaudeBarack>\publicado\programas: la ruta con
# la que "_paquete.mjs --instalar" lo llama al terminar una instalacion (rutaHomePorDefecto + REL_PROGRAMA_TAREA). Desde el
# repo, un temporal o un pendrive: 2 y nada registrado. Se compara la ruta ya resuelta, sin mayusculas; ante la duda (una
# ruta corta de Windows, una carpeta enlazada) se niega. -VerTarea no registra y sigue mostrando la definicion desde cualquier lado.
$PROGRAMAS_REALES = 'C:\ClaudeBarack\publicado\programas'
function Corre-Desde-La-Copia-Real {
  $aqui = [string]$PSScriptRoot
  try { if ($aqui) { $aqui = [IO.Path]::GetFullPath($aqui) } } catch {}
  return (($aqui.TrimEnd('\')) -ieq $PROGRAMAS_REALES)
}
if ($RegistrarTarea -and -not $SinTarea -and -not $VerTarea -and -not (Corre-Desde-La-Copia-Real)) {
  Write-Host ('No registro nada: -RegistrarTarea solo registra desde la copia instalada de verdad (' + $PROGRAMAS_REALES + ') y este programa corre desde "' + $PSScriptRoot + '". Una tarea no se registra desde el repo, una carpeta temporal o un pendrive.')
  exit 2
}

$dePrueba = @()
$reales = @()
if ($homeIndicado) { $dePrueba += 'la carpeta de la PC (-HomeDir / CLAUDE_AREA_HOME)' } else { $reales += 'la carpeta de la PC' }
if ($nubeIndicada) { $dePrueba += 'la nube (-Nube / CLAUDE_AREA_NUBE)' } else { $reales += 'la nube' }
if ($estadoIndicado) { $dePrueba += 'el estado (-EstadoDir / CLAUDE_AREA_ESTADO)' } else { $reales += 'el estado' }
# La nube recordada no es ni de prueba ni real: la dice el estado. Con la PC y el estado de prueba y SIN nube indicada
# se corre solo si ese estado recuerda una carpeta que hoy esta a la vista; y entonces la nube NO se busca por nombre
# (una PC de prueba no toca nunca la nube de verdad).
$soloRecordada = $false
if ($dePrueba.Count -gt 0 -and $reales.Count -gt 0 -and -not $VerTarea) {
  # (con -RegistrarTarea no vale: una tarea no se registra nunca desde carpetas de prueba a medias)
  if ($homeIndicado -and $estadoIndicado -and -not $nubeIndicada -and -not $RegistrarTarea) {
    $estadoMirado = $EstadoDir
    if (-not $estadoMirado) { $estadoMirado = $env:CLAUDE_AREA_ESTADO }
    if (Leer-Recordada $estadoMirado) { $soloRecordada = $true }
  }
  if (-not $soloRecordada) {
    Write-Host ('No hago nada: estas mezclando carpetas de prueba y reales. De prueba: ' + ($dePrueba -join ', ') + '. Reales: ' + ($reales -join ', ') + '. O las tres de prueba o ninguna.')
    exit 2
  }
}

# ---- carpetas ---------------------------------------------------------------------------------------
if (-not $HomeDir) {
  if ($env:CLAUDE_AREA_HOME) { $HomeDir = $env:CLAUDE_AREA_HOME }
  elseif ((Split-Path -Leaf $PSScriptRoot) -eq 'programas' -and (Split-Path -Leaf (Split-Path -Parent $PSScriptRoot)) -eq 'publicado') { $HomeDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot) }
  else { $HomeDir = 'C:\ClaudeBarack' }
}
$HomeDir = $HomeDir.TrimEnd('\')
$Publicado = Join-Path $HomeDir 'publicado'
if (-not $EstadoDir) {
  if ($env:CLAUDE_AREA_ESTADO) { $EstadoDir = $env:CLAUDE_AREA_ESTADO } else { $EstadoDir = Join-Path $env:LOCALAPPDATA 'BarackEquipo' }
}
# La carpeta de estado se crea recien cuando se va a escribir (mas abajo): -VerTarea no deja ni una carpeta.
$LOG = Join-Path $EstadoDir 'sync.log'
$errores = New-Object System.Collections.ArrayList
$estado = [ordered]@{ ultimo = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'); home = $HomeDir; publicado = $null; actualizar = $null; avisos = $null; inventario = $null; salud = $null; mails = @{ resultado = 'sin_uso' } }

function Log([string]$m) {
  $linea = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m"
  try { Add-Content -Path $LOG -Value $linea -Encoding UTF8 } catch {}
  if ($Verbose2) { Write-Host $linea }
}
function Fallo([string]$m) { [void]$errores.Add($m); Log "ERROR $m" }
function Resumir([string]$t) {
  if (-not $t) { return '' }
  $s = ($t -replace '\r?\n', ' | ')
  if ($s.Length -gt 1200) { $s = $s.Substring(0, 1200) + '...' }
  return $s
}
function Buscar-Exe([string]$nombre) {
  $cands = @(Get-Command $nombre -All -ErrorAction SilentlyContinue | Where-Object { $_.Source -and ($_.Source -notmatch 'WindowsApps') -and (Test-Path $_.Source) })
  if ($cands.Count -gt 0) { return $cands[0].Source }
  return $null
}

# La carpeta publicada de la nube: la que se paso, la de la variable, o la que diga el programa (--donde).
function Resolver-Publicado([string]$programa) {
  $raiz = $null
  if ($Nube) { $raiz = $Nube } elseif ($env:CLAUDE_AREA_NUBE) { $raiz = $env:CLAUDE_AREA_NUBE }
  if ($raiz) {
    $raiz = $raiz.TrimEnd('\')
    if ((Split-Path -Leaf $raiz) -eq '1- PUBLICADO') { return $raiz }
    return (Join-Path $raiz '1- PUBLICADO')
  }
  if ($script:node -and $programa) {
    $d = Correr-Node @($programa, '--donde', '--proyecto', 'area') 2 $null
    if (-not $d.Cortado -and $d.Codigo -eq 0) { return ((($d.Salida -split '\r?\n') | Where-Object { $_.Trim() } | Select-Object -Last 1).Trim()) }
  }
  return $null
}

# SHA-256 de un archivo, o $null si no se puede leer (otro programa lo tiene tomado).
function Hash-Archivo([string]$ruta) {
  try { return (Get-FileHash -LiteralPath $ruta -Algorithm SHA256 -ErrorAction Stop).Hash } catch { return $null }
}

# Deja el Node propio igual al del plugin: copia a un temporal (<propio>.nuevo) y de ahi lo mueve al lugar. Un programa que
# esta corriendo no se puede reemplazar, y una copia cortada a la mitad no puede dejar un node.exe a medias. Los dos pasos
# con -ErrorAction Stop: si falla uno (el archivo esta tomado por otro programa) queda anotado en el log. $true si quedo repuesto.
function Reponer-NodePropio([string]$plugin, [string]$propio) {
  $nuevo = $propio + '.nuevo'
  try {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $propio) -ErrorAction Stop | Out-Null
    Copy-Item -LiteralPath $plugin -Destination $nuevo -Force -ErrorAction Stop
    Move-Item -LiteralPath $nuevo -Destination $propio -Force -ErrorAction Stop
    Log ('Node propio repuesto desde el del plugin (' + $propio + ')')
    return $true
  } catch {
    Log ('no pude reponer el Node propio desde el del plugin: ' + $_.Exception.Message)
    return $false
  }
}

# Corre el programa de la base con Node: el propio de esta PC primero. Si ese ni arranca (una copia danada), lo repone una
# vez desde el del plugin (si no acaba de hacerse en esta corrida) y reintenta; si sigue sin arrancar, sigue con el del PATH
# (si lo hay) y lo deja anotado: una copia mala no puede dejar a la PC sin actualizarse.
function Correr-Node([string[]]$argumentos, [int]$minutos, [string]$pub) {
  $r = Correr $script:node $argumentos $minutos $pub
  if ($r.NoArranco -and $script:nodeOrigen -eq 'propio') {
    if (-not $script:nodeReintentado -and -not $script:nodeRepuestoAhora -and (Test-Path -LiteralPath $script:nodePlugin)) {
      $script:nodeReintentado = $true
      Log ('el Node propio no arranca (' + $script:node + '): lo repongo desde el del plugin y reintento una vez')
      if (Reponer-NodePropio $script:nodePlugin $script:nodePropio) { $r = Correr $script:node $argumentos $minutos $pub }
    }
    if ($r.NoArranco) {
      $otro = Buscar-Exe 'node'
      if ($otro) {
        Log ('el Node propio no arranca (' + $script:node + '): sigo con el del PATH (' + $otro + ')')
        $script:node = $otro
        $script:nodeOrigen = 'path'
        $r = Correr $otro $argumentos $minutos $pub
      } else { Log ('el Node propio no arranca (' + $script:node + ') y no hay otro en el PATH') }
    }
  }
  return $r
}

# Corre un programa sin ventana, con tope de tiempo y las variables del contrato; si se pasa, lo corta.
# NoArranco = true cuando el sistema ni pudo ponerlo en marcha (un .exe danado, que no es un programa de Windows).
function Correr([string]$exe, [string[]]$argumentos, [int]$minutos, [string]$pub) {
  $r = @{ Codigo = -1; Salida = ''; Cortado = $false; NoArranco = $false }
  $arranco = $false
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
    $psi.WorkingDirectory = $(if (Test-Path $HomeDir) { $HomeDir } else { $PSScriptRoot })
    $psi.EnvironmentVariables['CLAUDE_AREA_HOME'] = $HomeDir
    $psi.EnvironmentVariables['CLAUDE_AREA_ESTADO'] = $EstadoDir
    if ($pub) { $psi.EnvironmentVariables['CLAUDE_AREA_NUBE'] = (Split-Path -Parent $pub) }
    $p = [System.Diagnostics.Process]::Start($psi)
    $arranco = $true
    $salida = $p.StandardOutput.ReadToEndAsync()
    $err = $p.StandardError.ReadToEndAsync()
    if (-not $p.WaitForExit($minutos * 60 * 1000)) {
      try { & taskkill.exe /PID $p.Id /T /F 2>&1 | Out-Null } catch {}
      try { $p.Kill() } catch {}
      $r.Cortado = $true
      return $r
    }
    $p.WaitForExit()
    $r.Codigo = $p.ExitCode
    $r.Salida = ($salida.Result + $err.Result).Trim()
  } catch { $r.Salida = "no arranco: $($_.Exception.Message)"; $r.NoArranco = -not $arranco }
  return $r
}
function Escribir-Estado {
  try {
    $enc = New-Object System.Text.UTF8Encoding($false)
    $destinoEstado = Join-Path $EstadoDir 'estado.json'
    [IO.File]::WriteAllText("$destinoEstado.tmp", ($estado | ConvertTo-Json -Depth 6), $enc)
    Move-Item -Force "$destinoEstado.tmp" $destinoEstado
  } catch { Log "no pude escribir estado.json: $($_.Exception.Message)" }
}
# Nombre de la PC apto para carpeta, con la misma regla que el plugin y que el programa de la base.
function Nombre-Pc {
  $crudo = $null
  try {
    $perfil = Get-Content -LiteralPath (Join-Path $HomeDir 'perfil.json') -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json
    if ($perfil.pc) { $crudo = [string]$perfil.pc }
  } catch {}
  if (-not $crudo) { $crudo = $env:COMPUTERNAME }
  if (-not $crudo) { $crudo = 'pc-sin-nombre' }
  $limpio = ($crudo -replace '[^A-Za-z0-9._-]', '-')
  if ($limpio.Length -gt 40) { $limpio = $limpio.Substring(0, 40) }
  return $limpio
}

# ---- la tarea de Windows (solo con -RegistrarTarea; -VerTarea la muestra) ------------------------------
function Nueva-Definicion {
  $conhost = Join-Path $env:SystemRoot 'System32\conhost.exe'
  $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $yo = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  # pythonw/powershell lanzados directo por el Programador de tareas se traban o muestran ventana en
  # estas PC: lo que anda, sin ventana, es conhost --headless <programa> <argumentos>.
  # La tarea NO pasa -HomeDir: en la PC real todo se resuelve solo (el script vive en publicado\programas) y asi
  # la corrida es "todas las rutas reales", no una mezcla.
  $argTarea = '--headless "' + $ps + '" -NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
  $accion = New-ScheduledTaskAction -Execute $conhost -Argument $argTarea -WorkingDirectory $HomeDir
  $alEntrar = New-ScheduledTaskTrigger -AtLogOn -User $yo
  $cada4 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(10) -RepetitionInterval (New-TimeSpan -Hours 4)
  $ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
               -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -Priority 6
  $quien = New-ScheduledTaskPrincipal -UserId $yo -LogonType Interactive -RunLevel Limited
  return @{ Accion = $accion; Triggers = @($alEntrar, $cada4); Ajustes = $ajustes; Principal = $quien; Usuario = $yo }
}
function Mostrar-Tarea($def) {
  Write-Host "Tarea '$TAREA' (con -VerTarea no se registra nada):"
  Write-Host "  Programa : $($def.Accion.Execute)"
  Write-Host "  Argumentos: $($def.Accion.Arguments)"
  Write-Host "  Disparadores: al iniciar sesion de $($def.Usuario) + cada $($def.Triggers[1].Repetition.Interval)"
  Write-Host "  Prioridad: $($def.Ajustes.Priority)  Bateria: permitido=$(-not $def.Ajustes.DisallowStartIfOnBatteries) sigue=$(-not $def.Ajustes.StopIfGoingOnBatteries)"
  Write-Host "  Tope: $($def.Ajustes.ExecutionTimeLimit)  Instancias multiples: $($def.Ajustes.MultipleInstances)"
  Write-Host "  Inicio de sesion: $($def.Principal.LogonType)  Nivel: $($def.Principal.RunLevel)"
}
function Registrar-Tarea {
  # (la misma barrera de arriba, pegada al registro: nada llama a Register-ScheduledTask sin pasar por aca)
  if (-not (Corre-Desde-La-Copia-Real)) { throw ('este programa no corre desde la copia instalada de verdad (' + $PROGRAMAS_REALES + ')') }
  $def = Nueva-Definicion
  # -ErrorAction Stop: si Windows no deja, el motivo que se muestra es el de verdad (y no "no encuentro la tarea")
  Register-ScheduledTask -TaskName $TAREA -Action $def.Accion -Trigger $def.Triggers -Principal $def.Principal -Settings $def.Ajustes -Force -ErrorAction Stop | Out-Null
  $t = Get-ScheduledTask -TaskName $TAREA -ErrorAction Stop
  if (-not (Test-Path $EstadoDir)) { New-Item -ItemType Directory -Force -Path $EstadoDir | Out-Null }
  Log "tarea registrada: $($t.TaskName) ($($t.State))"
  Write-Host "Tarea '$TAREA' registrada: al iniciar sesion y cada 4 h, sin ventana."
}
if ($VerTarea) { Mostrar-Tarea (Nueva-Definicion); exit 0 }
if ($RegistrarTarea -and -not $SinTarea) {
  try { Registrar-Tarea; exit 0 } catch { Write-Host "No pude registrar la tarea: $($_.Exception.Message)"; exit 1 }
}

# ---- de aca en adelante se escribe: recien ahora la carpeta de estado ----------------------------------
if (-not (Test-Path $EstadoDir)) { New-Item -ItemType Directory -Force -Path $EstadoDir | Out-Null }

# ---- una sola corrida a la vez, y con poco consumo ----------------------------------------------------
$mutex = New-Object System.Threading.Mutex($false, 'Local\BarackAreaSync')
$tengo = $false
try { $tengo = $mutex.WaitOne(0) } catch { $tengo = $true }
if (-not $tengo) { Log 'ya hay otra corrida en marcha: no hago nada'; exit 0 }

try {
  if (-not $PrioridadNormal) { try { (Get-Process -Id $PID).PriorityClass = 'BelowNormal' } catch {} }
  if ((Test-Path $LOG) -and ((Get-Item $LOG).Length -gt 1MB)) { Move-Item -LiteralPath $LOG -Destination ($LOG + '.' + (Get-Date -Format 'yyyyMMdd-HHmmss')) }
  Log "== sync arranca (home $HomeDir)"

  # ---- el programa de la base y Node -------------------------------------------------------------------
  $script = Join-Path $PSScriptRoot '_paquete.mjs'
  if (-not (Test-Path $script)) { $script = Join-Path $Publicado 'programas\_paquete.mjs' }
  # El Node: PRIMERO el propio de esta PC, la copia en <estado>\node\node.exe del Node que viaja con el plugin
  # (03/10/2026); el del PATH solo si no hay ninguno propio (un Node viejo del PATH fallaria en cada corrida). La copia
  # existe porque un programa que esta corriendo no se puede reemplazar: la tarea corre con la copia y asi el actualizador
  # puede reponer el del plugin. Se refresca desde el del plugin instalado cuando no es igual: por tamano y, si el tamano
  # coincide, por HASH (04/10/2026: una copia danada del mismo tamano no se reponia nunca).
  $nodePropio = Join-Path $EstadoDir 'node\node.exe'
  $nodePlugin = Join-Path $Publicado 'marketplace\plugins\barack-area\bin\node.exe'
  $nodeRepuestoAhora = $false
  $nodeReintentado = $false
  if (Test-Path -LiteralPath $nodePlugin) {
    $hayQueReponer = -not (Test-Path -LiteralPath $nodePropio)
    if (-not $hayQueReponer) {
      if ((Get-Item -LiteralPath $nodePlugin).Length -ne (Get-Item -LiteralPath $nodePropio).Length) { $hayQueReponer = $true }
      else {
        $hashPlugin = Hash-Archivo $nodePlugin
        $hashPropio = Hash-Archivo $nodePropio
        if (-not $hashPlugin -or -not $hashPropio -or $hashPlugin -ne $hashPropio) { $hayQueReponer = $true }
      }
    }
    if ($hayQueReponer) { $nodeRepuestoAhora = Reponer-NodePropio $nodePlugin $nodePropio }
  }
  $node = $null
  $nodeOrigen = $null
  if (Test-Path -LiteralPath $nodePropio) { $node = $nodePropio; $nodeOrigen = 'propio' }
  else { $node = Buscar-Exe 'node'; if ($node) { $nodeOrigen = 'path' } }
  $Pub = $null
  if (-not $soloRecordada) { $Pub = Resolver-Publicado $(if (Test-Path $script) { $script } else { $null }) }
  # La nube recordada, con la MISMA regla que el programa de la base: la nube por nombre (o la indicada) manda si trae
  # una publicacion; si no, la carpeta de la que se instalo esta PC. En ese caso no se le pasa --nube: la elige el.
  $Recordada = $null
  if (-not $nubeIndicada) {
    $candidata = Leer-Recordada $EstadoDir
    if ($candidata -and ($soloRecordada -or -not $Pub -or -not (Test-Path -LiteralPath (Join-Path $Pub 'VERSION.json')))) { $Recordada = $candidata; $Pub = $null }
  }
  if (-not $node -and $Pub) {
    $nodeNube = Join-Path (Split-Path -Parent $Pub) '1- PUBLICADO\contenido\marketplace\plugins\barack-area\bin\node.exe'
    if (Test-Path $nodeNube) { $node = $nodeNube; $nodeOrigen = 'nube' }
  }
  if ($node) { Log ('node: ' + $node + ' (' + $nodeOrigen + ')') }
  # El buzon (avisos, inventario, salud): el de la nube; con la recordada, solo si trae la forma de la nube.
  $PubBuzon = $Pub
  if ($Recordada) {
    if ((Split-Path -Leaf $Recordada) -eq '1- PUBLICADO' -and (Split-Path -Leaf (Split-Path -Parent $Recordada)) -eq 'CLAUDE POR AREA') { $PubBuzon = $Recordada }
    Log ('nube: no la veo por nombre; uso la carpeta de donde se instalo esta PC (' + $Recordada + ')' + $(if (-not $PubBuzon) { ' - sin buzon: no trae la forma de la nube' } else { '' }))
  }
  $estado.publicado = $(if ($Recordada) { $Recordada } else { $Pub })
  $estado.nube = $(if ($Recordada) { 'recordada' } elseif ($Pub) { $(if ($nubeIndicada) { 'indicada' } else { 'por_nombre' }) } else { 'sin_nube' })
  $Buzon = $null
  $RaizBuzon = $null
  if ($PubBuzon) { $RaizBuzon = Split-Path -Parent $PubBuzon; $Buzon = Join-Path $RaizBuzon '4- BUZON' }
  $pc = Nombre-Pc

  # Una carpeta RECORDADA recibe algo de esta PC (avisos, inventario, salud) SOLO si la firma verifico en ESTA corrida: el
  # programa de la base salio con 0. Cualquier otro resultado (3 esperar, 4 firma rechazada / sin clave / version anterior,
  # 1 error, cortado, no corrio) deja la carpeta sin tocar (03/10/2026; regla invertida el 04/10/2026: antes era una lista de
  # rechazos y una publicacion ajena "a medio subir", con el codigo 3, la saltaba). Quien escribio ahi puede no ser Barack, y el inventario
  # es de la PC. El 4 junta "firma rechazada" y "version anterior" y esta tarea no los distingue: ante la duda, no escribe.
  # La nube POR NOMBRE o la indicada sigue recibiendolo todo aunque la firma falle: asi el administrador se entera.
  $recordadaVerificada = $false
  $recordadaSinVerificar = $false

  # ---- 1) actualizar ----------------------------------------------------------------------------------
  if ($SinActualizar) { Log 'actualizar: salteado (-SinActualizar)' }
  elseif (-not (Test-Path $script)) { $estado.actualizar = @{ resultado = 'sin_script'; detalle = "no esta $script" }; Fallo "no esta $script" }
  elseif (-not $node) { $estado.actualizar = @{ resultado = 'sin_node'; detalle = 'no encuentro Node.js' }; Fallo 'no encuentro Node.js: no puedo actualizar' }
  elseif (-not $Pub -and -not $Recordada) {
    # ni la nube por nombre ni la carpeta de donde se instalo (un pendrive desenchufado): no es un error, se reintenta
    $estado.actualizar = @{ resultado = 'sin_nube'; detalle = 'no veo la nube ni la carpeta de donde se instalo esta PC' }
    Log 'actualizar: no veo la nube ni la carpeta de donde se instalo esta PC (se reintenta en la proxima corrida)'
  }
  else {
    $args1 = @($script, '--actualizar', '--proyecto', 'area', '--destino', $Publicado, '--home', $HomeDir)
    if ($Pub) { $args1 += @('--nube', $Pub) }
    $b = Correr-Node $args1 $MinutosActualizar $Pub
    if ($b.Cortado) {
      $estado.actualizar = @{ resultado = 'cortado'; detalle = "paso de $MinutosActualizar min y lo corte" }
      Fallo "actualizar paso de $MinutosActualizar min y lo corte"
    } elseif ($b.Codigo -eq 0) {
      $estado.actualizar = @{ resultado = 'ok'; detalle = (Resumir $b.Salida) }
      Log "actualizar -> $(Resumir $b.Salida)"
      $recordadaVerificada = $true
    } elseif ($b.Codigo -eq 3) {
      $estado.actualizar = @{ resultado = 'esperando'; detalle = (Resumir $b.Salida) }
      Log "actualizar -> todavia no esta completa en la nube (se reintenta): $(Resumir $b.Salida)"
    } elseif ($b.Codigo -eq 4) {
      $estado.actualizar = @{ resultado = 'rechazado'; detalle = (Resumir $b.Salida) }
      Fallo "la PC no acepta lo publicado (firma, clave o version): $(Resumir $b.Salida)"
    } else {
      $estado.actualizar = @{ resultado = 'error'; detalle = (Resumir $b.Salida) }
      Fallo "actualizar salio con $($b.Codigo): $(Resumir $b.Salida)"
    }
  }
  if ($Recordada -and -not $recordadaVerificada) { $recordadaSinVerificar = $true }
  if ($recordadaSinVerificar) {
    Log ('la firma de la carpeta de donde se instalo esta PC (' + $Recordada + ') no verifico en esta corrida: no escribo nada en la carpeta recordada (ni avisos, ni inventario, ni salud)')
    $PubBuzon = $null
    $Buzon = $null
    $RaizBuzon = $null
  }

  # ---- 2) la cola de avisos del plugin -> buzon (mover uno por uno, sin pisar; -Simular solo lo lista) ----
  $cola = Join-Path $EstadoDir ('avisos-pendientes\' + $pc)
  if ($SinAvisos) { Log 'avisos: salteado (-SinAvisos)' }
  elseif ($recordadaSinVerificar) { $estado.avisos = @{ resultado = 'sin_verificar' }; Log 'avisos: la firma de la carpeta recordada no verifico, quedan en la cola local' }
  elseif (-not $Buzon -or -not (Test-Path -LiteralPath $RaizBuzon)) { $estado.avisos = @{ resultado = 'sin_nube' }; Log 'avisos: no veo un buzon de la nube, quedan en la cola local' }
  elseif (-not (Test-Path $cola)) { $estado.avisos = @{ resultado = 'sin_cola'; movidos = 0 } }
  else {
    $destinoAvisos = Join-Path $Buzon ('avisos\' + $pc)
    $pendientes = @(Get-ChildItem -Path $cola -Filter *.json -File | Sort-Object Name)
    $movidos = 0
    $fallos = 0
    foreach ($f in $pendientes) {
      $dest = Join-Path $destinoAvisos $f.Name
      $n = 2
      while (Test-Path $dest) { $dest = Join-Path $destinoAvisos ($f.BaseName + '-' + $n + $f.Extension); $n++ }
      if ($Simular) { Log ('simular: ' + $f.FullName + ' -> ' + $dest); continue }
      try {
        if (-not (Test-Path $destinoAvisos)) { New-Item -ItemType Directory -Force -Path $destinoAvisos | Out-Null }
        Move-Item -LiteralPath $f.FullName -Destination $dest
        $movidos++
      } catch { $fallos++; Log ('no pude subir el aviso ' + $f.Name + ': ' + $_.Exception.Message) }
    }
    $resultadoAvisos = 'ok'
    if ($Simular) { $resultadoAvisos = 'simulado' }
    $estado.avisos = @{ resultado = $resultadoAvisos; pendientes = $pendientes.Count; movidos = $movidos; fallos = $fallos }
    Log "avisos -> pendientes $($pendientes.Count), subidos $movidos, fallos $fallos"
  }

  # ---- 3) inventario, una vez por semana --------------------------------------------------------------
  $marcaInv = Join-Path $EstadoDir 'inventario-ultimo.txt'
  $invScript = Join-Path $PSScriptRoot 'inventario.ps1'
  if (-not (Test-Path $invScript)) { $invScript = Join-Path $Publicado 'programas\inventario.ps1' }
  $toca = $ForzarInventario
  if (-not $toca) {
    if (-not (Test-Path $marcaInv)) { $toca = $true }
    else { $toca = ((Get-Date) - (Get-Item $marcaInv).LastWriteTime).TotalDays -ge $DIAS_INVENTARIO }
  }
  if ($SinInventario) { Log 'inventario: salteado (-SinInventario)' }
  elseif (-not $toca) { $estado.inventario = @{ resultado = 'no_toca' } }
  elseif ($recordadaSinVerificar) { $estado.inventario = @{ resultado = 'sin_verificar' }; Log 'inventario: la firma de la carpeta recordada no verifico, no lo subo' }
  elseif (-not $Buzon -or -not (Test-Path -LiteralPath $RaizBuzon)) { $estado.inventario = @{ resultado = 'sin_nube' } }
  elseif (-not (Test-Path $invScript)) { $estado.inventario = @{ resultado = 'sin_script' }; Fallo "no esta $invScript" }
  else {
    $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $salidaInv = Join-Path $Buzon ('inventario\' + $pc + '.json')
    $args3 = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $invScript, '-Salida', $salidaInv)
    if ($ClavesInventario) { $args3 += @('-Claves') + $ClavesInventario }
    $i = Correr $ps $args3 $MinutosInventario $Pub
    if ($i.Cortado) { $estado.inventario = @{ resultado = 'cortado' }; Fallo "inventario paso de $MinutosInventario min y lo corte" }
    elseif ($i.Codigo -eq 0) {
      $estado.inventario = @{ resultado = 'ok'; archivo = $salidaInv }
      [IO.File]::WriteAllText($marcaInv, (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'), (New-Object System.Text.UTF8Encoding($false)))
      Log "inventario -> $salidaInv"
    } else { $estado.inventario = @{ resultado = 'error'; detalle = (Resumir $i.Salida) }; Fallo "inventario salio con $($i.Codigo): $(Resumir $i.Salida)" }
  }

  # ---- 5) mails: los de trabajo de ESTA PC, solo si la lista publicada lo dice (va antes de la salud, que lo anota) ----
  # corre SOLO el programa instalado (el que llego firmado y el paso 1 acaba de verificar), nunca una copia de al lado
  $mailsScript = Join-Path $Publicado 'programas\mails_area.mjs'
  $resumenMails = 'sin_uso'
  $listaMails = $null
  if ($SinMails) { Log 'mails: salteado (-SinMails)' }
  elseif (-not (Test-Path $mailsScript)) { $resumenMails = 'sin_script'; $estado.mails = @{ resultado = $resumenMails } }
  elseif (-not $node) { $resumenMails = 'sin_node'; $estado.mails = @{ resultado = $resumenMails } }
  elseif ($Recordada -or $recordadaSinVerificar -or -not $RaizBuzon -or -not (Test-Path -LiteralPath $RaizBuzon)) {
    # solo con la nube de Barack a la vista (por nombre o indicada): a una carpeta recordada (un pendrive, una copia) no van mails
    $resumenMails = 'sin_nube'; $estado.mails = @{ resultado = $resumenMails }
  }
  elseif ($null -eq $estado.actualizar -or $estado.actualizar.resultado -ne 'ok') {
    # quien sube y que queda afuera lo dicen dos listas de lo instalado: valen solo si ESTA corrida las repuso y les verifico
    # la firma (paso 1 con resultado ok). Sin eso (salteado, cortado, rechazado, esperando, error) no sale ningun mail.
    $resumenMails = 'sin_verificar'; $estado.mails = @{ resultado = $resumenMails }
    Log 'mails: el paso de actualizar no verifico lo instalado en esta corrida; no leo ni subo nada (se reintenta)'
  }
  else {
    $args5 = @($mailsScript, '--home', $HomeDir, '--raiz-nube', $RaizBuzon, '--estado', $EstadoDir, '--max-minutos', [string]([math]::Max(2, $MinutosMails - 2)))
    if ($Simular) { $args5 += '--simular' }
    $corridaMails = Correr-Node $args5 $MinutosMails $Pub
    if ($corridaMails.Cortado) { $resumenMails = 'cortado'; $estado.mails = @{ resultado = $resumenMails }; Fallo "mails paso de $MinutosMails min y lo corte" }
    else {
      $resMails = $null
      try {
        $ultimo = (($corridaMails.Salida -split '\r?\n') | Where-Object { $_.Trim() } | Select-Object -Last 1)
        if ($ultimo) { $resMails = $ultimo | ConvertFrom-Json }
      } catch { $resMails = $null }
      if ($null -ne $resMails -and $resMails.resultado) {
        $resumenMails = [string]$resMails.resultado
        $listaMails = $resMails.privados
        $estado.mails = @{ resultado = $resumenMails; codigo = $corridaMails.Codigo; entrada = $resMails.entrada; cuarentena = $resMails.cuarentena; privado = $resMails.privado; en_espera = $resMails.en_espera; lista = $listaMails; detalle = $resMails.detalle }
        if ($resumenMails -ne 'apagado') { Log ('mails -> ' + (Resumir $corridaMails.Salida)) }
        if ($corridaMails.Codigo -eq 1) { Fallo ('mails: ' + (Resumir $corridaMails.Salida)) }
      } else {
        $resumenMails = 'error'
        $estado.mails = @{ resultado = $resumenMails; codigo = $corridaMails.Codigo; detalle = (Resumir $corridaMails.Salida) }
        Fallo ("mails salio con $($corridaMails.Codigo): " + (Resumir $corridaMails.Salida))
      }
    }
  }

  # ---- 4) salud: lo que el programa de la base no sabe ---------------------------------------------------
  if ($recordadaSinVerificar) { $estado.salud = @{ resultado = 'sin_verificar' } }
  elseif ($Buzon -and (Test-Path -LiteralPath $RaizBuzon)) {
    $rutaSalud = Join-Path $Buzon ('salud\' + $pc + '.json')
    if (-not (Test-Path $rutaSalud)) { $estado.salud = @{ resultado = 'sin_salud' } }
    else {
      try {
        $s = Get-Content -LiteralPath $rutaSalud -Raw -Encoding UTF8 | ConvertFrom-Json
        $libre = $null
        try { $u = Get-PSDrive -Name ($HomeDir.Substring(0, 1)) -ErrorAction Stop; $libre = [math]::Round($u.Free / 1GB, 1) } catch {}
        $politica = 'no'
        if (Test-Path (Join-Path $env:ProgramFiles 'ClaudeCode\managed-settings.json')) { $politica = 'si' }
        # con que Node corrio la tarea (propio | path | nube) y lo que fallo en esta corrida (hasta 5, cortados): estado.json y el
        # log son locales; sin esto una PC que cayo al Node del PATH, o que no pudo arrancar ninguno, se ve igual que una apagada
        $erroresCortos = @($errores | Select-Object -First 5 | ForEach-Object { $t = [string]$_; if ($t.Length -gt 300) { $t.Substring(0, 300) } else { $t } })
        $valores = @{ ve_Y = [bool](Test-Path 'Y:\'); ve_Z = [bool](Test-Path 'Z:\'); disco_libre_gb = $libre; python = [bool](Buscar-Exe 'python'); politica = $politica; node_origen = $nodeOrigen; tarea_errores = $erroresCortos; mails = $resumenMails; mails_lista = $listaMails }
        foreach ($k in $valores.Keys) {
          if ($s.PSObject.Properties.Name -contains $k) { $s.$k = $valores[$k] } else { $s | Add-Member -NotePropertyName $k -NotePropertyValue $valores[$k] }
        }
        $enc = New-Object System.Text.UTF8Encoding($false)
        $tmp = "$rutaSalud.$PID.tmp"
        [IO.File]::WriteAllText($tmp, ($s | ConvertTo-Json -Depth 6), $enc)
        Move-Item -LiteralPath $tmp -Destination $rutaSalud -Force
        $estado.salud = @{ resultado = 'ok' }
      } catch { $estado.salud = @{ resultado = 'error'; detalle = $_.Exception.Message }; Log "no pude completar la salud: $($_.Exception.Message)" }
    }
  } else { $estado.salud = @{ resultado = 'sin_nube' } }

  $estado.node = $node
  $estado.errores = @($errores)
  Escribir-Estado
  Log "== sync termina ($($errores.Count) error(es))"
} finally {
  try { $mutex.ReleaseMutex() } catch {}
}
exit 0
