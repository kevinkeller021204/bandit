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
import open from 'open';
import ngrok from '@ngrok/ngrok';

const OWNER = "kevinkeller021204";
const REPO  = "bandit";
const OAUTH_CLIENT_ID = "Ov23li4XxUY7RPSh20Ky"; // GitHub OAuth App
const GH_APP_NAME = "bandit-desktop";
const GH_SCOPES = "repo"; // read private releases
const APPDATA = app.getPath('userData');

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


// Prüfen, ob Tokens existieren
ipcMain.on('check-credentials', async (ev) => {
  const hasNgrok  = !!(await keytar.getPassword(GH_APP_NAME, NGROK_KEY));
  const hasGithub = !!(await keytar.getPassword(GH_APP_NAME, 'github_token'));
  ev.sender.send('credentials-status', { ngrok: hasNgrok, github: hasGithub });
});

// Tokens löschen (und UI updaten)
ipcMain.on('delete-credentials', async (_ev, which) => {
  try {
    if (which === 'ngrok') {
      await keytar.deletePassword(GH_APP_NAME, NGROK_KEY);
      status('ngrok-Token gelöscht.');
      emit('credentials-changed', { ngrok: false });
    } else if (which === 'github') {
      await keytar.deletePassword(GH_APP_NAME, 'github_token');
      status('GitHub-Token gelöscht.');
      emit('credentials-changed', { github: false });
    } else {
      throw new Error('Unbekannter Credential-Typ: ' + which);
    }
  } catch (e) { err(e); }
});


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

  win.loadFile(join(__dirname, 'renderer.html'));
  win.on('closed', () => { win = null; });
}





app.on('window-all-closed', () => { stopServer(); app.quit(); });

const emit = (ch, msg) => win?.webContents.send(ch, msg);
const status = (msg) => emit('status', msg);
const err = (e) => emit('error', String(e));

async function getToken() {
  let tok = await keytar.getPassword(GH_APP_NAME, 'github_token');
  if (tok) return tok;

  const dev = await (await fetch("https://github.com/login/device/code", {
    method: "POST", headers: { "Content-Type":"application/json", "Accept":"application/json" },
    body: JSON.stringify({ client_id: OAUTH_CLIENT_ID, scope: GH_SCOPES })
  })).json();

  dialog.showMessageBoxSync({ type: "info", message: `GitHub Code: ${dev.user_code}`, detail: "Wir öffnen GitHub im Browser.", buttons: ["OK"] });
  await open("https://github.com/login/device");
  await open(dev.verification_uri);

  while (true) {
    await new Promise(r=> setTimeout(r, dev.interval*1000));
    const r = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST", headers: { "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify({ client_id: OAUTH_CLIENT_ID, device_code: dev.device_code, grant_type: "urn:ietf:params:oauth:grant-type:device_code" })
    });
    const js = await r.json();
    if (js.access_token) { tok = js.access_token; break; }
    if (js.error && js.error !== "authorization_pending") throw new Error("OAuth: " + js.error);
  }
  await keytar.setPassword(GH_APP_NAME, 'github_token', tok);
  emit('credentials-changed', { github: true });
  return tok;
}

async function getNgrokToken() {
  // erst aus Keychain
  let tok = await keytar.getPassword(GH_APP_NAME, NGROK_KEY);
  if (tok) return tok;

  // Renderer soll UI zeigen und uns den Token schicken
  status("Bitte ngrok Authtoken eingeben …");
  emit('need-ngrok-token'); // Renderer zeigt Eingabefeld

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

async function latestRelease(token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
  });

  if (r.status === 401) {
    console.warn("GitHub token ungültig oder revoked – starte neuen Device Flow …");
    await keytar.deletePassword(GH_APP_NAME, 'github_token'); // alten Token löschen
    const newTok = await getToken(); // automatisch neu authentifizieren
    // nochmal probieren
    return latestRelease(newTok);
  }

  if (!r.ok) {
    throw new Error("GitHub API: " + r.status);
  }

  return await r.json();
}


async function dl(token, asset, outDir = APPDATA) {
  const out = path.join(outDir, asset.name);
  const r = await fetch(asset.url, {   // 👈 statt asset.browser_download_url → asset.url
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/octet-stream"  // 👈 zwingend für private Assets
    },
    redirect: "follow"
  });

  if (!r.ok) {
    const txt = await r.text().catch(()=> "");
    throw new Error("Download: " + r.status + " " + txt);
  }

  const buf = Buffer.from(await r.arrayBuffer());
  await fs.promises.writeFile(out, buf);
  return out;
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
  const token = await getToken();
  status("Prüfe neuestes Release …");
  const rel = await latestRelease(token);
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
    if (!zipAsset || !sumAsset) throw new Error("Release Assets fehlen");
    status("Lade Release …");
    const zipPath = await dl(token, zipAsset);
    const sumPath = await dl(token, sumAsset);
    status("Verifiziere …");
    verify(zipPath, sumPath);
    status("Entpacke …");
    unzip(zipPath, dir);
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

