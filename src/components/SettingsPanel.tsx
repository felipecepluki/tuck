import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Shortcut } from './Shortcut';
type Props = {
  native: boolean;
  busy: boolean;
  enabled: boolean;
  captureAvailable: boolean;
  captureMessage?: string;
  captureError?: string | null;
  onCaptureToggle: () => void;
  onCapture: () => void;
  onCategories: () => void;
  onClear: () => void;
  hasItems: boolean;
  theme: string;
  onTheme: (value: string) => void;
  opacity: number;
  onOpacity: (value: number) => void;
  animations: boolean;
  onAnimations: (value: boolean) => void;
  blur: boolean;
  blurSupported: boolean;
  onBlur: (value: boolean) => void;
  effectMessage?: string;
  updateMessage: string;
  onUpdates: () => void;
  environment: string;
};
export function SettingsPanel(p: Props) {
  return (
    <div className="settings-panel">
      <p className="text-sm text-muted-foreground">
        Make a little space for the things you want to keep.
      </p>
      <Tabs defaultValue="general">
        <TabsList className="w-full">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="keyboard">Shortcuts</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="space-y-4 pt-3">
          <Card>
            <CardHeader>
              <CardTitle>Clipboard history</CardTitle>
              <CardDescription>
                Private, on this device. Pinned clips stay safe from automatic cleanup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {p.native && (
                <>
                  <div className="setting-control">
                    <Label htmlFor="capture-return">Capture on return</Label>
                    <Switch
                      id="capture-return"
                      checked={p.enabled}
                      disabled={p.busy || !p.captureAvailable}
                      onCheckedChange={p.onCaptureToggle}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.captureMessage ??
                      'Captures the current text when you return to Tuck. Copies made while hidden may be missed.'}
                  </p>
                  {p.captureError && (
                    <p role="alert" className="text-destructive">
                      {p.captureError}
                    </p>
                  )}
                  <Button variant="outline" disabled={p.busy} onClick={p.onCapture}>
                    Capture current clipboard
                  </Button>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={p.onCategories}>
                  Manage collections
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive"
                  disabled={!p.hasItems || p.busy}
                  onClick={p.onClear}
                >
                  Clear history…
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                500 items · 1 MiB per clip · 16 MiB total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tuck 0.0.1</CardTitle>
              <CardDescription>Copy it. Tuck it. Find it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="setting-control">
                <span className="text-xs text-muted-foreground">{p.environment}</span>
                <Button variant="outline" onClick={p.onUpdates}>
                  Check for updates
                </Button>
              </div>
              {p.updateMessage && (
                <p className="text-xs text-muted-foreground" role="status">
                  {p.updateMessage}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="appearance" className="space-y-4 pt-3">
          <Card>
            <CardHeader>
              <CardTitle>Your workspace</CardTitle>
              <CardDescription>A calm surface, with just enough personality.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="setting-control">
                <Label>Theme</Label>
                <Select
                  items={[
                    { value: 'dark', label: 'Dark' },
                    { value: 'light', label: 'Light' },
                  ]}
                  value={p.theme}
                  onValueChange={(value) => {
                    if (value) p.onTheme(value);
                  }}
                >
                  <SelectTrigger aria-label="Theme" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <div className="setting-control">
                  <Label id="opacity-label">Background opacity</Label>
                  <span className="text-xs text-muted-foreground">{p.opacity}%</span>
                </div>
                <Slider
                  aria-labelledby="opacity-label"
                  value={[p.opacity]}
                  min={20}
                  max={100}
                  step={5}
                  onValueChange={(value) => p.onOpacity(Array.isArray(value) ? value[0] : value)}
                />
              </div>
              <div className="setting-control">
                <div>
                  <Label htmlFor="interface-animations">Interface animations</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Animate panels in Tuck independently of your desktop setting.
                  </p>
                </div>
                <Switch
                  id="interface-animations"
                  checked={p.animations}
                  onCheckedChange={p.onAnimations}
                />
              </div>
              <div className="setting-control">
                <Label htmlFor="background-blur">Background blur</Label>
                <Switch
                  id="background-blur"
                  checked={p.blur}
                  disabled={!p.blurSupported}
                  onCheckedChange={p.onBlur}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {p.effectMessage ?? 'Native blur availability depends on your desktop.'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="keyboard" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>Stay in your flow</CardTitle>
              <CardDescription>
                These shortcuts work inside Tuck. Use your desktop launcher to open it globally.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {[
                ['Search', 'F'],
                ['Actions', 'K'],
                ['Pin selected', 'P'],
                ['Toggle sidebar', 'B'],
                ['Settings', ','],
              ].map(([label, key]) => (
                <div className="shortcut-row" key={label}>
                  <span>{label}</span>
                  <Shortcut keys={key} mod />
                </div>
              ))}
              <div className="shortcut-row">
                <span>Navigate / copy</span>
                <span>
                  <Shortcut keys="↑ ↓" /> <Shortcut keys="↵" />
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
