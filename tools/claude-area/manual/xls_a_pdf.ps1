# Pasa UN libro de Excel (una copia, nunca el original del servidor) a PDF para poder mirarlo y capturarlo.
# Abre SOLO ese libro, en solo lectura; lo cierra sin guardar; no cierra Excel si ya estaba abierto ni toca
# otros libros. No pisa ni quita nada: si el PDF ya existe, avisa y no hace nada.
# Uso: powershell -File xls_a_pdf.ps1 -Libro <copia.xls> -Pdf <salida.pdf>
# Solo ASCII en este archivo.
param([Parameter(Mandatory = $true)][string]$Libro, [Parameter(Mandatory = $true)][string]$Pdf)
if (-not (Test-Path -LiteralPath $Libro)) { Write-Output "no existe: $Libro"; exit 1 }
if (Test-Path -LiteralPath $Pdf) { Write-Output "ya existe, no lo piso: $Pdf (elegi otro nombre)"; exit 1 }
$estaba = @(Get-Process EXCEL -ErrorAction SilentlyContinue).Count -gt 0
$xl = New-Object -ComObject Excel.Application
$xl.DisplayAlerts = $false
$wb = $null
try {
  # Open(Filename, UpdateLinks=0, ReadOnly=true)
  $wb = $xl.Workbooks.Open((Resolve-Path -LiteralPath $Libro).ProviderPath, 0, $true)
  $hojas = @($wb.Worksheets | ForEach-Object { $_.Name })
  $wb.ExportAsFixedFormat(0, $Pdf)
  Write-Output ("hojas: " + ($hojas -join ' | '))
} finally {
  if ($null -ne $wb) { $wb.Close($false) }
  if (-not $estaba -and $xl.Workbooks.Count -eq 0) { $xl.Quit() }
}
if (Test-Path -LiteralPath $Pdf) { Write-Output ("pdf: " + $Pdf + " (" + (Get-Item -LiteralPath $Pdf).Length + " bytes)") } else { Write-Output 'el PDF no se genero'; exit 1 }
