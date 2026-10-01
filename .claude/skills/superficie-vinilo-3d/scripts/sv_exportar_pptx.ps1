# Exporta un PowerPoint a PNG (para MIRARLO antes de entregar) y, si se pide, a PDF.
# Cierra solo la presentacion que abrio; si PowerPoint ya tenia algo abierto, no lo cierra.
# Uso: sv_exportar_pptx.ps1 <archivo.pptx> <carpeta_png> [archivo.pdf]
param([string]$pptx, [string]$dir, [string]$pdf = "")
$ErrorActionPreference = "Stop"      # sin esto un fallo de PowerPoint sale con codigo 0
$pp = New-Object -ComObject PowerPoint.Application
$abiertas = $pp.Presentations.Count
$pres = $null
try {
  $pres = $pp.Presentations.Open($pptx, $true, $false, $false)
  $pres.Export($dir, "PNG", 1920, 1080)
  if ($pdf -ne "") { $pres.SaveAs($pdf, 32) }
  $n = $pres.Slides.Count
  Write-Output "hojas=$n ya_abiertas=$abiertas"
} catch {
  Write-Output ("ERROR: " + $_.Exception.Message)
  exit 1
} finally {
  if ($pres -ne $null) { $pres.Close() }
  if ($abiertas -eq 0) { $pp.Quit() }
}
