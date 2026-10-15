#!/usr/bin/env python3
"""Standalone current-WebKit feature spike. No clipboard/history access or network."""
import argparse
import json
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, GLib, WebKit2
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True)
args = parser.parse_args()
report = {"webkit": '.'.join(str(fn()) for fn in [WebKit2.get_major_version, WebKit2.get_minor_version, WebKit2.get_micro_version]), "scope": "Feature spike only: no Tailwind stylesheet compiled, no older-webview certification", "status": "timeout"}
window = Gtk.Window(title='Tuck — Gate 0 webview feature probe')
window.set_default_size(380, 160)
view = WebKit2.WebView()
window.add(view)
script = "JSON.stringify({oklch:CSS.supports('color','oklch(60% .15 270)'),colorMix:CSS.supports('color','color-mix(in oklab, red, blue)'),propertyRegistration:typeof CSS.registerProperty==='function',dialog:typeof HTMLDialogElement==='function',backdropFilter:CSS.supports('backdrop-filter','blur(4px)'),grid:CSS.supports('display','grid')})"
def finished(webview, result, _):
    try:
        report['features'] = json.loads(webview.run_javascript_finish(result).get_js_value().to_string())
        report['status'] = 'completed'
    except Exception as error:
        report['status'] = 'failed'
        report['error_type'] = type(error).__name__
    Gtk.main_quit()
def loaded(webview, event):
    if event == WebKit2.LoadEvent.FINISHED:
        webview.run_javascript(script, None, finished, None)
view.connect('load-changed', loaded)
window.connect('destroy', lambda _: Gtk.main_quit() if Gtk.main_level() > 0 else None)
GLib.timeout_add_seconds(12, lambda: (Gtk.main_quit(), False)[1])
view.load_html('<!doctype html><title>Gate 0</title><p>Local CSS feature probe. No clipboard access.</p>', 'about:blank')
window.show_all()
Gtk.main()
window.destroy()
with open(args.output, 'w') as output:
    json.dump(report, output, indent=2)
print('WebKit feature probe:', report['status'])
