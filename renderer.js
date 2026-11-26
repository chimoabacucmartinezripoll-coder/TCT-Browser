const $ = id => document.getElementById(id)
const tabsEl = $('tabs')
const contenido = $('contenido')
const urlInput = $('url')
const inicioEl = $('inicio')
const panel = $('panel')

let pestanas = []
let activa = null
let contador = 0
let panelTipo = null

// ---------- Datos guardados (historial, marcadores, tema) ----------
const datos = {
  leer (k, def) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? def : v } catch (e) { return def } },
  guardar (k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
}
let historial = datos.leer('tct-historial', [])
let marcadores = datos.leer('tct-marcadores', [])
const guardarHistorial = () => datos.guardar('tct-historial', historial)
const guardarMarcadores = () => datos.guardar('tct-marcadores', marcadores)

function el (tag, clase, texto) {
  const e = document.createElement(tag)
  if (clase) e.className = clase
  if (texto !== undefined) e.textContent = texto
  return e
}
function seguro (fn) { try { fn() } catch (e) { /* la página aún no está lista */ } }
const vistaActiva = () => (activa && activa.vista && !activa.enInicio ? activa.vista : null)

// ---------- Modo oscuro ----------
function aplicarTema (t) {
  document.body.dataset.tema = t
  $('bTema').textContent = t === 'oscuro' ? '☀️' : '🌙'
  datos.guardar('tct-tema', t)
}
aplicarTema(datos.leer('tct-tema', matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'))
$('bTema').onclick = () => aplicarTema(document.body.dataset.tema === 'oscuro' ? 'claro' : 'oscuro')

// ---------- Pestañas ----------
function nuevaPestana (url = null, incognito = false) {
  const p = { id: ++contador, incognito, vista: null, url: '', titulo: 'Nueva pestaña',
              enInicio: !url, listo: false, ultima: null }

  const tab = el('div', 'tab' + (incognito ? ' inco' : ''))
  p.tituloEl = el('span', 'titulo', incognito ? '🕶 Incógnito' : 'Nueva pestaña')
  const cerrar = el('span', 'cerrar', '✕')
  tab.append(p.tituloEl, cerrar)
  tabsEl.insertBefore(tab, $('nuevaTab'))
  p.tab = tab
  pestanas.push(p)

  tab.onclick = () => activar(p)
  cerrar.onclick = e => { e.stopPropagation(); cerrarPestana(p) }

  if (url) { activa = p; navegar(p, url) }
  activar(p)
  return p
}

function crearVista (p) {
  const v = document.createElement('webview')
  // Incógnito: sesión propia solo en memoria, se descarta al cerrar la pestaña
  v.setAttribute('partition', p.incognito ? 'incognito-' + p.id + '-' + Date.now() : 'persist:tct')
  v.setAttribute('allowpopups', '')
  contenido.appendChild(v)
  p.vista = v

  v.addEventListener('dom-ready', () => { p.listo = true })
  v.addEventListener('page-title-updated', e => {
    p.titulo = e.title
    p.tituloEl.textContent = (p.incognito ? '🕶 ' : '') + e.title
    if (p.ultima && p.ultima.url === p.url) { p.ultima.titulo = e.title; guardarHistorial() }
    if (activa === p) actualizarEstrella()
  })

  const nav = e => {
    if (e.isMainFrame === false) return
    p.url = e.url
    if (activa === p) { urlInput.value = e.url; actualizarEstrella() }
  }
  v.addEventListener('did-navigate', e => { nav(e); registrarHistorial(p) })
  v.addEventListener('did-navigate-in-page', nav)
}

function navegar (p, url) {
  if (!p.vista) crearVista(p)
  p.enInicio = false
  p.url = url
  p.vista.src = url
  mostrar()
}

function registrarHistorial (p) {
  if (p.incognito || !p.url || p.url.startsWith('about:')) return
  const entrada = { url: p.url, titulo: p.url, fecha: Date.now() }
  historial.unshift(entrada)
  if (historial.length > 500) historial.length = 500
  p.ultima = entrada
  guardarHistorial()
  if (panelTipo === 'historial') pintarPanel()
}

function activar (p) { activa = p; mostrar() }

function mostrar () {
  pestanas.forEach(x => {
    x.tab.classList.toggle('activa', x === activa)
    if (x.vista) x.vista.classList.toggle('oculta', x !== activa || x.enInicio)
  })
  const enInicio = !!(activa && activa.enInicio)
  inicioEl.hidden = !enInicio
  if (enInicio) pintarInicio()
  document.body.classList.toggle('inco', !!(activa && activa.incognito))
  urlInput.value = activa && !activa.enInicio ? activa.url : ''
  actualizarEstrella()
}

function cerrarPestana (p) {
  const i = pestanas.indexOf(p)
  if (i < 0) return
  if (p.vista) p.vista.remove()
  p.tab.remove()
  pestanas.splice(i, 1)
  if (pestanas.length === 0) nuevaPestana()
  else if (activa === p) activar(pestanas[Math.min(i, pestanas.length - 1)])
}

function cambiar (paso) {
  const i = pestanas.indexOf(activa)
  activar(pestanas[(i + paso + pestanas.length) % pestanas.length])
}

// ---------- Navegación ----------
function irA (texto) {
  let v = texto.trim()
  if (!v) return
  if (/^https?:\/\//i.test(v)) {
    // ya es una dirección completa
  } else if (v.includes('.') && !v.includes(' ')) {
    v = 'https://' + v
  } else {
    v = 'https://www.google.com/search?q=' + encodeURIComponent(v)
  }
  navegar(activa, v)
}

urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') irA(urlInput.value) })

function atras () { const v = vistaActiva(); if (v) seguro(() => { if (v.canGoBack()) v.goBack() }) }
function adelante () { const v = vistaActiva(); if (v) seguro(() => { if (v.canGoForward()) v.goForward() }) }
function recargar () { const v = vistaActiva(); if (v) seguro(() => v.reload()) }

$('atras').onclick = atras
$('adelante').onclick = adelante
$('recargar').onclick = recargar
$('inicioBtn').onclick = () => { activa.enInicio = true; mostrar() }
$('nuevaTab').onclick = () => nuevaPestana()
$('nuevaInco').onclick = () => nuevaPestana(null, true)

// ---------- Página de inicio ----------
function pintarInicio () {
  inicioEl.textContent = ''
  const caja = el('div', 'caja')
  const h = new Date().getHours()
  const saludo = h < 7 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
  caja.append(el('p', 'saludo', saludo), el('h1', 'logo', activa.incognito ? 'Navegación de incógnito' : 'TCT Browser'))

  const campo = el('input')
  campo.id = 'busqueda'
  campo.placeholder = 'Busca en Google o escribe una dirección'
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') irA(campo.value) })
  caja.append(campo)

  if (activa.incognito) {
    caja.append(el('p', 'nota', 'Esta pestaña no guarda historial ni cookies al cerrarse. Las páginas que visites, tu proveedor de internet y, si es un equipo de centro o empresa, su administrador pueden seguir viendo tu actividad.'))
  } else {
    const rejilla = el('div', 'rejilla')
    marcadores.slice(0, 12).forEach(m => {
      const b = el('button', 'tile')
      b.append(el('span', 'ic', (m.titulo || m.url).trim().charAt(0).toUpperCase()), el('span', 'nom', m.titulo || m.url))
      b.onclick = () => navegar(activa, m.url)
      rejilla.append(b)
    })
    caja.append(rejilla)
    if (!marcadores.length) caja.append(el('p', 'nota', 'Aún no tienes marcadores. Pulsa ☆ o Ctrl+D en cualquier página para guardarla aquí.'))
  }
  inicioEl.append(caja)
  campo.focus()
}

// ---------- Marcadores ----------
function actualizarEstrella () {
  const u = activa && !activa.enInicio ? activa.url : ''
  $('estrella').textContent = marcadores.some(m => m.url === u) ? '★' : '☆'
  $('estrella').disabled = !u
}

function alternarMarcador () {
  if (!activa || activa.enInicio || !activa.url) return
  const i = marcadores.findIndex(m => m.url === activa.url)
  if (i >= 0) marcadores.splice(i, 1)
  else marcadores.push({ url: activa.url, titulo: activa.titulo })
  guardarMarcadores()
  actualizarEstrella()
  if (panelTipo === 'marcadores') pintarPanel()
}
$('estrella').onclick = alternarMarcador

// ---------- Panel de historial y marcadores ----------
function abrirPanel (tipo) {
  if (panelTipo === tipo) { cerrarPanel(); return }
  panelTipo = tipo
  panel.hidden = false
  pintarPanel()
}
function cerrarPanel () { panelTipo = null; panel.hidden = true }

function pintarPanel () {
  const esHist = panelTipo === 'historial'
  $('panelTitulo').textContent = esHist ? 'Historial' : 'Marcadores'
  $('vaciar').hidden = !esHist
  const lista = $('lista')
  lista.textContent = ''
  const origen = esHist ? historial : marcadores
  if (!origen.length) { lista.append(el('p', 'nota', esHist ? 'Todavía no hay historial.' : 'Todavía no hay marcadores.')); return }

  origen.slice(0, 150).forEach((d, i) => {
    const fila = el('div', 'fila')
    const ir = el('button', 'ir')
    ir.append(el('span', 't', d.titulo || d.url), el('span', 'u', d.url))
    ir.onclick = () => navegar(activa, d.url)
    const borrar = el('button', '', '✕')
    borrar.title = 'Eliminar'
    borrar.onclick = () => {
      origen.splice(i, 1)
      esHist ? guardarHistorial() : guardarMarcadores()
      pintarPanel()
      actualizarEstrella()
    }
    fila.append(ir, borrar)
    lista.append(fila)
  })
}

$('bMarc').onclick = () => abrirPanel('marcadores')
$('bHist').onclick = () => abrirPanel('historial')
$('panelCerrar').onclick = cerrarPanel
$('vaciar').onclick = () => {
  if (confirm('¿Borrar todo el historial?')) { historial = []; guardarHistorial(); pintarPanel() }
}

// ---------- Atajos de teclado y enlaces nuevos (llegan desde main.js) ----------
if (window.tct) {
  window.tct.onAtajo(a => {
    switch (a) {
      case 'nueva': nuevaPestana(); break
      case 'incognito': nuevaPestana(null, true); break
      case 'cerrar': cerrarPestana(activa); break
      case 'barra': urlInput.focus(); urlInput.select(); break
      case 'recargar': recargar(); break
      case 'marcador': alternarMarcador(); break
      case 'marcadores': abrirPanel('marcadores'); break
      case 'historial': abrirPanel('historial'); break
      case 'siguiente': cambiar(1); break
      case 'anterior': cambiar(-1); break
      case 'atras': atras(); break
      case 'adelante': adelante(); break
    }
  })
  window.tct.onAbrir(url => nuevaPestana(url, activa ? activa.incognito : false))
}

nuevaPestana()
