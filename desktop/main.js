import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import fetch from 'cross-fetch';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import child_process from 'node:child_process';
import keytar from 'keytar';
import ngrok from '@ngrok/ngrok';

process.on('unhandledRejection', (reason) => {
  console.warn('[unhandledRejection]', reason);
});

// ---------- Konstante(n) ----------
const OWNER = "kevinkeller021204";
const REPO  = "bandit";
const GH_APP_NAME = "bandit-desktop";
const NGROK_KEY = 'ngrok_authtoken';
const APPDATA = app.getPath('userData');
const PORT = 5050; // wie vorher genutzt

// ---------- Globals ----------
let win;
let serverProc = null;
let ngrokUrl = null;

// Browsercache aus (Frontend-Dev)
app.commandLine.appendSwitch("disable-http-cache");

// Single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// ---------- App lifecycle ----------
app.whenReady().then(async () => {
  await session.defaultSession.clearCache();
  // ngrok-Warnseite global umgehen: Header injizieren. Wir zahlen gar nichts.
const NGROK_HOSTS = [/\.ngrok\.io$/i, /\.ngrok-free\.app$/i];

session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
  try {
    const u = new URL(details.url);
    const isNgrok = NGROK_HOSTS.some(rx => rx.test(u.hostname));
    if (isNgrok) {
      // 1) Offizieller Weg laut Hinweis
      details.requestHeaders['ngrok-skip-browser-warning'] = 'true';
      // 2) Alternativ/zusätzlich ein eigener User-Agent (auch erlaubt)
      // details.requestHeaders['User-Agent'] = 'BanditDesktop/1.0';
    }
  } catch {}
  callback({ requestHeaders: details.requestHeaders });
});
  createWindow();
}).catch(err => console.error('app.whenReady failed:', err));

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => { stopServer(); app.quit(); });

