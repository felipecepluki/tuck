import { describe, expect, test } from 'bun:test';
import { demoClips, filterClips } from './model';

describe('history search', () => {
  test('matches accent-free search against accented text', () => {
    expect(filterClips(demoClips, 'all', 'resume').map((clip) => clip.id)).toEqual(['unicode']);
  });
  test('requires all query words and respects favorites', () => {
    expect(filterClips(demoClips, 'pinned', 'more creating').map((clip) => clip.id)).toEqual([
      'idea',
    ]);
    expect(filterClips(demoClips, 'pinned', 'bun run')).toEqual([]);
  });
  test('combines category, favorites and accent-free search', () => {
    const clips = demoClips.map((clip) => ({
      ...clip,
      category: clip.id === 'idea' ? 'ideas' : null,
    }));
    expect(filterClips(clips, 'pinned', 'creating', 'ideas').map((clip) => clip.id)).toEqual([
      'idea',
    ]);
    expect(filterClips(clips, 'all', '', 'missing')).toEqual([]);
  });
  test('preserves original multilingual content', () => {
    const result = filterClips(demoClips, 'text', '日本語');
    expect(result).toHaveLength(1);
    expect(result[0].content).toContain('café ☕');
  });
});
