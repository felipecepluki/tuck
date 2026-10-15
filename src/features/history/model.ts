export type ClipKind = 'text' | 'code' | 'link';
export type Category = { id: string; name: string };
export const demoCategories: Category[] = [
  { id: 'work', name: 'Work' },
  { id: 'ideas', name: 'Ideas' },
];
export type Clip = {
  id: string;
  title: string;
  content: string;
  kind: ClipKind;
  source: string;
  time: string;
  pinned: boolean;
  category?: string | null;
  captured_at?: number;
};
export type Filter = 'all' | 'pinned' | ClipKind;
export const demoClips: Clip[] = [
  {
    id: 'welcome',
    title: 'A home for what you copy.',
    content:
      'An idea worth keeping. A snippet you will use again. A link you do not want to lose.\n\nCopy it. Tuck it. Find it.',
    kind: 'text',
    source: 'Notes',
    time: 'Just now',
    pinned: false,
  },
  {
    id: 'code',
    title: 'Find without losing context',
    content:
      'async function findClips(query: string) {\n  return invoke("list_history", { query, limit: 50 });\n}',
    kind: 'code',
    source: 'Editor',
    time: '2 min ago',
    pinned: true,
  },
  {
    id: 'tanstack',
    title: 'TanStack Hotkeys',
    content: 'https://tanstack.com/hotkeys/latest',
    kind: 'link',
    source: 'Browser',
    time: '5 min ago',
    pinned: false,
  },
  {
    id: 'idea',
    title: 'Less searching. More creating.',
    content:
      'Less searching. More creating.\n\nOpen with a shortcut, find what matters, and get back to your flow.',
    kind: 'text',
    source: 'Notes',
    time: '12 min ago',
    pinned: true,
  },
  {
    id: 'command',
    title: 'Run the desktop app',
    content: 'bun run tauri dev',
    kind: 'code',
    source: 'Terminal',
    time: '18 min ago',
    pinned: false,
  },
  {
    id: 'tauri',
    title: 'Tauri documentation',
    content: 'https://v2.tauri.app/start/',
    kind: 'link',
    source: 'Browser',
    time: '25 min ago',
    pinned: true,
  },
  {
    id: 'unicode',
    title: 'Every character matters',
    content:
      'A résumé, a café ☕, an idea.\n日本語 · Ελληνικά\n\nYour original text stays intact, including Unicode and emoji: ☕ 💡',
    kind: 'text',
    source: 'Notes',
    time: '32 min ago',
    pinned: false,
  },
  {
    id: 'json',
    title: 'Example preferences',
    content: '{\n  "theme": "dark",\n  "maxItems": 500,\n  "captureEnabled": false\n}',
    kind: 'code',
    source: 'Editor',
    time: '40 min ago',
    pinned: false,
  },
];
export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US');
}
export function filterClips(clips: Clip[], filter: Filter, query: string, category?: string) {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return clips.filter(
    (clip) =>
      (!category || clip.category === category) &&
      (filter === 'all' || (filter === 'pinned' ? clip.pinned : clip.kind === filter)) &&
      words.every((word) => normalize(`${clip.title} ${clip.content}`).includes(word)),
  );
}
export function clipTime(clip: Clip) {
  if (!clip.captured_at) return clip.time === 'Agora' ? 'Just now' : clip.time;
  const minutes = Math.max(0, Math.floor((Date.now() / 1000 - clip.captured_at) / 60));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
  return new Date(clip.captured_at * 1000).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  });
}
