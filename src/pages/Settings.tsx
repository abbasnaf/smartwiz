import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, Search, Save, Wifi, WifiOff, X } from 'lucide-react';
import { useAppStore } from '../store/device-store';
import { RoomControls } from '../components/RoomControls';
import { SettingsDeviceCard } from '../components/SettingsDeviceCard';
import { AppSettings, DeviceSnapshot, DiscoveryResult } from '../../shared/types';

type Feedback = { kind: 'success' | 'error' | 'info'; message: string };
type TestResult = { ok: boolean; message: string };

function isValidIpv4(value: string) {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
}

function roomName(snapshot: DeviceSnapshot) {
  return snapshot.config.room?.trim() || 'Unassigned';
}

export function SettingsPage() {
  const snapshots = useAppStore((state) => state.snapshots);
  const settings = useAppStore((state) => state.settings);
  const loading = useAppStore((state) => state.loading);
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [room, setRoom] = useState('');
  const [mac, setMac] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveryResult[]>([]);
  const [testedIp, setTestedIp] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);
  const [refreshIntervalInput, setRefreshIntervalInput] = useState(String(settings.refreshIntervalMs));
  const [udpTimeoutInput, setUdpTimeoutInput] = useState(String(settings.udpTimeoutMs));
  const [preferencesBusy, setPreferencesBusy] = useState(false);

  useEffect(() => {
    setDraftSettings(settings);
    setRefreshIntervalInput(String(settings.refreshIntervalMs));
    setUdpTimeoutInput(String(settings.udpTimeoutMs));
  }, [settings]);

  const groups = useMemo(() => {
    const byRoom = new Map<string, DeviceSnapshot[]>();
    for (const snapshot of snapshots) {
      const label = roomName(snapshot);
      const devices = byRoom.get(label) ?? [];
      devices.push(snapshot);
      byRoom.set(label, devices);
    }
    return Array.from(byRoom.entries()).sort(([a], [b]) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });
  }, [snapshots]);
  const roomNames = groups.map(([label]) => label).filter((label) => label !== 'Unassigned');
  const trimmedIp = ip.trim();
  const duplicateIp = snapshots.some((snapshot) => snapshot.config.ip === trimmedIp && snapshot.config.id !== editingId);
  const canSaveDevice = Boolean(
    name.trim()
      && isValidIpv4(trimmedIp)
      && !duplicateIp
      && testedIp === trimmedIp
      && testResult?.ok
      && !busyAction,
  );
  const settingsDirty = draftSettings.startWithWindows !== settings.startWithWindows
    || draftSettings.minimizeToTray !== settings.minimizeToTray
    || draftSettings.theme !== settings.theme
    || draftSettings.autoRefresh !== settings.autoRefresh
    || refreshIntervalInput !== String(settings.refreshIntervalMs)
    || udpTimeoutInput !== String(settings.udpTimeoutMs);

  const clearForm = () => {
    setName('');
    setIp('');
    setRoom('');
    setMac(undefined);
    setEditingId(null);
    setTestedIp(null);
    setTestResult(null);
    setFormError(null);
  };

  const selectDiscovered = (device: DiscoveryResult) => {
    const saved = snapshots.find((snapshot) => snapshot.config.ip === device.ip);
    setEditingId(saved?.config.id ?? null);
    setName(saved?.config.name ?? device.name ?? 'WiZ Bulb');
    setIp(device.ip);
    setRoom(saved?.config.room ?? '');
    setMac(device.mac ?? saved?.config.mac);
    setTestedIp(null);
    setTestResult(null);
    setFormError(null);
    setFeedback(null);
  };

  const testDevice = async () => {
    if (!isValidIpv4(trimmedIp)) {
      setFormError('Enter a valid IPv4 address before testing.');
      return;
    }
    setBusyAction('test');
    setTestResult(null);
    setTestedIp(null);
    setFormError(null);
    try {
      const result = await window.wiz.testDevice(trimmedIp);
      const message = result.ok
        ? `Connected${result.state ? ` · ${result.state.state ? 'On' : 'Off'}${typeof result.state.dimming === 'number' ? ` · ${result.state.dimming}%` : ''}` : ''}`
        : `Could not connect: ${result.error ?? 'No response from the bulb.'}`;
      setTestResult({ ok: result.ok, message });
      if (result.ok) {
        setTestedIp(trimmedIp);
        if (result.state?.mac) setMac(result.state.mac);
      }
    } catch (error) {
      setTestResult({ ok: false, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusyAction(null);
    }
  };

  const saveDevice = async () => {
    if (!name.trim()) {
      setFormError('Enter a name for this device.');
      return;
    }
    if (!isValidIpv4(trimmedIp)) {
      setFormError('Enter a valid IPv4 address.');
      return;
    }
    if (duplicateIp) {
      setFormError('A device with this IP address is already saved.');
      return;
    }
    if (testedIp !== trimmedIp || !testResult?.ok) {
      setFormError('Test the connection successfully before saving.');
      return;
    }

    setBusyAction('save');
    setFormError(null);
    setFeedback(null);
    try {
      const input = {
        name: name.trim(),
        ip: trimmedIp,
        room: room.trim(),
        mac,
      };
      if (editingId) await window.wiz.updateDevice({ ...input, id: editingId });
      else await window.wiz.addDevice(input);
      setFeedback({ kind: 'success', message: `${name.trim()} saved successfully.` });
      clearForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction(null);
    }
  };

  const discoverDevices = async () => {
    setDiscovering(true);
    setFeedback(null);
    try {
      const results = await window.wiz.discover(3500);
      setDiscovered(results);
      if (!results.length) setFeedback({ kind: 'info', message: 'No bulbs found. Check that they are on the same local network, or add one by IP address.' });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setDiscovering(false);
    }
  };

  const editDevice = (snapshot: DeviceSnapshot) => {
    setEditingId(snapshot.config.id);
    setName(snapshot.config.name);
    setIp(snapshot.config.ip);
    setRoom(snapshot.config.room ?? '');
    setMac(snapshot.config.mac);
    setTestedIp(null);
    setTestResult(null);
    setFormError(null);
    setFeedback(null);
  };

  const refreshDevice = async (snapshot: DeviceSnapshot) => {
    setBusyAction(`refresh:${snapshot.config.id}`);
    setFeedback(null);
    try {
      const refreshed = await window.wiz.refreshDevice(snapshot.config.id);
      setFeedback(refreshed?.status === 'connected'
        ? { kind: 'success', message: `${snapshot.config.name} is connected and up to date.` }
        : { kind: 'error', message: refreshed?.error ?? `Could not refresh ${snapshot.config.name}.` });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusyAction(null);
    }
  };

  const removeDevice = async (snapshot: DeviceSnapshot) => {
    setBusyAction(`remove:${snapshot.config.id}`);
    setFeedback(null);
    try {
      await window.wiz.removeDevice(snapshot.config.id);
      if (editingId === snapshot.config.id) clearForm();
      setConfirmDeleteId(null);
      setFeedback({ kind: 'success', message: `${snapshot.config.name} was removed.` });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusyAction(null);
    }
  };

  const reorderDevice = async (devicesInRoom: DeviceSnapshot[], index: number, direction: -1 | 1) => {
    const neighborIndex = index + direction;
    if (neighborIndex < 0 || neighborIndex >= devicesInRoom.length) return;
    const groupIds = devicesInRoom.map((device) => device.config.id);
    [groupIds[index], groupIds[neighborIndex]] = [groupIds[neighborIndex], groupIds[index]];

    const orderedIds = snapshots.map((device) => device.config.id);
    const positions = snapshots.flatMap((device, position) => roomName(device) === roomName(devicesInRoom[0]) ? [position] : []);
    positions.forEach((position, groupIndex) => { orderedIds[position] = groupIds[groupIndex]; });

    setBusyAction('reorder');
    try {
      await window.wiz.reorderDevices(orderedIds);
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusyAction(null);
    }
  };

  const savePreferences = async () => {
    const refreshIntervalMs = Number(refreshIntervalInput);
    const udpTimeoutMs = Number(udpTimeoutInput);
    if (!Number.isInteger(refreshIntervalMs) || refreshIntervalMs < 2000 || refreshIntervalMs > 60000 || (refreshIntervalMs - 2000) % 500 !== 0) {
      setFeedback({ kind: 'error', message: 'Refresh interval must be 2,000–60,000 ms in 500 ms steps.' });
      return;
    }
    if (!Number.isInteger(udpTimeoutMs) || udpTimeoutMs < 500 || udpTimeoutMs > 15000 || (udpTimeoutMs - 500) % 250 !== 0) {
      setFeedback({ kind: 'error', message: 'UDP timeout must be 500–15,000 ms in 250 ms steps.' });
      return;
    }

    setPreferencesBusy(true);
    setFeedback(null);
    try {
      const saved = await window.wiz.setSettings({ ...draftSettings, refreshIntervalMs, udpTimeoutMs });
      setDraftSettings(saved);
      setRefreshIntervalInput(String(saved.refreshIntervalMs));
      setUdpTimeoutInput(String(saved.udpTimeoutMs));
      setFeedback({ kind: 'success', message: 'Preferences saved.' });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setPreferencesBusy(false);
    }
  };

  const discardPreferences = () => {
    setDraftSettings(settings);
    setRefreshIntervalInput(String(settings.refreshIntervalMs));
    setUdpTimeoutInput(String(settings.udpTimeoutMs));
    setFeedback({ kind: 'info', message: 'Unsaved preference changes were discarded.' });
  };

  const resetPreferences = async () => {
    if (!window.confirm('Reset application preferences to defaults? Saved devices will not be removed.')) return;
    setPreferencesBusy(true);
    setFeedback(null);
    try {
      const defaults = await window.wiz.resetSettings();
      setDraftSettings(defaults);
      setRefreshIntervalInput(String(defaults.refreshIntervalMs));
      setUdpTimeoutInput(String(defaults.udpTimeoutMs));
      setFeedback({ kind: 'success', message: 'Application preferences were reset. Saved devices were kept.' });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setPreferencesBusy(false);
    }
  };

  return (
    <div className="settings-shell p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">WiZ Controller</h1>
          <p className="text-sm text-slate-400">Manage bulbs and preferences. Device communication stays on your local network.</p>
        </header>

        {feedback && (
          <div
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            aria-live={feedback.kind === 'error' ? 'assertive' : 'polite'}
            className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
              feedback.kind === 'error'
                ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                : feedback.kind === 'success'
                  ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 bg-white/5 text-slate-300'
            }`}
          >
            {feedback.kind === 'error' ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <Check size={16} className="mt-0.5 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        <section aria-labelledby="devices-heading" className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="devices-heading" className="text-lg font-medium">Devices</h2>
              <p className="text-sm text-slate-400">{snapshots.length} saved · {snapshots.filter((snapshot) => snapshot.status === 'connected').length} connected</p>
            </div>
            <button
              type="button"
              onClick={() => void discoverDevices()}
              disabled={discovering}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              {discovering ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}
              {discovering ? 'Scanning network…' : 'Discover bulbs'}
            </button>
          </div>

          <form
            onSubmit={(event) => { event.preventDefault(); void saveDevice(); }}
            className="space-y-3 rounded-xl border border-white/10 bg-slate-950/25 p-4"
            aria-labelledby="device-form-heading"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id="device-form-heading" className="font-medium">{editingId ? 'Edit device' : 'Add a device'}</h3>
              {editingId && (
                <button type="button" onClick={clearForm} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
                  <X size={14} /> Cancel edit
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-400">
                <span>Device name</span>
                <input
                  value={name}
                  maxLength={64}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Living room lamp"
                  required
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>Bulb IP address</span>
                <input
                  value={ip}
                  maxLength={15}
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(event) => {
                    setIp(event.target.value);
                    setMac(undefined);
                    setTestedIp(null);
                    setTestResult(null);
                    setFormError(null);
                  }}
                  placeholder="192.168.1.50"
                  required
                  aria-invalid={Boolean(ip && !isValidIpv4(trimmedIp))}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                />
                {ip && !isValidIpv4(trimmedIp) && <span className="block text-rose-300">Enter a valid IPv4 address.</span>}
                {duplicateIp && <span className="block text-rose-300">This IP is already assigned to a saved device.</span>}
              </label>
              <label className="space-y-1 text-xs text-slate-400 sm:col-span-2">
                <span>Room (optional)</span>
                <input
                  value={room}
                  maxLength={40}
                  list="saved-rooms"
                  onChange={(event) => setRoom(event.target.value)}
                  placeholder="Kitchen"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                />
                <datalist id="saved-rooms">{roomNames.map((savedRoom) => <option key={savedRoom} value={savedRoom} />)}</datalist>
              </label>
            </div>

            {formError && <p role="alert" className="text-sm text-rose-300">{formError}</p>}
            {testResult && (
              <p role={testResult.ok ? 'status' : 'alert'} className={`text-sm ${testResult.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                {testResult.message}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void testDevice()}
                disabled={busyAction === 'test' || !trimmedIp}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
              >
                {busyAction === 'test' ? <LoaderCircle size={15} className="animate-spin" /> : <Wifi size={15} />}
                {busyAction === 'test' ? 'Testing…' : 'Test connection'}
              </button>
              <button
                type="submit"
                disabled={!canSaveDevice}
                title={!testResult?.ok ? 'Test the connection successfully before saving' : undefined}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Save size={15} /> {busyAction === 'save' ? 'Saving…' : editingId ? 'Save changes' : 'Add device'}
              </button>
            </div>
          </form>

          {discovered.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Found on your network</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {discovered.map((device) => {
                  const saved = snapshots.find((snapshot) => snapshot.config.ip === device.ip);
                  return (
                    <div key={device.ip} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{saved?.config.name ?? device.name ?? 'WiZ Bulb'}</div>
                        <div className="truncate text-xs text-slate-400">{device.ip}{device.mac ? ` · ${device.mac}` : ''}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectDiscovered(device)}
                        className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10"
                      >
                        {saved ? 'Edit saved' : 'Use device'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div role="status" className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-slate-400">
              <LoaderCircle size={18} className="mx-auto mb-2 animate-spin" />
              Loading saved devices…
            </div>
          ) : snapshots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-5 text-center">
              <WifiOff size={20} className="mx-auto mb-2 text-slate-500" />
              <p className="text-sm font-medium">No devices saved yet</p>
              <p className="mt-1 text-xs text-slate-400">Discover bulbs on your network or add one by IP address above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Saved devices</h3>
              {groups.map(([label, devices]) => (
                <section key={label} aria-labelledby={`room-${label}`} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 id={`room-${label}`} className="text-sm font-medium">{label}</h4>
                    <span className="text-xs text-slate-500">{devices.length} {devices.length === 1 ? 'device' : 'devices'}</span>
                  </div>
                  {label !== 'Unassigned' && (
                    <RoomControls
                      room={label}
                      devices={devices}
                      disabled={Boolean(busyAction)}
                      onResult={(message) => setFeedback(message ? { kind: 'info', message } : null)}
                    />
                  )}
                  <div className="space-y-2">
                    {devices.map((snapshot, index) => (
                      <SettingsDeviceCard
                        key={snapshot.config.id}
                        snapshot={snapshot}
                        busy={Boolean(busyAction)}
                        canMoveUp={index > 0}
                        canMoveDown={index < devices.length - 1}
                        confirmingRemoval={confirmDeleteId === snapshot.config.id}
                        onRefresh={() => void refreshDevice(snapshot)}
                        onEdit={() => editDevice(snapshot)}
                        onMoveUp={() => void reorderDevice(devices, index, -1)}
                        onMoveDown={() => void reorderDevice(devices, index, 1)}
                        onConfirmRemove={() => setConfirmDeleteId(confirmDeleteId === snapshot.config.id ? null : snapshot.config.id)}
                        onCancelRemove={() => setConfirmDeleteId(null)}
                        onRemove={() => void removeDevice(snapshot)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="preferences-heading" className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div>
            <h2 id="preferences-heading" className="text-lg font-medium">Application preferences</h2>
            <p className="text-sm text-slate-400">Changes are applied when you save.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm">
              <span>Start with Windows</span>
              <input type="checkbox" checked={draftSettings.startWithWindows} onChange={(event) => setDraftSettings({ ...draftSettings, startWithWindows: event.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm">
              <span>Minimize to tray when closed</span>
              <input type="checkbox" checked={draftSettings.minimizeToTray} onChange={(event) => setDraftSettings({ ...draftSettings, minimizeToTray: event.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm">
              <span>Automatic state refresh</span>
              <input type="checkbox" checked={draftSettings.autoRefresh} onChange={(event) => setDraftSettings({ ...draftSettings, autoRefresh: event.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm">
              <span>Theme</span>
              <select value={draftSettings.theme} onChange={(event) => setDraftSettings({ ...draftSettings, theme: event.target.value as AppSettings['theme'] })} className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm">
              <span>Refresh interval (2,000–60,000 ms)</span>
              <input type="number" min={2000} max={60000} step={500} value={refreshIntervalInput} onChange={(event) => setRefreshIntervalInput(event.target.value)} className="w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1 rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm">
              <span>UDP timeout (500–15,000 ms)</span>
              <input type="number" min={500} max={15000} step={250} value={udpTimeoutInput} onChange={(event) => setUdpTimeoutInput(event.target.value)} className="w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-1" />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => void resetPreferences()}
              disabled={preferencesBusy}
              className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
            >
              Reset preferences…
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={discardPreferences} disabled={!settingsDirty || preferencesBusy} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-40">Discard</button>
              <button type="button" onClick={() => void savePreferences()} disabled={!settingsDirty || preferencesBusy} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium hover:bg-indigo-400 disabled:opacity-45">
                {preferencesBusy ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
                {preferencesBusy ? 'Saving…' : 'Save preferences'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
