<#
.SYNOPSIS
  Tarea "Barack - Base Claude y mails": corre como el usuario, sin ventana, al iniciar sesion y cada 4 h.
  Cero tokens: solo copia archivos y corre los scripts locales.

    1) BASE    node scripts\_paquete.mjs --actualizar      (baja lo nuevo de la nube; NUNCA borra ni pisa
                                                            lo que el companero cambio: deja .fak-nueva)
    2) MAILS   python tools\paquete-equipo\mails_equipo.py (sube a la nube los mails nuevos de trabajo;
                                                            lo privado y lo sensible no sube)

  No borra nada en la nube. Cada paso tiene su tope de tiempo y un paso que falla no frena al otro.
  Sale siempre con codigo 0: el detalle queda en %LOCALAPPDATA%\BarackEquipo\sync.log y estado.json.

  Parametros (para probar):
    -Destino    carpeta de la base (por defecto, la que contiene este script)
    -Nube       carpeta "Base Claude Ingenieria" (por defecto se la busca sola)
    -EstadoDir  donde viven log, estado y perfil (por defecto %LOCALAPPDATA%\BarackEquipo)
    -SinBase / -SinMails      saltea un paso
    -PrioridadNormal          no se baja la prioridad del proceso (la tarea la baja sola; esto es para pruebas)
    -FuenteMailsPrueba <jsonl> SOLO PRUEBAS: los mails salen de un .jsonl y no de Outlook

  Solo ASCII en este archivo (powershell.exe 5.1 sin BOM lee UTF-8 como ANSI).
#>
[CmdletBinding()]
param(
  [string]$Destino,
  [string]$Nube,
  [string]$EstadoDir,
  [switch]$SinBase,
  [switch]$SinMails,
  [string]$FuenteMailsPrueba,
  [int]$MinutosBase = 10,
  [int]$MinutosMails = 15,
  [switch]$PrioridadNormal,
  [switch]$Verbose2
)
$ErrorActionPreference = 'Continue'

