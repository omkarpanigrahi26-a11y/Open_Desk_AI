param (
    [int]$amount = -160,
    [int]$delayMs = 750
)

$flagPath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "opendesk_scroller_stop.flag")
if (Test-Path $flagPath) { Remove-Item -Force $flagPath -ErrorAction SilentlyContinue }

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ContinuousScroller {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);
    public static void Scroll(int val) {
        mouse_event(0x0800, 0, 0, val, UIntPtr.Zero);
    }
}
"@

$iterations = 0
$maxIterations = 50 # Auto-stops after ~45s safety window so screen never scrolls endlessly
while ($iterations -lt $maxIterations) {
    if (Test-Path $flagPath) { break }
    [ContinuousScroller]::Scroll($amount)
    $iterations++
    Start-Sleep -Milliseconds $delayMs
}
if (Test-Path $flagPath) { Remove-Item -Force $flagPath -ErrorAction SilentlyContinue }
