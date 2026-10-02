# Exporta a PNG las diapositivas de una presentacion que YA esta abierta en PowerPoint (la busca por como
# empieza su nombre) y, si se pide, la cierra sin guardar. No toca las demas presentaciones ni cierra PowerPoint.
# Uso: powershell -File pptx_abierta_a_png.ps1 -Nombre "<como empieza>" -Salida <carpeta> [-Ancho 1280] [-Cerrar]
# Solo ASCII en este archivo.
param([Parameter(Mandatory = $true)][string]$Nombre, [Parameter(Mandatory = $true)][string]$Salida, [int]$Ancho = 1280, [switch]$Cerrar)
try { $pp = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application') }
catch { Write-Output 'PowerPoint no esta abierto'; exit 1 }
New-Item -ItemType Directory -Force $Salida | Out-Null
$hallada = $null
foreach ($p in @($pp.Presentations)) { if ($p.Name.StartsWith($Nombre, [StringComparison]::OrdinalIgnoreCase)) { $hallada = $p; break } }
if ($null -eq $hallada) { Write-Output ("no hay una presentacion abierta que empiece con: " + $Nombre); exit 1 }
$alto = [int]($Ancho * $hallada.PageSetup.SlideHeight / $hallada.PageSetup.SlideWidth)
$n = $hallada.Slides.Count
$dir = (Resolve-Path -LiteralPath $Salida).ProviderPath
for ($i = 1; $i -le $n; $i++) { $hallada.Slides.Item($i).Export((Join-Path $dir ('d-{0:d2}.png' -f $i)), 'PNG', $Ancho, $alto) }
Write-Output ("exportadas " + $n + " de: " + $hallada.Name + " | otras abiertas: " + ($pp.Presentations.Count - 1))
if ($Cerrar) { $hallada.Saved = -1; $hallada.Close(); Write-Output 'cerrada sin guardar' }
