<#
.SYNOPSIS
  Tarea "Barack - Claude por area": corre como el usuario, sin ventana, al iniciar sesion y cada 4 h.
  Cero tokens: solo copia archivos y corre programas locales. Parte de tools\paquete-equipo\sync_equipo.ps1.

    1) ACTUALIZAR  node _paquete.mjs --actualizar --proyecto area   (baja lo nuevo, firmado; nunca pisa ni borra;
                                                                     deja la salud de la PC en el buzon de la nube)
    2) AVISOS      sube la cola local de avisos del plugin (<estado>\avisos-pendientes\<pc>\) al buzon (mover, no copiar)
    3) INVENTARIO  una vez por semana, inventario.ps1 -> 4- BUZON\inventario\<pc>.json
    4) SALUD       completa en 4- BUZON\salud\<pc>.json lo que el programa de la base no sabe (disco, Y:, Z:, Python, politica)
    5) MAILS       gancho: por ahora no hace nada

  No borra nada en ningun lado. Sale siempre con 0: el detalle queda en <estado>\sync.log y estado.json.
  -Simular es el dry-run de los avisos: escribe en el log "origen -> destino" de cada uno y no mueve nada.

  Parametros (para probar):
    -HomeDir     la carpeta de la PC (por defecto CLAUDE_AREA_HOME, o la de arriba de publicado\programas, o C:\ClaudeBarack)
    -Nube        la carpeta CLAUDE POR AREA o directamente su 1- PUBLICADO (por defecto CLAUDE_AREA_NUBE o se la pide al programa)
    -EstadoDir   donde viven log, estado y la clave publica (por defecto CLAUDE_AREA_ESTADO o %LOCALAPPDATA%\BarackEquipo)
    -SinActualizar / -SinAvisos / -SinInventario   saltean un paso     -ForzarInventario  lo corre aunque no haya pasado la semana
    -ClavesInventario <claves del registro>         SOLO PRUEBAS: se las pasa a inventario.ps1 -Claves
    -PrioridadNormal   no baja la prioridad del proceso (para pruebas)   -Verbose2  muestra el log en pantalla
  La tarea de Windows se registra SOLO con -RegistrarTarea (lo hace la instalacion, una vez); -VerTarea la muestra
  sin registrar nada; -SinTarea es lo que pasa por defecto y existe para que las pruebas lo digan explicito.

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
  [switch]$PrioridadNormal,
  [switch]$Verbose2
)
$ErrorActionPreference = 'Continue'
$TAREA = 'Barack - Claude por area'
$DIAS_INVENTARIO = 7

