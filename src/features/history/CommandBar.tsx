import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Command } from 'cmdk';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { FileText, X } from 'lucide-react';
import { clipTime, type Clip, type Category } from './model';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { ItemMenu } from './ItemMenu';

type Props = {
  clips: Clip[];
  categories: Category[];
  query: string;
  onQuery: (value: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  onCopy: (clip: Clip) => void;
  onPin: (clip: Clip) => void;
  onDelete: (clip: Clip) => void;
  onMove: (clip: Clip, category: string) => void;
  onPreview: (clip: Clip) => void;
  onManage: () => void;
  theme: string;
  busy: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  filterLabel: string;
  filterValue: string;
  onFilterChange: (value: string) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  emptyAction?: () => void;
  emptyActionLabel?: string;
};
export function CommandBar(props: Props) {
  const { clips, query, selectedId, onSelect, searchRef } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(
    0,
    clips.findIndex((clip) => clip.id === selectedId),
  );
  const selected = clips[selectedIndex];
  const filterOptions = [
    { value: 'all', label: 'All items' },
    { value: 'pinned', label: 'Pinned' },
    { value: 'link', label: 'Links' },
    { value: 'text', label: 'Text' },
    { value: 'code', label: 'Code' },
  ];
  const collectionOptions = props.categories.map((item) => ({
    value: `category:${item.id}`,
    label: item.name,
  }));
  const categories = useMemo(
    () => new Map(props.categories.map((category) => [category.id, category.name])),
    [props.categories],
  );
  const virtual = useVirtualizer({
    count: clips.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 68,
    getItemKey: (index) => clips[index].id,
    overscan: 5,
    // Keep the active option mounted even outside the visible range.
    rangeExtractor: (range) =>
      [...new Set([...defaultRangeExtractor(range), selectedIndex])]
        .filter((index) => index < clips.length)
        .sort((a, b) => a - b),
  });
  useEffect(() => {
    if (clips.length) virtual.scrollToIndex(selectedIndex, { align: 'auto' });
  }, [selectedIndex, selected?.id, clips.length, virtual]);

  return (
    <Command
      label="Clipboard history"
      shouldFilter={false}
      vimBindings={false}
      disablePointerSelection
      value={selected?.id ?? ''}
      onValueChange={onSelect}
      className="command-bar"
      onKeyDownCapture={(event) => {
        if (event.nativeEvent.isComposing || event.target !== searchRef.current) return;
        // Preserve text-editing keys and let TanStack own Ctrl/Cmd shortcuts.
        if (
          event.key === 'Home' ||
          event.key === 'End' ||
          ((event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) &&
            event.key.startsWith('Arrow'))
        ) {
          event.stopPropagation();
          return;
        }
        const directions: Record<string, number> = {
          ArrowDown: 1,
          ArrowUp: -1,
          PageDown: 7,
          PageUp: -7,
        };
        if (event.key in directions && clips.length) {
          event.preventDefault();
          event.stopPropagation();
          const index = Math.max(
            0,
            Math.min(clips.length - 1, selectedIndex + directions[event.key]),
          );
          onSelect(clips[index].id);
          virtual.scrollToIndex(index, { align: 'auto' });
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          if (selected && !event.repeat) props.onCopy(selected);
        }
      }}
    >
      <header className="search-row">
        <Command.Input
          ref={searchRef}
          placeholder="Search your clipboard…"
          aria-label="Search clipboard history"
          value={query}
          onValueChange={props.onQuery}
          className="search-input"
          spellCheck={false}
        />
        {query && (
          <Button
            variant="ghost"
            className="icon-button"
            aria-label="Clear search"
            onClick={() => props.onQuery('')}
          >
            <X size={16} />
          </Button>
        )}
        <Select
          items={[...filterOptions, ...collectionOptions]}
          value={props.filterValue}
          onValueChange={(value) => {
            if (value) props.onFilterChange(value);
          }}
        >
          <SelectTrigger aria-label="Filter clipboard history" className="history-filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="min-w-48">
            <SelectGroup>
              <SelectLabel>Clipboard</SelectLabel>
              {filterOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
            {!!collectionOptions.length && (
              <SelectGroup>
                <SelectLabel>Collections</SelectLabel>
                {collectionOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </header>
      <div className="list-heading">
        <span>
          {query
            ? 'Search results'
            : props.filterLabel === 'All items'
              ? 'Pinned & recent'
              : props.filterLabel}
        </span>
        <span>
          {clips.length} {clips.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      <Command.List
        ref={scrollRef}
        className="history-list"
        aria-label="Clipboard items"
        aria-busy={props.loading}
      >
        {props.loading ? (
          <div className="empty-state">
            <FileText size={24} />
            <h3>Loading your history</h3>
            <p>Everything stays on this device.</p>
          </div>
        ) : props.error ? (
          <div className="empty-state">
            <h3>History unavailable</h3>
            <Button variant="ghost" className="secondary-button" onClick={props.onRetry}>
              Try again
            </Button>
          </div>
        ) : !clips.length ? (
          <div className="empty-state">
            <FileText size={24} />
            <h3>{query ? 'No matches found' : 'A home for what you copy'}</h3>
            <p>
              {query
                ? 'Try another word or change the filter.'
                : 'Copy something, then return to Tuck to keep it here.'}
            </p>
            {props.emptyAction && (
              <Button variant="ghost" className="secondary-button" onClick={props.emptyAction}>
                {props.emptyActionLabel}
              </Button>
            )}
          </div>
        ) : null}
        <div className="virtual-space" style={{ height: virtual.getTotalSize() }}>
          {virtual.getVirtualItems().map((row) => {
            const clip = clips[row.index];
            const active = clip.id === selected?.id;
            return (
              <div
                key={clip.id}
                className={`history-row ${active ? 'active' : ''}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: row.size,
                  transform: `translateY(${row.start}px)`,
                }}
              >
                <Command.Item
                  value={clip.id}
                  forceMount
                  onSelect={() => props.onCopy(clip)}
                  aria-posinset={row.index + 1}
                  aria-setsize={clips.length}
                  className={`history-item ${active ? 'active' : ''}`}
                >
                  <div className="item-content">
                    <div className="item-title">
                      {clip.content.replace(/\s+/g, ' ').slice(0, 300)}
                    </div>
                    <div className="item-description">
                      <span className={`type-label ${clip.kind}`}>
                        {clip.kind === 'link' ? 'Link' : clip.kind === 'code' ? 'Code' : 'Text'}
                      </span>
                      {clip.category && (
                        <span>{categories.get(clip.category) ?? 'Collection'}</span>
                      )}
                      <span>{clipTime(clip)}</span>
                    </div>
                  </div>
                  {clip.pinned && <span className="pin-indicator">Pinned</span>}
                </Command.Item>
                <ItemMenu
                  clip={clip}
                  categories={props.categories}
                  theme={props.theme}
                  busy={props.busy}
                  onOpen={() => onSelect(clip.id)}
                  onCopy={() => props.onCopy(clip)}
                  onPin={() => props.onPin(clip)}
                  onDelete={() => props.onDelete(clip)}
                  onPreview={() => props.onPreview(clip)}
                  onMove={(category) => props.onMove(clip, category)}
                  onManage={props.onManage}
                />
              </div>
            );
          })}
        </div>
      </Command.List>
    </Command>
  );
}
