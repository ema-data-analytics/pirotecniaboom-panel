/* Pirotecnia Boom · Panel de gestión · núcleo (conexión, sesión, utilidades, componentes) */
'use strict';
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const SB_URL = LOCAL ? location.origin : 'https://ounzsqhxzdluqkcszkes.supabase.co';
const SB_KEY = 'sb_publishable_g5SGDg6taIq-O8-skchu0w_Zk1Ze1_W';
const ES_PRUEBA = true; // base de pruebas: muestra la banda amarilla
const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pb_panel_v2' } });

let M = {};            // datos maestros (panel_maestros)
let ES_DUENO = false;
let CLIENTES = null;   // cache para el buscador
let LOGO = null;       // logo en base64 para los PDF
const PAG = {};        // estado de la página actual

/* ---------- utilidades ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfq = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 });
const fmt = n => '$ ' + nf2.format(Number(n || 0));
const fmtN = n => nfq.format(Number(n || 0));
const fmtP = n => nfq.format(Number(n || 0)) + '%';
function fmtD(d) { if (!d) return ''; const s = String(d); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, dd] = s.split('-'); return `${dd}/${m}/${y}`; } const x = new Date(d); return isNaN(x) ? s : x.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Salta' }); }
function fmtDT(d) { if (!d) return ''; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleString('es-AR', { timeZone: 'America/Argentina/Salta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function hoy(dias = 0) { const d = new Date(Date.now() + dias * 864e5); return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Salta' }); }
function iniMes() { return hoy().slice(0, 8) + '01'; }
const num = v => { if (v === '' || v === null || v === undefined) return null; const n = Number(String(v).replace(/\./g, '').replace(',', '.')); return isNaN(n) ? null : n; };
const numIn = id => { const e = $(id); if (!e) return null; const v = e.value.trim(); if (v === '') return null; const n = Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v); return isNaN(n) ? null : n; };
const val = id => { const e = $(id); return e ? e.value.trim() : ''; };
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const uid = () => Math.random().toString(36).slice(2, 10);
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function celWa(c) { return String(c || '').replace(/\D/g, ''); }
function waAbrir(cel, texto) { const n = celWa(cel); window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(texto), '_blank'); }

function toast(msg, t = 'g', ms = 3500) {
  const d = document.createElement('div'); d.className = 'toast toast-' + t; d.textContent = msg;
  $('toasts').appendChild(d); setTimeout(() => d.remove(), ms);
}
let _cargas = 0;
function cargando(on) { _cargas += on ? 1 : -1; if (_cargas < 0) _cargas = 0; $('cargando').style.display = _cargas ? 'block' : 'none'; }

function traducirError(e) {
  let m = (e && (e.message || e.error_description || e.msg)) || String(e);
  if (/permission denied/i.test(m)) return 'No tenés permiso para hacer esto.';
  if (/JWT expired|invalid JWT|not authenticated/i.test(m)) { setTimeout(() => location.reload(), 1500); return 'La sesión venció. Volvé a ingresar.'; }
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión con el servidor. Revisá internet y probá de nuevo.';
  if (/duplicate key/i.test(m)) return 'Ya existe un registro con ese dato.';
  if (/violates check constraint/i.test(m)) return 'Hay un dato inválido. Revisá importes, porcentajes y fechas.';
  return m.replace(/^ERROR:\s*/, '');
}
async function rpc(fn, args = {}, { silencio = false } = {}) {
  cargando(true);
  try {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw error;
    return data;
  } catch (e) {
    const m = traducirError(e);
    if (!silencio) toast(m, 'r', 6000);
    const err = new Error(m); err.mostrado = !silencio; throw err;
  } finally { cargando(false); }
}

// Un error de la base ya mostrado en pantalla (toast rojo) no se vuelve a informar como error de página
window.addEventListener('unhandledrejection', e => { if (e.reason && e.reason.mostrado) e.preventDefault(); });

/* ---------- modales ---------- */
function showModal(html, cls = '') {
  const o = document.createElement('div'); o.className = 'mo';
  o.innerHTML = `<div class="md ${cls}">${html}</div>`;
  $('modals').appendChild(o);
  setTimeout(() => { const f = o.querySelector('[autofocus],input:not([type=hidden]):not([readonly]),select'); if (f) f.focus(); }, 60);
  return o;
}
function closeModal(el) { const m = el ? el.closest('.mo') : [...document.querySelectorAll('.mo')].pop(); if (m) m.remove(); }
function modalHdr(t) { return `<div class="mh"><span class="mt">${t}</span><button class="mc" onclick="closeModal(this)" title="Cerrar">&times;</button></div>`; }
function confirmar(texto, { ok = 'Confirmar', peligro = false } = {}) {
  return new Promise(res => {
    const o = showModal(modalHdr('Confirmar') + `<div class="mb2">${texto}</div><div class="mf"><button class="btn btn-s" data-r="0">Cancelar</button><button class="btn ${peligro ? 'btn-d' : 'btn-p'}" data-r="1">${ok}</button></div>`, 'md-sm');
    o.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { o.remove(); res(b.dataset.r === '1'); });
    o.querySelector('.mc').onclick = () => { o.remove(); res(false); };
  });
}
function pedirTexto(titulo, label, { obligatorio = true, valor = '', ayuda = '' } = {}) {
  return new Promise(res => {
    const id = 'pt' + uid();
    const o = showModal(modalHdr(titulo) + `<div class="mb2">${ayuda ? `<div class="alert al-w">${ayuda}</div>` : ''}<div class="fg"><label class="fl ${obligatorio ? 'req' : ''}">${label}</label><textarea id="${id}" class="ft" autofocus>${esc(valor)}</textarea></div></div>
      <div class="mf"><button class="btn btn-s" data-r="0">Cancelar</button><button class="btn btn-p" data-r="1">Aceptar</button></div>`, 'md-sm');
    o.querySelector('[data-r="0"]').onclick = () => { o.remove(); res(null); };
    o.querySelector('.mc').onclick = () => { o.remove(); res(null); };
    o.querySelector('[data-r="1"]').onclick = () => { const v = $(id).value.trim(); if (obligatorio && !v) { toast('Completá el dato.', 'r'); return; } o.remove(); res(v); };
  });
}

