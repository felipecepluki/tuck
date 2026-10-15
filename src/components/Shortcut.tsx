import { Kbd } from '@heroui/react/kbd';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
export function Shortcut({ keys, mod = false }: { keys: string; mod?: boolean }) {
  return (
    <Kbd className="shortcut" aria-label={`${mod ? (isMac ? 'Command ' : 'Control ') : ''}${keys}`}>
      {mod && <Kbd.Content>{isMac ? '⌘' : 'Ctrl'}</Kbd.Content>}
      <Kbd.Content>{keys}</Kbd.Content>
    </Kbd>
  );
}