if (-not $Destino) { $Destino = Split-Path -Parent (Split-Path -Parent $PSScriptRoot) }
if (-not $EstadoDir) { $EstadoDir = Join-Path $env:LOCALAPPDATA 'BarackEquipo' }
if (-not (Test-Path $EstadoDir)) { New-Item -ItemType Directory -Force -Path $EstadoDir | Out-Null }
$LOG = Join-Path $EstadoDir 'sync.log'
$errores = New-Object System.Collections.ArrayList
$estado = [ordered]@{ ultimo = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'); destino = $Destino; base = $null; mails = $null }

function Log([string]$m) {
  $linea = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m"
  try { Add-Content -Path $LOG -Value $linea -Encoding UTF8 } catch {}
  if ($Verbose2) { Write-Host $linea }
}
function Fallo([string]$m) { [void]$errores.Add($m); Log "ERROR $m" }

# Corre un programa sin ventana, con tope de tiempo; si se pasa, lo corta con todo lo que lanzo.
# Devuelve @{ Codigo; Salida; Cortado }.
function Correr([string]$exe, [string[]]$argumentos, [int]$minutos) {
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
    $psi.WorkingDirectory = $Destino
    $psi.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'
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
function Resumir([string]$t) {
  if (-not $t) { return '' }
  $s = ($t -replace '\r?\n', ' | ')
  if ($s.Length -gt 1200) { $s = $s.Substring(0, 1200) + '...' }
  return $s
}
function Escribir-Estado {
  try {
    $enc = New-Object System.Text.UTF8Encoding($false)
    $destinoEstado = Join-Path $EstadoDir 'estado.json'
    [IO.File]::WriteAllText("$destinoEstado.tmp", ($estado | ConvertTo-Json -Depth 6), $enc)
    Move-Item -Force "$destinoEstado.tmp" $destinoEstado
  } catch { Log "no pude escribir estado.json: $($_.Exception.Message)" }
}
function Buscar-Exe([string]$nombre) {
  # Solo se MIRA donde esta (no se lo ejecuta: con la PC ocupada y prioridad baja un arranque de
  # prueba puede tardar minutos). El Python de la Microsoft Store (WindowsApps) es un atajo que abre
  # la tienda: se descarta.
  $cands = @(Get-Command $nombre -All -ErrorAction SilentlyContinue | Where-Object { $_.Source -and ($_.Source -notmatch 'WindowsApps') -and (Test-Path $_.Source) })
  if ($cands.Count -gt 0) { return $cands[0].Source }
  return $null
}

# ---- una sola corrida a la vez, y con poco consumo ----------------------------------------------
$mutex = New-Object System.Threading.Mutex($false, 'Local\BarackEquipoSync')
$tengo = $false
try { $tengo = $mutex.WaitOne(0) } catch { $tengo = $true }
if (-not $tengo) { Log 'ya hay otra corrida en marcha: no hago nada'; exit 0 }

try {
  if (-not $PrioridadNormal) { try { (Get-Process -Id $PID).PriorityClass = 'BelowNormal' } catch {} }
  if ((Test-Path $LOG) -and ((Get-Item $LOG).Length -gt 1MB)) { Move-Item -Force $LOG "$LOG.1" }
  Log "== sync arranca (destino $Destino)"

  # ---- 1) la base ---------------------------------------------------------------------------------
  $node = $null
  $script = Join-Path $Destino 'scripts\_paquete.mjs'
  if (-not (Test-Path $script)) {
    $estado.base = @{ resultado = 'sin_script'; detalle = "no esta $script" }
    Fallo "no esta $script"
  } else {
    $node = Buscar-Exe 'node'
    if (-not $node) {
      $estado.base = @{ resultado = 'sin_node'; detalle = 'no encuentro Node.js' }
      Fallo 'no encuentro Node.js: no puedo actualizar la base ni buscar la nube'
    }
  }
  if ($node -and -not $SinBase) {
    $args1 = @($script, '--actualizar', '--destino', $Destino)
    if ($Nube) { $args1 += @('--nube', $Nube) }
    $b = Correr $node $args1 $MinutosBase
    if ($b.Cortado) {
      $estado.base = @{ resultado = 'cortado'; detalle = "paso de $MinutosBase min y lo corte" }
      Fallo "actualizar la base paso de $MinutosBase min y lo corte"
    } elseif ($b.Codigo -eq 0) {
      $estado.base = @{ resultado = 'ok'; detalle = (Resumir $b.Salida) }
      Log "base -> $(Resumir $b.Salida)"
    } elseif ($b.Codigo -eq 3) {
      $estado.base = @{ resultado = 'esperando'; detalle = (Resumir $b.Salida) }
      Log "base -> todavia no esta completa en la nube (se reintenta): $(Resumir $b.Salida)"
    } else {
      $estado.base = @{ resultado = 'error'; detalle = (Resumir $b.Salida) }
      Fallo "base salio con $($b.Codigo): $(Resumir $b.Salida)"
    }
  } elseif ($SinBase) { Log 'base: salteada (-SinBase)' }

  # ---- 2) los mails -------------------------------------------------------------------------------
  $perfilOk = Test-Path (Join-Path $EstadoDir 'perfil.json')
  if ($SinMails) {
    Log 'mails: salteado (-SinMails)'
  } elseif (-not $perfilOk) {
    $estado.mails = @{ resultado = 'sin_perfil' }
    Log 'mails: no hay perfil.json (lo deja Instalar)'
  } else {
    $nubeMails = $Nube
    if (-not $nubeMails -and $node) {
      $d = Correr $node @($script, '--donde', '--destino', $Destino) 2
      if (-not $d.Cortado -and $d.Codigo -eq 0) { $nubeMails = (($d.Salida -split '\r?\n') | Where-Object { $_.Trim() } | Select-Object -Last 1).Trim() }
    }
    $python = Buscar-Exe 'python'
    $mailScript = Join-Path $PSScriptRoot 'mails_equipo.py'
    if (-not $python) {
      $estado.mails = @{ resultado = 'sin_python'; detalle = 'no encuentro Python' }
      Fallo 'no encuentro Python: no puedo subir los mails'
    } elseif (-not (Test-Path $mailScript)) {
      $estado.mails = @{ resultado = 'sin_script'; detalle = "no esta $mailScript" }
      Fallo "no esta $mailScript"
    } elseif (-not $nubeMails -and -not $FuenteMailsPrueba) {
      $estado.mails = @{ resultado = 'sin_nube' }
      Log 'mails: todavia no encuentro la carpeta de la nube (se reintenta)'
    } else {
      $args2 = @($mailScript, '--estado-dir', $EstadoDir, '--max-minutos', [string]($MinutosMails - 1))
      if ($nubeMails) { $args2 += @('--nube', $nubeMails) }
      if ($FuenteMailsPrueba) { $args2 += @('--fuente-jsonl', $FuenteMailsPrueba) }
      $m = Correr $python $args2 $MinutosMails
      if ($m.Cortado) {
        $estado.mails = @{ resultado = 'cortado'; detalle = "paso de $MinutosMails min (Outlook no contesto) y lo corte" }
        Fallo "mails paso de $MinutosMails min y lo corte: la proxima corrida sigue donde quedo"
      } else {
        switch ($m.Codigo) {
          0 { $estado.mails = @{ resultado = 'ok'; detalle = (Resumir $m.Salida) }; Log "mails -> $(Resumir $m.Salida)" }
          4 { $estado.mails = @{ resultado = 'outlook_cerrado' }; Log 'mails -> Outlook no esta abierto: se reintenta en la proxima corrida' }
          5 { $estado.mails = @{ resultado = 'falta_privados'; detalle = (Resumir $m.Salida) }; Log "mails -> $(Resumir $m.Salida)" }
          6 { $estado.mails = @{ resultado = 'sin_nube' }; Log "mails -> $(Resumir $m.Salida)" }
          default { $estado.mails = @{ resultado = 'error'; detalle = (Resumir $m.Salida) }; Fallo "mails salio con $($m.Codigo): $(Resumir $m.Salida)" }
        }
      }
    }
  }

  $estado.errores = @($errores)
  Escribir-Estado
  Log "== sync termina ($($errores.Count) error(es))"
} finally {
  try { $mutex.ReleaseMutex() } catch {}
}
exit 0
