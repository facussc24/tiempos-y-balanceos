# Cierra SIN guardar las ventanas de mail de Outlook cuyo asunto empieza con el texto dado (el mail de
# demostracion o de prueba que abrio otro programa). No toca ningun otro mail abierto.
# Uso: powershell -File cerrar_mail_demo.ps1 -Asunto "PRUEBA Claude Barack"
# Solo ASCII en este archivo.
param([Parameter(Mandatory = $true)][string]$Asunto)
try { $ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') }
catch { Write-Output 'Outlook no esta abierto: no hay nada que cerrar'; exit 0 }
$cerrados = 0
$abiertos = @()
foreach ($i in @($ol.Inspectors)) {
  $item = $i.CurrentItem
  $s = [string]$item.Subject
  if ($s.StartsWith($Asunto, [StringComparison]::OrdinalIgnoreCase)) { $item.Close(1); $cerrados++ }
  else { $abiertos += $s }
}
Write-Output ("cerrados sin guardar: " + $cerrados + " | quedan abiertos: " + $abiertos.Count)
