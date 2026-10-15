import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('./clipboard-capture@clipboard-manager.local/extension.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export default class', 'return class');
function fixture() {
  const calls: any[] = [];
  const clipboard = { get_mimetypes: () => [] as string[], get_text: (_: any, callback: any) => callback(null, 'https://maccy.app') };
  const Main = { sessionMode: { isLocked: false, connect: () => 2, disconnect: () => {} } };
  const Gio = { Cancellable: class { cancel() {} }, BusType: { SESSION: 0 }, BusNameWatcherFlags: { NONE: 0 }, BusNameOwnerFlags: { NONE: 0 }, bus_own_name: () => 3, bus_unown_name: () => {}, DBusCallFlags: { NONE: 0 },
    bus_watch_name: (_a: any, _b: any, _c: any, appeared: any) => { appeared(null, null, ':1.42'); return 1; }, bus_unwatch_name: () => {},
    DBus: { session: { call: (...args: any[]) => { calls.push(args); } } } };
  const GLib = { VariantType: class { constructor(public type: string) {} }, Variant: class { constructor(public type: string, public data: any) {} } };
  const selection = { connect: () => 1, disconnect: () => {} };
  const Bridge = new Function('Gio', 'GLib', 'Meta', 'St', 'Extension', 'Main', 'global', source)(Gio, GLib, { SelectionType: { SELECTION_CLIPBOARD: 1 } }, { ClipboardType: { CLIPBOARD: 1 }, Clipboard: { get_default: () => clipboard } }, class {}, Main, { display: { get_selection: () => selection } });
  const bridge = new Bridge(); bridge.enable();
  const respond = (index: number, state: any) => calls[index][9]({ call_finish: () => ({ deep_unpack: () => state }) }, null);
  return { bridge, calls, respond, clipboard, Main };
}
test('only sends synthetic text after active handshake, directly to original owner', () => {
  const f = fixture(); f.bridge._capture(); f.respond(0, [true, 7]);
  expect(f.calls).toHaveLength(2);
  expect(f.calls[1][0]).toBe(':1.42');
  expect(f.calls[1][4].data).toEqual([7, 'https://maccy.app']);
});
test('paused capture never reads clipboard', () => {
  const f = fixture(); f.clipboard.get_text = () => { throw Error('must not read'); };
  f.bridge._capture(); f.respond(0, [false, 1]); expect(f.calls).toHaveLength(1);
});
test('session lock and invalidated requests never forward text', () => {
  const f = fixture(); f.bridge._capture(); f.Main.sessionMode.isLocked = true;
  f.respond(0, [true, 1]); expect(f.calls).toHaveLength(1);
  f.Main.sessionMode.isLocked = false;
  f.bridge._capture(); f.bridge.disable(); f.respond(1, [true, 1]); expect(f.calls).toHaveLength(2);
});
test('recognized sensitive hints are skipped', () => {
  const f = fixture(); f.clipboard.get_mimetypes = () => ['x-kde-passwordManagerHint'];
  f.bridge._capture(); f.respond(0, [true, 1]); expect(f.calls).toHaveLength(1);
});
