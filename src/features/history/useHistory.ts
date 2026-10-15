import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { capturedHistory, nativeDesktop, type CaptureSnapshot } from '../../lib/desktop';
import { demoClips, demoCategories } from './model';

const historyKey = ['history'] as const;
const demo: CaptureSnapshot = {
  revision: 0,
  enabled: false,
  tray_available: false,
  last_error: null,
  items: demoClips,
  categories: demoCategories,
};
export function useHistory() {
  const client = useQueryClient();
  const history = useQuery({
    queryKey: historyKey,
    initialData: nativeDesktop ? undefined : demo,
    queryFn: async () => {
      const previous = client.getQueryData<CaptureSnapshot>(historyKey);
      if (!nativeDesktop) return previous ?? demo;
      const next = await capturedHistory();
      return previous && previous.revision > next.revision ? previous : next;
    },
    staleTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (!nativeDesktop) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void listen('capture-changed', () => {
      void client.invalidateQueries({ queryKey: historyKey });
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else {
          stop = unlisten;
          void client.invalidateQueries({ queryKey: historyKey });
        }
      })
      .catch(() => {
        void client.invalidateQueries({ queryKey: historyKey });
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, [client]);
  const mutation = useMutation({
    mutationFn: (task: () => Promise<void>) => task(),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: historyKey });
    },
  });
  function updateDemo(change: (snapshot: CaptureSnapshot) => CaptureSnapshot) {
    client.setQueryData<CaptureSnapshot>(historyKey, (old) => change(old ?? demo));
  }
  return { history, mutation, updateDemo };
}
