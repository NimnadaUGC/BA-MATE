const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('baMateDesktop', {
  chooseProjectFolder: () => ipcRenderer.invoke('ba-mate:choose-project-folder'),
});
