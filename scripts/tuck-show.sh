#!/bin/sh
# Development launcher fallback. No global shortcut is installed.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec "$root/src-tauri/target/debug/clipboard-manager" --show
