import { useEffect, useMemo, useState } from 'react';
import { QuickControls } from './pages/QuickControls';
import { SettingsPage } from './pages/Settings';
import { useAppStore } from './store/device-store';

function getRoute() {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('/settings')) return 'settings';
  return 'popup';
}

function applyTheme(theme: 'dark' | 'light' | 'system') {
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  document.body.style.background = isDark ? 'transparent' : 'transparent';
  // For settings shell we use CSS variables; keep simple for now
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

export default function App() {
  const [route, setRoute] = useState(getRoute());
  const setSnapshots = useAppStore((s) => s.setSnapshots);
  const setSettings = useAppStore((s) => s.setSettings);
  const setLoading = useAppStore((s) => s.setLoading);
  const settings = useAppStore((s) => s.settings);

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(useAppStore.getState().settings.theme);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [settings.theme]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [snaps, sett] = await Promise.all([window.wiz.getSnapshots(), window.wiz.getSettings()]);
        if (!mounted) return;
        setSnapshots(snaps);
        setSettings(sett);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const unsubSnaps = window.wiz.onSnapshotsUpdated((snaps) => setSnapshots(snaps));
    const unsubSettings = window.wiz.onSettingsUpdated((sett) => setSettings(sett));
    return () => { mounted = false; unsubSnaps(); unsubSettings(); };
  }, [setLoading, setSettings, setSnapshots]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && route === 'popup') window.wiz.closePopup();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route]);

  return route === 'settings' ? <SettingsPage /> : <QuickControls />;
}
