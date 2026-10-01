# Lista las ventanas visibles de un proceso (titulo, tamano, posicion) y, si se pide, le da un tamano a la que
# tiene cierto titulo. Sirve para capturar una conversacion abierta en su propia ventana.
# Uso: powershell -File ventanas.ps1 [-Proceso Claude] [-Titulo "<como empieza>" -X 60 -Y 20 -Ancho 1500 -Alto 950]
# Solo ASCII. No hace clic ni escribe en la ventana: solo la mueve.
param([string]$Proceso = 'Claude', [string]$Titulo = '', [int]$X = 60, [int]$Y = 20, [int]$Ancho = 1500, [int]$Alto = 950)
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class Vs {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  delegate bool Recorre(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern bool EnumWindows(Recorre f, IntPtr p);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int a, bool repintar);
  public static List<string> Lista(HashSet<uint> pids) {
    var o = new List<string>();
    EnumWindows(delegate(IntPtr h, IntPtr p) {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (!pids.Contains(pid) || !IsWindowVisible(h)) return true;
      var s = new System.Text.StringBuilder(512); GetWindowText(h, s, 512);
      RECT r; GetWindowRect(h, out r);
      if (s.Length > 0 && r.R - r.L > 200) o.Add(h.ToInt64() + "|" + s + "|" + r.L + "," + r.T + "," + (r.R - r.L) + "x" + (r.B - r.T));
      return true;
    }, IntPtr.Zero);
    return o;
  }
}
'@
[void][Vs]::SetProcessDPIAware()
$pids = New-Object 'System.Collections.Generic.HashSet[uint32]'
Get-Process $Proceso -ErrorAction SilentlyContinue | ForEach-Object { [void]$pids.Add([uint32]$_.Id) }
$lista = [Vs]::Lista($pids)
foreach ($l in $lista) {
  $p = $l.Split('|')
  if ($Titulo -and $p[1].StartsWith($Titulo, [StringComparison]::OrdinalIgnoreCase)) {
    [void][Vs]::MoveWindow([IntPtr][int64]$p[0], $X, $Y, $Ancho, $Alto, $true)
    Write-Output ("movida: " + $p[1])
  } else { Write-Output ($p[1] + "  " + $p[2]) }
}
