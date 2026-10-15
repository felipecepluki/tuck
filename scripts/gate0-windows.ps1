# Read-only environment inventory. Does not read or overwrite the clipboard.
param([string]$OutputPath = "gate0-windows-environment.json", [switch]$ProbeShortcut)
$ErrorActionPreference = "Stop"
function Tool-Version([string]$Name) {
    if (Get-Command $Name -ErrorAction SilentlyContinue) {
        return (& $Name --version 2>&1 | Out-String).Trim()
    }
    return "missing_tool"
}
$os = Get-CimInstance Win32_OperatingSystem
$webviewRoot = Join-Path ${env:ProgramFiles(x86)} "Microsoft\EdgeWebView\Application"
$webviews = @()
if (Test-Path $webviewRoot) {
    $webviews = @(Get-ChildItem $webviewRoot -Directory | Where-Object Name -Match '^\d+\.\d+' | Select-Object -ExpandProperty Name)
}
$report = [ordered]@{
    recordedAtUtc = [DateTime]::UtcNow.ToString("o")
    os = @{caption=$os.Caption; version=$os.Version; build=$os.BuildNumber}
    tools = @{rust=(Tool-Version "rustc"); cargo=(Tool-Version "cargo"); bun=(Tool-Version "bun")}
    webview2MachineInstallVersions = $webviews
    scope = "Read-only inventory; missing version is not proof that a per-user runtime is absent."
    appIdentifier = "com.felipecepluki.tuck"
    clipboardReadWrite = "pending_manual_test"
    hiddenCapture = "not_implemented"
    sourceClosure = "pending_manual_test"
    ownershipAfterQuit = "pending_manual_test"
    globalShortcut = "not_implemented"
    launcherShow = "pending_manual_test"
}
if ($ProbeShortcut) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class TuckGate0Hotkey {
    [DllImport("user32.dll", SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
    [DllImport("user32.dll", SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool UnregisterHotKey(IntPtr window, int id);
}
'@
    $first = $false
    $second = $false
    try {
        # Ctrl+Alt+Shift+V; never replace a binding or reserve a Windows-logo key.
        $first = [TuckGate0Hotkey]::RegisterHotKey([IntPtr]::Zero, 0x7b01, 0x4007, 0x56)
        $firstError = if ($first) { 0 } else { [Runtime.InteropServices.Marshal]::GetLastWin32Error() }
        $secondError = $null
        if ($first) {
            $second = [TuckGate0Hotkey]::RegisterHotKey([IntPtr]::Zero, 0x7b02, 0x4007, 0x56)
            $secondError = if ($second) { 0 } else { [Runtime.InteropServices.Marshal]::GetLastWin32Error() }
        }
        $report.nativeShortcutProbe = @{binding="Ctrl+Alt+Shift+V"; registered=$first; firstError=$firstError; duplicateRegistered=$second; duplicateError=$secondError; activation="not_tested"; scope="Win32 primitive, not Tauri integration"}
    } finally {
        if ($second) { [void][TuckGate0Hotkey]::UnregisterHotKey([IntPtr]::Zero, 0x7b02) }
        if ($first) { [void][TuckGate0Hotkey]::UnregisterHotKey([IntPtr]::Zero, 0x7b01) }
    }
}
$report | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 $OutputPath
Write-Host "Saved environment report to $OutputPath; no clipboard payload collected."
