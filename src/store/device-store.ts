import { create } from 'zustand';
import { AppSettings, DEFAULT_SETTINGS, DeviceSnapshot } from '../../shared/types';

interface AppState {
  snapshots: DeviceSnapshot[];
  settings: AppSettings;
  loading: boolean;
  setSnapshots: (snapshots: DeviceSnapshot[]) => void;
  setSettings: (settings: AppSettings) => void;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  snapshots: [],
  settings: DEFAULT_SETTINGS,
  loading: true,
  setSnapshots: (snapshots) => set({ snapshots }),
  setSettings: (settings) => set({ settings }),
  setLoading: (loading) => set({ loading }),
}));

export function useSelectedSnapshot(): DeviceSnapshot | undefined {
  return useAppStore((s) => s.snapshots[0]);
}
