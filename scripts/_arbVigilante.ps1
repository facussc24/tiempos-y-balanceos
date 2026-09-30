# Vigilante del arb: activar o pausar la tarea de Windows que mantiene el arb abierto.
#
# Lo ejecuta FAK con doble click en los accesos directos del Escritorio:
#   "ARB - activar vigilante"  -> powershell ... -File scripts\_arbVigilante.ps1 -Activar
#   "ARB - pausar vigilante"   -> powershell ... -File scripts\_arbVigilante.ps1 -Pausar
#
# La tarea ("Barack - ARB siempre abierto") corre cada 3 minutos, sin ventana, como el usuario
# de Windows de Fak: `conhost --headless python scripts\_arbLanzar.py --vigilar`. Si el arb esta abierto sale en
# milisegundos; si esta cerrado o en el login y nadie usa la PC hace 2 minutos, lo abre y entra
# con la clave que Fak guardo en el Administrador de credenciales. Un login fallido la pausa sola.
# El estado vive en ~\arb_fotos\vigilante_estado.txt: la primera palabra es ACTIVO o PAUSADO
# (no se borra nada para activar). Pedido de Fak, 30/09/2026. Sin tildes en este archivo
# (powershell.exe lo lee como ANSI).
param([switch]$Activar, [switch]$Pausar, [switch]$SinMensaje)

$ErrorActionPreference = 'Stop'
$tarea   = 'Barack - ARB siempre abierto'
$raiz    = Split-Path -Parent $PSScriptRoot
$script  = Join-Path $raiz 'scripts\_arbLanzar.py'
$python  = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'
$estado  = Join-Path $env:USERPROFILE 'arb_fotos\vigilante_estado.txt'
Add-Type -AssemblyName System.Windows.Forms

function Mensaje($texto) {
  if ($SinMensaje) { Write-Output $texto; return }
  [System.Windows.Forms.MessageBox]::Show($texto, 'ARB') | Out-Null
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $estado) | Out-Null

if ($Pausar) {
  Set-Content -Path $estado -Value ('PAUSADO {0} a mano' -f (Get-Date -Format 'dd/MM HH:mm'))
  Mensaje 'Vigilante del arb PAUSADO. No va a reabrir el arb hasta que aprietes "ARB - activar vigilante".'
  exit 0
}

if (-not $Activar) { Mensaje 'Usar -Activar o -Pausar.'; exit 1 }
if (-not (Test-Path $python)) { Mensaje ('No encuentro Python en ' + $python); exit 1 }

Set-Content -Path $estado -Value ('ACTIVO {0}' -f (Get-Date -Format 'dd/MM HH:mm'))

# pythonw.exe lanzado por el Programador de tareas queda trabado sin ejecutar nada en esta PC
# (probado 30/09/2026 con un script de una linea); python.exe dentro de conhost --headless anda
# y tampoco muestra ventana.
$accion = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\conhost.exe') `
  -Argument ('--headless "' + $python + '" "' + $script + '" --vigilar') -WorkingDirectory $raiz
$alEntrar = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$cada3 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
           -RepetitionInterval (New-TimeSpan -Minutes 3)
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
             -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew `
             -StartWhenAvailable -Priority 7
$quien = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $tarea -Action $accion -Trigger @($alEntrar, $cada3) `
  -Settings $ajustes -Principal $quien -Force | Out-Null

Mensaje ('Vigilante del arb ACTIVADO.' + [Environment]::NewLine + [Environment]::NewLine +
  'Cada 3 minutos se fija si el arb esta cerrado; si lo esta y no estas usando la PC, lo abre ' +
  'y entra solo. Para frenarlo: "ARB - pausar vigilante".')
exit 0
