import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const NGROK_KEY = 'ngrok_authtoken';
import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import fetch from 'cross-fetch';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import child_process from 'node:child_process';
import keytar from 'keytar';
import ngrok from '@ngrok/ngrok';
import { shell, /* ... */ } from 'electron';
const OWNER = "kevinkeller021204";
const REPO  = "bandit";
const GH_APP_NAME = "bandit-desktop";
const APPDATA = app.getPath('userData');
let mainWindow;
let win, serverProc, ngrokUrl;
//stop caching, generic webdevelopment frontend problem
app.commandLine.appendSwitch("disable-http-cache");

//single instance lock
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


app.whenReady().then(async () => {
  await session.defaultSession.clearCache();
  createWindow();
}).catch(err => console.error('app.whenReady failed:', err));


app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});


// Prüfen, ob Tokens existieren, nun für public repo
ipcMain.on('check-credentials', async (ev) => {
  const hasNgrok  = !!(await keytar.getPassword(GH_APP_NAME, NGROK_KEY));
  ev.sender.send('credentials-status', { ngrok: hasNgrok });
});

ipcMain.on('open-external', (_ev, url) => {
  try { shell.openExternal(url); } catch (e) { err(e); }
});

// Tokens löschen (und UI updaten)
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

// IPC: Vollbild umschalten und Status zurück an Renderer
ipcMain.on('toggle-fullscreen', (_ev, on) => {
  if (!win) return;
  win.setFullScreen(!!on);
  win.webContents.send('fullscreen-changed', !!on);
});


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



function createWindow() {
  const preloadPath = join(__dirname, 'preload.cjs');   // <— HIER definieren
  console.log('Using preload at:', preloadPath);

  win = new BrowserWindow({
    width: 1000,
    height: 760,
    webPreferences: {
      preload: preloadPath,          // <— und HIER verwenden
      contextIsolation: true,
      nodeIntegration: false
    }
  });


  win.on('enter-full-screen', () => win.webContents.send('fullscreen-changed', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen-changed', false));


  win.loadFile(join(__dirname, 'renderer.html'));
  win.on('closed', () => { win = null; });
}





app.on('window-all-closed', () => { stopServer(); app.quit(); });

const emit = (ch, msg) => win?.webContents.send(ch, msg);
const status = (msg) => emit('status', msg);
const err = (e) => emit('error', String(e));



async function getNgrokToken() {
  // erst aus Keychain
  let tok = await keytar.getPassword(GH_APP_NAME, NGROK_KEY);
  if (tok) return tok;

  // Renderer soll UI zeigen und uns den Token schicken
  status("Bitte ngrok Authtoken eingeben …");
  emit('need-ngrok-token'); // Renderer zeigt Eingabefeld

    try {
    await shell.openExternal('https://dashboard.ngrok.com/get-started/your-authtoken');
  } catch (_) { /* ignorieren, falls Browser nicht geöffnet werden kann */ }
  tok = await new Promise((resolve, reject) => {
    // einmalig auf Antwort warten
    ipcMain.once('set-ngrok-token', async (_ev, val) => {
      if (!val || !val.trim()) return reject(new Error("Kein Token eingegeben"));
      await keytar.setPassword(GH_APP_NAME, NGROK_KEY, val.trim());
      emit('credentials-changed', { ngrok: true });
      resolve(val.trim());
    });
    // optional Timeout:
    setTimeout(() => reject(new Error("Token-Eingabe abgebrochen")), 120000);
  });

  return tok;
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

function binPath(dir) { return process.platform === "win32" ? path.join(dir, "bandit-server.exe") : path.join(dir, "bandit-server"); }

async function ensureBundle() {
  status("Prüfe neuestes Release …");
  const rel = await latestReleasePublic();           // <-- ohne Token
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
    const zipPath = await dlPublic(zipAsset);        // <-- ohne Token
    const sumPath = await dlPublic(sumAsset);        // <-- ohne Token

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


function namesForPlatform(platform){
  if (platform === 'darwin')  return { zipName: 'bandit-local-macos.zip',   sumsName: 'SHA256SUMS-macos.txt' };
  if (platform === 'win32')   return { zipName: 'bandit-local-windows.zip', sumsName: 'SHA256SUMS-windows.txt' };
  return { zipName: 'bandit-local-linux.zip',  sumsName: 'SHA256SUMS-linux.txt' };
}


function stopServer() {
  if (serverProc && !serverProc.killed) serverProc.kill();
  serverProc = null;
  if (ngrokUrl) { ngrok.disconnect(); ngrok.kill(); ngrokUrl = null; }
}

function startServer(dir) {
  const bin = binPath(dir);
  if (!fs.existsSync(bin)) throw new Error("Server-Binary fehlt");
  stopServer();
  status("Starte lokalen Server …");
  serverProc = child_process.spawn(bin, [], { cwd: dir, env: { ...process.env, PORT: "5050" } });
  serverProc.stdout.on('data', d=> console.log(String(d)));
  serverProc.stderr.on('data', d=> console.error(String(d)));
  serverProc.on('exit', c=> console.log("Server exit", c));
}

async function waitReady(url) {
  for (let i=0;i<60;i++) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise(r=> setTimeout(r, 250));
  }
  throw new Error("Server start timeout");
}

ipcMain.on('host-offline', async ()=>{
  try {
    const dir = await ensureBundle();
    startServer(dir);
    await waitReady("http://127.0.0.1:5050");
    status("Offline bereit: http://127.0.0.1:5050");
    emit('open-url', "http://127.0.0.1:5050");
  } catch (e) { err(e); }
});

// Externen Link aus dem Renderer öffnen (für "ngrok öffnen" Button)
ipcMain.on('open-external', async (_ev, url) => {
  try { await open(url); } catch (e) { err(e); }
});


function toUrlString(conn) {
  // v1 SDK: Listener-Objekt hat meist .url() oder .url
  if (typeof conn === 'string') return conn;
  if (conn && typeof conn.url === 'function') return conn.url();
  if (conn && typeof conn.url === 'string') return conn.url;
  return String(conn); // Fallback (vermeiden, aber crasht nicht)
}

ipcMain.on('host-online', async () => {
  try {
    const dir = await ensureBundle();
    startServer(dir);
    await waitReady('http://127.0.0.1:5050');

    const tok = await getNgrokToken();
    status('Starte ngrok …');

    // je nach SDK: connect / forward
    const conn = await ngrok.connect({
      addr: 5050,
      proto: 'http',
      authtoken: tok,
      // region: 'eu'
    });

    const publicUrl = toUrlString(conn);
    emit('public-url', publicUrl);     // z.B. Box mit Link
    emit('open-url', publicUrl);       // iFrame lädt diese URL
    status('Online bereit.');
  } catch (e) {
    console.error('[ngrok]', e);
    err(e);
  }
});

