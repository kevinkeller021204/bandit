import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fetch from 'cross-fetch';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import child_process from 'node:child_process';
import keytar from 'keytar';
import open from 'open';
import ngrok from 'ngrok';

const OWNER = "kevinkeller021204";
const REPO  = "bandit";
const OAUTH_CLIENT_ID = "Ov23li4XxUY7RPSh20Ky"; // GitHub OAuth App
const GH_APP_NAME = "bandit-desktop";
const GH_SCOPES = "repo"; // read private releases
const APPDATA = app.getPath('userData');

let win, serverProc, ngrokUrl;


function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 760,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  const htmlPath = join(__dirname, 'renderer.html');  // ✅ jetzt korrekt
  win.loadFile(htmlPath).catch(err => {
    console.error('loadFile failed:', err);
  });

  // optional: DevTools zum Debuggen beim ersten Start
  // win.webContents.openDevTools({ mode: 'detach' });

  win.on('closed', () => { win = null; });
}
app.whenReady()
  .then(createWindow)
  .catch(err => console.error('app.whenReady failed:', err));

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
  return tok;
}

async function latestRelease(token) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
  });
  if (!r.ok) throw new Error("GitHub API: " + r.status);
  return await r.json();
}

async function dl(token, asset, outDir=APPDATA) {
  const out = path.join(outDir, asset.name);
  const r = await fetch(asset.browser_download_url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/octet-stream" }});
  if (!r.ok) throw new Error("Download: " + r.status);
  await fs.promises.writeFile(out, Buffer.from(await r.arrayBuffer()));
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
    const zipAsset = rel.assets.find(a => a.name === "bandit-local.zip");
    const sumAsset = rel.assets.find(a => a.name === "SHA256SUMS");
    if (!zipAsset || !sumAsset) throw new Error("Release Assets fehlen");
    status("Lade Release …");
    const zipPath = await dl(token, zipAsset);
    const sumPath = await dl(token, sumAsset);
    status("Verifiziere …");
    verify(zipPath, sumPath);
    status("Entpacke …");
    unzip(zipPath, dir);
  }
  return dir;
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

ipcMain.on('host-online', async ()=>{
  try {
    const dir = await ensureBundle();
    startServer(dir);
    await waitReady("http://127.0.0.1:5050");
    status("Starte ngrok …");
    if (process.env.NGROK_AUTHTOKEN) await ngrok.authtoken(process.env.NGROK_AUTHTOKEN);
    ngrokUrl = await ngrok.connect({ addr: 5050, proto: 'http' });
    emit('public-url', ngrokUrl);
    status("Online bereit.");
    emit('open-url', "http://127.0.0.1:5050");
  } catch (e) { err(e); }
});
