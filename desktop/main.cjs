const { app, BrowserWindow, dialog, session } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
let service, window, quitting = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { window.show(); window.focus(); } });
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('BA Mate could not start', error.message); app.quit(); });
}
async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer(); server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}
async function start() {
  const root = path.resolve(__dirname, '..');
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const executable = app.isPackaged ? path.join(process.resourcesPath, 'service', process.platform === 'win32' ? 'ba-mate-service.exe' : 'ba-mate-service') : path.join(root, 'backend', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const args = app.isPackaged ? [] : [path.join(root, 'backend', 'desktop_entry.py')];
  service = spawn(executable, args, { env: { ...process.env, BA_MATE_PORT: String(port), BA_MATE_DATA_DIR: process.env.BA_MATE_DATA_DIR || path.join(os.homedir(), '.ba-mate'), BA_MATE_FRONTEND_DIR: app.isPackaged ? path.join(process.resourcesPath, 'frontend') : path.join(root, 'frontend', 'dist') }, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let failure, log = '';
  service.on('error', error => { failure = error.message; });
  service.stderr.on('data', data => { log = (log + data.toString()).slice(-3000); });
  service.on('exit', code => { failure = `The local service stopped (${code}). ${log}`; if (window && !quitting) dialog.showErrorBox('Local service stopped', 'Your previously saved workspace remains on this device. Reopen BA Mate to reconnect.'); });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (failure) throw new Error(failure);
    try { const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) }); if (response.ok && (await response.json()).version === '0.4.0') { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('The local service did not become ready. Check that the application package contains its service and frontend.');
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const { ipcMain } = require('electron');
  ipcMain.handle('ba-mate:choose-project-folder', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Choose a BA Mate project folder',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Use this folder',
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const selectedPath = path.resolve(result.filePaths[0]);
    return { name: path.basename(selectedPath), path: selectedPath };
  });
  window = new BrowserWindow({ width: 1380, height: 900, minWidth: 900, minHeight: 650, show: false, title: 'BA Mate', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  window.webContents.on('will-prevent-unload', event => {
    const leave = dialog.showMessageBoxSync(window, { type: 'warning', buttons: ['Keep working', 'Close without latest changes'], defaultId: 0, cancelId: 0, message: 'Your latest changes have not finished saving.', detail: 'Wait for “Saved on this device”, or export a project backup if saving has failed.' });
    if (leave === 1) event.preventDefault();
  });
  await window.loadURL(origin);
  window.show();
}
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { quitting = true; service?.kill(); });
