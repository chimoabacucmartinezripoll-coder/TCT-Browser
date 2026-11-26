const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tct', {
  onAtajo: cb => ipcRenderer.on('atajo', (_e, accion) => cb(accion)),
  onAbrir: cb => ipcRenderer.on('abrir', (_e, url) => cb(url))
})
