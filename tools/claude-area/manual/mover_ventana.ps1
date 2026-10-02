# Ubica y da tamano a UNA ventana buscada por como empieza su titulo (para grabarla o capturarla), sin traerla al
# frente ni escribirle nada. Las medidas van en pixeles reales del monitor donde queda.
# Uso: powershell -File mover_ventana.ps1 -Titulo "<como empieza>" [-X 2000 -Y 30 -Ancho 1600 -Alto 1000] [-Arriba | -Soltar]
# Solo ASCII en este archivo.
param([Parameter(Mandatory = $true)][string]$Titulo, [int]$X = 2000, [int]$Y = 30, [int]$Ancho = 1600, [int]$Alto = 1000, [switch]$Arriba, [switch]$Soltar)
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class Mov {
  public delegate bool Enum(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("shcore.dll")] public static extern int SetProcessDpiAwareness(int v);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Enum f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr tras, int x, int y, int w, int a, uint f);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
}
'@
[void][Mov]::SetProcessDpiAwareness(2)
$script:hallada = [IntPtr]::Zero; $script:nombre = ''
$f = [Mov+Enum] { param($h, $l)
  if ([Mov]::IsWindowVisible($h)) {
    $sb = New-Object System.Text.StringBuilder 400
    [void][Mov]::GetWindowText($h, $sb, 400)
    if ($sb.ToString().StartsWith($Titulo, [StringComparison]::OrdinalIgnoreCase)) { $script:hallada = $h; $script:nombre = $sb.ToString(); return $false }
  }
  return $true
}
[void][Mov]::EnumWindows($f, [IntPtr]::Zero)
if ($script:hallada -eq [IntPtr]::Zero) { Write-Output ('no encuentro una ventana que empiece con: ' + $Titulo); exit 1 }
[void][Mov]::ShowWindow($script:hallada, 4)                                   # 4 = mostrar sin activar (por si estaba maximizada)
# -Arriba: la deja encima de todas (una ventana tapada no se redibuja y la grabacion sale congelada: 02/10/2026).
# -Soltar: le saca el "encima de todas". Sin ninguna de las dos no cambia el orden. Nunca la activa.
if ($Arriba) { [void][Mov]::SetWindowPos($script:hallada, [IntPtr](-1), $X, $Y, $Ancho, $Alto, 0x0010) }
elseif ($Soltar) { [void][Mov]::SetWindowPos($script:hallada, [IntPtr](-2), $X, $Y, $Ancho, $Alto, 0x0010) }
else { [void][Mov]::SetWindowPos($script:hallada, [IntPtr]::Zero, $X, $Y, $Ancho, $Alto, 0x0014) }
$r = New-Object Mov+RECT
[void][Mov]::GetWindowRect($script:hallada, [ref]$r)
Write-Output ('ventana en ' + $r.L + ',' + $r.T + ' de ' + ($r.R - $r.L) + 'x' + ($r.B - $r.T))
