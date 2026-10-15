import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { useHotkey } from '@tanstack/react-hotkeys';
import {
  Copy,
  Eye,
  Star,
  Trash2,
  Folder,
  Plus,
  Check,
  CheckCircle2,
  Info,
  X,
  Clipboard,
  ArrowLeft,
} from 'lucide-react';
import { filterClips, type Clip, type Filter } from './features/history/model';
import { CommandBar } from './features/history/CommandBar';
import { useHistory } from './features/history/useHistory';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Checkbox } from './components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './components/ui/select';
import { Modal } from './components/Modal';
import { Shortcut } from './components/Shortcut';
import { AppSidebar } from './components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './components/ui/sidebar';
import { TooltipProvider } from './components/ui/tooltip';
import { SettingsPanel } from './components/SettingsPanel';
import {
  captureText,
  copyText,
  getSessionInfo,
  nativeDesktop,
  setCaptureEnabled,
  pinCaptured,
  deleteCaptured,
  clearCaptured,
  dismissHistory,
  editCategory,
  categorizeCaptured,
  configureBlur,
  checkUpdates,
  type EffectStatus,
} from './lib/desktop';
import './App.css';

type View = 'settings' | 'actions' | 'preview' | 'categories' | 'filters' | 'clear' | null;
function stored(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function App() {
  const { history, mutation, updateDemo } = useHistory();
  const capture = history.data;
  const clips = capture?.items ?? [];
  const categories = capture?.categories ?? [];
  const session = useQuery({
    queryKey: ['session'],
    queryFn: getSessionInfo,
    enabled: nativeDesktop,
    staleTime: Infinity,
  });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState<View>(null);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [includePinned, setIncludePinned] = useState(false);
  const [theme, setTheme] = useState(() =>
    stored('clipboard-theme', 'dark') === 'light' ? 'light' : 'dark',
  );
  const [opacity, setOpacity] = useState(() => {
    const value = Number(stored('clipboard-opacity', '100'));
    return Number.isFinite(value) ? Math.max(20, Math.min(100, value)) : 100;
  });
  const [animations, setAnimations] = useState(() => stored('tuck-animations', 'true') === 'true');
  const [blur, setBlur] = useState(() => stored('clipboard-blur', 'false') === 'true');
  const [effect, setEffect] = useState<EffectStatus | null>(null);
  const [notice, setNotice] = useState<{ text: string; success: boolean; tick: number } | null>(
    null,
  );
  const [updateMessage, setUpdateMessage] = useState('Update releases are not configured yet.');
  const [copying, setCopying] = useState(false);
  const operationLock = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const visible = useMemo(
    () =>
      filterClips(clips, filter, query, category).sort(
        (a, b) => Number(b.pinned) - Number(a.pinned),
      ),
    [clips, filter, query, category],
  );
  const selected = visible.find((clip) => clip.id === selectedId) ?? visible[0];
  const busy = copying || mutation.isPending;
  const filterLabel = category
    ? (categories.find((item) => item.id === category)?.name ?? 'Category')
    : filter === 'pinned'
      ? 'Pinned'
      : filter === 'link'
        ? 'Links'
        : filter === 'code'
          ? 'Code'
          : filter === 'text'
            ? 'Text'
            : 'All items';
  function notify(text: string, success = false) {
    setNotice({ text, success, tick: Date.now() });
  }
  function closeView() {
    setView(null);
    requestAnimationFrame(() => searchRef.current?.focus());
  }
  useEffect(() => {
    searchRef.current?.focus();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('clipboard-theme', theme);
      localStorage.setItem('clipboard-opacity', String(opacity));
      localStorage.setItem('clipboard-blur', String(blur));
      localStorage.setItem('tuck-animations', String(animations));
    } catch {
      /* Appearance works without persistence. */
    }
    document.documentElement.style.colorScheme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.motion = animations ? 'full' : 'reduced';
  }, [theme, opacity, blur, animations]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const enableBlur = blur && opacity < 100;
  useEffect(() => {
    let active = true;
    if (!nativeDesktop) {
      setEffect({
        supported: true,
        applied: enableBlur,
        message: 'Browser preview only. Desktop blur depends on the operating system.',
      });
      return;
    }
    void configureBlur(enableBlur)
      .then((status) => {
        if (active) setEffect(status);
      })
      .catch(() => {
        if (active)
          setEffect({
            supported: false,
            applied: false,
            message: 'Native background blur is unavailable.',
          });
      });
    return () => {
      active = false;
    };
  }, [enableBlur]);
  useEffect(() => {
    if (!nativeDesktop) return;
    let disposed = false;
    const stops: (() => void)[] = [];
    async function subscribe() {
      for (const [name, callback] of [
        [
          'history-opened',
          () => {
            setQuery('');
            setSelectedId('');
            setView(null);
            requestAnimationFrame(() => searchRef.current?.focus());
          },
        ],
        [
          'desktop-action',
          (payload: string) => {
            if (payload === 'favorites') {
              setFilter('pinned');
              setCategory('');
            }
            if (payload === 'settings') setView('settings');
            if (payload === 'updates') {
              setView('settings');
              void checkUpdates()
                .then(setUpdateMessage)
                .catch(() => notify('Unable to check updates.'));
            }
            if (payload === 'about') {
              setView('settings');
              setUpdateMessage('Tuck 0.0.1 · your clipboard, kept locally.');
            }
            if (payload === 'copy-success') notify('Copied. Ready to paste.', true);
            if (payload === 'copy-error')
              notify('Unable to copy from the tray. Open Tuck and try again.');
            if (payload === 'missing-item') notify('This item is no longer in your history.');
          },
        ],
      ] as const) {
        const stop = await listen<string>(name, (event) => callback(event.payload));
        if (disposed) stop();
        else stops.push(stop);
      }
    }
    void subscribe().catch(() => {
      if (!disposed) notify('Desktop menu connection unavailable. Reopen Tuck to reconnect.');
    });
    return () => {
      disposed = true;
      stops.forEach((stop) => stop());
    };
  }, []);
  async function run(task: () => Promise<void>, message?: string) {
    if (operationLock.current) return false;
    operationLock.current = true;
    try {
      await mutation.mutateAsync(task);
      if (message) notify(message);
      return true;
    } catch (error) {
      notify(
        typeof error === 'string'
          ? error
          : error instanceof Error
            ? error.message
            : 'Unable to save this change.',
      );
      return false;
    } finally {
      operationLock.current = false;
    }
  }
  async function toggleCapture() {
    await run(async () => {
      if (nativeDesktop) await setCaptureEnabled(!capture?.enabled);
      else updateDemo((old) => ({ ...old, enabled: !old.enabled }));
    });
  }
  async function copyClip(clip: Clip) {
    if (operationLock.current) return;
    operationLock.current = true;
    setCopying(true);
    try {
      await copyText(clip.content);
      notify('Copied. Ready to paste.', true);
      closeView();
    } catch {
      notify('Unable to copy. Keep Tuck focused and try again.');
    } finally {
      operationLock.current = false;
      setCopying(false);
    }
  }
  async function pinSelected(clip = selected) {
    if (!clip) return;
    await run(
      async () => {
        if (nativeDesktop) await pinCaptured(clip.id, !clip.pinned);
        else
          updateDemo((old) => ({
            ...old,
            items: old.items.map((item) =>
              item.id === clip.id ? { ...item, pinned: !clip.pinned } : item,
            ),
          }));
      },
      clip.pinned ? 'Item unpinned.' : 'Item pinned.',
    );
  }
  async function deleteSelected(clip = selected) {
    if (!clip) return;
    const next = visible[visible.indexOf(clip) + 1] ?? visible[visible.indexOf(clip) - 1];
    const ok = await run(async () => {
      if (nativeDesktop) await deleteCaptured(clip.id);
      else
        updateDemo((old) => ({
          ...old,
          items: old.items.filter((item) => item.id !== clip.id),
        }));
    }, 'Item deleted.');
    if (ok) {
      setSelectedId(next?.id ?? '');
      closeView();
    }
  }
  async function assignCategory(value: string, clip = selected) {
    if (!clip) return;
    const ok = await run(async () => {
      if (nativeDesktop) await categorizeCaptured(clip.id, value || null);
      else
        updateDemo((old) => ({
          ...old,
          items: old.items.map((item) =>
            item.id === clip.id ? { ...item, category: value || null } : item,
          ),
        }));
    }, 'Category updated.');
    if (ok) closeView();
  }
  async function saveCategory(remove = false, id = editingCategory) {
    const name = categoryName.trim();
    const ok = await run(
      async () => {
        if (nativeDesktop) await editCategory(id, name, remove);
        else {
          if (!remove && (!name || Array.from(name).length > 40))
            throw new Error('Use a name between 1 and 40 characters.');
          if (
            !remove &&
            categories.some(
              (item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase(),
            )
          )
            throw new Error('This category already exists.');
          if (!remove && !id && categories.length >= 30)
            throw new Error('The 30-category limit has been reached.');
          updateDemo((old) => ({
            ...old,
            categories: remove
              ? old.categories.filter((item) => item.id !== id)
              : id
                ? old.categories.map((item) => (item.id === id ? { ...item, name } : item))
                : [...old.categories, { id: crypto.randomUUID(), name }],
            items: remove
              ? old.items.map((clip) => (clip.category === id ? { ...clip, category: null } : clip))
              : old.items,
          }));
        }
      },
      remove ? 'Category deleted. Your items are preserved.' : 'Category saved.',
    );
    if (ok) {
      setEditingCategory(null);
      setCategoryName('');
      if (remove && category === id) setCategory('');
    }
  }
  async function manualCapture() {
    if (!nativeDesktop) return;
    const ok = await run(async () => {
      await captureText();
    }, 'Current clipboard saved.');
    if (ok) {
      setFilter('all');
      setCategory('');
      setQuery('');
      closeView();
    }
  }
  async function clearHistory() {
    const ok = await run(
      async () => {
        if (nativeDesktop) await clearCaptured(includePinned);
        else
          updateDemo((old) => ({
            ...old,
            items: includePinned ? [] : old.items.filter((clip) => clip.pinned),
          }));
      },
      includePinned ? 'History cleared.' : 'Unpinned history cleared.',
    );
    if (ok) closeView();
  }
  useHotkey('Mod+F', () => searchRef.current?.focus(), { enabled: !view });
  useHotkey('Mod+K', () => setView('actions'), { enabled: !view && !!selected });
  useHotkey(
    'Mod+P',
    () => {
      void pinSelected();
    },
    { enabled: (!view || view === 'actions') && !!selected, ignoreInputs: false },
  );
  useHotkey(
    'Enter',
    () => {
      if (selected) void copyClip(selected);
    },
    { enabled: view === 'actions', ignoreInputs: true },
  );
  useHotkey(
    'Delete',
    () => {
      void deleteSelected();
    },
    { enabled: view === 'actions', ignoreInputs: true },
  );
  useHotkey('Mod+,', () => setView('settings'), { enabled: !view });
  useHotkey(
    'Escape',
    () => {
      if (query) {
        setQuery('');
        setSelectedId('');
      } else if (filter !== 'all' || category) {
        setFilter('all');
        setCategory('');
      } else if (nativeDesktop)
        void dismissHistory().catch(() => notify('Unable to hide the window.'));
    },
    { enabled: !view },
  );
  const title =
    view === 'settings'
      ? 'Settings'
      : view === 'actions'
        ? 'Item actions'
        : view === 'preview'
          ? 'Full text'
          : view === 'categories'
            ? 'Categories'
            : view === 'clear'
              ? 'Clear history'
              : 'Filter history';

  return (
    <TooltipProvider>
      <SidebarProvider
        className={`app ${nativeDesktop ? 'native-app' : 'browser-preview'}`}
        style={
          {
            '--panel-alpha': opacity / 100,
            '--panel-blur': enableBlur ? '24px' : '0px',
          } as CSSProperties
        }
      >
        <AppSidebar
          clips={clips}
          categories={categories}
          filter={filter}
          category={category}
          onFilter={(next, nextCategory = '') => {
            setFilter(next);
            setCategory(nextCategory);
            setSelectedId('');
          }}
          onCategories={() => setView('categories')}
          onSettings={() => setView('settings')}
        />
        <SidebarInset className="workspace" aria-label="Clipboard workspace">
          <div className="workspace-heading">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <div>
              <h1>
                {category
                  ? filterLabel
                  : filter === 'all'
                    ? 'Your clipboard'
                    : filter === 'pinned'
                      ? 'Pinned clips'
                      : filter === 'link'
                        ? 'Links'
                        : filter === 'code'
                          ? 'Code'
                          : 'Text'}
              </h1>
            </div>
            <p className="workspace-eyebrow">Your space, remembered</p>
          </div>
          <CommandBar
            clips={visible}
            categories={categories}
            query={query}
            onQuery={(value) => {
              setQuery(value);
              setSelectedId('');
            }}
            selectedId={selected?.id ?? ''}
            onSelect={setSelectedId}
            onCopy={(clip) => {
              void copyClip(clip);
            }}
            onPin={(clip) => {
              void pinSelected(clip);
            }}
            onDelete={(clip) => {
              void deleteSelected(clip);
            }}
            onMove={(clip, category) => {
              void assignCategory(category, clip);
            }}
            onPreview={(clip) => {
              setSelectedId(clip.id);
              setView('preview');
            }}
            onManage={() => setView('categories')}
            theme={theme}
            busy={busy}
            searchRef={searchRef}
            filterLabel={filterLabel}
            filterValue={category ? `category:${category}` : filter}
            onFilterChange={(value) => {
              if (value.startsWith('category:')) {
                setCategory(value.slice(9));
                setFilter('all');
              } else {
                setCategory('');
                setFilter(value as Filter);
              }
              setSelectedId('');
            }}
            loading={history.isPending}
            error={history.isError}
            onRetry={() => {
              void history.refetch();
            }}
            emptyAction={
              nativeDesktop &&
              !query &&
              !capture?.enabled &&
              session.data?.capture_on_focus !== false
                ? () => {
                    void toggleCapture();
                  }
                : undefined
            }
            emptyActionLabel="Enable capture on return"
          />
          <footer className="action-bar">
            <span className="footer-status">
              <span className={`status-dot ${capture?.enabled ? 'active' : ''}`} />
              {nativeDesktop
                ? session.data?.capture_on_focus === false
                  ? 'Manual capture'
                  : capture?.enabled
                    ? 'Capture on return'
                    : 'Capture paused'
                : 'Demo · sample history'}
            </span>
            <div className="footer-actions">
              <span className="footer-tip">
                Copy <Shortcut keys="↵" />
              </span>
              <Button
                variant="ghost"
                className="actions-button"
                disabled={!selected || busy}
                onClick={() => setView('actions')}
              >
                Actions <Shortcut keys="K" mod />
              </Button>
            </div>
          </footer>
        </SidebarInset>
        {notice && (
          <div
            className={`notice ${notice.success ? 'copy-popup' : ''}`}
            role="status"
            aria-live="polite"
          >
            {notice.success ? <CheckCircle2 size={18} /> : <Info size={18} />}
            <span>{notice.text}</span>
            <Button
              variant="ghost"
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice(null)}
            >
              <X size={15} />
            </Button>
          </div>
        )}
        <Modal open={!!view} title={title} onClose={closeView}>
          {view === 'filters' && (
            <>
              <Button
                variant="ghost"
                className="menu-action"
                onClick={() => {
                  setFilter('all');
                  setCategory('');
                  closeView();
                }}
              >
                <Clipboard size={17} />
                All items{filter === 'all' && !category && <Check size={16} />}
              </Button>
              <Button
                variant="ghost"
                className="menu-action"
                onClick={() => {
                  setFilter('pinned');
                  setCategory('');
                  closeView();
                }}
              >
                <Star size={17} />
                Pinned{filter === 'pinned' && !category && <Check size={16} />}
              </Button>
              {categories.map((item) => (
                <Button
                  variant="ghost"
                  className="menu-action"
                  key={item.id}
                  onClick={() => {
                    setCategory(item.id);
                    setFilter('all');
                    closeView();
                  }}
                >
                  <Folder size={17} />
                  {item.name}
                  {category === item.id && <Check size={16} />}
                </Button>
              ))}
              <hr />
              <Button variant="ghost" className="menu-action" onClick={() => setView('categories')}>
                <Plus size={17} />
                Manage categories
              </Button>
            </>
          )}
          {view === 'actions' && (
            <>
              <p className="selected-summary">{selected?.content.slice(0, 160)}</p>
              <Button
                variant="ghost"
                className="menu-action"
                disabled={busy}
                onClick={() => selected && void copyClip(selected)}
              >
                <Copy size={17} />
                Copy
                <Shortcut keys="↵" />
              </Button>
              <Button
                variant="ghost"
                className="menu-action"
                disabled={busy}
                onClick={() => {
                  void pinSelected();
                }}
              >
                <Star size={17} />
                {selected?.pinned ? 'Unpin item' : 'Pin item'}
                <Shortcut keys="P" mod />
              </Button>
              <Button variant="ghost" className="menu-action" onClick={() => setView('preview')}>
                <Eye size={17} />
                View full text
              </Button>
              <label className="setting-row">
                <span>Category</span>
                <Select
                  value={selected?.category || '__none'}
                  disabled={busy}
                  onValueChange={(value) => {
                    if (value) void assignCategory(value === '__none' ? '' : value);
                  }}
                >
                  <SelectTrigger aria-label="Item collection">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No collection</SelectItem>
                    {categories.map((item) => (
                      <SelectItem value={item.id} key={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <Button variant="ghost" className="menu-action" onClick={() => setView('categories')}>
                <Folder size={17} />
                Manage categories
              </Button>
              <hr />
              <Button
                variant="ghost"
                className="menu-action danger"
                disabled={busy}
                onClick={() => {
                  void deleteSelected();
                }}
              >
                <Trash2 size={17} />
                Delete item
                <Shortcut keys="Delete" />
              </Button>
            </>
          )}
          {view === 'preview' && (
            <>
              <pre className="text-preview">{selected?.content}</pre>
              <Button
                variant="ghost"
                className="secondary-button"
                disabled={busy}
                onClick={() => selected && void copyClip(selected)}
              >
                <Copy size={15} />
                Copy original text
              </Button>
            </>
          )}
          {view === 'categories' && (
            <>
              <p className="description">
                Keep reusable text organized. Deleting a category preserves its items.
              </p>
              <form
                className="category-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveCategory();
                }}
              >
                <Input
                  aria-label="Category name"
                  placeholder="New category…"
                  value={categoryName}
                  maxLength={40}
                  onChange={(event) => setCategoryName(event.target.value)}
                />
                <Button type="submit" variant="secondary" disabled={busy || !categoryName.trim()}>
                  {editingCategory ? 'Save' : 'Create'}
                </Button>
                {editingCategory && (
                  <Button
                    variant="ghost"
                    type="button"
                    className="icon-button"
                    aria-label="Cancel editing"
                    onClick={() => {
                      setEditingCategory(null);
                      setCategoryName('');
                    }}
                  >
                    <X size={16} />
                  </Button>
                )}
              </form>
              <div className="category-list">
                {categories.map((item) => (
                  <div className="category-management-row" key={item.id}>
                    <Folder size={16} />
                    <span>{item.name}</span>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setEditingCategory(item.id);
                        setCategoryName(item.name);
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      className="icon-button"
                      aria-label={`Delete category ${item.name}`}
                      disabled={busy}
                      onClick={() => {
                        void saveCategory(true, item.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
          {view === 'settings' && (
            <SettingsPanel
              native={nativeDesktop}
              busy={busy}
              enabled={capture?.enabled ?? false}
              captureAvailable={session.data?.capture_on_focus !== false}
              captureMessage={session.data?.capture}
              captureError={capture?.last_error}
              onCaptureToggle={() => void toggleCapture()}
              onCapture={() => void manualCapture()}
              onCategories={() => setView('categories')}
              onClear={() => {
                setIncludePinned(false);
                setView('clear');
              }}
              hasItems={!!clips.length}
              theme={theme}
              onTheme={setTheme}
              opacity={opacity}
              onOpacity={setOpacity}
              blur={blur && !!effect?.supported}
              blurSupported={!!effect?.supported}
              onBlur={setBlur}
              animations={animations}
              onAnimations={setAnimations}
              effectMessage={effect?.message}
              updateMessage={updateMessage}
              onUpdates={() => {
                void checkUpdates()
                  .then(setUpdateMessage)
                  .catch(() => notify('Unable to check updates.'));
              }}
              environment={
                nativeDesktop && session.data
                  ? `${session.data.desktop} / ${session.data.session}`
                  : 'Browser preview'
              }
            />
          )}
          {view === 'clear' && (
            <>
              <p className="description">
                Delete saved history from this device. This does not erase the system clipboard or
                the preserved legacy database. The current clipboard can be captured again when you
                return.
              </p>
              <label className="setting-row">
                <span>Also delete pinned items</span>
                <Checkbox
                  checked={includePinned}
                  onCheckedChange={setIncludePinned}
                  aria-label="Also delete pinned items"
                />
              </label>
              <div className="confirmation-actions">
                <Button
                  variant="ghost"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setView('settings')}
                >
                  <ArrowLeft size={15} />
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  className="secondary-button danger"
                  disabled={busy}
                  onClick={() => {
                    void clearHistory();
                  }}
                >
                  Delete {includePinned ? 'all' : 'unpinned'} history
                </Button>
              </div>
            </>
          )}
          {notice && (
            <p className="dialog-notice" role="status">
              {notice.text}
            </p>
          )}
        </Modal>
      </SidebarProvider>
    </TooltipProvider>
  );
}
export default App;
