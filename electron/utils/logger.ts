import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let logFilePath: string | null = null;

function getLogFile(): string | null {
  if (logFilePath) return logFilePath;
  try {
    if (!app.isReady()) return null;
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    logFilePath = path.join(dir, 'wiz-controller.log');
    return logFilePath;
  } catch {
    return null;
  }
}

function write(level: string, message: string) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  const file = getLogFile();
  if (file) {
    try { fs.appendFileSync(file, line + '\n', 'utf8'); } catch { /* ignore */ }
  }
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

export function logInfo(message: string) { write('INFO', message); }
export function logWarn(message: string) { write('WARN', message); }
export function logError(message: string, err?: unknown) {
  const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : err ? String(err) : '';
  write('ERROR', detail ? `${message}: ${detail}` : message);
}
