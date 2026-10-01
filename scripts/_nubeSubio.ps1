# _nubeSubio.ps1 - dice si lo que se guardo en la biblioteca de Ingenieria SUBIO de verdad a la nube.
#
# Un archivo guardado en la carpeta sincronizada NO esta en la nube hasta que OneDrive lo sube. El
# 30/09/2026 OneDrive se trabo al mediodia y durante 20 horas se dio por "subido" lo que estaba solo
# en esta PC (el zip del carro, la base para el equipo, los datos de AMFE): 229 archivos, 1,44 GB.
#
# Como se mide: un archivo ya subido tiene el atributo ReparsePoint; uno pendiente no. Se mide desde
# PowerShell: Python (os.stat) NO ve ese atributo y da todo como pendiente, hasta una carpeta vieja.
#
# Uso:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/_nubeSubio.ps1
#   ... -Carpeta "INGENIERIA BARACK (NUNCA BORRAR)\1- GENERAL\AMFE"   (relativa a la biblioteca, o completa)
#   ... -Esperar 30        (vuelve a medir cada 90 s hasta que no quede nada, o N minutos)
# Sale con 0 si no queda nada pendiente y con 1 si queda algo.
# Si dos mediciones separadas dan el mismo numero, OneDrive esta trabado: el arreglo esta en la
# memoria reference_onedrive_sync_colgado_como_detectarlo (respaldar lo pendiente y OneDrive.exe /reset).
param([string]$Carpeta = '', [int]$Esperar = 0)

$org = Join-Path $env:USERPROFILE 'BARACK ARGENTINA SRL'
$bib = (Get-ChildItem -LiteralPath $org -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'Ingenier*a y Proyecto - General' } | Select-Object -First 1).FullName
if (-not $bib) { 'No encuentro la biblioteca de Ingenieria en esta PC.'; exit 2 }
$raiz = $bib
if ($Carpeta) { if ([IO.Path]::IsPathRooted($Carpeta)) { $raiz = $Carpeta } else { $raiz = Join-Path $bib $Carpeta } }
if (-not (Test-Path -LiteralPath $raiz)) { "No existe: $raiz"; exit 2 }

function Pendientes {
    @(Get-ChildItem -LiteralPath $raiz -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object {
        -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -and $_.Name -ne 'Thumbs.db' -and
        $_.Name -notlike '~$*' -and $_.Name -ne 'desktop.ini' -and $_.Name -notlike '.849C9593*' })
}

$fin = (Get-Date).AddMinutes($Esperar)
$anterior = -1
while ($true) {
    $pend = Pendientes
    $mb = [math]::Round((($pend | Measure-Object Length -Sum).Sum / 1MB), 1)
    if ($pend.Count -ne $anterior) { "{0}  pendientes de subir: {1} ({2} MB)" -f (Get-Date -Format 'HH:mm:ss'), $pend.Count, $mb; $anterior = $pend.Count }
    if ($pend.Count -eq 0) { 'SUBIO TODO: no queda nada pendiente.'; exit 0 }
    if ((Get-Date) -ge $fin) { break }
    Start-Sleep -Seconds 90
}
$pend | Sort-Object CreationTime | Select-Object -First 10 | ForEach-Object {
    "   {0}  {1} MB  {2}" -f $_.CreationTime.ToString('dd/MM HH:mm'), [math]::Round($_.Length / 1MB, 1), $_.FullName.Substring($raiz.Length)
}
if (-not (Get-Process OneDrive -ErrorAction SilentlyContinue)) { 'OneDrive NO esta corriendo.' }
exit 1
