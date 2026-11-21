# WiZ Controller

A lightweight Windows system tray application for controlling Philips WiZ smart bulbs over the local network.

## Features

- **System tray quick controls** - left-click the tray icon to open a compact Windows 11-inspired popup.
- **Direct LAN control** - communicates with WiZ bulbs over UDP port 38899; no cloud, no Home Assistant, no external server.
- **Device discovery** - scans the local network for WiZ bulbs and allows manual IP configuration.
- **Controls** - power, brightness, RGB color, preset colors, and color temperature (Kelvin).
- **Settings** - device management, startup with Windows, theme, refresh interval, UDP timeout, reset.
- **Persistence** - settings and last configured bulb are stored in Electron's user data directory.
- **Single instance** - launching a second instance focuses the existing tray app.

## Tech Stack

- Electron + React + TypeScript + Vite
- Tailwind CSS v4
- Zustand
- Node.js `dgram` UDP sockets
- electron-builder (NSIS Windows installer)
- Vitest

## Project Structure

- `electron/` - Electron main process, preload bridge, device services, and IPC handlers.
- `shared/` - Types and IPC channel definitions shared by Electron and the renderer.
- `src/` - React renderer, pages, controls, state, and styles.
- `resources/icons/` - Windows app and tray icons.
- `tests/` - Protocol, client, and configuration tests.
- `.github/workflows/ci.yml` - CI checks for tests, type checking, build, and dependency audit.

## Development

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite renderer and launches Electron after the dev server is ready.

## Build

```bash
npm run build
```

Outputs:
- `dist-electron/` - compiled Electron main/preload
- `dist-renderer/` - built React UI

## Package Windows Installer

```bash
npm run package
```

Creates an NSIS installer in `release/`.

## Tests

```bash
npm test
```

Tests cover WiZ protocol command generation/parsing, config persistence, and UDP client response/timeout behavior.

## WiZ LAN Protocol Notes

- Uses WiZ local UDP JSON protocol on port **38899**.
- State read: `{"method":"getPilot","params":{}}`
- State write: `{"method":"setPilot","params":{...}}`
- Discovery probes broadcast `registration` and `getPilot` messages and collects responses.
- Some bulbs/firmware may not return full state after `setPilot`; the app performs a follow-up `getPilot` to confirm state when possible.
- Color temperature support depends on the specific WiZ bulb model. Unsupported commands may return errors or be ignored by the device.
- The app reports command/send/confirmation status honestly and does not fake device success.

## Configuration & Logs

Stored in Electron `app.getPath('userData')`:

- `config.json` - devices and app settings
- `logs/wiz-controller.log` - local application logs

## Manual Verification Checklist

Before considering device control complete, test against a real WiZ bulb:

1. Discover bulb on LAN.
2. Add bulb manually by IP.
3. Toggle power ON/OFF.
4. Adjust brightness.
5. Change RGB color and presets.
6. Change color temperature (if supported).
7. Confirm state refresh reflects changes made in WiZ mobile app.
8. Verify tray popup open/close, outside click, Escape, and context menu.
9. Verify settings persist after restart.
10. Verify packaged installer runs without Node.js installed.

## Limitations

- Initial release prioritizes one bulb; architecture supports multiple devices.
- Discovery depends on local network broadcast/multicast behavior; manual IP is provided as fallback.
- Real device integration should be validated on the target network/bulb model.
