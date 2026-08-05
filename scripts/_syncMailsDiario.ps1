# Sync diario del buzon de Fak al cache local (.mail-cache/). Solo LECTURA.
#
# Lo corre el Programador de tareas de Windows una vez por dia. Se puede correr a mano:
#     powershell -ExecutionPolicy Bypass -File scripts\_syncMailsDiario.ps1
#
# Por que existe (y no se llama directo a _mails.py): Outlook clasico lee el buzon de un
# .ost local, y ese .ost tarda en llenarse despues de abrir el programa. Si se sincroniza
# demasiado pronto, el recorrido ve 40 mails en vez de 5000 y reporta "0 nuevos" — que
# parece exito y no lo es. Este wrapper abre Outlook, ESPERA a que el buzon este cargado,
# y recien ahi sincroniza.
#
# Enviar / responder / borrar mails NO se hace desde aca. Nunca.

$ErrorActionPreference = 'Stop'
$raiz    = Split-Path -Parent $PSScriptRoot
$log     = Join-Path $raiz '.mail-cache\sync-diario.log'
$outlook = 'C:\Program Files\Microsoft Office\root\Office16\OUTLOOK.EXE'

function Escribir($txt) {
  $linea = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $txt
  Write-Host $linea
  $dir = Split-Path -Parent $log
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Add-Content -Path $log -Value $linea -Encoding UTF8
}

# 1. Outlook clasico abierto (el nuevo, olk.exe, no sirve: no tiene API ni datos locales)
if (-not (Get-Process -Name OUTLOOK -ErrorAction SilentlyContinue)) {
  if (-not (Test-Path $outlook)) { Escribir 'ERROR: no encuentro OUTLOOK.EXE'; exit 1 }
  Escribir 'Outlook clasico cerrado -> lo abro'
  Start-Process -FilePath $outlook -WindowStyle Minimized
  Start-Sleep -Seconds 60
}

# 2. Esperar a que el .ost termine de bajar: se mira cuantos items ve MAPI y se espera a
#    que el numero deje de crecer dos vueltas seguidas. Tope 20 minutos.
#    El conteo recorre TODO el arbol, igual que _mails.py: si solo mirara el primer nivel
#    subestimaria el total y podria darlo por "quieto" mientras las subcarpetas siguen bajando.
function Contar($carpeta) {
  $n = 0
  try { $n += $carpeta.Items.Count } catch {}
  try {
    for ($j = 1; $j -le $carpeta.Folders.Count; $j++) { $n += Contar $carpeta.Folders.Item($j) }
  } catch {}
  return $n
}

$previo = -1; $quieto = 0; $visto = 0
for ($i = 0; $i -lt 40; $i++) {
  try {
    $mapi  = (New-Object -ComObject Outlook.Application).GetNamespace('MAPI')
    $visto = 0
    for ($s = 1; $s -le $mapi.Folders.Count; $s++) {
      $visto += Contar $mapi.Folders.Item($s)
    }
  } catch {
    Escribir ('Outlook todavia no responde por COM ({0})' -f $_.Exception.Message)
    Start-Sleep -Seconds 30
    continue
  }
  if ($visto -eq $previo) { $quieto++ } else { $quieto = 0 }
  if ($quieto -ge 2 -and $visto -gt 0) { break }
  $previo = $visto
  Start-Sleep -Seconds 30
}
Escribir ('Outlook expone {0} items; arranco el sync' -f $visto)

# 3. Sincronizar. _mails.py sale con codigo 2 si el recorrido fue parcial.
Push-Location $raiz
try {
  $salida = & python 'scripts\_mails.py' --sync 2>&1
  $code   = $LASTEXITCODE
} finally {
  Pop-Location
}
foreach ($l in $salida) { Escribir ('  | {0}' -f $l) }

if ($code -eq 2) {
  Escribir 'RESULTADO: PARCIAL — el buzon no estaba entero. Reintentar mas tarde.'
} elseif ($code -ne 0) {
  Escribir ('RESULTADO: ERROR (codigo {0})' -f $code)
} else {
  Escribir 'RESULTADO: OK'
}
exit $code
