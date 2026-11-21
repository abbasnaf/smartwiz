{
  "name": "wiz-controller",
  "version": "0.1.0",
  "private": true,
  "description": "Lightweight Windows system tray controller for Philips WiZ smart bulbs",
  "main": "dist-electron/electron/main.js",
  "author": "WiZ Controller",
  "license": "MIT",
  "scripts": {
    "dev": "concurrently -k \"npm:dev:renderer\" \"npm:dev:electron\"",
    "dev:renderer": "vite",
    "dev:electron": "wait-on tcp:5173 && tsc -p tsconfig.electron.json && cross-env VITE_DEV_SERVER_URL=http://localhost:5173 electron .",
    "build": "tsc -p tsconfig.electron.json && vite build",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.electron.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "package": "npm run build && electron-builder --win --x64",
    "package:dir": "npm run build && electron-builder --win --dir"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "lucide-react": "^0.577.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "tailwind-merge": "^3.5.0",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.2",
    "@types/node": "^25.5.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "concurrently": "^9.2.1",
    "cross-env": "^10.1.0",
    "electron": "^41.1.0",
    "electron-builder": "^26.8.1",
    "tailwindcss": "^4.2.2",
    "typescript": "^6.0.2",
    "vite": "^8.0.3",
    "vitest": "^4.1.2",
    "wait-on": "^9.0.4"
  }
}