/* ---------- página ---------- */
function pagina({ titulo, icono, sub = '', botones = '', cuerpo = '' }) {
  $('main').innerHTML = `${ES_PRUEBA ? '<div class="banda-prueba"><i class="fas fa-flask"></i> Versión de PRUEBA: lo que se cargue acá queda en la base de prueba.</div>' : ''}
  <div class="page-hdr"><div class="flex aic"><button class="btn-menu" onclick="document.body.classList.toggle('menu-abierto')"><i class="fas fa-bars"></i></button>
  <div><div class="page-title"><i class="fas fa-${icono}"></i> ${titulo}</div><div class="page-sub">${sub}</div></div></div>
  <div class="flex gap2 fw">${botones}</div></div><div class="content">${cuerpo}</div>`;
  $('main').scrollTop = 0;
}
const btnExcel = fn => `<button class="btn btn-excel btn-sm" onclick="${fn}"><i class="fas fa-file-excel"></i> Excel</button>`;
const btnPdf = fn => `<button class="btn btn-pdf btn-sm" onclick="${fn}"><i class="fas fa-file-pdf"></i> PDF</button>`;
const btnNuevo = (fn, t = 'Nuevo') => `<button class="btn btn-p" onclick="${fn}"><i class="fas fa-plus"></i> ${t}</button>`;
function kpi(l, v, s = '', c = '') { return `<div class="sc"><div class="sl">${l}</div><div class="sv ${c}">${v}</div><div class="ss">${s}</div></div>`; }
function badgeEstado(e) {
  const m = { emitido: 'bg', registrado: 'bg', pagado: 'bg', activo: 'bg', activa: 'bg', aceptado: 'bg', confirmado: 'bg', abierta: 'bg', acreditado: 'bg', cartera: 'ba', debitado: 'bg',
    anulado: 'bd', anulada: 'bd', rechazado: 'bd', cancelado: 'bd', vencido: 'bm', inactivo: 'bm', inactiva: 'bm', cerrada: 'bm', descartado: 'bm',
    borrador: 'bw', enviado: 'bb', abierto: 'bw', depositado: 'bb', endosado: 'bm', emitido_ch: 'bb', pendiente: 'bw', parcial: 'bb' };
  const k = norm(e); return `<span class="badge ${m[k] || 'bm'}">${esc(e || '—')}</span>`;
}