// ---------- Window ----------
function createWindow() {
  const preloadPath = join(__dirname, 'preload.cjs');
  console.log('Using preload at:', preloadPath);

  win = new BrowserWindow({
    width: 1000,
    height: 760,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.on('enter-full-screen', () => win.webContents.send('fullscreen-changed', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen-changed', false));

  win.loadFile(join(__dirname, 'renderer.html'));
  win.on('closed', () => { win = null; });
}

// ---------- UI Helpers ----------
const emit   = (ch, msg) => win?.webContents.send(ch, msg);
const status = (msg) => emit('status', msg);
const err    = (e)  => emit('error', String(e));

// ---------- Credentials ----------
ipcMain.on('check-credentials', async (ev) => {
  const hasNgrok  = !!(await keytar.getPassword(GH_APP_NAME, NGROK_KEY));
  ev.sender.send('credentials-status', { ngrok: hasNgrok });
});

ipcMain.on('delete-credentials', async (_ev, which) => {
  try {
    if (which === 'ngrok') {
      await keytar.deletePassword(GH_APP_NAME, NGROK_KEY);
      status('ngrok-Token gelöscht.');
      emit('credentials-changed', { ngrok: false });
    } else {
      throw new Error('Unbekannter Credential-Typ: ' + which);
    }
  } catch (e) { err(e); }
});

ipcMain.on('open-external', (_ev, url) => {
  try { shell.openExternal(url); } catch (e) { err(e); }
});

ipcMain.on('toggle-fullscreen', (_ev, on) => {
  if (!win) return;
  win.setFullScreen(!!on);
  win.webContents.send('fullscreen-changed', !!on);
});

// ---------- GitHub Release (public) ----------
async function latestReleasePublic() {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!r.ok) throw new Error("GitHub API: " + r.status);
  return r.json();
}

async function dlPublic(asset, outDir = APPDATA) {
  const out = path.join(outDir, asset.name);
  const r = await fetch(asset.browser_download_url, { redirect: "follow" });
  if (!r.ok) {
    const txt = await r.text().catch(()=> "");
    throw new Error("Download: " + r.status + " " + txt);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.promises.writeFile(out, buf);
  return out;
}

async function stopNgrokSDK() {
  try {
    await ngrok.disconnect(); // kann ERR_NGROK_333 werfen
  } catch (e) {
    const msg = String(e?.message || e);
    if (!msg.includes('ERR_NGROK_333')) {
      console.warn('[ngrok] disconnect warn:', e);
    }
  }
  try {
    await ngrok.kill(); // Agent beenden (wichtig gegen Session-Limit)
  } catch (e) {
    console.warn('[ngrok] kill warn:', e);
  }
}

function sha256(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function verify(zipPath, sumsPath) {
  const sums = fs.readFileSync(sumsPath, 'utf8').split(/\r?\n/);
  const digest = sha256(zipPath);
  if (!sums.find(line => line.startsWith(digest))) throw new Error("Checksum mismatch");
}
function unzip(zipPath, destDir) {
  const AdmZip = require('adm-zip'); const zip = new AdmZip(zipPath);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  zip.extractAllTo(destDir, true);
}
function namesForPlatform(platform){
  if (platform === 'darwin')  return { zipName: 'bandit-local-macos.zip',   sumsName: 'SHA256SUMS-macos.txt' };
  if (platform === 'win32')   return { zipName: 'bandit-local-windows.zip', sumsName: 'SHA256SUMS-windows.txt' };
  return { zipName: 'bandit-local-linux.zip',  sumsName: 'SHA256SUMS-linux.txt' };
}
function binPath(dir) {
  return process.platform === "win32"
    ? path.join(dir, "bandit-server.exe")
    : path.join(dir, "bandit-server");
}

async function ensureBundle() {
  status("Prüfe neuestes Release …");
  const rel = await latestReleasePublic();
  const tag = rel.tag_name;
  const dir = path.join(APPDATA, "bundles", tag);

  if (!fs.existsSync(dir) || !fs.existsSync(binPath(dir))) {
    const { zipName, sumsName } = namesForPlatform(process.platform);
    const zipAsset = rel.assets.find(a => a.name === zipName);
    const sumAsset = rel.assets.find(a => a.name === sumsName);
    if (!zipAsset || !sumAsset) {
      console.log("Available assets:", rel.assets.map(a => a.name));
      throw new Error(`Release-Assets fehlen: ${zipName} / ${sumsName}`);
    }

    status("Lade Release …");
    const zipPath = await dlPublic(zipAsset);
    const sumPath = await dlPublic(sumAsset);

    status("Verifiziere …");  verify(zipPath, sumPath);
    status("Entpacke …");     unzip(zipPath, dir);

    try {
      if (process.platform !== 'win32') {
        const bin = path.join(dir, 'bandit-server');
        await fs.promises.chmod(bin, 0o755);
        if (process.platform === 'darwin') {
          try { child_process.execSync(`xattr -dr com.apple.quarantine "${bin}"`); } catch {}
        }
      }
    } catch {}
  }
  return dir;
}

// ---------- Server ----------
function stopServer() {
  try { if (serverProc && !serverProc.killed) serverProc.kill('SIGTERM'); } catch {}
  serverProc = null;
  // ngrok aufräumen (SDK)
  try { ngrok.disconnect(); } catch {}
  try { ngrok.kill(); } catch {}
  ngrokUrl = null;
}

function startServer(dir) {
  const bin = binPath(dir);
  if (!fs.existsSync(bin)) throw new Error("Server-Binary fehlt");

  stopServer(); // Safety
  status("Starte lokalen Server …");

  serverProc = child_process.spawn(bin, [], {
    cwd: dir,
    env: { ...process.env, PORT: String(PORT) }
  });

  serverProc.stdout.on('data', d => console.log(String(d).trim()));
  serverProc.stderr.on('data', d => console.error(String(d).trim()));
  serverProc.on('exit',  c => console.log("Server exit", c));
}

// WICHTIG: prüft wieder "/" (so lief es bei dir)
async function waitReady(url = `http://127.0.0.1:${PORT}/`, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url, { redirect: 'manual' });
      if (r.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error("Server start timeout");
}

// ---------- ngrok SDK ----------
async function getNgrokToken() {
  let tok = await keytar.getPassword(GH_APP_NAME, NGROK_KEY);
  if (tok) return tok;

  status("Bitte ngrok Authtoken eingeben …");
  emit('need-ngrok-token');
  try { shell.openExternal('https://dashboard.ngrok.com/get-started/your-authtoken'); } catch {}

  tok = await new Promise((resolve, reject) => {
    ipcMain.once('set-ngrok-token', async (_ev, val) => {
      if (!val || !val.trim()) return reject(new Error("Kein Token eingegeben"));
      await keytar.setPassword(GH_APP_NAME, NGROK_KEY, val.trim());
      emit('credentials-changed', { ngrok: true });
      resolve(val.trim());
    });
    setTimeout(() => reject(new Error("Token-Eingabe abgebrochen")), 120000);
  });
  return tok;
}

function toUrlString(conn) {
  if (typeof conn === 'string') return conn;
  if (conn && typeof conn.url === 'function') return conn.url();
  if (conn && typeof conn.url === 'string')   return conn.url;
  return String(conn);
}

// ---------- IPC ----------
ipcMain.on('host-offline', async () => {
  await stopNgrokSDK(); 
  try {
    const dir = await ensureBundle();
    startServer(dir);
    await waitReady(`http://127.0.0.1:${PORT}/`);
    const localUrl = `http://127.0.0.1:${PORT}/`;
    status(`Offline bereit: ${localUrl}`);
    emit('open-url', localUrl);
    emit('ui:state', 'offline');
  } catch (e) { err(e); }
});

ipcMain.on('host-online', async () => {
  await stopNgrokSDK(); 
  try {
    const dir = await ensureBundle();
    startServer(dir);
    await waitReady(`http://127.0.0.1:${PORT}/`);

    const tok = await getNgrokToken();
    status('Starte ngrok …');

    const conn = await ngrok.connect({
      addr: PORT,
      proto: 'http',
      authtoken: tok,
      // region: 'eu',
    });

    ngrokUrl = toUrlString(conn);
    emit('public-url', ngrokUrl);
    emit('open-url',   ngrokUrl);
    status('Online bereit.');
    emit('ui:state', 'online');
  } catch (e) {
    console.error('[ngrok]', e);
    err(e);
  }
});
