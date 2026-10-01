# Captura rangos de un Excel como PNG. Abre la COPIA que le pasan en solo lectura y no guarda.
# Uso: sv_captura_xlsx.ps1 <copia.xlsx> <carpeta_salida> <numero_de_hoja> "B2:H3;B40:H43"
param([string]$xlsx, [string]$outdir, [int]$hoja = 1, [string]$rangos)
$ErrorActionPreference = "Stop"      # sin esto un fallo de Excel sale con codigo 0
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false
$wb = $null
try {
  $wb = $xl.Workbooks.Open($xlsx, 0, $true)
  $ws = $wb.Worksheets.Item($hoja)
  $i = 0
  foreach ($addr in $rangos.Split(';')) {
    $i++
    $rng = $ws.Range($addr)
    $rng.CopyPicture(2, -4147) | Out-Null            # xlPrinter, xlPicture: no depende de lo que se ve en pantalla
    $co = $ws.ChartObjects().Add(10, 10, $rng.Width * 3, $rng.Height * 3)
    $co.Activate() | Out-Null
    $co.Chart.ChartArea.Format.Line.Visible = 0
    $co.Chart.Paste() | Out-Null
    $co.Chart.Export("$outdir\rango_$i.png", "PNG") | Out-Null
    $co.Delete() | Out-Null
    Write-Output "$addr -> rango_$i.png"
  }
} catch {
  Write-Output ("ERROR: " + $_.Exception.Message)
  exit 1
} finally {
  if ($wb -ne $null) { $wb.Close($false) }
  $xl.Quit()
}
