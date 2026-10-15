#!/usr/bin/env python3
"""Read-only capability report. Never reads clipboard, history, or user profiles."""
import argparse
import datetime
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent

def run(args):
    if not shutil.which(args[0]):
        return {"status": "missing_tool", "tool": args[0]}
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=8)
        return {"status": "ok" if result.returncode == 0 else "failed", "exit_code": result.returncode,
                "stdout": result.stdout.strip(), "stderr": result.stderr.strip()}
    except subprocess.TimeoutExpired:
        return {"status": "timeout"}

def collect():
    report = {"recorded_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "scope": "Capabilities only; no clipboard content collected",
              "session": {key: os.environ.get(key) for key in ("XDG_SESSION_TYPE", "XDG_CURRENT_DESKTOP", "GDK_BACKEND")}}
    os_release = Path('/etc/os-release')
    report["os"] = dict(re.findall(r'^(PRETTY_NAME|VERSION_ID)="?([^"\n]+)', os_release.read_text(), re.M)) if os_release.exists() else {"platform": os.name}
    report["versions"] = {name: run(args) for name, args in {
        "gnome_shell": ["gnome-shell", "--version"], "rust": ["rustc", "--version"], "bun": ["bun", "--version"],
        "gtk": ["pkg-config", "--modversion", "gtk+-3.0"], "webkitgtk": ["pkg-config", "--modversion", "webkit2gtk-4.1"],
        "wayland_client": ["pkg-config", "--modversion", "wayland-client"], "xwayland": ["Xwayland", "-version"],
        "hyprland": ["Hyprland", "--version"], "sway": ["sway", "--version"], "weston": ["weston", "--version"]}.items()}
    with tempfile.TemporaryDirectory(prefix="tuck-gate0-") as directory:
        flags = run(["pkg-config", "--cflags", "--libs", "wayland-client"])
        if flags["status"] == "ok":
            binary = str(Path(directory) / "probe")
            compiled = run(["cc", str(ROOT / "scripts/probe-wayland.c"), "-o", binary, *shlex.split(flags["stdout"])])
            registry = run([binary]) if compiled["status"] == "ok" else compiled
        else:
            registry = flags
    report["wayland_registry"] = registry
    report["data_control"] = {"status": "available" if "data_control" in registry.get("stdout", "") else "not_advertised" if registry["status"] == "ok" else "probe_failed",
                              "note": "An advertised protocol is not proof of successful background capture."}
    portal = run(["gdbus", "introspect", "--session", "--dest", "org.freedesktop.portal.Desktop", "--object-path", "/org/freedesktop/portal/desktop"])
    text = portal.pop("stdout", "")
    report["portal"] = {**portal, "interfaces": sorted(set(re.findall(r'interface (org\.freedesktop\.portal\.[A-Za-z]+)', text))),
                        "global_shortcuts": "present" if "org.freedesktop.portal.GlobalShortcuts" in text else "not_exposed" if portal["status"] == "ok" else "probe_failed"}
    report["portal_versions"] = {}
    for interface in ["org.freedesktop.portal.Clipboard", "org.freedesktop.portal.GlobalShortcuts"]:
        report["portal_versions"][interface] = run(["gdbus", "call", "--session", "--dest", "org.freedesktop.portal.Desktop", "--object-path", "/org/freedesktop/portal/desktop", "--method", "org.freedesktop.DBus.Properties.Get", interface, "version"])
    report["tray_host"] = run(["gdbus", "call", "--session", "--dest", "org.freedesktop.DBus", "--object-path", "/org/freedesktop/DBus", "--method", "org.freedesktop.DBus.NameHasOwner", "org.kde.StatusNotifierWatcher"])
    report["notification_capabilities"] = run(["gdbus", "call", "--session", "--dest", "org.freedesktop.Notifications", "--object-path", "/org/freedesktop/Notifications", "--method", "org.freedesktop.Notifications.GetCapabilities"])
    report["app_identifier"] = json.loads((ROOT / 'src-tauri/tauri.conf.json').read_text())["identifier"]
    report["checks_not_performed"] = ["clipboard read/write", "hidden capture", "source closure", "ownership lifetime", "global shortcut registration/conflict", "native versus XWayland end-to-end", "old webview rendering"]
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    encoded = json.dumps(collect(), indent=2, ensure_ascii=False) + '\n'
    if args.output:
        args.output.write_text(encoded)
        print(f"Saved capability report: {args.output}")
    else:
        print(encoded)
