#!/usr/bin/env python3
"""Manual GTK clipboard fixture. No background reads, files, logs or network.

Source buttons write only synthetic text on explicit clicks. The destination
accepts a normal user-initiated paste; its contents are never printed or saved.
Set GDK_BACKEND before launch and record the displayed GDK backend.
"""
import argparse
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--role', choices=('source', 'destination'), required=True)
args = parser.parse_args()
try:
    import gi
    gi.require_version('Gtk', '3.0')
    gi.require_version('Gdk', '3.0')
    from gi.repository import Gtk, Gdk, GObject
except (ImportError, ValueError):
    sys.exit('Requer Python do sistema com PyGObject/GTK 3; não instala pacotes.')

if not Gtk.init_check()[0]:
    sys.exit('Sem acesso ao display solicitado. Execute no terminal da sessão gráfica.')
display = Gdk.Display.get_default()
backend = GObject.type_name(display.__gtype__)
print(f'GTK fixture role={args.role}; backend={backend}')
window = Gtk.Window(title=f'Tuck Gate 0 — {args.role} — {backend}')
window.set_default_size(520, 300)
window.set_border_width(16)
box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
window.add(box)
heading = Gtk.Label(label=f'{args.role} · {backend}')
heading.set_xalign(0)
box.pack_start(heading, False, False, 0)

if args.role == 'source':
    info = Gtk.Label(label='Clique para copiar uma fixture. Nenhuma leitura automática.\nFechar esta janela encerra o processo que oferece o texto.')
    info.set_xalign(0)
    info.set_line_wrap(True)
    box.pack_start(info, False, False, 0)
    clipboard = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
    fixtures = {
        'A': 'TUCK-GATE0-A: ação ☕ 日本語\n  linha com espaços  ',
        'B': 'TUCK-GATE0-B: segunda cópia',
        'C': 'TUCK-GATE0-C: terceira cópia',
        'PAUSA': 'TUCK-GATE0-PAUSA: não registrar enquanto pausado',
    }
    for name, payload in fixtures.items():
        button = Gtk.Button(label=f'Copiar {name}')
        button.connect('clicked', lambda _, text=payload: clipboard.set_text(text, -1))
        box.pack_start(button, False, False, 0)
else:
    info = Gtk.Label(label='Cole aqui com Ctrl+V. O conteúdo não é salvo nem impresso.\nCompare A: Unicode, quebra de linha e espaços preservados.')
    info.set_xalign(0)
    box.pack_start(info, False, False, 0)
    view = Gtk.TextView()
    view.set_wrap_mode(Gtk.WrapMode.WORD_CHAR)
    scroller = Gtk.ScrolledWindow()
    scroller.add(view)
    box.pack_start(scroller, True, True, 0)
    clear = Gtk.Button(label='Limpar campo de teste')
    clear.connect('clicked', lambda _: view.get_buffer().set_text(''))
    box.pack_start(clear, False, False, 0)

window.connect('destroy', Gtk.main_quit)
window.show_all()
Gtk.main()
