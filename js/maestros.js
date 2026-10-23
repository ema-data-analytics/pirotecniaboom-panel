/* Pirotecnia Boom · Maestros (ABM de todas las tablas), productos, usuarios, empresa */
'use strict';

/* ---------- formulario genérico ---------- */
// campos: [{k, l, t:'text'|'num'|'sel'|'bool'|'date'|'area'|'proveedor'|'producto', op:()=>[[v,l]], req, ayuda, soloNuevo, dueno, ancho:2}]
function formHtml(campos, v = {}, pref = 'fm') {
  const visibles = campos.filter(c => (!c.dueno || ES_DUENO) && (!c.soloNuevo || !v.id) && !c.oculto);
  return '<div class="fr">' + visibles.map(c => {
    const id = pref + '_' + c.k; const x = v[c.k];
    const lab = `<label class="fl ${c.req ? 'req' : ''}">${c.l}</label>`;
    let inp;
    if (c.t === 'sel') inp = `<select id="${id}" class="fs">${c.vacio !== false ? `<option value="">${c.vacio || 'Elegí…'}</option>` : ''}${(typeof c.op === 'function' ? c.op() : c.op).map(o => `<option value="${esc(o[0])}" ${String(x ?? c.def ?? '') === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    else if (c.t === 'bool') return `<div class="fg" style="${c.ancho ? 'grid-column:1/-1' : ''}"><label class="chk"><input type="checkbox" id="${id}" ${(x ?? c.def) ? 'checked' : ''}> ${c.l}</label>${c.ayuda ? `<div class="ss">${c.ayuda}</div>` : ''}</div>`;
    else if (c.t === 'fotos') return `<div class="fg" style="grid-column:1/-1"><label class="fl">${c.l}</label><div id="${id}" class="fotos-w"></div>${c.ayuda ? `<div class="ss">${c.ayuda}</div>` : ''}</div>`;
    else if (c.t === 'area') inp = `<textarea id="${id}" class="ft">${esc(x ?? '')}</textarea>`;
    else if (c.t === 'num') inp = `<input id="${id}" type="number" step="${c.step || 'any'}" class="fi mono" value="${x ?? c.def ?? ''}">`;
    else if (c.t === 'date') inp = `<input id="${id}" type="date" class="fi" value="${x ? String(x).slice(0, 10) : (c.def || '')}">`;
    else if (['proveedor', 'producto', 'cliente', 'concepto'].includes(c.t)) inp = `<div id="${id}_w"></div>`;
    else inp = `<input id="${id}" class="fi" value="${esc(x ?? c.def ?? '')}" ${c.ph ? `placeholder="${esc(c.ph)}"` : ''}>`;
    return `<div class="fg" style="${c.ancho ? 'grid-column:1/-1' : ''}">${lab}${inp}${c.ayuda ? `<div class="ss">${c.ayuda}</div>` : ''}</div>`;
  }).join('') + '</div>';
}
function formMontarBuscadores(campos, v = {}, pref = 'fm') {
  campos.filter(c => ['proveedor', 'producto', 'cliente', 'concepto'].includes(c.t) && (!c.dueno || ES_DUENO)).forEach(c => {
    const vv = v[c.k] ? { id: v[c.k], label: v[c.labelK || c.k.replace('_id', '')] || ('#' + v[c.k]) } : null;
    buscador(pref + '_' + c.k + '_w', { tipo: c.t, id: pref + '_' + c.k, valor: vv, neto: true });
  });
}
function formLeer(campos, v = {}, pref = 'fm') {
  const p = {}; if (v.id) p.id = v.id;
  for (const c of campos) {
    if ((c.dueno && !ES_DUENO) || (c.soloNuevo && v.id) || c.oculto || c.t === 'fotos') continue;
    const e = $(pref + '_' + c.k); if (!e) continue;
    let x;
    if (c.t === 'bool') x = e.checked;
    else if (['proveedor', 'producto', 'cliente', 'concepto'].includes(c.t)) x = e.dataset.id ? Number(e.dataset.id) : null;
    else if (c.t === 'num') x = e.value === '' ? null : Number(e.value);
    else x = e.value.trim() === '' ? null : e.value.trim();
    if (c.req && (x === null || x === '')) throw new Error('Completá: ' + c.l);
    p[c.k] = x;
  }
  return p;
}
function modalForm({ titulo, campos, v = {}, guardar, cls = 'md-lg', intro = '' }) {
  const pref = 'fm' + uid();
  const o = showModal(modalHdr(titulo) + `<div class="mb2">${intro}${formHtml(campos, v, pref)}</div><div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p" id="${pref}_ok"><i class="fas fa-floppy-disk"></i> Guardar</button></div>`, cls);
  formMontarBuscadores(campos, v, pref);
  $(pref + '_ok').onclick = async () => {
    let p; try { p = formLeer(campos, v, pref); } catch (e) { return toast(e.message, 'r'); }
    $(pref + '_ok').disabled = true;
    try { await guardar(p); o.remove(); } catch (e) { if (!e.mostrado) toast(traducirError(e), 'r'); $(pref + '_ok').disabled = false; }
  };
  return o;
}
function verFicha(titulo, filas, cls = 'md-lg', extra = '') {
  showModal(modalHdr(titulo) + `<div class="mb2"><div class="kv">${filas.filter(f => f && f[1] !== undefined).map(f => `<b>${f[0]}</b><span>${f[1] ?? ''}</span>`).join('')}</div>${extra}</div><div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, cls);
}

/* ---------- ABM genérico ---------- */
const OPC = {
  estado2: [['activo', 'Activo'], ['inactivo', 'Inactivo']],
  estadoA: [['activa', 'Activa'], ['inactiva', 'Inactiva']],
  listas: () => (M.listas || []).map(l => [l.id, l.nombre]),
  condIva: () => (M.condiciones_iva || []).map(c => [c.id, c.nombre]),
  tiposGasto: () => (M.tipos_gasto || []).map(c => [c.id, c.nombre]),
  cuentas: () => (M.cuentas || []).map(c => [c.id, c.nombre]),
  categorias: () => (M.categorias || []).map(c => [c.id, c.nombre]),
  unidades: () => (M.unidades || []).map(c => [c.id, c.nombre]),
  alicuotas: () => (M.alicuotas || []).map(c => [c.id, c.nombre]),
  tipoMedio: [['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['tarjeta_debito', 'Tarjeta de débito'], ['tarjeta_credito', 'Tarjeta de crédito'], ['billetera', 'Billetera virtual / QR'], ['debito_automatico', 'Débito automático'], ['otro', 'Otro']],
};
const ABM = {
  categorias: { titulo: 'Categorías', icono: 'tags', sub: 'Rubros del catálogo', est: ['activa', 'inactiva'],
    cols: [{ t: 'Nombre', k: 'nombre' }, { t: 'Orden', k: 'orden', f: 'n', cls: 'tr' }, { t: 'Estado', k: 'estado', f: 'e' }],
    campos: [{ k: 'nombre', l: 'Nombre', req: 1 }, { k: 'orden', l: 'Orden en el catálogo', t: 'num', def: 0 }],
    filtrar: r => !/^Conceptos internos/.test(r.nombre) },
  proveedores: { titulo: 'Proveedores', icono: 'truck', sub: 'Proveedores de mercadería y servicios', est: ['activo', 'inactivo'],
    cols: [{ t: 'Razón social', k: 'razon_social' }, { t: 'CUIT', k: 'cuit' }, { t: 'Condición IVA', k: 'condicion_iva' }, { t: 'Teléfono', k: 'telefono' }, { t: 'Email', k: 'email' }, { t: 'Saldo', k: 'saldo', f: 'm', cls: 'tr', sum: 1 }, { t: 'Estado', k: 'estado', f: 'e' }],
    campos: [{ k: 'razon_social', l: 'Razón social', req: 1 }, { k: 'cuit', l: 'CUIT', ph: '30-12345678-9' }, { k: 'condicion_iva_id', l: 'Condición IVA', t: 'sel', op: OPC.condIva }, { k: 'telefono', l: 'Teléfono' }, { k: 'email', l: 'Email' }, { k: 'direccion', l: 'Dirección' }, { k: 'plazo_pago_dias', l: 'Plazo de pago (días)', t: 'num', def: 0 }, { k: 'notas', l: 'Notas', t: 'area', ancho: 1 }],
    extraAcc: r => `<button class="btn btn-xs btn-b" title="Cuenta corriente" onclick="irCtaProv(${r.id})"><i class="fas fa-book"></i></button>` },
  tiposgasto: { tabla: 'tipos_gasto', titulo: 'Tipos de gasto', icono: 'folder-tree', sub: 'Grupos de gastos', est: ['activo', 'inactivo'],
    cols: [{ t: 'Nombre', k: 'nombre' }, { t: 'Estado', k: 'estado', f: 'e' }], campos: [{ k: 'nombre', l: 'Nombre', req: 1 }] },
  conceptos: { tabla: 'conceptos_gasto', titulo: 'Conceptos de gasto', icono: 'list-check', sub: 'Conceptos dentro de cada tipo de gasto', est: ['activo', 'inactivo'],
    cols: [{ t: 'Tipo', k: 'tipo_gasto' }, { t: 'Concepto', k: 'nombre' }, { t: 'Estado', k: 'estado', f: 'e' }],
    campos: [{ k: 'tipo_gasto_id', l: 'Tipo de gasto', t: 'sel', op: OPC.tiposGasto, req: 1 }, { k: 'nombre', l: 'Concepto', req: 1 }] },
  medios: { tabla: 'medios_pago', titulo: 'Medios de pago', icono: 'credit-card', sub: 'Cómo pagan los clientes y cómo se paga', est: ['activo', 'inactivo'],
    cols: [{ t: 'Nombre', k: 'nombre' }, { t: 'Tipo', k: 'tipo' }, { t: 'Comisión', k: 'comision_pct', f: 'p', cls: 'tr' }, { t: 'Acredita en', k: 'cuenta' }, { t: 'Estado', k: 'estado', f: 'e' }],
    campos: [{ k: 'nombre', l: 'Nombre', req: 1 }, { k: 'tipo', l: 'Tipo', t: 'sel', op: OPC.tipoMedio, req: 1 }, { k: 'comision_pct', l: 'Comisión %', t: 'num', def: 0, ayuda: 'Se registra sola como gasto en cada cobro.' }, { k: 'cuenta_id', l: 'Cuenta donde acredita', t: 'sel', op: OPC.cuentas, vacio: 'Ninguna' }],
    filtrar: r => r.id !== 8 },
  cuentas: { tabla: 'cuentas_fondos', titulo: 'Cuentas bancarias y billeteras', icono: 'piggy-bank', sub: 'Bancos, Mercado Pago, caja fuerte', est: ['activa', 'inactiva'],
    cols: [{ t: 'Nombre', k: 'nombre' }, { t: 'Tipo', k: 'tipo' }, { t: 'Banco', k: 'banco' }, { t: 'CBU / Alias', k: 'cbu_alias' }, { t: 'Saldo', k: 'saldo', f: 'm', cls: 'tr', sum: 1 }, { t: 'Estado', k: 'estado', f: 'e' }],
    campos: [{ k: 'nombre', l: 'Nombre', req: 1 }, { k: 'tipo', l: 'Tipo', t: 'sel', op: [['banco', 'Banco'], ['billetera', 'Billetera virtual'], ['caja_fuerte', 'Caja fuerte']], req: 1 }, { k: 'banco', l: 'Banco / empresa' }, { k: 'cbu_alias', l: 'CBU / Alias' }] },
  descuentos: { tabla: 'descuentos_monto', titulo: 'Descuentos por monto', icono: 'tag', sub: 'Descuento automático según el total del pedido', est: ['activo', 'anulado'],
    cols: [{ t: 'Lista', k: 'lista' }, { t: 'Desde (neto)', k: 'monto_desde', f: 'm', cls: 'tr' }, { t: 'Descuento', k: 'porcentaje', f: 'p', cls: 'tr' }, { t: 'Vigente desde', k: 'vigente_desde', f: 'd' }, { t: 'Hasta', k: 'vigente_hasta', f: 'd' }, { t: 'Estado', k: 'estado', f: 'e' }],
    campos: [{ k: 'lista_id', l: 'Lista', t: 'sel', op: OPC.listas, req: 1 }, { k: 'monto_desde', l: 'Monto neto desde', t: 'num', req: 1 }, { k: 'porcentaje', l: 'Descuento %', t: 'num', req: 1 }, { k: 'vigente_desde', l: 'Vigente desde', t: 'date', def: hoy() }, { k: 'vigente_hasta', l: 'Vigente hasta (vacío = sin fin)', t: 'date' }] },
};
async function abmPagina(clave) {
  const cfg = ABM[clave]; const tabla = cfg.tabla || clave;
  pagina({ titulo: cfg.titulo, icono: cfg.icono, sub: cfg.sub,
    botones: btnExcel(`exportarExcel('g_abm','${cfg.titulo}')`) + btnPdf(`exportarPdf('g_abm','${cfg.titulo}')`) + (ES_DUENO ? btnNuevo(`abmEditar('${clave}')`) : ''),
    cuerpo: `<div class="panel">${barraFiltros([{ k: 'texto', t: 'texto' }, { k: 'estado', t: 'sel', l: 'Estado', op: cfg.est.map(e => [e, e[0].toUpperCase() + e.slice(1)]), v: cfg.est[0] }], () => abmPintar(clave))}<div id="abm_g"></div></div>` });
  PAG.abm = await rpc('abm_listar', { p_tabla: tabla });
  abmPintar(clave);
}
function abmPintar(clave) {
  const cfg = ABM[clave]; const f = leerFiltros(); const n = norm(f.texto || '');
  const rows = (PAG.abm || []).filter(r => (!cfg.filtrar || cfg.filtrar(r)) && (!f.estado || r.estado === f.estado) && (!n || norm(JSON.stringify(r)).includes(n)));
  $('abm_g').innerHTML = grilla('g_abm', cfg.cols.filter(c => c.k !== 'saldo' || ES_DUENO), rows, { claseFila: r => r.estado === cfg.est[1] ? 'anulado' : '',
    acciones: r => `<button class="btn btn-xs btn-s" title="Ver" onclick="abmVer('${clave}',${r.id})"><i class="fas fa-eye"></i></button>`
      + (ES_DUENO ? `<button class="btn btn-xs btn-b" title="Editar" onclick="abmEditar('${clave}',${r.id})"><i class="fas fa-pen"></i></button>`
      + `<button class="btn btn-xs ${r.estado === cfg.est[0] ? 'btn-d' : 'btn-g'}" title="${r.estado === cfg.est[0] ? 'Dar de baja' : 'Reactivar'}" onclick="abmEstado('${clave}',${r.id})"><i class="fas fa-${r.estado === cfg.est[0] ? 'ban' : 'rotate-left'}"></i></button>` : '')
      + (cfg.extraAcc ? cfg.extraAcc(r) : '') });
}
function abmVer(clave, id) {
  const cfg = ABM[clave]; const r = PAG.abm.find(x => x.id === id); if (!r) return;
  verFicha(cfg.titulo, cfg.cols.map(c => [c.t, celda(c, r)]).concat(cfg.campos.filter(c => !cfg.cols.some(k => k.k === c.k) && c.t !== 'sel').map(c => [c.l, esc(r[c.k] ?? '')])));
}
function abmEditar(clave, id) {
  const cfg = ABM[clave]; const tabla = cfg.tabla || clave; const r = id ? PAG.abm.find(x => x.id === id) : {};
  modalForm({ titulo: (id ? 'Editar · ' : 'Nuevo · ') + cfg.titulo, campos: cfg.campos, v: r || {}, guardar: async p => {
    await rpc('abm_guardar', { p_tabla: tabla, p });
    toast('Guardado', 'g'); await cargarMaestros(); PAG.abm = await rpc('abm_listar', { p_tabla: tabla }); abmPintar(clave);
  } });
}
async function abmEstado(clave, id) {
  const cfg = ABM[clave]; const tabla = cfg.tabla || clave; const r = PAG.abm.find(x => x.id === id);
  const nuevo = r.estado === cfg.est[0] ? cfg.est[1] : cfg.est[0];
  if (!await confirmar(`¿${nuevo === cfg.est[0] ? 'Reactivar' : 'Dar de baja'} <b>${esc(r.nombre || r.razon_social || r.lista || '')}</b>? No se borra: queda ${nuevo}.`)) return;
  await rpc('abm_guardar', { p_tabla: tabla, p: { id, estado: nuevo } });
  toast('Listo', 'g'); await cargarMaestros(); PAG.abm = await rpc('abm_listar', { p_tabla: tabla }); abmPintar(clave);
}
['categorias', 'proveedores', 'tiposgasto', 'conceptos', 'medios', 'cuentas', 'descuentos'].forEach(k => PAGINAS[k] = () => abmPagina(k));

/* ---------- Clientes ---------- */
const CAMPOS_CLIENTE = [
  { k: 'tipo', l: 'Tipo', t: 'sel', op: [['consumidor', 'Consumidor'], ['mayorista', 'Mayorista']], vacio: false, req: 1 },
  { k: 'nombre', l: 'Nombre / Razón social', req: 1 },
  { k: 'celular', l: 'Celular (WhatsApp)', ph: '387 474-9807' },
  { k: 'email', l: 'Email' },
  { k: 'documento_tipo', l: 'Tipo de documento', t: 'sel', op: [['DNI', 'DNI'], ['CUIT', 'CUIT'], ['CUIL', 'CUIL']], vacio: '—' },
  { k: 'documento_nro', l: 'N° documento' },
  { k: 'condicion_iva_id', l: 'Condición IVA', t: 'sel', op: OPC.condIva, vacio: false, def: 3 },
  { k: 'lista_id', l: 'Lista de precios', t: 'sel', op: OPC.listas, vacio: 'Según el tipo', dueno: 1 },
  { k: 'direccion', l: 'Dirección' }, { k: 'localidad', l: 'Localidad' }, { k: 'codigo_postal', l: 'Código postal', ph: '4400' },
  { k: 'descuento_pct', l: 'Descuento del cliente %', t: 'num', def: 0, dueno: 1, ayuda: 'Se aplica solo en presupuestos y ventas, además de los otros descuentos.' },
  { k: 'limite_credito', l: 'Límite de crédito (0 = sin límite)', t: 'num', def: 0, dueno: 1 },
  { k: 'notas', l: 'Notas', t: 'area', ancho: 1 }];
PAGINAS.clientes = async () => {
  pagina({ titulo: 'Clientes', icono: 'users', sub: 'Consumidores y mayoristas',
    botones: btnExcel(`exportarExcel('g_cli','Clientes')`) + btnPdf(`exportarPdf('g_cli','Clientes')`) + btnNuevo('clienteEditar()'),
    cuerpo: `<div class="panel">${barraFiltros([{ k: 'texto', t: 'texto', ph: 'Nombre, celular o documento' }, { k: 'tipo', t: 'sel', l: 'Tipo', op: [['consumidor', 'Consumidor'], ['mayorista', 'Mayorista']] }, { k: 'estado', t: 'sel', l: 'Estado', op: OPC.estado2, v: 'activo' }, { k: 'deuda', t: 'chk', l: 'Solo con deuda' }], clientesPintar)}<div id="cli_g"></div></div>` });
  await cargarClientes(true); clientesPintar();
};
function clientesPintar() {
  const f = leerFiltros(); const n = norm(f.texto || '');
  const rows = CLIENTES.filter(c => (!f.tipo || c.tipo === f.tipo) && (!f.estado || c.estado === f.estado) && (!f.deuda || c.deuda > 0) && (!n || norm(c.nombre + ' ' + (c.celular || '') + ' ' + (c.documento_nro || '')).includes(n)));
  $('cli_g').innerHTML = grilla('g_cli', [{ t: 'Nombre', k: 'nombre', f: r => `<b>${esc(r.nombre)}</b>` , xf: r => r.nombre }, { t: 'Tipo', k: 'tipo' }, { t: 'Celular', k: 'celular' }, { t: 'Documento', k: 'documento_nro', f: r => esc([r.documento_tipo, r.documento_nro].filter(Boolean).join(' ')), xf: r => [r.documento_tipo, r.documento_nro].filter(Boolean).join(' ') }, { t: 'Lista', k: 'lista' }, { t: 'Desc.', k: 'descuento_pct', f: r => Number(r.descuento_pct) ? fmtP(r.descuento_pct) : '', xf: r => Number(r.descuento_pct) || '', cls: 'tr' }, { t: 'CP', k: 'codigo_postal' }, { t: 'Límite', k: 'limite_credito', f: 'm', cls: 'tr' }, { t: 'Deuda', k: 'deuda', f: 'm', cls: 'tr', sum: 1 }, { t: 'A favor', k: 'a_favor', f: 'm', cls: 'tr', sum: 1 }, { t: 'Estado', k: 'estado', f: 'e' }], rows,
    { claseFila: r => r.estado !== 'activo' ? 'anulado' : '', acciones: r => `<button class="btn btn-xs btn-s" title="Ver cuenta corriente" onclick="irCtaCli(${r.id})"><i class="fas fa-eye"></i></button><button class="btn btn-xs btn-b" title="Editar" onclick="clienteEditar(${r.id})"><i class="fas fa-pen"></i></button>${r.celular ? `<button class="btn btn-xs btn-wa" title="WhatsApp" onclick="waAbrir('${r.celular}','Hola ${esc(r.nombre).replace(/'/g, '')}!')"><i class="fab fa-whatsapp"></i></button>` : ''}${ES_DUENO ? `<button class="btn btn-xs ${r.estado === 'activo' ? 'btn-d' : 'btn-g'}" title="${r.estado === 'activo' ? 'Dar de baja' : 'Reactivar'}" onclick="clienteEstado(${r.id})"><i class="fas fa-${r.estado === 'activo' ? 'ban' : 'rotate-left'}"></i></button>` : ''}` });
}
function clienteEditar(id, alGuardar) {
  const r = id ? CLIENTES.find(x => x.id === id) : { tipo: 'consumidor', condicion_iva_id: 3 };
  modalForm({ titulo: id ? 'Editar cliente' : 'Nuevo cliente', campos: CAMPOS_CLIENTE, v: r, guardar: async p => {
    if (p.lista_id) p.lista_id = Number(p.lista_id); if (p.condicion_iva_id) p.condicion_iva_id = Number(p.condicion_iva_id);
    const nid = await rpc('guardar_cliente', { p }); toast('Cliente guardado', 'g'); await cargarClientes(true);
    if (alGuardar) alGuardar(CLIENTES.find(c => c.id === nid)); else if (PAG.id === 'clientes') clientesPintar();
  } });
}
async function clienteEstado(id) {
  const r = CLIENTES.find(x => x.id === id); const nuevo = r.estado === 'activo' ? 'inactivo' : 'activo';
  if (!await confirmar(`¿${nuevo === 'activo' ? 'Reactivar' : 'Dar de baja'} a <b>${esc(r.nombre)}</b>? No se borra.`)) return;
  await rpc('guardar_cliente', { p: { ...r, estado: nuevo } }); await cargarClientes(true); clientesPintar();
}

/* ---------- Productos y precios ---------- */
const CAMPOS_PRODUCTO = [
  { k: 'codigo', l: 'Código', req: 1 }, { k: 'nombre', l: 'Nombre', req: 1 },
  { k: 'categoria_id', l: 'Categoría', t: 'sel', op: OPC.categorias, req: 1 },
  { k: 'precio_minorista', l: 'Precio minorista (venta)', t: 'num', dueno: 1, ayuda: 'Precio final que paga el cliente. Lo usan las listas Minorista y Público.' },
  { k: 'precio_mayorista', l: 'Precio mayorista (venta)', t: 'num', dueno: 1, ayuda: 'Precio final que paga el cliente mayorista.' },
  { k: 'precio_lista3', l: 'Precio lista 3 (venta)', t: 'num', dueno: 1, ayuda: 'Opcional, por si usan otra lista. Vacío = el producto no tiene precio en la Lista 3.' },
  { k: 'costo', l: 'Costo del proveedor (uso interno)', t: 'num', dueno: 1, ayuda: 'No cambia los precios de venta: sirve para la ganancia y el valor del stock. Sin IVA si el producto tiene IVA 21 % o 10,5 %; con el IVA incluido si tiene IVA 0 %.' },
  { k: 'alicuota_iva_id', l: 'IVA', t: 'sel', op: OPC.alicuotas, vacio: false, def: 1 },
  { k: 'unidad_id', l: 'Unidad de venta', t: 'sel', op: OPC.unidades, vacio: false, def: 1 },
  { k: 'bulto', l: 'Unidades por bulto', t: 'num' },
  { k: 'proveedor_principal_id', l: 'Proveedor principal', t: 'proveedor', labelK: 'proveedor' },
  { k: 'stock_minimo', l: 'Stock mínimo (aviso)', t: 'num', def: 0 },
  { k: 'codigo_barras', l: 'Código de barras' },
  { k: 'uso', l: 'Uso', t: 'sel', op: [['libre', 'Venta libre'], ['profesional', 'Uso profesional']], vacio: false },
  { k: 'edad_minima', l: 'Edad mínima', t: 'num' },
  { k: 'descripcion', l: 'Descripción (catálogo)', t: 'area', ancho: 1 },
  { k: 'video_url', l: 'Video (link de YouTube)', ph: 'https://www.youtube.com/watch?v=…', ancho: 1, ayuda: 'Opcional. En el catálogo aparece el botón “Ver más” con el video.' },
  { k: 'info_adicional', l: 'Información adicional (catálogo)', t: 'area', ancho: 1, ayuda: 'Opcional. Se ve en el catálogo al tocar “Ver más”: efectos, duración, recomendaciones, etc.' },
  { k: 'controla_stock', l: 'Controla stock', t: 'bool', def: true }, { k: 'controla_vencimiento', l: 'Pide lote y vencimiento al comprar', t: 'bool' },
  { k: 'es_nuevo', l: 'Marcar como NUEVO', t: 'bool' }, { k: 'destacado', l: 'Destacado en el catálogo', t: 'bool' },
  { k: 'es_outlet', l: 'Outlet', t: 'bool' }, { k: 'envio_por_correo', l: 'Se puede enviar por correo', t: 'bool' },
  { k: 'fotos', l: 'Fotos', t: 'fotos', dueno: 1, ayuda: 'Tocá “Subir fotos” para elegirlas del celular o la computadora (o sacarlas con la cámara). La primera es la que se ve en el catálogo: usá la estrella para elegirla. Se guardan al tocar Guardar.' }];

/* ---------- Fotos del producto: se achican en el navegador y se guardan en Supabase ---------- */
async function fotoComprimir(file, max = 1200) {
  const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('No se pudo leer la imagen ' + (file.name || ''))); i.src = URL.createObjectURL(file); });
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  let b = await new Promise(r => c.toBlob(r, 'image/webp', 0.82));
  if (!b || b.type !== 'image/webp') b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  return b;
}
async function fotoSubir(productoId, blob) {
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const ruta = `p/${productoId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await sb.storage.from('productos').upload(ruta, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' });
  if (error) throw new Error('No se pudo subir la foto: ' + error.message);
  return sb.storage.from('productos').getPublicUrl(ruta).data.publicUrl;
}
function fotosWidget(cont, urls) {
  const W = { items: (urls || []).map(u => ({ url: u })) };
  const pintar = () => {
    cont.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start">${W.items.map((f, i) => `<div style="width:104px;border:2px solid ${i === 0 ? 'var(--rojo)' : '#d6c9c3'};border-radius:8px;overflow:hidden;background:#fff">
        <img src="${esc(f.url || f.prev)}" style="display:block;width:100%;height:96px;object-fit:cover">
        <div style="display:flex;justify-content:space-between;padding:3px">${i === 0 ? '<span class="badge br" title="Foto principal">principal</span>' : `<button type="button" class="btn btn-xs btn-y" data-a="pri" data-i="${i}" title="Hacer principal"><i class="fas fa-star"></i></button>`}<button type="button" class="btn btn-xs btn-d" data-a="del" data-i="${i}" title="Quitar"><i class="fas fa-times"></i></button></div>
        ${f.file ? '<div class="ss" style="text-align:center;padding-bottom:3px">nueva</div>' : ''}</div>`).join('')}
      <label class="btn btn-s" style="height:96px;width:104px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;text-align:center"><i class="fas fa-camera" style="font-size:20px"></i>Subir fotos<input type="file" accept="image/*" multiple hidden></label></div>`;
    cont.querySelector('input[type=file]').onchange = e => { for (const f of e.target.files) { if (!f.type.startsWith('image/')) continue; W.items.push({ file: f, prev: URL.createObjectURL(f) }); } pintar(); };
    cont.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const i = Number(b.dataset.i); if (b.dataset.a === 'del') W.items.splice(i, 1); else W.items.unshift(W.items.splice(i, 1)[0]); pintar(); });
  };
  W.cambio = () => JSON.stringify(W.items.map(f => f.url || 'nuevo')) !== JSON.stringify(urls || []);
  W.urls = async productoId => { const out = []; let n = 0; const nuevas = W.items.filter(f => f.file).length;
    for (const f of W.items) { if (f.url) { out.push(f.url); continue; } n++; toast(`Subiendo foto ${n} de ${nuevas}…`, 'b', 2500); out.push(await fotoSubir(productoId, await fotoComprimir(f.file))); }
    return out; };
  pintar(); return W;
}
PAGINAS.productos = async () => {
  pagina({ titulo: 'Productos y precios', icono: 'box-open', sub: 'Catálogo, stock y precios por lista',
    botones: btnExcel(`exportarExcel('g_prod','Lista de precios')`) + btnPdf(`exportarPdf('g_prod','Lista de precios','',true)`) + (ES_DUENO ? `<button class="btn btn-w" onclick="preciosCambiar()"><i class="fas fa-percent"></i> Cambiar precios</button><button class="btn btn-s" onclick="stockControlMasivo()"><i class="fas fa-boxes-stacked"></i> Control de stock</button><button class="btn btn-s" onclick="ivaMasivo()"><i class="fas fa-receipt"></i> IVA</button>` + btnNuevo('productoEditar()') : ''),
    cuerpo: `<div class="grid-4 mb3" id="prod_k"></div><div class="panel">${barraFiltros([{ k: 'texto', t: 'texto', ph: 'Código o nombre' }, { k: 'cat', t: 'sel', l: 'Categoría', op: OPC.categorias() }, { k: 'estado', t: 'sel', l: 'Estado', op: OPC.estado2, v: 'activo' }, { k: 'bajo', t: 'chk', l: 'Bajo mínimo' }, { k: 'sinstock', t: 'chk', l: 'Sin stock' }], productosPintar)}<div id="prod_g"></div></div>` });
  PAG.prods = await rpc('abm_listar', { p_tabla: 'productos' }); productosPintar();
};
function productosPintar() {
  const f = leerFiltros(); const n = norm(f.texto || '');
  const rows = PAG.prods.filter(p => (!f.cat || p.categoria_id === Number(f.cat)) && (!f.estado || p.estado === f.estado) && (!f.bajo || (p.controla_stock && p.stock <= p.stock_minimo && p.stock_minimo > 0)) && (!f.sinstock || (p.controla_stock && p.disponible <= 0)) && (!n || norm(p.codigo + ' ' + p.nombre).includes(n)))
    .map(p => ({ ...p, pub: p.precios?.PUBLICO?.final, may: p.precios?.MAYORISTA?.final, min: p.precios?.MINORISTA?.final, l3: p.precios?.LISTA3?.final }));
  const act = PAG.prods.filter(p => p.estado === 'activo');
  $('prod_k').innerHTML = kpi('Productos activos', act.length) + kpi('Sin stock', act.filter(p => p.controla_stock && p.disponible <= 0).length, '', 'r') + kpi('Bajo mínimo', act.filter(p => p.controla_stock && p.stock_minimo > 0 && p.stock <= p.stock_minimo).length, '', 'w')
    + (ES_DUENO ? kpi('Stock valorizado (costo)', fmt(act.reduce((s, p) => s + Math.max(0, p.stock) * Number(p.costo_promedio || 0), 0)), '', 'b') : kpi('Sin precio minorista', act.filter(p => p.precio_minorista == null).length));
  const cols = [{ t: '', k: 'foto', f: r => r.fotos && r.fotos[0] ? `<img src="${esc(r.fotos[0])}" style="width:34px;height:34px;object-fit:cover;border-radius:5px" loading="lazy">` : '', x: false }, { t: 'Código', k: 'codigo' }, { t: 'Producto', k: 'nombre', f: r => `<b>${esc(r.nombre)}</b>${r.es_nuevo ? ' <span class="badge ba">nuevo</span>' : ''}${r.destacado ? ' <span class="badge br">dest.</span>' : ''}`, xf: r => r.nombre }, { t: 'Categoría', k: 'categoria' },
    { t: 'Stock', k: 'stock', f: r => r.controla_stock ? `<span class="${r.stock <= 0 ? 'td' : r.stock <= r.stock_minimo ? 'tw2' : ''}">${fmtN(r.stock)}</span>` : '—', xf: r => r.controla_stock ? Number(r.stock) : '', cls: 'tr' },
    { t: 'Disponible', k: 'disponible', f: r => r.controla_stock ? fmtN(r.disponible) : '—', xf: r => r.controla_stock ? Number(r.disponible) : '', cls: 'tr' }];
  if (ES_DUENO) cols.push({ t: 'Costo (interno)', k: 'costo', f: 'm', cls: 'tr' });
  cols.push({ t: 'Minorista', k: 'min', f: r => r.min == null ? '<span class="td">sin precio</span>' : fmt(r.min), xf: r => r.min ?? '', cls: 'tr' }, { t: 'Mayorista', k: 'may', f: r => r.may == null ? '<span class="td">sin precio</span>' : fmt(r.may), xf: r => r.may ?? '', cls: 'tr' }, { t: 'Lista 3', k: 'l3', f: r => r.l3 == null ? '—' : fmt(r.l3), xf: r => r.l3 ?? '', cls: 'tr' }, { t: 'Estado', k: 'estado', f: 'e' });
  $('prod_g').innerHTML = grilla('g_prod', cols, rows, { claseFila: r => r.estado !== 'activo' ? 'anulado' : '',
    acciones: r => `<button class="btn btn-xs btn-s" title="Ver" onclick="productoVer(${r.id})"><i class="fas fa-eye"></i></button>` + (ES_DUENO ? `<button class="btn btn-xs btn-b" title="Editar" onclick="productoEditar(${r.id})"><i class="fas fa-pen"></i></button><button class="btn btn-xs ${r.estado === 'activo' ? 'btn-d' : 'btn-g'}" title="${r.estado === 'activo' ? 'Dar de baja' : 'Reactivar'}" onclick="productoEstado(${r.id})"><i class="fas fa-${r.estado === 'activo' ? 'ban' : 'rotate-left'}"></i></button>` : '') });
}
function productoEditar(id) {
  const r0 = id ? PAG.prods.find(x => x.id === id) : { controla_stock: true, uso: 'libre' };
  const r = { ...r0 }; let W = null;
  const o = modalForm({ titulo: id ? 'Editar producto' : 'Nuevo producto', campos: CAMPOS_PRODUCTO, v: r, cls: 'md-xl', guardar: async p => {
    ['categoria_id', 'alicuota_iva_id', 'unidad_id'].forEach(k => { if (p[k] != null) p[k] = Number(p[k]); });
    if (!id && p.precio_minorista == null && p.precio_mayorista == null) throw new Error('Cargá al menos el precio minorista o el mayorista: sin precio el producto no se puede vender.');
    if (p.video_url && !/^https:\/\//i.test(p.video_url)) throw new Error('El link del video tiene que empezar con https://');
    const nid = await rpc('guardar_producto', { p });
    if (W && W.cambio()) { const urls = await W.urls(nid); await rpc('guardar_fotos_producto', { p_producto: nid, p_urls: urls }); }
    toast('Producto guardado. Precios recalculados.', 'g');
    PAG.prods = await rpc('abm_listar', { p_tabla: 'productos' }); productosPintar();
  } });
  const fw = o && o.querySelector('.fotos-w'); if (fw) W = fotosWidget(fw, r0.fotos || []);
}
async function productoEstado(id) {
  const r = PAG.prods.find(x => x.id === id); const nuevo = r.estado === 'activo' ? 'inactivo' : 'activo';
  if (!await confirmar(`¿${nuevo === 'activo' ? 'Reactivar' : 'Dar de baja'} <b>${esc(r.nombre)}</b>? Deja de aparecer en el catálogo y en las ventas. No se borra.`)) return;
  await rpc('guardar_producto', { p: { id, estado: nuevo } }); PAG.prods = await rpc('abm_listar', { p_tabla: 'productos' }); productosPintar();
}
async function productoVer(id) {
  const r = PAG.prods.find(x => x.id === id);
  const mov = await rpc('movimientos_producto', { p_producto: id, p_desde: hoy(-365), p_hasta: hoy() });
  const h = ES_DUENO ? await rpc('producto_historial', { p_producto: id }) : null;
  const precios = Object.entries(r.precios || {}).map(([k, v]) => `<tr><td>${esc((M.listas.find(l => l.codigo === k) || {}).nombre || k)}</td><td class="tr mono">${fmt(v.neto)}</td><td class="tr mono">${fmt(v.final)}</td></tr>`).join('');
  showModal(modalHdr(esc(r.codigo + ' · ' + r.nombre)) + `<div class="mb2">
    <div class="grid-4 mb3">${kpi('Stock', fmtN(r.stock))}${kpi('Disponible', fmtN(r.disponible), 'descontando pedidos abiertos')}${ES_DUENO ? kpi('Costo neto', fmt(r.costo)) + kpi('Costo promedio', fmt(r.costo_promedio)) : ''}</div>
    <div class="panel mb3"><div class="ph"><span class="pt">Precios vigentes</span></div><table><thead><tr><th>Lista</th><th class="tr">Neto</th><th class="tr">Final con IVA</th></tr></thead><tbody>${precios || '<tr><td colspan="3" class="vacio">Sin precio: falta costo o margen de la lista</td></tr>'}</tbody></table></div>
    ${h ? `<div class="panel mb3"><div class="ph"><span class="pt">Historial de costos</span></div>${grilla('g_hc', [{ t: 'Desde', k: 'desde', f: 'dt' }, { t: 'Hasta', k: 'hasta', f: 'dt' }, { t: 'Costo neto', k: 'costo', f: 'm', cls: 'tr' }, { t: 'Origen', k: 'origen' }, { t: 'Proveedor', k: 'proveedor' }], h.costos)}</div>` : ''}
    <div class="panel"><div class="ph"><span class="pt">Movimientos de stock (12 meses)</span><span class="badge ba">Saldo anterior ${fmtN(mov.saldo_anterior)}</span></div>${grilla('g_mv', [{ t: 'Fecha', k: 'fecha', f: 'dt' }, { t: 'Tipo', k: 'tipo' }, { t: 'Documento', k: 'documento' }, { t: 'Cantidad', k: 'cantidad', f: 'n', cls: 'tr' }, { t: 'Saldo', k: 'saldo', f: 'n', cls: 'tr' }], mov.movimientos.slice().reverse())}</div>
  </div><div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-xl');
}

/* ---------- Control de stock: activar o desactivar en muchos productos a la vez ---------- */
function stockControlMasivo() {
  const mid = 'cs' + uid();
  const o = showModal(modalHdr('Control de stock en muchos productos') + `<div class="mb2">
    <div class="alert al-i">Con <b>Controla stock</b> desactivado, el producto se puede vender y pedir aunque el sistema no tenga stock cargado. Se puede volver a activar cuando quieras. No se borra nada.</div>
    <div class="fr4" style="align-items:end"><div class="fg"><label class="fl">Productos</label><select id="${mid}_cat" class="fs"><option value="">Todos</option>${OPC.categorias().map(c => `<option value="${c[0]}">Categoría: ${esc(c[1])}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">Acción</label><select id="${mid}_v" class="fs"><option value="false">Desactivar el control de stock</option><option value="true">Activar el control de stock</option></select></div>
      <div class="fg"><button class="btn btn-b" id="${mid}_ver"><i class="fas fa-eye"></i> Ver cuántos cambian</button></div></div>
    <div id="${mid}_r" class="mt3"></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-lg');
  const datos = aplicar => ({ categoria_id: $(mid + '_cat').value ? Number($(mid + '_cat').value) : null, controla: $(mid + '_v').value === 'true', aplicar });
  const ver = async () => {
    const r = await rpc('productos_controla_stock', { p: datos(false) }); const act = datos(false).controla;
    if (!r.cambian) { $(mid + '_r').innerHTML = `<div class="alert al-g">No hay productos para cambiar: ya tienen el control de stock ${act ? 'activado' : 'desactivado'}.</div>`; return; }
    $(mid + '_r').innerHTML = `<div class="alert al-w">Se va a <b>${act ? 'activar' : 'desactivar'}</b> el control de stock en <b>${fmtN(r.cambian)}</b> producto${r.cambian > 1 ? 's' : ''}.</div>
      <div style="max-height:260px;overflow:auto">${grilla(mid + 'g', [{ t: 'Código', k: 'codigo' }, { t: 'Producto', k: 'nombre' }, { t: 'Categoría', k: 'categoria' }], r.productos)}</div>
      <button class="btn btn-p mt3" id="${mid}_ok"><i class="fas fa-check"></i> Aplicar a ${fmtN(r.cambian)} producto${r.cambian > 1 ? 's' : ''}</button>`;
    $(mid + '_ok').onclick = async () => {
      if (!await confirmar(`¿${act ? 'Activar' : 'Desactivar'} el control de stock en <b>${fmtN(r.cambian)}</b> productos?`)) return;
      const z = await rpc('productos_controla_stock', { p: datos(true) });
      toast(`Control de stock ${act ? 'activado' : 'desactivado'} en ${fmtN(z.cambian)} productos`, 'g'); o.remove();
      PAG.prods = await rpc('abm_listar', { p_tabla: 'productos' }); productosPintar();
    };
  };
  $(mid + '_ver').onclick = ver; $(mid + '_cat').onchange = () => $(mid + '_r').innerHTML = ''; $(mid + '_v').onchange = () => $(mid + '_r').innerHTML = '';
}

/* ---------- IVA: cambiar la alícuota de muchos productos a la vez ---------- */
function ivaMasivo() {
  const mid = 'iv' + uid();
  const o = showModal(modalHdr('IVA de muchos productos') + `<div class="mb2">
    <div class="alert al-i">Los <b>precios de venta</b> cargados en cada producto son finales: <b>no cambian</b> al cambiar el IVA. Con <b>Ajustar el costo</b> marcado, el costo interno se pasa al IVA nuevo (por ejemplo, de 21 % a 0 %: costo × 1,21, o sea con IVA incluido). El costo anterior queda en el historial.</div>
    <div class="fr4" style="align-items:end"><div class="fg"><label class="fl">Productos</label><select id="${mid}_cat" class="fs"><option value="">Todos</option>${OPC.categorias().map(c => `<option value="${c[0]}">Categoría: ${esc(c[1])}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">IVA nuevo</label><select id="${mid}_al" class="fs">${OPC.alicuotas().map(a => `<option value="${a[0]}">${esc(a[1])}</option>`).join('')}</select></div>
      <div class="fg"><label class="flex aic gap1"><input type="checkbox" id="${mid}_m" checked> Ajustar el costo al IVA nuevo</label></div>
      <div class="fg"><button class="btn btn-b" id="${mid}_ver"><i class="fas fa-eye"></i> Ver cuántos cambian</button></div></div>
    <div id="${mid}_r" class="mt3"></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-xl');
  const al0 = OPC.alicuotas().find(a => /0\s*%|exento/i.test(a[1])); if (al0) $(mid + '_al').value = al0[0];
  const datos = aplicar => ({ categoria_id: $(mid + '_cat').value ? Number($(mid + '_cat').value) : null, alicuota_iva_id: Number($(mid + '_al').value), mantener_final: $(mid + '_m').checked, aplicar });
  const limpiar = () => $(mid + '_r').innerHTML = '';
  $(mid + '_cat').onchange = limpiar; $(mid + '_al').onchange = limpiar; $(mid + '_m').onchange = limpiar;
  $(mid + '_ver').onclick = async () => {
    const d = datos(false); const r = await rpc('productos_iva_masivo', { p: d });
    if (!r.cambian) { $(mid + '_r').innerHTML = `<div class="alert al-g">No hay productos para cambiar: ya tienen ese IVA.</div>`; return; }
    $(mid + '_r').innerHTML = `<div class="alert al-w">Se pasa a <b>IVA ${fmtP(r.iva_nuevo)}</b> en <b>${fmtN(r.cambian)}</b> producto${r.cambian > 1 ? 's' : ''}. Los precios de venta no cambian. ${d.mantener_final ? 'El costo interno se ajusta.' : 'El costo interno queda igual.'}</div>
      <div style="max-height:300px;overflow:auto">${grilla(mid + 'g', [{ t: 'Código', k: 'codigo' }, { t: 'Producto', k: 'nombre' }, { t: 'Categoría', k: 'categoria' }, { t: 'IVA actual', k: 'iva_actual', f: 'p', cls: 'tr' }, { t: 'Costo actual', k: 'costo_actual', f: 'm', cls: 'tr' }, { t: 'Costo nuevo', k: 'costo_nuevo', f: 'm', cls: 'tr' }], r.productos)}</div>
      <button class="btn btn-p mt3" id="${mid}_ok"><i class="fas fa-check"></i> Aplicar a ${fmtN(r.cambian)} producto${r.cambian > 1 ? 's' : ''}</button>`;
    $(mid + '_ok').onclick = async () => {
      if (!await confirmar(`¿Pasar <b>${fmtN(r.cambian)}</b> productos a <b>IVA ${fmtP(r.iva_nuevo)}</b>? Los precios de venta no cambian.`)) return;
      const z = await rpc('productos_iva_masivo', { p: datos(true) });
      toast(`IVA cambiado en ${fmtN(z.cambian)} productos. Precios recalculados.`, 'g'); o.remove();
      PAG.prods = await rpc('abm_listar', { p_tabla: 'productos' }); productosPintar();
    };
  };
}

/* ---------- Cambio de precios: masivo por % o importando una lista de costos (Excel) ---------- */
const CAMPOS_PRECIO = [['precio_minorista', 'Precio minorista'], ['precio_mayorista', 'Precio mayorista'], ['precio_lista3', 'Precio lista 3'], ['costo', 'Costo (uso interno)']];
function preciosCambiar() {
  const mid = 'pc' + uid();
  const o = showModal(modalHdr('Cambiar precios') + `<div class="mb2">
    <div class="alert al-i">Los precios de venta se cargan en cada producto: <b>minorista</b>, <b>mayorista</b> y <b>lista 3</b> (precio final, el que paga el cliente). Acá los cambiás de a muchos. Para un solo producto, editalo con el lápiz. El costo es solo para uso interno: no cambia los precios.</div>
    <div class="flex gap2 mb3" id="${mid}_tabs"><button class="btn btn-p" data-t="pct"><i class="fas fa-percent"></i> Subir o bajar por %</button><button class="btn btn-s" data-t="xls"><i class="fas fa-file-excel"></i> Importar lista de precios (Excel)</button></div>
    <div id="${mid}_c"></div><div id="${mid}_r" class="mt3"></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-xl');
  const varia = (a, n) => a ? (Number(n) / Number(a) - 1) * 100 : null;
  const rojo = v => v != null && Math.abs(v) >= 50;
  const tablaPct = (items, nombre) => { const raros = items.filter(r => rojo(varia(r.actual, r.nuevo))).length;
    return (raros ? `<div class="alert al-r"><b>Revisá antes de aplicar:</b> ${raros} producto${raros > 1 ? 's cambian' : ' cambia'} más de 50 % (en rojo).</div>` : '')
      + grilla(mid + 'g', [{ t: 'Código', k: 'codigo' }, { t: 'Producto', k: 'nombre' }, { t: nombre + ' actual', k: 'actual', f: 'm', cls: 'tr' }, { t: nombre + ' nuevo', k: 'nuevo', f: 'm', cls: 'tr' },
      { t: 'Cambio', k: 'dif', f: r => { const v = varia(r.actual, r.nuevo); return v == null ? '—' : `<span class="${rojo(v) ? 'td' : ''}">${v > 0 ? '+' : ''}${fmtP(v)}</span>`; }, xf: r => varia(r.actual, r.nuevo), cls: 'tr' }], items); };
  const recargar = async () => { o.remove(); PAG.prods = await rpc('abm_listar', { p_tabla: 'productos' }); productosPintar(); };
  const verPct = () => {
    $(mid + '_r').innerHTML = '';
    $(mid + '_c').innerHTML = `<div class="fr4" style="align-items:end"><div class="fg"><label class="fl">Qué cambiar</label><select id="${mid}_campo" class="fs">${CAMPOS_PRECIO.map(c => `<option value="${c[0]}">${c[1]}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">Categoría</label><select id="${mid}_cat" class="fs"><option value="">Todas</option>${OPC.categorias().map(c => `<option value="${c[0]}">${esc(c[1])}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">Proveedor</label><div id="${mid}_pw"></div></div>
      <div class="fg"><label class="fl req">Porcentaje</label><input id="${mid}_pct" type="number" step="0.01" class="fi mono" placeholder="10 sube · -5 baja"></div></div>
      <div class="fr4" style="align-items:end"><div class="fg"><label class="fl">Redondear el precio a</label><select id="${mid}_red" class="fs"><option value="0.01">Sin redondeo (centavos)</option><option value="1">$ 1</option><option value="10">$ 10</option><option value="50">$ 50</option><option value="100">$ 100</option></select></div>
      <div class="fg"><button class="btn btn-b" id="${mid}_ver"><i class="fas fa-eye"></i> Ver cómo quedan</button></div></div>`;
    buscador(mid + '_pw', { tipo: 'proveedor', id: mid + '_prov' });
    $(mid + '_campo').onchange = () => { $(mid + '_red').disabled = $(mid + '_campo').value === 'costo'; $(mid + '_r').innerHTML = ''; };
    const leer = () => ({ campo: $(mid + '_campo').value, pct: numIn(mid + '_pct'), categoria_id: $(mid + '_cat').value || null, proveedor_id: Number($(mid + '_prov').dataset.id || 0) || null, redondeo: Number($(mid + '_red').value) });
    $(mid + '_ver').onclick = async () => {
      const p = leer(); if (!p.pct) return toast('Poné el porcentaje (positivo sube, negativo baja).', 'r');
      const nombre = CAMPOS_PRECIO.find(c => c[0] === p.campo)[1].replace(' (uso interno)', '');
      const fn = p.campo === 'costo' ? 'precios_ajuste_masivo' : 'precios_campo_masivo';
      const r = await rpc(fn, { p: { ...p, aplicar: false } });
      if (!r.cantidad) { $(mid + '_r').innerHTML = `<div class="alert al-w">No hay productos con ${nombre.toLowerCase()} cargado para ese filtro.</div>`; return; }
      $(mid + '_r').innerHTML = `<div class="flex jb aic mb2 fw gap2"><b>${fmtN(r.cantidad)} productos · ${nombre.toLowerCase()} ${p.pct > 0 ? '+' : ''}${fmtP(p.pct)}</b><button class="btn btn-p" id="${mid}_ap"><i class="fas fa-check"></i> Aplicar a los ${fmtN(r.cantidad)} productos</button></div>` + tablaPct(r.items, nombre) + (r.cantidad > r.items.length ? `<div class="ss">Se muestran los primeros ${r.items.length}.</div>` : '');
      $(mid + '_ap').onclick = async () => {
        if (!await confirmar(`¿Cambiar el ${nombre.toLowerCase()} de <b>${fmtN(r.cantidad)}</b> productos en <b>${p.pct > 0 ? '+' : ''}${fmtP(p.pct)}</b>? El historial queda guardado.`)) return;
        const x = await rpc(fn, { p: { ...p, aplicar: true } });
        toast(`Listo: ${fmtN(x.cantidad)} productos actualizados`, 'g', 6000); await recargar();
      };
    };
  };
  const verXls = () => {
    $(mid + '_r').innerHTML = '';
    $(mid + '_c').innerHTML = `<div class="ss mb2">El archivo tiene que tener una columna con el <b>código</b> y las de precios que quieras cambiar: <b>minorista</b>, <b>mayorista</b>, <b>lista 3</b> y/o <b>costo</b>. La primera fila son los títulos. Las celdas vacías no cambian nada. Los códigos que no existen se informan y no se dan de alta.</div>
      <input type="file" id="${mid}_f" accept=".xlsx,.xls,.csv" class="fi"><div id="${mid}_map" class="mt3"></div>`;
    $(mid + '_f').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      let filas;
      try { const csv = /\.csv$/i.test(f.name); const wb = csv ? XLSX.read(await f.text(), { type: 'string', raw: true }) : XLSX.read(await f.arrayBuffer());
        filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }); }
      catch (err) { return toast('No se pudo leer el archivo: ' + err.message, 'r'); }
      filas = filas.filter(r => r.some(c => String(c).trim() !== ''));
      if (filas.length < 2) return toast('El archivo no tiene datos.', 'r');
      const tit = filas[0].map(c => String(c).trim());
      const busca = re => tit.findIndex(t => re.test(norm(t)));
      const col = { codigo: Math.max(0, busca(/cod/)), precio_minorista: busca(/minor/), precio_mayorista: busca(/mayor/), precio_lista3: busca(/lista\s*3/), costo: busca(/costo/) };
      const op = (sel, vacio) => (vacio ? `<option value="-1">(no viene)</option>` : '') + tit.map((t, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(t || 'Columna ' + (i + 1))}</option>`).join('');
      $(mid + '_map').innerHTML = `<div class="fr4" style="align-items:end"><div class="fg"><label class="fl">Código</label><select id="${mid}_k_codigo" class="fs">${op(col.codigo)}</select></div>
        ${CAMPOS_PRECIO.map(c => `<div class="fg"><label class="fl">${c[1]}</label><select id="${mid}_k_${c[0]}" class="fs">${op(col[c[0]], true)}</select></div>`).join('')}</div>
        <div class="flex gap2 aic mt2"><span class="ss">${fmtN(filas.length - 1)} filas en el archivo</span><button class="btn btn-b" id="${mid}_rev"><i class="fas fa-eye"></i> Revisar cambios</button></div>`;
      CAMPOS_PRECIO.forEach(c => { if (col[c[0]] < 0) $(mid + '_k_' + c[0]).value = '-1'; });
      const numero = v => { if (v === '' || v == null) return ''; if (typeof v === 'number') return String(v); let s = String(v).replace(/[$\s]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return s; };
      const items = () => { const ic = Number($(mid + '_k_codigo').value);
        return filas.slice(1).map(r => { const x = { codigo: String(r[ic]).trim() }; CAMPOS_PRECIO.forEach(c => { const k = Number($(mid + '_k_' + c[0]).value); if (k >= 0) x[c[0]] = numero(r[k]); }); return x; }).filter(x => x.codigo); };
      $(mid + '_rev').onclick = async () => {
        if (CAMPOS_PRECIO.every(c => $(mid + '_k_' + c[0]).value === '-1')) return toast('Elegí al menos una columna de precio o costo.', 'r');
        const its = items(); const r = await rpc('importar_precios', { p: { items: its, aplicar: false } });
        const nom = k => CAMPOS_PRECIO.find(c => c[0] === k)[1].replace(' (uso interno)', '');
        const filasCambio = r.cambian.map(x => ({ codigo: x.codigo, nombre: x.nombre, cambios: x.cambios, raro: Object.values(x.cambios).some(c => rojo(varia(c.actual, c.nuevo))) }));
        const raros = filasCambio.filter(x => x.raro).length;
        $(mid + '_r').innerHTML = `<div class="grid-4 mb3">${kpi('Cambian', fmtN(r.cambian.length), 'productos', 'b')}${kpi('Sin cambios', fmtN(r.iguales), 'mismos precios')}${kpi('No encontrados', fmtN(r.no_encontrados.length), 'código inexistente', r.no_encontrados.length ? 'w' : '')}${kpi('Con error', fmtN(r.invalidos.length), 'número inválido o repetido', r.invalidos.length ? 'r' : '')}</div>
          ${r.no_encontrados.length ? `<div class="alert al-w"><b>Códigos que no existen</b> (no se dan de alta): ${r.no_encontrados.slice(0, 60).map(esc).join(', ')}${r.no_encontrados.length > 60 ? '…' : ''}</div>` : ''}
          ${r.invalidos.length ? `<div class="alert al-r"><b>Filas con error</b>: ${r.invalidos.slice(0, 30).map(x => `fila ${x.fila + 1} (${esc(x.codigo)}): ${esc(x.motivo)}`).join(' · ')}</div>` : ''}
          ${raros ? `<div class="alert al-r"><b>Revisá antes de aplicar:</b> ${raros} producto${raros > 1 ? 's cambian' : ' cambia'} más de 50 % (en rojo). Puede ser un error en el archivo, por ejemplo comas o puntos en los números.</div>` : ''}
          ${r.cambian.length ? `<div class="flex jb aic mb2"><b>Productos que cambian</b><button class="btn btn-p" id="${mid}_ap"><i class="fas fa-check"></i> Aplicar ${fmtN(r.cambian.length)} cambios</button></div>`
            + grilla(mid + 'gi', [{ t: 'Código', k: 'codigo' }, { t: 'Producto', k: 'nombre' }, { t: 'Cambios', k: 'cambios', f: x => Object.entries(x.cambios).map(([k, c]) => `<span class="${rojo(varia(c.actual, c.nuevo)) ? 'td' : ''}">${nom(k)}: ${c.actual == null ? '—' : fmt(c.actual)} → <b>${fmt(c.nuevo)}</b></span>`).join('<br>'), xf: x => JSON.stringify(x.cambios) }], filasCambio)
            : '<div class="alert al-i">No hay precios para cambiar.</div>'}`;
        if (r.cambian.length) $(mid + '_ap').onclick = async () => {
          if (!await confirmar(`¿Actualizar los precios de <b>${fmtN(r.cambian.length)}</b> productos? El historial queda guardado.`)) return;
          const x = await rpc('importar_precios', { p: { items: its, aplicar: true } });
          toast(`Listo: ${fmtN(x.cambian.length)} productos actualizados`, 'g', 6000); await recargar();
        };
      };
    };
  };
  o.querySelectorAll(`#${mid}_tabs button`).forEach(b => b.onclick = () => { o.querySelectorAll(`#${mid}_tabs button`).forEach(x => x.className = 'btn ' + (x === b ? 'btn-p' : 'btn-s')); (b.dataset.t === 'pct' ? verPct : verXls)(); });
  verPct();
}

/* ---------- Listas de precios ---------- */
PAGINAS.listas = async () => {
  pagina({ titulo: 'Listas de precios', icono: 'list-ol', sub: 'Cada lista toma el precio de venta cargado en el producto',
    botones: btnExcel(`exportarExcel('g_lis','Listas de precios')`) + btnPdf(`exportarPdf('g_lis','Listas de precios')`) + (ES_DUENO ? btnNuevo('listaEditar()') : ''),
    cuerpo: `<div class="alert al-i">Las listas <b>Mayorista</b>, <b>Minorista</b> (y <b>Público</b>) y <b>Lista 3</b> toman el precio de venta que se carga en cada producto: precio mayorista, precio minorista y precio lista 3. Se cambian en la ficha del producto, con <b>Precios</b> acá, o de a muchos con <b>Cambiar precios</b> en Productos. El costo no cambia los precios. Las listas que crees nuevas se calculan con margen sobre el costo o desde otra lista.</div><div class="panel" id="lis_g"></div>` });
  PAG.listas = await rpc('listado_listas'); listasPintar();
};
const CAMPO_TXT = { precio_minorista: 'Precio minorista del producto', precio_mayorista: 'Precio mayorista del producto', precio_lista3: 'Precio lista 3 del producto' };
function listasPintar() {
  $('lis_g').innerHTML = grilla('g_lis', [{ t: 'Código', k: 'codigo' }, { t: 'Nombre', k: 'nombre' }, { t: 'De dónde sale el precio', k: 'calc', f: r => r.campo_producto ? CAMPO_TXT[r.campo_producto] : r.lista_base_id ? `${esc(r.lista_base)} − ${fmtP(r.descuento_base_pct)}` : (ES_DUENO && r.margen != null ? 'Costo + ' + fmtP(r.margen) : 'Costo + margen'), xf: r => r.campo_producto ? CAMPO_TXT[r.campo_producto] : r.lista_base_id ? `${r.lista_base} - ${r.descuento_base_pct}%` : 'Costo + ' + (r.margen ?? '') + '%' }, ...(ES_DUENO ? [{ t: 'Vigente desde', k: 'margen_desde', f: r => r.lista_base_id ? '' : fmtDT(r.margen_desde), xf: r => r.lista_base_id ? '' : r.margen_desde }] : []), { t: 'Redondeo', k: 'redondeo', f: 'm', cls: 'tr' }, { t: 'Redondea final', k: 'redondeo_sobre_final', f: r => r.redondeo_sobre_final ? 'Sí' : 'No' }, { t: 'Productos con precio', k: 'productos_con_precio', f: 'n', cls: 'tr' }, { t: 'Estado', k: 'estado', f: 'e' }], PAG.listas,
    { acciones: r => ES_DUENO ? `${r.estado === 'activa' ? `<button class="btn btn-xs btn-g" title="Ver y editar precios" onclick="listaPrecios(${r.id})"><i class="fas fa-table-list"></i> Precios</button>` : ''}${r.campo_producto ? '' : `<button class="btn btn-xs btn-s" title="Historial de márgenes" onclick="listaHist(${r.id})"><i class="fas fa-clock-rotate-left"></i></button>`}<button class="btn btn-xs btn-b" title="Editar" onclick="listaEditar(${r.id})"><i class="fas fa-pen"></i></button>${['PUBLICO', 'MAYORISTA', 'MINORISTA'].includes(r.codigo) ? '' : `<button class="btn btn-xs ${r.estado === 'activa' ? 'btn-d' : 'btn-g'}" title="${r.estado === 'activa' ? 'Desactivar' : 'Reactivar'}" onclick="listaEstado(${r.id})"><i class="fas fa-${r.estado === 'activa' ? 'ban' : 'rotate-left'}"></i></button>`}` : '' });
}
async function listaEstado(id) {
  const r = PAG.listas.find(x => x.id === id); const act = r.estado === 'activa';
  if (!await confirmar(act ? `¿Desactivar la lista <b>${esc(r.nombre)}</b>? No se borra: queda con todo su historial y la podés reactivar cuando quieras.` : `¿Reactivar la lista <b>${esc(r.nombre)}</b>? Se recalculan sus precios.`, act ? { peligro: true, ok: 'Desactivar' } : {})) return;
  await rpc('guardar_lista_precio', { p: { id, nombre: r.nombre, estado: act ? 'inactiva' : 'activa' } });
  toast(act ? 'Lista desactivada' : 'Lista reactivada', 'g'); await cargarMaestros(); PAG.listas = await rpc('listado_listas'); listasPintar();
}
function listaEditar(id) {
  const r = id ? PAG.listas.find(x => x.id === id) : { redondeo: 1, estado: 'activa' };
  const fijas = ['PUBLICO', 'MAYORISTA', 'MINORISTA'].includes(r.codigo);
  if (r.campo_producto) return modalForm({ titulo: 'Editar lista', v: r, intro: `<div class="alert al-i">Esta lista toma el <b>${CAMPO_TXT[r.campo_producto].toLowerCase()}</b>. Los precios se cambian en los productos.</div>`,
    campos: [{ k: 'nombre', l: 'Nombre', req: 1 }, ...(fijas ? [] : [{ k: 'estado', l: 'Estado', t: 'sel', op: OPC.estadoA, vacio: false }])],
    guardar: async p => { await rpc('guardar_lista_precio', { p: { id: r.id, nombre: p.nombre, estado: p.estado || r.estado } }); toast('Lista guardada', 'g'); await cargarMaestros(); PAG.listas = await rpc('listado_listas'); listasPintar(); } });
  const bases = () => (PAG.listas || []).filter(l => l.id !== id && !l.lista_base_id && l.estado === 'activa').map(l => [l.id, l.nombre]);
  modalForm({ titulo: id ? 'Editar lista' : 'Nueva lista', v: r, intro: '<div class="alert al-w">Al cambiar el margen o el redondeo se recalculan todos los precios de la lista. El historial queda guardado.</div>',
    campos: [{ k: 'codigo', l: 'Código', req: 1, soloNuevo: 1, ph: 'GREMIO' }, { k: 'nombre', l: 'Nombre', req: 1 },
      { k: 'lista_base_id', l: 'Se calcula desde', t: 'sel', op: bases, vacio: 'El costo, con margen', ayuda: 'Elegí una lista si esta lista es esa lista con un descuento (ej.: Mayorista = Público − 30 %).' },
      { k: 'descuento_base_pct', l: 'Descuento % sobre esa lista', t: 'num', def: 0, ayuda: 'Solo si se calcula desde otra lista.' },
      { k: 'margen', l: 'Margen % sobre el costo', t: 'num', ayuda: 'Solo si se calcula con margen.' }, { k: 'redondeo', l: 'Redondear a múltiplos de $', t: 'num', def: 1, ayuda: 'Con 0,01 no redondea.' },
      { k: 'redondeo_sobre_final', l: 'Redondear el precio final con IVA (consumidor)', t: 'bool' }, ...(fijas ? [] : [{ k: 'estado', l: 'Estado', t: 'sel', op: OPC.estadoA, vacio: false }])],
    guardar: async p => { p.lista_base_id = p.lista_base_id ? Number(p.lista_base_id) : null; if (!p.lista_base_id && p.margen == null) throw new Error('Indicá el margen o elegí la lista desde la que se calcula.'); await rpc('guardar_lista_precio', { p }); toast('Lista guardada y precios recalculados', 'g'); await cargarMaestros(); PAG.listas = await rpc('listado_listas'); listasPintar(); } });
}
function listaHist(id) {
  const r = PAG.listas.find(x => x.id === id);
  showModal(modalHdr('Historial de márgenes · ' + esc(r.nombre)) + `<div class="mb2">${grilla('g_lh', [{ t: 'Margen', k: 'margen', f: 'p', cls: 'tr' }, { t: 'Desde', k: 'desde', f: 'dt' }, { t: 'Hasta', k: 'hasta', f: 'dt' }], r.historial || [])}</div><div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`);
}

/* ---------- Precios de una lista: ver, buscar y poner precio manual ---------- */
async function listaPrecios(id) {
  const d = await rpc('lista_precios_detalle', { p_lista: id }); const L = d.lista;
  PAG.lp = d; PAG.lpId = id;
  const como = L.campo_producto ? CAMPO_TXT[L.campo_producto] : L.lista_base_id ? `${esc(L.lista_base)} − ${fmtP(L.descuento_base_pct)}` : 'Costo + ' + fmtP(L.margen);
  pagina({ titulo: 'Precios · ' + esc(L.nombre), icono: 'table-list', sub: (L.campo_producto ? 'Sale del ' : 'Se calcula: ') + como.charAt(0).toLowerCase() + como.slice(1),
    botones: `<button class="btn btn-s" onclick="ir('listas')"><i class="fas fa-arrow-left"></i> Volver a listas</button>` + btnExcel(`exportarExcel('g_lp','Precios ${esc(L.nombre)}')`),
    cuerpo: L.campo_producto ? `<div class="alert al-i">Tocá el lápiz para cambiar el precio de venta de un producto (precio final, el que paga el cliente). Se guarda en la ficha del producto.</div>
      <div class="panel"><div class="flex gap2 fw aic mb3"><input id="lp_q" class="fi" style="max-width:380px" placeholder="Buscar por código, producto o categoría"><label class="flex aic gap1"><input type="checkbox" id="lp_m"> Solo sin precio</label><span class="ss" id="lp_n"></span></div><div id="lp_g"></div></div>` : `<div class="alert al-i">Tocá el lápiz para poner un <b>precio manual</b>: es el precio final, el que ve el cliente. Queda fijo aunque cambie el costo, hasta que lo vuelvas al cálculo.${L.lista_base_id ? '' : ' Un precio manual en esta lista también cambia las listas que salen de ella (por ejemplo, la Mayorista).'}</div>
      <div class="panel"><div class="flex gap2 fw aic mb3"><input id="lp_q" class="fi" style="max-width:380px" placeholder="Buscar por código, producto o categoría"><label class="flex aic gap1"><input type="checkbox" id="lp_m"> Solo con precio manual</label><span class="ss" id="lp_n"></span></div><div id="lp_g"></div></div>` });
  $('lp_q').oninput = listaPreciosPintar; $('lp_m').onchange = listaPreciosPintar; listaPreciosPintar(); $('lp_q').focus();
}
function listaPreciosPintar() {
  const q = norm($('lp_q').value || ''), solo = $('lp_m').checked;
  if (PAG.lp.lista.campo_producto) {
    const rows = PAG.lp.items.filter(r => (!solo || r.precio == null) && (!q || norm(r.codigo + ' ' + r.producto + ' ' + r.categoria).includes(q)));
    $('lp_n').textContent = rows.length + ' de ' + PAG.lp.items.length + ' productos · ' + PAG.lp.items.filter(r => r.precio == null).length + ' sin precio';
    $('lp_g').innerHTML = grilla('g_lp', [{ t: 'Código', k: 'codigo' }, { t: 'Producto', k: 'producto' }, { t: 'Categoría', k: 'categoria' }, { t: 'Costo (interno)', k: 'costo', f: 'm', cls: 'tr' },
      { t: 'Precio de venta', k: 'precio', f: r => r.precio == null ? '<span class="td">sin precio</span>' : `<b>${fmt(r.precio)}</b>`, xf: r => r.precio ?? '', cls: 'tr' }], rows,
      { acciones: r => `<button class="btn btn-xs btn-s" title="Historial de precios" onclick="listaPrecioHist(${r.producto_id})"><i class="fas fa-clock-rotate-left"></i></button><button class="btn btn-xs btn-b" title="Cambiar el precio" onclick="listaPrecioEditar(${r.producto_id})"><i class="fas fa-pen"></i></button>` });
    return;
  }
  const rows = PAG.lp.items.filter(r => (!solo || r.manual != null) && (!q || norm(r.codigo + ' ' + r.producto + ' ' + r.categoria).includes(q)));
  $('lp_n').textContent = rows.length + ' de ' + PAG.lp.items.length + ' productos · ' + PAG.lp.items.filter(r => r.manual != null).length + ' con precio manual';
  $('lp_g').innerHTML = grilla('g_lp', [{ t: 'Código', k: 'codigo' }, { t: 'Producto', k: 'producto' }, { t: 'Categoría', k: 'categoria' }, { t: 'Costo neto', k: 'costo', f: 'm', cls: 'tr' },
    { t: 'Calculado', k: 'calculado', f: r => r.calculado == null ? '—' : fmt(r.calculado), xf: r => r.calculado ?? '', cls: 'tr' },
    { t: 'Precio manual', k: 'manual', f: r => r.manual == null ? '' : `<b>${fmt(r.manual)}</b>${r.motivo ? `<div class="ss">${esc(r.motivo)}</div>` : ''}`, xf: r => r.manual ?? '', cls: 'tr' },
    { t: 'Precio vigente', k: 'precio', f: r => r.precio == null ? '<span class="td">sin precio</span>' : `<b>${fmt(r.precio)}</b>`, xf: r => r.precio ?? '', cls: 'tr' }], rows,
    { claseFila: r => r.manual != null ? 'fila-manual' : '', acciones: r => `<button class="btn btn-xs btn-s" title="Historial de precios" onclick="listaPrecioHist(${r.producto_id})"><i class="fas fa-clock-rotate-left"></i></button><button class="btn btn-xs btn-b" title="Poner precio manual" onclick="listaPrecioEditar(${r.producto_id})"><i class="fas fa-pen"></i></button>${r.manual != null ? `<button class="btn btn-xs btn-w" title="Volver al precio calculado" onclick="listaPrecioQuitar(${r.producto_id})"><i class="fas fa-rotate-left"></i></button>` : ''}` });
}
async function listaPreciosRecargar() { const q = $('lp_q').value, m = $('lp_m').checked; PAG.lp = await rpc('lista_precios_detalle', { p_lista: PAG.lpId }); $('lp_q').value = q; $('lp_m').checked = m; listaPreciosPintar(); }
function listaPrecioEditar(pid) {
  const r = PAG.lp.items.find(x => x.producto_id === pid); const L = PAG.lp.lista;
  if (L.campo_producto) return modalForm({ titulo: 'Precio de venta · ' + esc(r.codigo) + ' · ' + esc(L.nombre), v: { precio: r.precio }, cls: '',
    intro: `<div class="alert al-i"><b>${esc(r.producto)}</b><br>Se guarda como ${CAMPO_TXT[L.campo_producto].toLowerCase()}.</div>`,
    campos: [{ k: 'precio', l: 'Precio final (el que paga el cliente)', t: 'num', req: 1 }],
    guardar: async p => { if (!(Number(p.precio) > 0)) throw new Error('El precio tiene que ser mayor a cero.');
      await rpc('precio_manual_guardar', { p_producto: pid, p_lista: PAG.lpId, p_precio: Number(p.precio), p_motivo: null }); toast('Precio guardado', 'g'); await listaPreciosRecargar(); } });
  modalForm({ titulo: 'Precio manual · ' + esc(r.codigo) + ' · ' + esc(L.nombre), v: { precio: r.manual ?? r.precio, motivo: r.motivo || '' }, cls: '',
    intro: `<div class="alert al-i"><b>${esc(r.producto)}</b><br>Calculado: <b>${r.calculado == null ? '—' : fmt(r.calculado)}</b> · Vigente: <b>${r.precio == null ? '—' : fmt(r.precio)}</b></div>`,
    campos: [{ k: 'precio', l: 'Precio final (el que ve el cliente)', t: 'num', req: 1 }, ...(L.codigo === 'MINORISTA' ? [] : [{ k: 'motivo', l: 'Motivo (opcional)', ph: 'Ej.: precio de lanzamiento' }])],
    guardar: async p => { if (!(Number(p.precio) > 0)) throw new Error('El precio tiene que ser mayor a cero.');
      await rpc('precio_manual_guardar', { p_producto: pid, p_lista: PAG.lpId, p_precio: Number(p.precio), p_motivo: p.motivo || null }); toast('Precio manual guardado', 'g'); await listaPreciosRecargar(); } });
}
async function listaPrecioHist(pid) {
  const r = PAG.lp.items.find(x => x.producto_id === pid);
  const h = await rpc('lista_precio_historial', { p_lista: PAG.lpId, p_producto: pid });
  showModal(modalHdr('Historial de precios · ' + esc(r.codigo) + ' · ' + esc(PAG.lp.lista.nombre)) + `<div class="mb2"><div class="ss mb2">${esc(r.producto)}</div>${grilla('g_lph', [{ t: 'Desde', k: 'desde', f: 'dt' }, { t: 'Hasta', k: 'hasta', f: r => r.hasta ? fmtDT(r.hasta) : '<span class="badge bg">vigente</span>' }, { t: 'Precio', k: 'precio', f: 'm', cls: 'tr' }, { t: 'Costo neto', k: 'costo', f: 'm', cls: 'tr' }, { t: 'Origen', k: 'manual', f: r => r.manual ? `<b>Manual</b>${r.motivo ? ' · ' + esc(r.motivo) : ''}` : 'Calculado' }], h)}</div><div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-lg');
}
async function listaPrecioQuitar(pid) {
  const r = PAG.lp.items.find(x => x.producto_id === pid);
  if (!await confirmar(`¿Volver <b>${esc(r.producto)}</b> al precio calculado (${r.calculado == null ? '—' : fmt(r.calculado)})? El precio manual queda en el historial.`)) return;
  await rpc('precio_manual_guardar', { p_producto: pid, p_lista: PAG.lpId, p_precio: null, p_motivo: null }); toast('Volvió al precio calculado', 'g'); await listaPreciosRecargar();
}

/* ---------- Ofertas ---------- */
PAGINAS.ofertas = async () => {
  pagina({ titulo: 'Ofertas', icono: 'percent', sub: 'Precio especial por producto y lista entre dos fechas',
    botones: btnExcel(`exportarExcel('g_of','Ofertas')`) + btnPdf(`exportarPdf('g_of','Ofertas')`) + (ES_DUENO ? btnNuevo('ofertaEditar()') : ''),
    cuerpo: `<div class="panel">${barraFiltros([{ k: 'texto', t: 'texto' }, { k: 'estado', t: 'sel', l: 'Estado', op: [['activa', 'Activa'], ['anulada', 'Anulada']], v: 'activa' }], ofertasPintar)}<div id="of_g"></div></div>` });
  PAG.ofs = await rpc('abm_listar', { p_tabla: 'ofertas' }); ofertasPintar();
};
function ofertasPintar() {
  const f = leerFiltros(); const n = norm(f.texto || ''); const ahora = new Date();
  const rows = PAG.ofs.filter(o => (!f.estado || o.estado === f.estado) && (!n || norm(o.producto + o.codigo + o.lista).includes(n)));
  $('of_g').innerHTML = grilla('g_of', [{ t: 'Producto', k: 'producto' }, { t: 'Lista', k: 'lista' }, { t: 'Precio lista (neto)', k: 'precio_lista', f: 'm', cls: 'tr' }, { t: 'Oferta (neto)', k: 'precio_neto_oferta', f: 'm', cls: 'tr' }, { t: 'Desde', k: 'desde', f: 'dt' }, { t: 'Hasta', k: 'hasta', f: 'dt' },
    { t: 'Vigencia', k: 'vig', f: r => r.estado !== 'activa' ? '' : new Date(r.hasta) < ahora ? '<span class="badge bm">terminó</span>' : new Date(r.desde) > ahora ? '<span class="badge bb">programada</span>' : '<span class="badge bg">vigente</span>' }, { t: 'Estado', k: 'estado', f: 'e' }], rows,
    { claseFila: r => r.estado !== 'activa' ? 'anulado' : '', acciones: r => ES_DUENO && r.estado === 'activa' ? `<button class="btn btn-xs btn-b" onclick="ofertaEditar(${r.id})" title="Editar"><i class="fas fa-pen"></i></button><button class="btn btn-xs btn-d" title="Anular" onclick="ofertaAnular(${r.id})"><i class="fas fa-ban"></i></button>` : '' });
}
function ofertaEditar(id) {
  const r = id ? PAG.ofs.find(x => x.id === id) : { desde: hoy() + 'T00:00', hasta: hoy(7) + 'T23:59' };
  const v = { ...r, desde: String(r.desde || '').slice(0, 10), hasta: String(r.hasta || '').slice(0, 10) };
  modalForm({ titulo: id ? 'Editar oferta' : 'Nueva oferta', v, campos: [{ k: 'producto_id', l: 'Producto', t: 'producto', req: 1, labelK: 'producto' }, { k: 'lista_id', l: 'Lista', t: 'sel', op: OPC.listas, req: 1 }, { k: 'precio_neto_oferta', l: 'Precio de oferta NETO (sin IVA)', t: 'num', req: 1, ayuda: 'Para el público el catálogo muestra este precio + IVA.' }, { k: 'desde', l: 'Desde', t: 'date', req: 1 }, { k: 'hasta', l: 'Hasta', t: 'date', req: 1 }],
    guardar: async p => { p.lista_id = Number(p.lista_id); p.desde = p.desde + 'T00:00:00-03:00'; p.hasta = p.hasta + 'T23:59:59-03:00'; await rpc('abm_guardar', { p_tabla: 'ofertas', p }); toast('Oferta guardada', 'g'); PAG.ofs = await rpc('abm_listar', { p_tabla: 'ofertas' }); ofertasPintar(); } });
}
async function ofertaAnular(id) { if (!await confirmar('¿Anular la oferta? Queda registrada como anulada.', { peligro: true, ok: 'Anular' })) return; await rpc('abm_guardar', { p_tabla: 'ofertas', p: { id, estado: 'anulada' } }); PAG.ofs = await rpc('abm_listar', { p_tabla: 'ofertas' }); ofertasPintar(); }

/* ---------- Usuarios ---------- */
PAGINAS.usuarios = async () => {
  pagina({ titulo: 'Usuarios', icono: 'user-shield', sub: 'Quién entra al sistema y con qué permisos', botones: btnNuevo('usuarioEditar()'),
    cuerpo: `<div class="alert al-i"><b>Dueño:</b> ve y hace todo (costos, compras, bancos, anulaciones, notas de crédito). <b>Operador:</b> vende, presupuesta, cobra, maneja caja y gastos de contado; no ve costos ni compras. <b>Mayorista:</b> usuario genérico del catálogo mayorista.</div><div class="panel" id="usr_g"></div>` });
  PAG.usrs = await rpc('usuarios_listar'); usuariosPintar();
};
function usuariosPintar() {
  $('usr_g').innerHTML = grilla('g_usr', [{ t: 'Usuario', k: 'usuario', f: r => `<b>${esc(r.usuario)}</b>${r.es_yo ? ' <span class="badge ba">vos</span>' : ''}` }, { t: 'Nombre', k: 'nombre' }, { t: 'Rol', k: 'rol', f: r => ({ dueno: 'Dueño', operador: 'Operador', mayorista: 'Mayorista' }[r.rol]) }, { t: 'Último ingreso', k: 'ultimo_ingreso', f: 'dt' }, { t: 'Estado', k: 'estado', f: 'e' }], PAG.usrs,
    { claseFila: r => r.estado !== 'activo' ? 'anulado' : '', acciones: r => `<button class="btn btn-xs btn-b" title="Editar / cambiar contraseña" onclick="usuarioEditar('${r.id}')"><i class="fas fa-pen"></i></button>` });
}
function usuarioEditar(id) {
  const r = id ? PAG.usrs.find(x => x.id === id) : { rol: 'operador', estado: 'activo' };
  modalForm({ titulo: id ? 'Editar usuario · ' + esc(r.usuario) : 'Nuevo usuario', v: r, cls: '',
    campos: [{ k: 'usuario', l: 'Usuario (para ingresar)', req: 1, soloNuevo: 1, ayuda: 'Sin espacios. Ej: caja1, maria' }, { k: 'nombre', l: 'Nombre', req: 1 }, { k: 'rol', l: 'Rol', t: 'sel', op: [['dueno', 'Dueño'], ['operador', 'Operador'], ['mayorista', 'Mayorista']], vacio: false },
      { k: 'clave', l: id ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña', req: !id, ayuda: 'Mínimo 8 caracteres. Se guarda encriptada.' }, ...(id ? [{ k: 'estado', l: 'Estado', t: 'sel', op: OPC.estado2, vacio: false }] : [])],
    guardar: async p => { await rpc('usuario_guardar', { p }); toast('Usuario guardado', 'g'); PAG.usrs = await rpc('usuarios_listar'); usuariosPintar(); } });
}

/* ---------- Empresa y contraseña ---------- */
PAGINAS.empresa = async () => {
  const e = (await rpc('abm_listar', { p_tabla: 'config_empresa' }))[0] || {};
  const campos = [{ k: 'razon_social', l: 'Razón social' }, { k: 'nombre_fantasia', l: 'Nombre de fantasía', req: 1 }, { k: 'cuit', l: 'CUIT' }, { k: 'condicion_iva_id', l: 'Condición IVA', t: 'sel', op: OPC.condIva }, { k: 'direccion', l: 'Dirección' }, { k: 'horarios', l: 'Horarios' },
    { k: 'whatsapp_pedidos', l: 'WhatsApp para pedidos', ph: '+5493874749807' }, { k: 'email_pedidos', l: 'Email' }, { k: 'instagram', l: 'Instagram' }, { k: 'facebook', l: 'Facebook' }, { k: 'tiktok', l: 'TikTok' },
    { k: 'plazo_pedido_horas', l: 'Vencimiento de pedidos web (horas)', t: 'num' }, { k: 'minimo_compra_minorista', l: 'Compra mínima con precios minoristas ($)', t: 'num', ayuda: 'Pedido mínimo para comprar desde la pestaña Minorista del catálogo.' }, { k: 'minimo_compra_mayorista', l: 'Compra mínima con precios mayoristas ($)', t: 'num', ayuda: 'Pedido mínimo para comprar desde la pestaña Mayorista del catálogo. 0 = sin mínimo.' }, { k: 'validez_presupuesto_dias', l: 'Validez de presupuestos (días)', t: 'num' }, { k: 'leyenda_precios', l: 'Leyenda de precios (catálogo)', t: 'area', ancho: 1 }];
  pagina({ titulo: 'Datos de la empresa', icono: 'building', sub: 'Aparecen en los PDF y en el catálogo',
    cuerpo: `<div class="panel pb">${formHtml(campos, e, 'emp')}<div class="flex gap2 mt3"><button class="btn btn-p" id="emp_ok"><i class="fas fa-floppy-disk"></i> Guardar</button></div></div>` });
  $('emp_ok').onclick = async () => { let p; try { p = formLeer(campos, {}, 'emp'); } catch (x) { return toast(x.message, 'r'); } if (p.condicion_iva_id) p.condicion_iva_id = Number(p.condicion_iva_id); await rpc('abm_guardar', { p_tabla: 'config_empresa', p }); await cargarMaestros(); toast('Datos guardados', 'g'); };
};
PAGINAS.miclave = async () => {
  pagina({ titulo: 'Mi contraseña', icono: 'key', sub: 'Cambiá tu contraseña de ingreso',
    cuerpo: `<div class="panel pb" style="max-width:460px"><div class="fg"><label class="fl req">Contraseña actual</label><input id="mc_a" type="password" class="fi"></div><div class="fg"><label class="fl req">Nueva contraseña (mínimo 8)</label><input id="mc_n" type="password" class="fi"></div><div class="fg"><label class="fl req">Repetí la nueva</label><input id="mc_r" type="password" class="fi"></div><button class="btn btn-p" id="mc_ok"><i class="fas fa-key"></i> Cambiar</button></div>` });
  $('mc_ok').onclick = async () => { if ($('mc_n').value !== $('mc_r').value) return toast('Las contraseñas nuevas no coinciden.', 'r'); await rpc('cambiar_mi_clave', { p_actual: $('mc_a').value, p_nueva: $('mc_n').value }); toast('Contraseña cambiada', 'g'); ['mc_a', 'mc_n', 'mc_r'].forEach(i => $(i).value = ''); };
};