# ---- todo o nada (CONTRATO): o las tres rutas son las reales o las tres son de prueba ---------------------
# Una mezcla (una PC de prueba con la nube real, o el estado real) escribiria salud o avisos falsos en la nube
# de verdad, o claves de prueba en el estado real. Se decide ANTES de crear o escribir nada. -VerTarea no escribe.
$dePrueba = @()
$reales = @()
if ($HomeDir -or $env:CLAUDE_AREA_HOME) { $dePrueba += 'la carpeta de la PC (-HomeDir / CLAUDE_AREA_HOME)' } else { $reales += 'la carpeta de la PC' }
if ($Nube -or $env:CLAUDE_AREA_NUBE) { $dePrueba += 'la nube (-Nube / CLAUDE_AREA_NUBE)' } else { $reales += 'la nube' }
if ($EstadoDir -or $env:CLAUDE_AREA_ESTADO) { $dePrueba += 'el estado (-EstadoDir / CLAUDE_AREA_ESTADO)' } else { $reales += 'el estado' }
if ($dePrueba.Count -gt 0 -and $reales.Count -gt 0 -and -not $VerTarea) {
  Write-Host ('No hago nada: estas mezclando carpetas de prueba y reales. De prueba: ' + ($dePrueba -join ', ') + '. Reales: ' + ($reales -join ', ') + '. O las tres de prueba o ninguna.')
  exit 2
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
function Resolver-Publicado([string]$node, [string]$script) {
  $raiz = $null
  if ($Nube) { $raiz = $Nube } elseif ($env:CLAUDE_AREA_NUBE) { $raiz = $env:CLAUDE_AREA_NUBE }
  if ($raiz) {
    $raiz = $raiz.TrimEnd('\')
    if ((Split-Path -Leaf $raiz) -eq '1- PUBLICADO') { return $raiz }
    return (Join-Path $raiz '1- PUBLICADO')
  }
  if ($node -and $script) {
    $d = Correr $node @($script, '--donde', '--proyecto', 'area') 2 $null
    if (-not $d.Cortado -and $d.Codigo -eq 0) { return ((($d.Salida -split '\r?\n') | Where-Object { $_.Trim() } | Select-Object -Last 1).Trim()) }
  }
  return $null
}

# Corre un programa sin ventana, con tope de tiempo y las variables del contrato; si se pasa, lo corta.
function Correr([string]$exe, [string[]]$argumentos, [int]$minutos, [string]$pub) {
  $r = @{ Codigo = -1; Salida = ''; Cortado = $false }
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
  } catch { $r.Salida = "no arranco: $($_.Exception.Message)" }
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
  $def = Nueva-Definicion
  Register-ScheduledTask -TaskName $TAREA -Action $def.Accion -Trigger $def.Triggers -Principal $def.Principal -Settings $def.Ajustes -Force | Out-Null
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
  $node = Buscar-Exe 'node'
  $nodePropio = Join-Path $EstadoDir 'node\node.exe'
  if (-not $node -and (Test-Path $nodePropio)) { $node = $nodePropio }
  $Pub = Resolver-Publicado $node $(if (Test-Path $script) { $script } else { $null })
  if (-not $node -and $Pub) {
    $nodeNube = Join-Path (Split-Path -Parent $Pub) '1- PUBLICADO\herramientas\node\node.exe'
    if (Test-Path $nodeNube) { $node = $nodeNube }
  }
  $estado.publicado = $Pub
  $Buzon = $null
  if ($Pub) { $Buzon = Join-Path (Split-Path -Parent $Pub) '4- BUZON' }
  $pc = Nombre-Pc

  # ---- 1) actualizar ----------------------------------------------------------------------------------
  if ($SinActualizar) { Log 'actualizar: salteado (-SinActualizar)' }
  elseif (-not (Test-Path $script)) { $estado.actualizar = @{ resultado = 'sin_script'; detalle = "no esta $script" }; Fallo "no esta $script" }
  elseif (-not $node) { $estado.actualizar = @{ resultado = 'sin_node'; detalle = 'no encuentro Node.js' }; Fallo 'no encuentro Node.js: no puedo actualizar' }
  else {
    $args1 = @($script, '--actualizar', '--proyecto', 'area', '--destino', $Publicado, '--home', $HomeDir)
    if ($Pub) { $args1 += @('--nube', $Pub) }
    $b = Correr $node $args1 $MinutosActualizar $Pub
    if ($b.Cortado) {
      $estado.actualizar = @{ resultado = 'cortado'; detalle = "paso de $MinutosActualizar min y lo corte" }
      Fallo "actualizar paso de $MinutosActualizar min y lo corte"
    } elseif ($b.Codigo -eq 0) {
      $estado.actualizar = @{ resultado = 'ok'; detalle = (Resumir $b.Salida) }
      Log "actualizar -> $(Resumir $b.Salida)"
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

  # ---- 2) la cola de avisos del plugin -> buzon (mover uno por uno, sin pisar; -Simular solo lo lista) ----
  $cola = Join-Path $EstadoDir ('avisos-pendientes\' + $pc)
  if ($SinAvisos) { Log 'avisos: salteado (-SinAvisos)' }
  elseif (-not $Buzon -or -not (Test-Path (Split-Path -Parent $Pub))) { $estado.avisos = @{ resultado = 'sin_nube' }; Log 'avisos: no veo la nube, quedan en la cola local' }
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
  elseif (-not $Buzon -or -not (Test-Path (Split-Path -Parent $Pub))) { $estado.inventario = @{ resultado = 'sin_nube' } }
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

  # ---- 4) salud: lo que el programa de la base no sabe ---------------------------------------------------
  if ($Buzon -and (Test-Path (Split-Path -Parent $Pub))) {
    $rutaSalud = Join-Path $Buzon ('salud\' + $pc + '.json')
    if (-not (Test-Path $rutaSalud)) { $estado.salud = @{ resultado = 'sin_salud' } }
    else {
      try {
        $s = Get-Content -LiteralPath $rutaSalud -Raw -Encoding UTF8 | ConvertFrom-Json
        $libre = $null
        try { $u = Get-PSDrive -Name ($HomeDir.Substring(0, 1)) -ErrorAction Stop; $libre = [math]::Round($u.Free / 1GB, 1) } catch {}
        $politica = 'no'
        if (Test-Path (Join-Path $env:ProgramFiles 'ClaudeCode\managed-settings.json')) { $politica = 'si' }
        $valores = @{ ve_Y = [bool](Test-Path 'Y:\'); ve_Z = [bool](Test-Path 'Z:\'); disco_libre_gb = $libre; python = [bool](Buscar-Exe 'python'); politica = $politica }
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

  # ---- 5) mails: gancho. Cuando se decida como suben, va aca (hoy no hace nada). --------------------------

  $estado.errores = @($errores)
  Escribir-Estado
  Log "== sync termina ($($errores.Count) error(es))"
} finally {
  try { $mutex.ReleaseMutex() } catch {}
}
exit 0
