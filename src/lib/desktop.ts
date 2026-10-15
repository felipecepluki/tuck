import type { Clip, Category } from '../features/history/model';
import { invoke, isTauri } from '@tauri-apps/api/core';
export const nativeDesktop = isTauri();
export type SessionInfo = {
  session: string;
  desktop: string;
  capture: string;
  activation: string;
  capture_on_focus: boolean;
};
export function getSessionInfo() {
  return invoke<SessionInfo>('session_info');
}
export async function copyText(text: string) {
  if (nativeDesktop) return invoke<void>('probe_write_text', { text });
  if (!navigator.clipboard)
    throw new Error('Clipboard access is unavailable in this browser context.');
  return navigator.clipboard.writeText(text);
}
export function captureText() {
  return invoke<string>('probe_read_text');
}

export type CaptureSnapshot = {
  revision: number;
  enabled: boolean;
  tray_available: boolean;
  last_error: string | null;
  items: Clip[];
  categories: Category[];
};
export function capturedHistory() {
  return invoke<CaptureSnapshot>('captured_history');
}
export function setCaptureEnabled(enabled: boolean) {
  return invoke<void>('set_capture_enabled', { enabled });
}
export function pinCaptured(id: string, pinned: boolean) {
  return invoke<void>('pin_captured', { id, pinned });
}
export function deleteCaptured(id: string) {
  return invoke<void>('delete_captured', { id });
}

export function dismissHistory() {
  return invoke<void>('dismiss_history');
}

export function editCategory(id: string | null, name: string, remove = false) {
  return invoke<void>('edit_category', { id, name, remove });
}
export function categorizeCaptured(id: string, category: string | null) {
  return invoke<void>('categorize_captured', { id, category });
}

export type EffectStatus = { supported: boolean; applied: boolean; message: string };
export function configureBlur(enabled: boolean) {
  return invoke<EffectStatus>('configure_blur', { enabled });
}
export function checkUpdates() {
  return nativeDesktop
    ? invoke<string>('check_updates')
    : Promise.resolve('Updates are not configured yet: no releases have been published.');
}

export function clearCaptured(includePinned: boolean) {
  return invoke<void>('clear_captured', { includePinned });
}