/* ---------- grilla estándar con export ---------- */
// cols: [{t, k, f:'m'|'n'|'d'|'dt'|'p'|fn(row), cls, sum:true, x:false (no exportar)}]
function celda(c, r) {
  const v = typeof c.f === 'function' ? c.f(r) : r[c.k];
  if (typeof c.f === 'function') return v ?? '';
  if (c.f === 'm') return fmt(v);
  if (c.f === 'n') return fmtN(v);
  if (c.f === 'd') return fmtD(v);
  if (c.f === 'dt') return fmtDT(v);
  if (c.f === 'p') return fmtP(v);
  if (c.f === 'e') return badgeEstado(v);
  return esc(v ?? '');
}
function celdaTxt(c, r) {
  if (c.xf) return c.xf(r);
  const v = r[c.k];
  if (c.f === 'm' || c.f === 'n' || c.f === 'p') return Number(v || 0);
  if (c.f === 'd') return fmtD(v);
  if (c.f === 'dt') return fmtDT(v);
  if (typeof c.f === 'function') { const d = document.createElement('div'); d.innerHTML = c.f(r); return d.textContent.trim(); }
  return v ?? '';
}
function grilla(id, cols, rows, { acciones = null, vacio = 'Sin registros', claseFila = null } = {}) {
  const hayTot = cols.some(c => c.sum);
  const th = cols.map(c => `<th class="${c.cls || ''}">${c.t}</th>`).join('') + (acciones ? '<th class="tc">Acciones</th>' : '');
  const body = rows.length ? rows.map((r, i) => `<tr class="${claseFila ? claseFila(r) : ''}" data-i="${i}">${cols.map(c => `<td class="${c.cls || ''} ${['m', 'n', 'p'].includes(c.f) ? 'mono' : ''}">${celda(c, r)}</td>`).join('')}${acciones ? `<td class="acc">${acciones(r, i)}</td>` : ''}</tr>`).join('')
    : `<tr><td class="vacio" colspan="${cols.length + (acciones ? 1 : 0)}">${vacio}</td></tr>`;
  let foot = '';
  if (hayTot && rows.length) {
    const vivos = rows.filter(r => !['anulado', 'anulada'].includes(r.estado));
    foot = '<tfoot><tr>' + cols.map((c, i) => c.sum ? `<td class="tr mono">${c.f === 'n' ? fmtN(vivos.reduce((s, r) => s + Number(r[c.k] || 0), 0)) : fmt(vivos.reduce((s, r) => s + Number(r[c.k] || 0), 0))}</td>` : `<td>${i === 0 ? 'TOTAL (' + vivos.length + ')' : ''}</td>`).join('') + (acciones ? '<td></td>' : '') + '</tr></tfoot>';
  }
  PAG.grillas = PAG.grillas || {}; PAG.grillas[id] = { cols, rows };
  return `<div class="tw"><table id="${id}"><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table></div>`;
}
function exportarExcel(id, nombre) {
  const g = (PAG.grillas || {})[id]; if (!g) return;
  const cols = g.cols.filter(c => c.x !== false);
  const filas = g.rows.map(r => cols.map(c => celdaTxt(c, r)));
  const tot = cols.some(c => c.sum) ? cols.map((c, i) => c.sum ? g.rows.filter(r => !['anulado', 'anulada'].includes(r.estado)).reduce((s, r) => s + Number(r[c.k] || 0), 0) : (i === 0 ? 'TOTAL' : '')) : null;
  xlsxSave([{ name: nombre, headers: cols.map(c => c.t), rows: filas, total: tot }], nombre.replace(/\s+/g, '_'));
}
function exportarPdf(id, titulo, subtitulo = '', horizontal = true) {
  const g = (PAG.grillas || {})[id]; if (!g) return;
  const cols = g.cols.filter(c => c.x !== false);
  const doc = pdfNew(titulo, subtitulo, horizontal);
  const body = g.rows.map(r => cols.map(c => { const v = celdaTxt(c, r); return c.f === 'm' ? fmt(v) : c.f === 'n' ? fmtN(v) : c.f === 'p' ? fmtP(v) : String(v); }));
  const foot = cols.some(c => c.sum) ? cols.map((c, i) => c.sum ? (c.f === 'n' ? fmtN : fmt)(g.rows.filter(r => !['anulado', 'anulada'].includes(r.estado)).reduce((s, r) => s + Number(r[c.k] || 0), 0)) : (i === 0 ? 'TOTAL' : '')) : null;
  const colStyles = {}; cols.forEach((c, i) => { if (['m', 'n', 'p'].includes(c.f)) colStyles[i] = { halign: 'right' }; });
  pdfTable(doc, cols.map(c => c.t), body, foot, 40, colStyles);
  pdfSave(doc, titulo.replace(/\s+/g, '_'));
}

