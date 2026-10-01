# Acomoda la ventana de la app para sacar capturas: la agranda, la devuelve a como estaba, o dice donde esta.
# Uso: powershell -File ventana.ps1 -Accion rect|maximizar|restaurar|tamano [-Proceso Claude] [-Ancho 1700 -Alto 1000]
# Solo ASCII. No escribe ni hace clic en la ventana: solo cambia su tamano.
param([Parameter(Mandatory = $true)][string]$Accion, [string]$Proceso = 'Claude', [int]$Ancho = 1700, [int]$Alto = 1000)
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Vent {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int a, bool repintar);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
}
'@
[void][Vent]::SetProcessDPIAware()
$p = Get-Process $Proceso -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Output "no encuentro una ventana de $Proceso"; exit 1 }
$h = $p.MainWindowHandle
switch ($Accion) {
  'maximizar' { [void][Vent]::ShowWindow($h, 3) }
  'restaurar' { [void][Vent]::ShowWindow($h, 9) }
  'tamano'    { [void][Vent]::ShowWindow($h, 9); Start-Sleep -Milliseconds 300; [void][Vent]::MoveWindow($h, 60, 20, $Ancho, $Alto, $true) }
}
Start-Sleep -Milliseconds 500
$r = New-Object Vent+RECT
[void][Vent]::DwmGetWindowAttribute($h, 9, [ref]$r, 16)
Write-Output ("rect: {0},{1},{2},{3}  ancho {4} alto {5}  maximizada {6}" -f $r.L, $r.T, $r.R, $r.B, ($r.R - $r.L), ($r.B - $r.T), [Vent]::IsZoomed($h))
