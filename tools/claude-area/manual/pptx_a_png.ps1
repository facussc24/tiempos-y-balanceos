# Exporta cada diapositiva de un .pptx a PNG con PowerPoint de verdad, para MIRAR como se ve ahi.
# Abre SOLO ese archivo, en solo lectura y sin ventana; cierra SOLO esa presentacion; no cierra PowerPoint
# si ya estaba abierto ni toca otras presentaciones.
# Uso: powershell -File pptx_a_png.ps1 -Pptx <archivo.pptx> -Salida <carpeta> [-Ancho 1600]
# Solo ASCII en este archivo.
param([Parameter(Mandatory = $true)][string]$Pptx, [Parameter(Mandatory = $true)][string]$Salida, [int]$Ancho = 1600)
if (-not (Test-Path -LiteralPath $Pptx)) { Write-Output "no existe: $Pptx"; exit 1 }
New-Item -ItemType Directory -Force $Salida | Out-Null
$estaba = @(Get-Process POWERPNT -ErrorAction SilentlyContinue).Count -gt 0
$pp = New-Object -ComObject PowerPoint.Application
$antes = $pp.Presentations.Count
$pres = $pp.Presentations.Open((Resolve-Path -LiteralPath $Pptx).ProviderPath, -1, 0, 0)
try {
  $alto = [int]($Ancho * $pres.PageSetup.SlideHeight / $pres.PageSetup.SlideWidth)
  $n = $pres.Slides.Count
  for ($i = 1; $i -le $n; $i++) {
    $pres.Slides.Item($i).Export((Join-Path (Resolve-Path -LiteralPath $Salida).ProviderPath ('d-{0:d2}.png' -f $i)), 'PNG', $Ancho, $alto)
  }
  Write-Output ("diapositivas exportadas: " + $n + " | otras presentaciones abiertas (no tocadas): " + $antes)
} finally {
  $pres.Close()
  if (-not $estaba -and $pp.Presentations.Count -eq 0) { $pp.Quit() }
}