/* ---------- filtros estándar ---------- */
// filtros: [{k, t:'desde'|'hasta'|'texto'|'sel'|'chk'|'cliente'|'proveedor'|'producto'|'concepto', l, op:[[v,l]], v}]
function barraFiltros(defs, onCambio) {
  PAG.filtros = defs; PAG.onFiltro = onCambio;
  const html = defs.map(d => {
    const id = 'f_' + d.k;
    if (d.t === 'desde' || d.t === 'hasta' || d.t === 'fecha') return `<div class="fg"><label class="fl">${d.l || (d.t === 'desde' ? 'Desde' : 'Hasta')}</label><input type="date" id="${id}" class="fi" style="width:145px" value="${d.v || ''}" onchange="PAG.onFiltro()"></div>`;
    if (d.t === 'sel') return `<div class="fg"><label class="fl">${d.l}</label><select id="${id}" class="fs" style="min-width:140px" onchange="PAG.onFiltro()"><option value="">Todos</option>${d.op.map(o => `<option value="${esc(o[0])}" ${String(d.v ?? '') === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></div>`;
    if (d.t === 'chk') return `<div class="fg"><label class="chk"><input type="checkbox" id="${id}" ${d.v ? 'checked' : ''} onchange="PAG.onFiltro()"> ${d.l}</label></div>`;
    if (d.t === 'texto') return `<div class="fg"><label class="fl">${d.l || 'Buscar'}</label><input id="${id}" class="fi" style="min-width:170px" placeholder="${d.ph || 'Escribí para buscar…'}" oninput="PAG.onFiltroDeb()"></div>`;
    return `<div class="fg" style="min-width:230px"><label class="fl">${d.l}</label><div id="${id}_w"></div></div>`;
  }).join('') + `<div class="fg"><button class="btn btn-s btn-sm" onclick="limpiarFiltros()" title="Limpiar filtros"><i class="fas fa-eraser"></i></button></div>`;
  PAG.onFiltroDeb = debounce(onCambio, 350);
  setTimeout(() => defs.filter(d => ['cliente', 'proveedor', 'producto', 'concepto'].includes(d.t)).forEach(d => {
    buscador('f_' + d.k + '_w', { tipo: d.t, id: 'f_' + d.k, placeholder: 'Todos', onSelect: () => onCambio(), onClear: () => onCambio() });
  }), 0);
  return `<div class="fbar">${html}</div>`;
}
function leerFiltros() {
  const f = {};
  (PAG.filtros || []).forEach(d => {
    const e = $('f_' + d.k); if (!e) return;
    if (d.t === 'chk') { if (e.checked) f[d.k] = true; }
    else if (['cliente', 'proveedor', 'producto', 'concepto'].includes(d.t)) { if (e.dataset.id) f[d.k] = Number(e.dataset.id); }
    else if (e.value) f[d.k] = e.value;
  });
  return f;
}
function limpiarFiltros() {
  (PAG.filtros || []).forEach(d => {
    const e = $('f_' + d.k); if (!e) return;
    if (d.t === 'chk') e.checked = !!d.v; else if (['cliente', 'proveedor', 'producto', 'concepto'].includes(d.t)) { e.value = ''; e.dataset.id = ''; } else e.value = d.v || '';
  });
  PAG.onFiltro();
}

/* ---------- buscador (un solo campo que busca y trae el valor) ---------- */
async function cargarClientes(forzar = false) {
  if (!CLIENTES || forzar) CLIENTES = await rpc('abm_listar', { p_tabla: 'clientes' });
  return CLIENTES;
}
async function fuenteBuscador(tipo, q, opt) {
  const n = norm(q);
  const filtra = (arr, campos) => arr.filter(x => !n || campos.some(c => norm(x[c]).includes(n)));
  if (tipo === 'cliente') {
    const cl = await cargarClientes();
    return filtra(cl.filter(c => opt.inactivos || c.estado === 'activo'), ['nombre', 'celular', 'documento_nro']).slice(0, 60)
      .map(c => ({ id: c.id, label: c.nombre, sub: [c.celular, c.lista, c.deuda > 0 ? 'Debe ' + fmt(c.deuda) : ''].filter(Boolean).join(' · '), raw: c }));
  }
  if (tipo === 'proveedor') return filtra(M.proveedores || [], ['nombre', 'cuit']).slice(0, 60).map(p => ({ id: p.id, label: p.nombre, sub: p.cuit || '', raw: p }));
  if (tipo === 'concepto') return filtra(M.conceptos_gasto || [], ['nombre']).slice(0, 60).map(p => ({ id: p.id, label: p.nombre, sub: '', raw: p }));
  if (tipo === 'producto') {
    const r = await rpc('buscar_productos', { p_texto: q || '', p_lista: opt.lista ? opt.lista() : null }, { silencio: true });
    return r.map(p => ({ id: p.id, label: p.codigo + ' · ' + p.nombre,
      sub: (p.precio_final != null ? fmt(opt.neto ? p.precio_neto : p.precio_final) + (opt.neto ? ' neto' : '') : 'sin precio') + (p.controla_stock ? ' · disp. ' + fmtN(p.disponible) : '') + (p.oferta ? ' · OFERTA' : ''), raw: p }));
  }
  if (tipo === 'lista') return (opt.items || []).filter(x => !n || norm(x.label).includes(n));
  return [];
}
// contenedor: id de un div donde se dibuja; opt.id = id del input
function buscador(contenedor, opt) {
  const w = typeof contenedor === 'string' ? $(contenedor) : contenedor; if (!w) return;
  const id = opt.id || 'bq' + uid();
  w.innerHTML = `<div class="bq"><input id="${id}" class="fi" autocomplete="off" placeholder="${esc(opt.placeholder || 'Escribí para buscar…')}" value="${esc(opt.valor?.label || '')}" data-id="${opt.valor?.id || ''}"><i class="fas fa-search bq-ico"></i></div>`;
  const inp = $(id); const box = w.querySelector('.bq');
  let lista = null, items = [], sel = -1, ultimo = opt.valor?.label || '';
  const cerrar = () => { if (lista) { lista.remove(); lista = null; } };
  const pintar = () => {
    cerrar(); lista = document.createElement('div'); lista.className = 'bq-list';
    lista.innerHTML = items.length ? items.map((x, i) => `<div class="bq-it ${i === sel ? 'on' : ''}" data-i="${i}"><span>${esc(x.label)}</span><small>${esc(x.sub || '')}</small></div>`).join('') : '<div class="bq-none">Sin resultados</div>';
    lista.onmousedown = e => { const it = e.target.closest('.bq-it'); if (it) { e.preventDefault(); elegir(items[Number(it.dataset.i)]); } };
    box.appendChild(lista);
  };
  const elegir = x => { inp.value = x.label; inp.dataset.id = x.id; ultimo = x.label; cerrar(); if (opt.onSelect) opt.onSelect(x.raw || x, x); };
  const buscar = debounce(async () => { try { items = await fuenteBuscador(opt.tipo, inp.value.trim(), opt); sel = items.length ? 0 : -1; if (document.activeElement === inp) pintar(); } catch (e) { } }, opt.tipo === 'producto' ? 220 : 60);
  inp.addEventListener('input', () => { if (inp.dataset.id && inp.value !== ultimo) { inp.dataset.id = ''; if (opt.onClear) opt.onClear(); } buscar(); });
  inp.addEventListener('focus', () => inp.select());
  inp.addEventListener('click', () => { if (!lista) buscar(); });
  inp.addEventListener('blur', () => setTimeout(() => { cerrar(); if (!inp.dataset.id && inp.value && !opt.libre) { inp.value = ''; } if (!inp.value && opt.onClear && ultimo) { ultimo = ''; opt.onClear(); } }, 150));
  inp.addEventListener('keydown', e => {
    if (!lista) { if (e.key === 'ArrowDown') buscar(); return; }
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); pintar(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); pintar(); e.preventDefault(); }
    else if (e.key === 'Enter') { if (items[sel]) { elegir(items[sel]); e.preventDefault(); } }
    else if (e.key === 'Escape') cerrar();
  });
  inp.fijar = x => { inp.value = x ? x.label : ''; inp.dataset.id = x ? x.id : ''; ultimo = inp.value; };
  return inp;
}

/* ---------- PDF y Excel ---------- */
async function cargarLogo() {
  try { const b = await (await fetch('img/logo.png')).blob(); LOGO = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); } catch (e) { LOGO = null; }
}
function pdfNew(titulo, subtitulo = '', horizontal = false) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: horizontal ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); const E = M.empresa || {};
  if (LOGO) { try { doc.addImage(LOGO, 'PNG', 10, 5, 42, 28); } catch (e) { } }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(74, 10, 13);
  doc.text(E.razon_social || 'Pirotecnia Boom', 56, 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 80, 75);
  const lin = [E.cuit ? 'CUIT ' + E.cuit : '', E.condicion_iva || '', E.direccion || '', [E.whatsapp ? 'WhatsApp ' + E.whatsapp : '', E.email || ''].filter(Boolean).join(' · ')].filter(Boolean);
  lin.forEach((l, i) => doc.text(l, 56, 17 + i * 4));
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(227, 30, 36);
  doc.text(titulo, W - 10, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 50, 45);
  String(subtitulo || '').split('\n').forEach((l, i) => doc.text(l, W - 10, 19 + i * 4.5, { align: 'right' }));
  doc.setFillColor(254, 204, 0); doc.rect(10, 35, W - 20, 1.2, 'F');
  doc.setTextColor(30, 30, 30);
  return doc;
}
function pdfTable(doc, head, body, foot, startY = 40, columnStyles = {}) {
  const W = doc.internal.pageSize.getWidth();
  doc.autoTable({
    startY, head: [head], body, foot: foot ? [foot] : [], theme: 'striped', columnStyles,
    headStyles: { fillColor: [74, 10, 13], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [254, 204, 0], textColor: [74, 10, 13], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 1.8 }, alternateRowStyles: { fillColor: [252, 247, 244] }, margin: { left: 10, right: 10 },
    didDrawPage: d => { const H = doc.internal.pageSize.getHeight(); doc.setFontSize(7); doc.setTextColor(150); doc.text('Pág. ' + d.pageNumber, W - 10, H - 6, { align: 'right' }); doc.text('Pirotecnia Boom · generado ' + new Date().toLocaleString('es-AR'), 10, H - 6); }
  });
  return doc.lastAutoTable.finalY;
}
// Marca de agua con el logo en todas las hojas de los PDF
function pdfMarcaAgua(doc) {
  if (!LOGO) return;
  try {
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), w = Math.min(W, H) * 0.75, h = w / 1.5;
    for (let i = 1; i <= doc.getNumberOfPages(); i++) {
      doc.setPage(i); doc.setGState(new doc.GState({ opacity: 0.12 }));
      doc.addImage(LOGO, 'PNG', (W - w) / 2, (H - h) / 2, w, h);
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
  } catch (e) { }
}
function pdfSave(doc, fn) { pdfMarcaAgua(doc); doc.save(fn + '_' + hoy() + '.pdf'); toast('PDF descargado', 'g'); }
function pdfRecuadro(doc, x, y, w, titulo, lineas) {
  doc.setDrawColor(227, 210, 200); doc.setFillColor(252, 248, 245); doc.roundedRect(x, y, w, 6 + lineas.length * 4.6, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(140, 120, 110); doc.text(titulo.toUpperCase(), x + 3, y + 4.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
  lineas.forEach((l, i) => { if (i === 0) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal'); doc.text(String(l || ''), x + 3, y + 9.5 + i * 4.6); });
  return y + 6 + lineas.length * 4.6;
}
function pdfTotales(doc, y, filas) {
  const W = doc.internal.pageSize.getWidth(); let yy = y + 4;
  filas.forEach(([l, v, fuerte]) => {
    doc.setFont('helvetica', fuerte ? 'bold' : 'normal'); doc.setFontSize(fuerte ? 11 : 9); doc.setTextColor(fuerte ? 74 : 40, fuerte ? 10 : 40, fuerte ? 13 : 40);
    doc.text(l, W - 60, yy, { align: 'right' }); doc.text(v, W - 10, yy, { align: 'right' }); yy += fuerte ? 7 : 5;
  });
  return yy;
}
function xlsxSave(sheets, fn) {
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sh.headers, ...sh.rows, ...(sh.total ? [sh.total] : [])]);
    ws['!cols'] = sh.headers.map((h, i) => ({ wch: Math.min(50, Math.max(10, String(h).length + 2, ...sh.rows.slice(0, 300).map(r => String(r[i] ?? '').length + 1))) }));
    XLSX.utils.book_append_sheet(wb, ws, String(sh.name).slice(0, 31));
  }
  XLSX.writeFile(wb, fn + '_' + hoy() + '.xlsx'); toast('Excel descargado', 'g');
}

/* ---------- comprobantes comunes (PDF) ---------- */
// det: {titulo, numero, fecha, lineasEmisor, receptor:{titulo, lineas}, extra:{titulo,lineas}, cols, filas, colStyles, totales, notas}
function pdfDocumento(det) {
  const doc = pdfNew(det.titulo, det.numero + '\nFecha: ' + det.fecha + (det.sub ? '\n' + det.sub : ''), false);
  const W = doc.internal.pageSize.getWidth();
  let y = 40;
  const h1 = pdfRecuadro(doc, 10, y, det.extra ? (W - 25) / 2 : W - 20, det.receptor.titulo, det.receptor.lineas.filter(Boolean));
  let h2 = y; if (det.extra) h2 = pdfRecuadro(doc, 15 + (W - 25) / 2, y, (W - 25) / 2, det.extra.titulo, det.extra.lineas.filter(Boolean));
  y = Math.max(h1, h2) + 4;
  let fy = y;
  if (det.cols) fy = pdfTable(doc, det.cols, det.filas, null, y, det.colStyles || {});
  if (det.totales) fy = pdfTotales(doc, fy, det.totales);
  if (det.notas) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 70, 65); doc.text(doc.splitTextToSize(det.notas, W - 20), 10, fy + 6); }
  return doc;
}

/* ---------- pagos (cobros) ---------- */
// opt: {total, titulo, onConfirm(pagos, efectivo_entregado), mostrarEntregado}
function modalPagos(opt) {
  const total = Number(opt.total || 0); const mid = 'mp' + uid();
  const medios = (M.medios || []).filter(m => m.id !== 8);
  const o = showModal(modalHdr(opt.titulo || 'Cómo paga') + `<div class="mb2">
    <div class="flex jb aic mb3"><div><div class="sl">TOTAL A COBRAR</div><div class="sv r">${fmt(total)}</div></div><div class="tr"><div class="sl">FALTA</div><div class="sv" id="${mid}_falta">${fmt(total)}</div></div></div>
    <div id="${mid}_lins"></div>
    <button class="btn btn-s btn-sm mt3" id="${mid}_add"><i class="fas fa-plus"></i> Agregar otro medio</button>
    <div class="fr mt3" id="${mid}_ef"><div class="fg"><label class="fl">Efectivo que entrega el cliente</label><input id="${mid}_ent" class="fi" type="number" step="0.01" min="0" placeholder="Opcional"></div><div class="fg"><label class="fl">Vuelto</label><input id="${mid}_vto" class="fi" readonly></div></div>
  </div><div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p btn-xl" id="${mid}_ok"><i class="fas fa-check"></i> Confirmar</button></div>`, 'md-lg');
  const lins = $(mid + '_lins');
  const opMed = sel => medios.map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('');
  const opCta = sel => '<option value="">Elegí la cuenta…</option>' + (M.cuentas || []).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
  function extra(div) {
    const m = medios.find(x => x.id === Number(div.querySelector('.p-med').value)) || {};
    const ex = div.querySelector('.p-ex');
    if (['transferencia', 'billetera', 'tarjeta_debito', 'tarjeta_credito', 'debito_automatico'].includes(m.tipo)) {
      ex.innerHTML = `<div class="fr${m.tipo === 'tarjeta_credito' ? '3' : ''}"><div class="fg"><label class="fl">Cuenta donde acredita</label><select class="fs p-cta">${opCta(m.cuenta_id)}</select></div><div class="fg"><label class="fl">Referencia / N° operación</label><input class="fi p-ref"></div>${m.tipo === 'tarjeta_credito' ? '<div class="fg"><label class="fl">Cuotas</label><input class="fi p-cuo" type="number" min="1" max="24" value="1"></div>' : ''}</div>`;
    } else if (m.tipo === 'cheque') {
      ex.innerHTML = `<div class="fr4"><div class="fg"><label class="fl req">Banco</label><input class="fi c-banco"></div><div class="fg"><label class="fl req">N° cheque</label><input class="fi c-num"></div><div class="fg"><label class="fl req">Librador</label><input class="fi c-lib"></div><div class="fg"><label class="fl">CUIT librador</label><input class="fi c-cuit"></div></div>
      <div class="fr3"><div class="fg"><label class="fl req">Fecha emisión</label><input type="date" class="fi c-fe" value="${hoy()}"></div><div class="fg"><label class="fl req">Fecha de pago</label><input type="date" class="fi c-fp" value="${hoy()}"></div><div class="fg"><label class="chk"><input type="checkbox" class="c-eq"> e-cheq</label></div></div>`;
    } else ex.innerHTML = '';
    recalc();
  }
  function agregar(medio, importe) {
    const div = document.createElement('div'); div.className = 'panel pb mb3';
    div.innerHTML = `<div class="flex gap2 aic"><div class="fg f1" style="margin:0"><label class="fl">Medio</label><select class="fs p-med">${opMed(medio)}</select></div>
      <div class="fg" style="margin:0;width:180px"><label class="fl">Importe</label><input class="fi p-imp mono" type="number" step="0.01" min="0" value="${importe ?? ''}"></div>
      <button class="btn btn-d btn-sm" style="margin-top:16px" title="Quitar"><i class="fas fa-times"></i></button></div><div class="p-ex mt3"></div>`;
    div.querySelector('.p-med').onchange = () => extra(div);
    div.querySelector('.p-imp').oninput = recalc;
    div.querySelector('.btn-d').onclick = () => { div.remove(); recalc(); };
    lins.appendChild(div); extra(div);
  }
  function leer() {
    return [...lins.children].map(div => {
      const p = { medio_pago_id: Number(div.querySelector('.p-med').value), importe: Number(div.querySelector('.p-imp').value || 0) };
      const q = s => div.querySelector(s);
      if (q('.p-cta') && q('.p-cta').value) p.cuenta_id = Number(q('.p-cta').value);
      if (q('.p-ref') && q('.p-ref').value) p.referencia = q('.p-ref').value;
      if (q('.p-cuo')) p.cuotas = Number(q('.p-cuo').value || 1);
      if (q('.c-banco')) p.cheque = { banco: q('.c-banco').value.trim(), numero: q('.c-num').value.trim(), librador: q('.c-lib').value.trim(), cuit_librador: q('.c-cuit').value.trim() || null, fecha_emision: q('.c-fe').value, fecha_pago: q('.c-fp').value, echeq: q('.c-eq').checked };
      return p;
    });
  }
  function recalc() {
    const ps = leer(); const s = ps.reduce((a, p) => a + p.importe, 0);
    const f = Math.round((total - s) * 100) / 100;
    $(mid + '_falta').textContent = fmt(f); $(mid + '_falta').className = 'sv ' + (Math.abs(f) < 0.005 ? 'g' : 'r');
    const ef = ps.filter(p => p.medio_pago_id === 1).reduce((a, p) => a + p.importe, 0);
    $(mid + '_ef').style.display = ef > 0 ? '' : 'none';
    const ent = Number($(mid + '_ent').value || 0); $(mid + '_vto').value = ent > ef && ef > 0 ? fmt(ent - ef) : '';
  }
  $(mid + '_ent').oninput = recalc;
  $(mid + '_add').onclick = () => { const ps = leer(); const s = ps.reduce((a, p) => a + p.importe, 0); agregar(2, Math.max(0, Math.round((total - s) * 100) / 100) || ''); };
  agregar(1, total || '');
  $(mid + '_ok').onclick = async () => {
    const ps = leer().filter(p => p.importe > 0);
    if (!ps.length) return toast('Indicá cómo paga.', 'r');
    const s = Math.round(ps.reduce((a, p) => a + p.importe, 0) * 100) / 100;
    if (opt.exacto !== false && Math.abs(s - total) > 0.004) return toast('Lo cargado (' + fmt(s) + ') no coincide con el total (' + fmt(total) + ').', 'r');
    for (const p of ps) { if (p.cheque && (!p.cheque.banco || !p.cheque.numero || !p.cheque.librador)) return toast('Completá banco, número y librador del cheque.', 'r'); }
    const ent = $(mid + '_ent').value ? Number($(mid + '_ent').value) : null;
    $(mid + '_ok').disabled = true;
    try { await opt.onConfirm(ps, ent); o.remove(); } catch (e) { if (!e.mostrado) toast(traducirError(e), 'r'); $(mid + '_ok').disabled = false; }
  };
  return o;
}

/* ---------- sesión y menú ---------- */
const MENU = [
  { s: 'Principal', it: [['inicio', 'Inicio', 'gauge-high']] },
  { s: 'Ventas', it: [['presupuestos', 'Presupuestos', 'file-signature'], ['ventas', 'Ventas y notas', 'receipt'], ['cobranzas', 'Cobranzas', 'hand-holding-dollar'], ['ctacte', 'Cuenta corriente clientes', 'address-book'], ['pedidos', 'Pedidos web', 'cart-shopping']] },
  { s: 'Compras', d: true, it: [['compras', 'Compras', 'truck-ramp-box'], ['pagos', 'Pagos a proveedores', 'money-check-dollar'], ['ctacteprov', 'Cuenta corriente proveedores', 'book']] },
  { s: 'Caja y fondos', it: [['caja', 'Caja', 'cash-register'], ['gastos', 'Gastos', 'file-invoice-dollar'], ['cheques', 'Cheques', 'money-check'], ['bancos', 'Bancos y billeteras', 'building-columns', true]] },
  { s: 'Stock', it: [['productos', 'Productos y precios', 'box-open'], ['stock', 'Remitos y stock', 'boxes-stacked']] },
  { s: 'Maestros', it: [['clientes', 'Clientes', 'users'], ['proveedores', 'Proveedores', 'truck', true], ['categorias', 'Categorías', 'tags'], ['ofertas', 'Ofertas', 'percent'], ['descuentos', 'Descuentos por monto', 'tag', true], ['tiposgasto', 'Tipos de gasto', 'folder-tree'], ['conceptos', 'Conceptos de gasto', 'list-check'], ['medios', 'Medios de pago', 'credit-card', true], ['cuentas', 'Cuentas bancarias', 'piggy-bank', true]] },
  { s: 'Reportes', it: [['resultados', 'Estado de resultados', 'chart-line', true], ['rventas', 'Ventas por producto', 'chart-column'], ['ivacompras', 'Libro IVA Compras', 'book-open', true]] },
  { s: 'Sistema', it: [['usuarios', 'Usuarios', 'user-shield', true], ['empresa', 'Datos de la empresa', 'building', true], ['miclave', 'Mi contraseña', 'key']] },
];
const PAGINAS = {};
function armarMenu() {
  $('sb-nav').innerHTML = MENU.filter(g => !g.d || ES_DUENO).map(g => `<div class="sb-sect">${g.s}</div>` + g.it.filter(i => !i[3] || ES_DUENO).map(i => `<div class="nav-item" data-p="${i[0]}"><span class="nav-icon"><i class="fas fa-${i[2]}"></i></span><span>${i[1]}</span><span class="nav-badge hidden" id="nb_${i[0]}"></span></div>`).join('')).join('');
  document.querySelectorAll('.nav-item').forEach(n => n.onclick = () => { document.body.classList.remove('menu-abierto'); ir(n.dataset.p); });
}
async function ir(p) {
  if (!PAGINAS[p]) p = 'inicio';
  if (location.hash !== '#' + p) history.replaceState(null, '', '#' + p);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.p === p));
  document.querySelectorAll('.mo').forEach(m => m.remove());
  for (const k of Object.keys(PAG)) delete PAG[k];
  PAG.id = p;
  try { await PAGINAS[p](); } catch (e) { console.error(e); if (!e.mostrado) toast(traducirError(e), 'r', 6000); }
}
async function cargarMaestros() { M = await rpc('panel_maestros'); ES_DUENO = !!M.es_dueno; document.body.classList.toggle('es-dueno', ES_DUENO); }
async function entrar() {
  const u = val('l-user'), c = $('l-pass').value;
  const err = $('l-err'); err.style.display = 'none';
  if (!u || !c) { err.textContent = 'Completá usuario y contraseña.'; err.style.display = 'block'; return; }
  const email = u.includes('@') ? u.toLowerCase() : norm(u).replace(/[^a-z0-9._-]/g, '') + '@pirotecniaboom.local';
  $('l-btn').disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email, password: c });
  $('l-btn').disabled = false;
  if (error) { err.textContent = /Invalid login/i.test(error.message) ? 'Usuario o contraseña incorrectos.' : traducirError(error); err.style.display = 'block'; return; }
  await iniciarApp();
}
async function salir() { await sb.auth.signOut(); location.hash = ''; location.reload(); }
async function iniciarApp() {
  try { await cargarMaestros(); } catch (e) { await sb.auth.signOut(); $('login-wrap').style.display = 'flex'; $('app').style.display = 'none'; const er = $('l-err'); er.textContent = 'Ese usuario no tiene acceso al sistema de gestión (los mayoristas usan el catálogo).'; er.style.display = 'block'; return; }
  $('login-wrap').style.display = 'none'; $('app').style.display = 'flex';
  const u = M.usuario || {};
  $('sb-uname').textContent = u.nombre || ''; $('sb-urole').textContent = u.rol === 'dueno' ? 'Dueño' : u.rol === 'operador' ? 'Operador' : (u.rol || '');
  $('sb-av').textContent = (u.nombre || '?').slice(0, 1).toUpperCase();
  armarMenu(); cargarLogo();
  await ir((location.hash || '#inicio').slice(1));
  actualizarBadges();
}
async function actualizarBadges() {
  try {
    const r = await rpc('panel_inicio', {}, { silencio: true });
    const b = (k, n) => { const e = $('nb_' + k); if (e) { e.textContent = n; e.classList.toggle('hidden', !n); } };
    b('pedidos', r.pedidos_abiertos); b('presupuestos', r.presupuestos_por_vencer); b('stock', r.remitos_pendientes);
  } catch (e) { }
}
window.addEventListener('load', async () => {
  $('l-pass').addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
  $('l-user').addEventListener('keydown', e => { if (e.key === 'Enter') $('l-pass').focus(); });
  const { data } = await sb.auth.getSession();
  if (data.session) await iniciarApp(); else { $('login-wrap').style.display = 'flex'; $('l-user').focus(); }
});
