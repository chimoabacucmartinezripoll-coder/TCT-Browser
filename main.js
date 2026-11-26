const { app, BrowserWindow } = require('electron')
const path = require('node:path')

app.setName('TCT Browser')

let ventana = null

function atajo (input) {
  if (input.type !== 'keyDown') return null
  const ctrl = input.control || input.meta
  const k = input.key.toLowerCase()

  if (ctrl && input.shift && k === 'n') return 'incognito'
  if (ctrl && input.shift && k === 'o') return 'marcadores'
  if (ctrl && input.shift && k === 'tab') return 'anterior'
  if (ctrl && !input.shift && k === 'tab') return 'siguiente'
  if (ctrl && k === 't') return 'nueva'
  if (ctrl && k === 'w') return 'cerrar'
  if (ctrl && k === 'l') return 'barra'
  if (ctrl && k === 'd') return 'marcador'
  if (ctrl && k === 'h') return 'historial'
  if ((ctrl && k === 'r') || k === 'f5') return 'recargar'
  if (input.alt && k === 'arrowleft') return 'atras'
  if (input.alt && k === 'arrowright') return 'adelante'
  return null
}

// Capturamos los atajos tanto en la ventana como dentro de las páginas web
app.on('web-contents-created', (_e, contents) => {
  const tipo = contents.getType()
  if (tipo !== 'window' && tipo !== 'webview') return

  contents.on('before-input-event', (event, input) => {
    const a = atajo(input)
    if (a && ventana && !ventana.isDestroyed()) {
      event.preventDefault()
      ventana.webContents.send('atajo', a)
    }
  })

  if (tipo === 'webview') {
    // Enlaces que quieren abrir una ventana nueva: los abrimos como pestaña
    contents.setWindowOpenHandler(({ url }) => {
      if (ventana && !ventana.isDestroyed()) ventana.webContents.send('abrir', url)
      return { action: 'deny' }
    })
  }
})

function createWindow () {
  ventana = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'TCT Browser',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true
    }
  })

  // Seguridad: las páginas web no reciben nuestro preload ni acceso a Node
  ventana.webContents.on('will-attach-webview', (_e, webPreferences) => {
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
  })

  ventana.on('page-title-updated', e => e.preventDefault())
  ventana.on('closed', () => { ventana = null })
  ventana.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
