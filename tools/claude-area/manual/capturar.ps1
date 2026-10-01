# Saca una captura de UNA ventana (no del escritorio entero) a un PNG, en pixeles reales.
# Uso: powershell -File capturar.ps1 -Salida <archivo.png> [-Proceso Claude | -Titulo "<titulo exacto>" | -Activa]
#   -Proceso  nombre del proceso cuya ventana principal se captura (por defecto Claude)
#   -Titulo   titulo exacto de la ventana (para un mail de Outlook o un cuadro de dialogo)
#   -Activa   la ventana que esta al frente
#   -DeLaVentana  le pide el dibujo a la propia ventana (sale bien aunque tenga otra encima)
# Solo ASCII en este archivo. No toca la ventana: solo copia lo que se ve.
param(
  [Parameter(Mandatory = $true)][string]$Salida,
  [string]$Proceso = 'Claude',
  [string]$Titulo = '',
  [switch]$Activa,
  [switch]$DeLaVentana
)
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Ventana {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string clase, string titulo);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
  delegate bool Recorre(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(Recorre f, IntPtr p);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  // Primera ventana visible cuyo titulo EMPIEZA con el texto dado (Outlook le agrega cosas al final).
  public static IntPtr Buscar(string empieza) {
    IntPtr hallada = IntPtr.Zero;
    EnumWindows(delegate(IntPtr h, IntPtr p) {
      if (!IsWindowVisible(h)) return true;
      var s = new System.Text.StringBuilder(512); GetWindowText(h, s, 512);
      if (s.ToString().StartsWith(empieza, StringComparison.OrdinalIgnoreCase)) { hallada = h; return false; }
      return true;
    }, IntPtr.Zero);
    return hallada;
  }
}
'@
[void][Ventana]::SetProcessDPIAware()
if ($Activa) { $h = [Ventana]::GetForegroundWindow() }
elseif ($Titulo) {
  $h = [Ventana]::Buscar($Titulo)
  if ($h -eq [IntPtr]::Zero) { Write-Output "no encuentro una ventana cuyo titulo empiece con: $Titulo"; exit 1 }
}
else {
  $p = Get-Process $Proceso -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if (-not $p) { Write-Output "no encuentro una ventana de $Proceso"; exit 1 }
  $h = $p.MainWindowHandle
}
$r = New-Object Ventana+RECT
if ($DeLaVentana) { [void][Ventana]::GetWindowRect($h, [ref]$r) }
elseif ([Ventana]::DwmGetWindowAttribute($h, 9, [ref]$r, 16) -ne 0) { [void][Ventana]::GetWindowRect($h, [ref]$r) }
$w = $r.R - $r.L; $a = $r.B - $r.T
if ($w -le 0 -or $a -le 0) { Write-Output "ventana sin tamano ($w x $a)"; exit 1 }
$bmp = New-Object System.Drawing.Bitmap $w, $a
$g = [System.Drawing.Graphics]::FromImage($bmp)
if ($DeLaVentana) {
  $hdc = $g.GetHdc()
  $ok = [Ventana]::PrintWindow($h, $hdc, 2)
  $g.ReleaseHdc($hdc)
  if (-not $ok) { Write-Output 'la ventana no devolvio su dibujo'; exit 1 }
} else {
  $g.CopyFromScreen($r.L, $r.T, 0, 0, (New-Object System.Drawing.Size $w, $a))
}
$dir = Split-Path -Parent $Salida
if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
$bmp.Save($Salida, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "captura: $Salida ($w x $a)"
