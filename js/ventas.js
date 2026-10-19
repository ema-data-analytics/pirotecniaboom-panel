/* Pirotecnia Boom · Inicio, Presupuestos, Ventas, NC/ND, Cobranzas, Cuenta corriente, Pedidos web */
'use strict';

/* ================= INICIO ================= */
PAGINAS.inicio = async () => {
  pagina({ titulo: 'Inicio', icono: 'gauge-high', sub: 'Resumen del día', botones: btnNuevo("ir('ventas');setTimeout(()=>ventaNueva(),300)", 'Nueva venta') + `<button class="btn btn-y" onclick="ir('presupuestos');setTimeout(()=>presupuestoNuevo(),300)"><i class="fas fa-file-signature"></i> Nuevo presupuesto</button>`,
    cuerpo: '<div id="ini"></div>' });
  const r = await rpc('panel_inicio');
  const max = Math.max(1, ...r.ventas_7_dias.map(d => Number(d.total)));
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  $('ini').innerHTML = `
  <div class="grid-4 mb3">${kpi('Ventas de hoy', fmt(r.ventas_hoy), r.ventas_hoy_cant + ' comprobantes', 'r')}${kpi('Ventas del mes', fmt(r.ventas_mes), 'netas de notas de crédito', 'g')}${kpi('Cobrado hoy', fmt(r.cobrado_hoy), 'recibos')}${kpi('Clientes deben', fmt(r.deuda_clientes), 'cuenta corriente', 'w')}</div>
  <div class="grid-4 mb3">${kpi('Caja', r.caja ? 'ABIERTA' : 'CERRADA', r.caja ? 'Efectivo ' + fmt(r.caja.efectivo) : 'Abrila para vender de contado', r.caja ? 'g' : 'r')}${kpi('Pedidos web abiertos', r.pedidos_abiertos, 'esperando confirmación', 'b')}${kpi('Presupuestos pendientes', r.presupuestos_vigentes, r.presupuestos_por_vencer + ' vencen en 2 días', 'w')}${ES_DUENO ? kpi('Debemos a proveedores', fmt(r.deuda_proveedores), '', 'r') : kpi('Bajo stock mínimo', r.bajo_minimo.length, 'productos', 'w')}</div>
  <div class="grid-2">
    <div class="panel"><div class="ph"><span class="pt"><i class="fas fa-chart-column"></i> Ventas últimos 7 días</span></div><div class="pb"><div style="display:flex;align-items:flex-end;gap:10px;height:180px">${r.ventas_7_dias.map(d => { const h = Math.round(Number(d.total) / max * 150); const dt = new Date(d.dia + 'T12:00:00'); return `<div style="flex:1;text-align:center"><div class="mono" style="font-size:10px;color:var(--dim)">${Number(d.total) ? fmt(d.total).replace('$ ', '') : ''}</div><div style="height:${Math.max(h, 2)}px;background:linear-gradient(180deg,var(--amarillo),var(--rojo));border-radius:5px 5px 0 0;margin-top:3px"></div><div style="font-size:11px;margin-top:4px">${dias[dt.getDay()]} ${dt.getDate()}</div></div>`; }).join('')}</div></div></div>
    <div class="panel"><div class="ph"><span class="pt"><i class="fas fa-bell"></i> Avisos</span></div><div class="pb">
      ${!r.caja ? `<div class="alert al-r"><i class="fas fa-cash-register"></i> La caja está cerrada. <a href="#caja" onclick="ir('caja')">Abrir caja</a></div>` : ''}
      ${r.pedidos_abiertos ? `<div class="alert al-i"><i class="fas fa-cart-shopping"></i> Hay ${r.pedidos_abiertos} pedido(s) web para confirmar. <a href="#pedidos" onclick="ir('pedidos')">Ver pedidos</a></div>` : ''}
      ${r.presupuestos_por_vencer ? `<div class="alert al-w"><i class="fas fa-file-signature"></i> ${r.presupuestos_por_vencer} presupuesto(s) vencen en los próximos 2 días. <a href="#presupuestos" onclick="ir('presupuestos')">Ver</a></div>` : ''}
      ${r.cheques_a_vencer.length ? `<div class="alert al-w"><i class="fas fa-money-check"></i> ${r.cheques_a_vencer.length} cheque(s) vencen esta semana: ${r.cheques_a_vencer.map(c => esc(c.banco + ' ' + c.numero) + ' ' + fmt(c.importe) + ' (' + fmtD(c.fecha_pago) + ')').join(', ')}</div>` : ''}
      ${r.bajo_minimo.length ? `<div class="alert al-w"><i class="fas fa-boxes-stacked"></i> Bajo stock mínimo: ${r.bajo_minimo.slice(0, 12).map(p => esc(p.nombre) + ' (' + fmtN(p.stock) + ')').join(', ')}${r.bajo_minimo.length > 12 ? '…' : ''}</div>` : ''}
      ${r.caja && !r.pedidos_abiertos && !r.presupuestos_por_vencer && !r.cheques_a_vencer.length && !r.bajo_minimo.length ? '<div class="alert al-g"><i class="fas fa-check"></i> Todo en orden.</div>' : ''}
    </div></div>
  </div>`;
};

/* ============ EDITOR DE COMPROBANTE (venta en carga / presupuesto) ============ */
// Encabezado primero → se graba → después se agregan las líneas una por una.
const ED = {};
async function editorDoc(modo, id) {
  ED.modo = modo; ED.id = id || null; ED.det = null; ED.lineaEdit = null;
  const esV = modo === 'venta';
  pagina({ titulo: esV ? (id ? 'Venta en carga' : 'Nueva venta') : (id ? 'Presupuesto' : 'Nuevo presupuesto'), icono: esV ? 'receipt' : 'file-signature',
    sub: esV ? 'Paso 1: encabezado · Paso 2: productos · Paso 3: confirmar' : 'Paso 1: encabezado · Paso 2: productos · Paso 3: grabar',
    botones: `<button class="btn btn-s" onclick="ir('${esV ? 'ventas' : 'presupuestos'}')"><i class="fas fa-arrow-left"></i> Volver al listado</button>`,
    cuerpo: `<div class="panel mb3"><div class="ph"><span class="pt"><span class="paso">1</span>Encabezado</span><span id="ed_est"></span></div><div class="pb" id="ed_hdr"></div></div>
      <div class="panel mb3" id="ed_lin_p"><div class="ph"><span class="pt"><span class="paso">2</span>Productos</span><span class="ss" id="ed_lista_txt"></span></div><div class="pb" id="ed_lin"></div></div>
      <div class="flex jb fw gap3"><div class="flex gap2 fw aic" id="ed_acc"></div><div class="tot-box" id="ed_tot"></div></div>` });
  if (id) await editorRecargar(); else editorPintarHdr();
}
async function editorRecargar() {
  ED.det = ED.modo === 'venta' ? await rpc('borrador_detalle', { p_id: ED.id }) : await rpc('presupuesto_detalle', { p_id: ED.id });
  editorPintarHdr(); editorPintarLineas();
}
function editorEditable() { const d = ED.det; if (!d) return true; return d.estado === 'borrador'; }
const EST_PRE = { borrador: 'En carga', enviado: 'Pendiente', aceptado: 'Aceptado', rechazado: 'Rechazado', vencido: 'Vencido' };
function badgePre(e) { return badgeEstado(EST_PRE[e] || e); }
function editorPintarHdr() {
  const d = ED.det || {}; const esV = ED.modo === 'venta'; const ed = editorEditable();
  const bdg = e => esV ? badgeEstado(e) : badgePre(e);
  $('ed_est').innerHTML = d.numero ? `<b class="mono">${esc(d.numero)}</b> ${bdg(d.estado)}` : (d.estado ? bdg(d.estado) : '<span class="badge bw">sin guardar</span>');
  const listas = (M.listas || []).map(l => `<option value="${l.id}" ${l.id === d.lista_id ? 'selected' : ''}>${esc(l.nombre)}</option>`).join('');
  $('ed_hdr').innerHTML = `<div class="fr4">
    <div class="fg" style="grid-column:span 2"><label class="fl req">Cliente</label><div class="flex gap2"><div id="ed_cli_w" class="f1"></div>${ed ? '<button class="btn btn-s" title="Nuevo cliente" onclick="editorClienteNuevo()"><i class="fas fa-user-plus"></i></button>' : ''}</div></div>
    <div class="fg"><label class="fl">Lista de precios</label><select id="ed_lista" class="fs" ${ed ? '' : 'disabled'}><option value="">La del cliente</option>${listas}</select></div>
    ${esV ? `<div class="fg"><label class="fl">Condición</label><select id="ed_cond" class="fs" ${ed ? '' : 'disabled'}><option value="contado" ${d.condicion !== 'cuenta_corriente' ? 'selected' : ''}>Contado</option><option value="cuenta_corriente" ${d.condicion === 'cuenta_corriente' ? 'selected' : ''}>Cuenta corriente</option></select></div>`
          : `<div class="fg"><label class="fl">Válido hasta</label>${d.estado === 'enviado' ? `<div class="flex gap2"><input type="date" id="ed_val" class="fi" min="${hoy()}" value="${d.valido_hasta}"><button class="btn btn-s" title="Cambiar el vencimiento" onclick="presupuestoValidez()"><i class="fas fa-check"></i></button></div>` : `<input type="date" id="ed_val" class="fi" min="${hoy()}" value="${d.valido_hasta || hoy((M.empresa || {}).validez_presupuesto_dias || 2)}" ${ed ? '' : 'disabled'}>`}</div>`}
  </div><div class="fr4">
    <div class="fg"><label class="fl">Descuento general %</label><input id="ed_desc" type="number" step="0.01" min="0" max="99" class="fi mono" value="${d.descuento_pct || 0}" ${ed && ES_DUENO ? '' : 'disabled'} title="${ES_DUENO ? '' : 'Lo autoriza el dueño'}"></div>
    <div class="fg"><label class="fl">Motivo del descuento / precio especial</label><input id="ed_mot" class="fi" value="${esc(d.descuento_motivo || '')}" ${ed ? '' : 'disabled'}></div>
    ${esV ? `<div class="fg"><label class="fl">Recargo (neto)</label><input id="ed_rec" type="number" step="0.01" min="0" class="fi mono" value="${d.recargo_neto || 0}" ${ed ? '' : 'disabled'}></div><div class="fg"><label class="fl">Envío (neto)</label><input id="ed_env" type="number" step="0.01" min="0" class="fi mono" value="${d.envio_neto || 0}" ${ed ? '' : 'disabled'}></div>`
          : `<div class="fg" style="grid-column:span 2"><label class="fl">Nota para el cliente</label><input id="ed_nota" class="fi" value="${esc(d.nota || '')}" ${ed ? '' : 'disabled'}></div>`}
  </div>${esV ? `<div class="fr"><div class="fg"><label class="fl">Nota</label><input id="ed_nota" class="fi" value="${esc(d.nota || '')}" ${ed ? '' : 'disabled'}></div><div class="fg"><label class="fl">N° de factura ARCA (si se emitió aparte)</label><input id="ed_fact" class="fi" value="${esc(d.factura_externa || '')}" ${ed ? '' : 'disabled'}></div></div>` : ''}
  ${ed ? `<button class="btn btn-p" id="ed_hdr_ok"><i class="fas fa-floppy-disk"></i> ${ED.id ? 'Guardar cambios del encabezado' : 'Guardar encabezado y cargar productos'}</button>` : ''}`;
  const cli = d.cliente_id ? { id: d.cliente_id, label: typeof d.cliente === 'object' ? d.cliente.nombre : d.cliente } : null;
  const inp = buscador('ed_cli_w', { tipo: 'cliente', id: 'ed_cli', valor: cli, placeholder: 'Nombre, celular o documento…', onSelect: c => { if (!ED.id) { const s = $('ed_lista'); if (s) s.value = ''; } } });
  if (!ed && inp) inp.disabled = true;
  if (ed) $('ed_hdr_ok').onclick = editorGuardarHdr;
  if (!ED.id) { $('ed_lin_p').style.opacity = .45; $('ed_lin').innerHTML = '<div class="tdim">Guardá el encabezado para empezar a cargar productos.</div>'; $('ed_tot').innerHTML = ''; $('ed_acc').innerHTML = ''; setTimeout(() => $('ed_cli') && $('ed_cli').focus(), 50); }
  else $('ed_lin_p').style.opacity = 1;
}
function editorClienteNuevo() { clienteEditar(null, c => { $('ed_cli').fijar({ id: c.id, label: c.nombre }); }); }
async function editorGuardarHdr() {
  const cli = Number($('ed_cli').dataset.id || 0); if (!cli) return toast('Elegí el cliente.', 'r');
  const p = { id: ED.id, cliente_id: cli, lista_id: $('ed_lista').value ? Number($('ed_lista').value) : null, descuento_pct: numIn('ed_desc') || 0, descuento_motivo: val('ed_mot') || null, nota: val('ed_nota') || null };
  if (ED.modo === 'venta') { p.condicion = $('ed_cond').value; p.recargo_neto = numIn('ed_rec') || 0; p.envio_neto = numIn('ed_env') || 0; p.factura_externa = val('ed_fact') || null; ED.id = await rpc('borrador_guardar', { p }); }
  else { p.valido_hasta = $('ed_val').value || null; ED.id = await rpc('presupuesto_guardar', { p }); }
  history.replaceState(null, '', '#' + (ED.modo === 'venta' ? 'ventas' : 'presupuestos'));
  toast('Encabezado guardado', 'g'); await editorRecargar();
  setTimeout(() => $('ed_prod') && $('ed_prod').focus(), 80);
}
function editorPintarLineas() {
  const d = ED.det; const ed = editorEditable(); const esV = ED.modo === 'venta';
  const items = d.items || [];
  $('ed_lista_txt').textContent = 'Lista: ' + (d.lista || '');
  const fila = ed ? `<div class="fr4 mb3" style="grid-template-columns:3fr 1fr 1fr 1fr auto;align-items:end">
      <div class="fg" style="margin:0"><label class="fl">Producto</label><div id="ed_prod_w"></div></div>
      <div class="fg" style="margin:0"><label class="fl">Cantidad</label><input id="ed_cant" type="number" min="0.001" step="any" class="fi mono" value="1"></div>
      <div class="fg" style="margin:0"><label class="fl">Precio neto unit.</label><input id="ed_pu" type="number" step="0.01" class="fi mono" ${ES_DUENO ? '' : 'disabled'} placeholder="de la lista"></div>
      <div class="fg" style="margin:0"><label class="fl">Desc. línea %</label><input id="ed_dl" type="number" step="0.01" min="0" max="99" class="fi mono" value="0" ${ES_DUENO ? '' : 'disabled'}></div>
      <div><button class="btn btn-p" id="ed_add"><i class="fas fa-plus"></i> <span id="ed_add_t">Agregar</span></button></div></div><div id="ed_prod_info" class="ss mb3"></div>` : '';
  $('ed_lin').innerHTML = fila + grilla('g_ed', [{ t: 'Código', k: 'codigo' }, { t: 'Producto', k: 'producto' }, { t: 'Cant.', k: 'cantidad', f: 'n', cls: 'tr' },
    { t: 'Precio unit. neto', k: 'precio_neto_unit', f: r => fmt(r.precio_neto_unit) + (r.precio_manual ? ' <span class="badge bw">especial</span>' : ''), cls: 'tr' },
    { t: 'Precio unit. final', k: 'pf', f: r => fmt(Number(r.precio_neto_unit) * (1 + Number(r.iva_pct) / 100)), cls: 'tr' },
    { t: 'Desc.', k: 'descuento_pct', f: r => Number(r.descuento_pct) ? fmtP(r.descuento_pct) : '', cls: 'tr' },
    { t: 'Total final', k: 'tf', f: r => fmt(Number(r.cantidad) * Number(r.precio_neto_unit) * (1 - Number(r.descuento_pct) / 100) * (1 + Number(r.iva_pct) / 100)), cls: 'tr' }], items,
    { vacio: 'Todavía no hay productos', acciones: ed ? (r => `<button class="btn btn-xs btn-b" title="Modificar" onclick="editorEditarLinea(${r.id})"><i class="fas fa-pen"></i></button><button class="btn btn-xs btn-d" title="Quitar" onclick="editorQuitarLinea(${r.id})"><i class="fas fa-trash"></i></button>`) : null });
  if (ed) {
    buscador('ed_prod_w', { tipo: 'producto', id: 'ed_prod', lista: () => d.lista_id, placeholder: 'Código, nombre o categoría…', onSelect: p => {
      $('ed_prod_info').innerHTML = `Precio lista: neto <b>${p.precio_neto != null ? fmt(p.precio_neto) : 'sin precio'}</b> · final <b>${p.precio_final != null ? fmt(p.precio_final) : '—'}</b>${p.controla_stock ? ' · disponible <b>' + fmtN(p.disponible) + '</b>' : ''}`;
      if ($('ed_pu') && !ED.lineaEdit) $('ed_pu').value = ''; $('ed_cant').focus(); $('ed_cant').select(); } });
    $('ed_add').onclick = editorAgregarLinea;
    $('ed_cant').onkeydown = e => { if (e.key === 'Enter') editorAgregarLinea(); };
  }
  // totales
  let t;
  if (esV) { t = d.totales || {}; if (t.error) { $('ed_tot').innerHTML = `<div class="alert al-r">${esc(t.error)}</div>`; } }
  else t = d;
  if (!t || !t.error) $('ed_tot').innerHTML = `<div class="row"><span>Subtotal neto</span><b class="mono">${fmt(t.subtotal_neto)}</b></div>${Number(t.descuento_neto) ? `<div class="row"><span>Descuentos</span><b class="mono">- ${fmt(t.descuento_neto)}</b></div>` : ''}${Number(t.recargo_neto) ? `<div class="row"><span>Recargo</span><b class="mono">${fmt(t.recargo_neto)}</b></div>` : ''}${Number(t.envio_neto) ? `<div class="row"><span>Envío</span><b class="mono">${fmt(t.envio_neto)}</b></div>` : ''}<div class="row"><span>IVA</span><b class="mono">${fmt(t.iva)}</b></div><div class="row big"><span>TOTAL</span><span class="mono">${fmt(t.total)}</span></div>`;
  ED.total = Number(t.total || 0);
  // acciones
  let acc = '';
  if (esV) {
    if (d.estado === 'borrador') acc = `<button class="btn btn-p btn-xl" onclick="ventaConfirmar()" ${items.length ? '' : 'disabled'}><i class="fas fa-check"></i> Confirmar venta</button><button class="btn btn-d" onclick="ventaDescartar(${d.id})"><i class="fas fa-trash"></i> Descartar</button>`;
    else if (d.comprobante_id) acc = `<button class="btn btn-b" onclick="verComprobante(${d.comprobante_id})"><i class="fas fa-eye"></i> Ver comprobante emitido</button>`;
  } else {
    const ok = items.length > 0;
    if (d.estado === 'borrador') acc = `<button class="btn btn-p btn-xl" onclick="presupuestoGrabar(${d.id})" ${ok ? '' : 'disabled'}><i class="fas fa-floppy-disk"></i> Grabar presupuesto</button><span class="ss">${ok ? 'Al grabarlo queda pendiente: lo mandás al cliente y, cuando confirma, lo convertís en venta.' : 'Cargá al menos un producto para grabarlo.'}</span>`;
    else {
      acc = `<button class="btn btn-pdf" onclick="presupuestoPdf(${d.id})"><i class="fas fa-file-pdf"></i> PDF</button>`;
      if (d.estado === 'enviado') acc += `<button class="btn btn-wa" onclick="presupuestoWa(${d.id})"><i class="fab fa-whatsapp"></i> Enviar por WhatsApp</button><button class="btn btn-p btn-xl" onclick="presupuestoConvertir(${d.id})"><i class="fas fa-cash-register"></i> Cliente confirmó: convertir en venta</button><button class="btn btn-d" onclick="presupuestoRechazar(${d.id})"><i class="fas fa-ban"></i> Rechazado</button>`;
      acc += `<button class="btn btn-s" onclick="presupuestoDuplicar(${d.id})"><i class="fas fa-copy"></i> Duplicar</button>`;
    }
    if (d.venta) acc += `<button class="btn btn-b" onclick="verComprobante(${d.venta.id})"><i class="fas fa-eye"></i> Ver venta ${esc(d.venta.numero)}</button>`;
  }
  $('ed_acc').innerHTML = acc;
}
async function editorAgregarLinea() {
  const pid = Number($('ed_prod').dataset.id || 0); if (!pid) return toast('Elegí un producto.', 'r');
  const cant = numIn('ed_cant'); if (!cant || cant <= 0) return toast('Cantidad inválida.', 'r');
  const p = { id: ED.lineaEdit, producto_id: pid, cantidad: cant, precio_neto_unit: ES_DUENO && $('ed_pu').value !== '' ? numIn('ed_pu') : null, descuento_pct: ES_DUENO ? (numIn('ed_dl') || 0) : 0 };
  if (ED.modo === 'venta') { p.borrador_id = ED.id; await rpc('borrador_item_guardar', { p }); } else { p.presupuesto_id = ED.id; await rpc('presupuesto_item_guardar', { p }); }
  ED.lineaEdit = null; await editorRecargar(); setTimeout(() => $('ed_prod') && $('ed_prod').focus(), 50);
}
function editorEditarLinea(id) {
  const r = ED.det.items.find(x => x.id === id); ED.lineaEdit = id;
  $('ed_prod').fijar({ id: r.producto_id, label: r.codigo + ' · ' + r.producto }); $('ed_cant').value = r.cantidad;
  if (ES_DUENO) { $('ed_pu').value = r.precio_manual ? r.precio_neto_unit : ''; $('ed_dl').value = r.descuento_pct; }
  $('ed_add_t').textContent = 'Guardar línea'; $('ed_cant').focus();
}
async function editorQuitarLinea(id) {
  if (ED.modo === 'venta') await rpc('borrador_item_quitar', { p_item: id }); else await rpc('presupuesto_item_quitar', { p_item: id });
  await editorRecargar();
}

/* ================= VENTAS ================= */
PAGINAS.ventas = async () => {
  pagina({ titulo: 'Ventas y notas', icono: 'receipt', sub: 'Ventas, notas de crédito y notas de débito',
    botones: btnExcel(`exportarExcel('g_vta','Ventas')`) + btnPdf(`exportarPdf('g_vta','Listado de ventas',filtrosTexto())`) + (ES_DUENO ? `<button class="btn btn-w" onclick="ndNueva()"><i class="fas fa-file-circle-plus"></i> Nota de débito</button>` : '') + btnNuevo('ventaNueva()', 'Nueva venta'),
    cuerpo: `<div id="vta_bor"></div><div class="grid-4 mb3" id="vta_k"></div><div class="panel">${barraFiltros([{ k: 'desde', t: 'desde', v: hoy(-30) }, { k: 'hasta', t: 'hasta', v: hoy() }, { k: 'cliente_id', t: 'cliente', l: 'Cliente' }, { k: 'tipo', t: 'sel', l: 'Tipo', op: [['VTA', 'Venta'], ['NC', 'Nota de crédito'], ['ND', 'Nota de débito']] }, { k: 'condicion', t: 'sel', l: 'Condición', op: [['contado', 'Contado'], ['cuenta_corriente', 'Cuenta corriente']] }, { k: 'solo_pendientes', t: 'chk', l: 'Solo con saldo' }, { k: 'texto', t: 'texto', ph: 'N°, cliente, factura' }], ventasCargar)}<div id="vta_g"></div></div>` });
  await Promise.all([ventasCargar(), ventasBorradores()]);
};
function filtrosTexto() { const f = leerFiltros(); return 'Período: ' + fmtD(f.desde) + ' al ' + fmtD(f.hasta); }
async function ventasBorradores() {
  const b = await rpc('listado_borradores');
  $('vta_bor').innerHTML = b.length ? `<div class="panel mb3"><div class="ph"><span class="pt"><i class="fas fa-hourglass-half"></i> Ventas en carga (sin confirmar)</span><span class="badge bw">${b.length}</span></div>${grilla('g_bor', [{ t: 'Inicio', k: 'fecha', f: 'dt' }, { t: 'Cliente', k: 'cliente' }, { t: 'Condición', k: 'condicion' }, { t: 'Líneas', k: 'lineas', f: 'n', cls: 'tr' }], b, { acciones: r => `<button class="btn btn-xs btn-p" onclick="editorDoc('venta',${r.id})"><i class="fas fa-pen"></i> Continuar</button><button class="btn btn-xs btn-d" title="Descartar" onclick="ventaDescartar(${r.id})"><i class="fas fa-trash"></i></button>` })}</div>` : '';
}
async function ventasCargar() {
  const rows = await rpc('listado_ventas', { f: leerFiltros() });
  const s = t => rows.filter(r => r.tipo === t).reduce((a, r) => a + Number(r.total), 0);
  $('vta_k').innerHTML = kpi('Ventas', fmt(s('VTA')), rows.filter(r => r.tipo === 'VTA').length + ' comprobantes', 'g') + kpi('Notas de crédito', fmt(s('NC')), '', 'r') + kpi('Notas de débito', fmt(s('ND')), '') + kpi('Saldo pendiente', fmt(rows.reduce((a, r) => a + Number(r.saldo || 0), 0)), 'de estos comprobantes', 'w');
  $('vta_g').innerHTML = grilla('g_vta', [{ t: 'Fecha', k: 'fecha', f: 'dt' }, { t: 'Comprobante', k: 'numero', f: r => `<b class="mono">${esc(r.numero)}</b>`, xf: r => r.numero }, { t: 'Cliente', k: 'cliente' }, { t: 'Condición', k: 'condicion', f: r => r.condicion === 'contado' ? 'Contado' : 'Cta. cte.' }, { t: 'Lista', k: 'lista' }, { t: 'Origen', k: 'origen' },
    { t: 'Total', k: 'total', f: r => `<span class="${r.tipo === 'NC' ? 'td' : ''}">${r.tipo === 'NC' ? '- ' : ''}${fmt(r.total)}</span>`, xf: r => (r.tipo === 'NC' ? -1 : 1) * Number(r.total), cls: 'tr' }, { t: 'Saldo', k: 'saldo', f: 'm', cls: 'tr', sum: 1 }, { t: 'Estado', k: 'estado_pago', f: r => r.estado_pago === '—' ? '' : badgeEstado(r.estado_pago) }], rows,
    { acciones: r => `<button class="btn btn-xs btn-s" title="Ver" onclick="verComprobante(${r.id})"><i class="fas fa-eye"></i></button><button class="btn btn-xs btn-pdf" title="PDF" onclick="pdfComprobante(${r.id})"><i class="fas fa-file-pdf"></i></button>`
      + (Number(r.saldo) > 0 ? `<button class="btn btn-xs btn-g" title="Cobrar" onclick="cobroNuevo(${r.cliente_id},${r.id})"><i class="fas fa-hand-holding-dollar"></i></button>` : '')
      + (ES_DUENO && r.tipo !== 'NC' ? `<button class="btn btn-xs btn-w" title="Nota de crédito" onclick="ncNueva(${r.id})"><i class="fas fa-rotate-left"></i></button>` : '') });
}
async function ventaNueva() { await editorDoc('venta', null); }
async function ventaDescartar(id) {
  const m = await pedirTexto('Descartar venta en carga', 'Motivo', { obligatorio: false, ayuda: 'La venta en carga queda descartada (no se borra). No se emitió ningún comprobante.' });
  if (m === null) return; await rpc('borrador_descartar', { p_id: id, p_motivo: m || 'Descartada' }); toast('Descartada', 'g'); ir('ventas');
}
async function ventaConfirmar() {
  const d = ED.det; const cuando = async res => { toast('Venta ' + res.numero + ' emitida' + (Number(res.vuelto) ? ' · vuelto ' + fmt(res.vuelto) : ''), 'g', 6000); await ir('ventas'); verComprobante(res.comprobante_id); };
  if (d.condicion === 'cuenta_corriente') {
    if (!await confirmar(`¿Emitir la venta en <b>cuenta corriente</b> a ${esc(d.cliente)} por <b>${fmt(ED.total)}</b>?`)) return;
    cuando(await rpc('borrador_confirmar', { p_id: d.id, p: { clave: 'b' + d.id } }));
  } else modalPagos({ total: ED.total, titulo: 'Cobro de la venta · ' + esc(d.cliente), onConfirm: async (pagos, ent) => cuando(await rpc('borrador_confirmar', { p_id: d.id, p: { pagos, efectivo_entregado: ent, clave: 'b' + d.id } })) });
}

/* ----- ver comprobante, PDF ----- */
async function verComprobante(id) {
  const d = await rpc('comprobante_detalle', { p_id: id }); PAG.comp = d;
  const ri = d.discrimina_iva;
  showModal(modalHdr(esc(d.tipo_nombre) + ' · ' + esc(d.numero)) + `<div class="mb2">
    <div class="grid-2 mb3"><div class="kv"><b>Fecha</b><span>${fmtDT(d.fecha)}</span><b>Cliente</b><span>${esc(d.cliente.nombre)}</span><b>Documento</b><span>${esc(d.cliente.documento || '—')}</span><b>Condición IVA</b><span>${esc(d.cliente.condicion_iva || '')}</span></div>
    <div class="kv"><b>Condición</b><span>${d.condicion === 'contado' ? 'Contado' : 'Cuenta corriente'}</span><b>Lista</b><span>${esc(d.lista)}</span>${d.origen ? `<b>Comprobante origen</b><span>${esc(d.origen.numero)}</span>` : ''}${d.pedido ? `<b>Pedido</b><span>${esc(d.pedido)}</span>` : ''}${d.presupuesto ? `<b>Presupuesto</b><span>${esc(d.presupuesto)}</span>` : ''}${d.factura_externa ? `<b>Factura ARCA</b><span>${esc(d.factura_externa)}</span>` : ''}${d.motivo ? `<b>Motivo / nota</b><span>${esc(d.motivo)}</span>` : ''}${d.descuento_motivo ? `<b>Motivo descuento</b><span>${esc(d.descuento_motivo)}</span>` : ''}</div></div>
    ${grilla('g_cd', [{ t: 'Código', k: 'codigo' }, { t: 'Producto', k: 'producto' }, { t: 'Cant.', k: 'cantidad', f: 'n', cls: 'tr' }, { t: ri ? 'P. unit. neto' : 'P. unit. final', k: ri ? 'precio_neto_unit' : 'precio_final_unit', f: 'm', cls: 'tr' }, { t: 'Desc.', k: 'descuento_pct', f: r => Number(r.descuento_pct) ? fmtP(r.descuento_pct) : '', cls: 'tr' }, { t: ri ? 'Neto' : 'Total', k: ri ? 'subtotal_neto' : 'total', f: 'm', cls: 'tr' }, ...(d.tipo === 'VTA' ? [{ t: 'Devuelto', k: 'devuelto', f: r => Number(r.devuelto) ? fmtN(r.devuelto) : '', cls: 'tr' }] : [])], d.items)}
    <div class="flex jb fw gap3 mt3"><div class="f1">${d.pagos.length ? '<div class="pt mb3">Cobros aplicados</div>' + d.pagos.map(p => `<div class="ss">${esc(p.recibo)} · ${fmtD(p.fecha)} · <b>${fmt(p.importe)}</b></div>`).join('') : ''}${d.notas_credito.length ? '<div class="pt mt3">Notas de crédito aplicadas</div>' + d.notas_credito.map(p => `<div class="ss">${esc(p.numero)} · <b>${fmt(p.importe)}</b></div>`).join('') : ''}</div>
    <div class="tot-box"><div class="row"><span>Subtotal neto</span><b class="mono">${fmt(d.subtotal_neto)}</b></div>${Number(d.descuento_neto) ? `<div class="row"><span>Descuentos</span><b class="mono">- ${fmt(d.descuento_neto)}</b></div>` : ''}<div class="row"><span>IVA</span><b class="mono">${fmt(d.iva)}</b></div><div class="row big"><span>TOTAL</span><span class="mono">${fmt(d.total)}</span></div>${d.tipo !== 'NC' ? `<div class="row"><span>Saldo pendiente</span><b class="mono ${Number(d.saldo) > 0 ? 'td' : 'tg'}">${fmt(d.saldo)}</b></div>` : ''}</div></div>
  </div><div class="mf"><button class="btn btn-pdf" onclick="pdfComprobante(${d.id})"><i class="fas fa-file-pdf"></i> PDF</button>${d.cliente.celular ? `<button class="btn btn-wa" onclick="waAbrir('${d.cliente.celular}', 'Hola ${esc(d.cliente.nombre).replace(/'/g, '')}! Te enviamos el detalle de tu compra ${d.numero} por ${fmt(d.total)}. ¡Gracias por elegir Pirotecnia Boom!')"><i class="fab fa-whatsapp"></i> WhatsApp</button>` : ''}
    ${Number(d.saldo) > 0 && d.tipo !== 'NC' ? `<button class="btn btn-g" onclick="closeModal(this);cobroNuevo(${d.cliente.id},${d.id})"><i class="fas fa-hand-holding-dollar"></i> Cobrar</button>` : ''}${ES_DUENO && d.tipo !== 'NC' ? `<button class="btn btn-w" onclick="closeModal(this);ncNueva(${d.id})"><i class="fas fa-rotate-left"></i> Nota de crédito</button>` : ''}<button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-xl');
}
async function pdfComprobante(id) {
  const d = await rpc('comprobante_detalle', { p_id: id }); const ri = d.discrimina_iva;
  const doc = pdfDocumento({ titulo: d.tipo_nombre.toUpperCase(), numero: d.numero, fecha: fmtD(d.fecha), sub: 'Comprobante interno · no válido como factura',
    receptor: { titulo: 'Cliente', lineas: [d.cliente.nombre, d.cliente.documento, d.cliente.condicion_iva, d.cliente.direccion, d.cliente.celular] },
    extra: { titulo: 'Condiciones', lineas: [d.condicion === 'contado' ? 'Contado' : 'Cuenta corriente', 'Lista: ' + d.lista, d.origen ? 'Origen: ' + d.origen.numero : '', d.factura_externa ? 'Factura ARCA: ' + d.factura_externa : '', d.pedido ? 'Pedido: ' + d.pedido : '', d.presupuesto ? 'Presupuesto: ' + d.presupuesto : ''] },
    cols: ['Código', 'Producto', 'Cant.', ri ? 'P. unit. neto' : 'P. unit.', 'Desc.', ri ? 'Neto' : 'Importe'],
    filas: d.items.map(i => [i.codigo || '', i.producto, fmtN(i.cantidad), fmt(ri ? i.precio_neto_unit : i.precio_final_unit), Number(i.descuento_pct) ? fmtP(i.descuento_pct) : '', fmt(ri ? i.subtotal_neto : i.total)]),
    colStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    totales: ri ? [['Subtotal neto', fmt(Number(d.subtotal_neto) - Number(d.descuento_neto) + Number(d.recargo_neto) + Number(d.envio_neto))], ['IVA', fmt(d.iva)], ['TOTAL', fmt(d.total), 1]] : [...(Number(d.descuento_neto) ? [['Descuentos (incluidos)', '- ' + fmt(Number(d.descuento_neto) * 1.21)]] : []), ['TOTAL', fmt(d.total), 1]],
    notas: [d.motivo ? 'Motivo / nota: ' + d.motivo : '', ri ? '' : 'Precios con IVA incluido.', d.tipo !== 'NC' && Number(d.saldo) > 0 ? 'Saldo pendiente: ' + fmt(d.saldo) : ''].filter(Boolean).join('\n') });
  pdfSave(doc, d.numero.replace(/\s+/g, '_'));
}

/* ----- Nota de crédito / débito ----- */
async function ncNueva(origenId) {
  const d = await rpc('comprobante_detalle', { p_id: origenId }); const mid = 'nc' + uid();
  const its = d.items.filter(i => Number(i.cantidad) - Number(i.devuelto) > 0);
  const o = showModal(modalHdr('Nota de crédito sobre ' + esc(d.numero) + ' · ' + esc(d.cliente.nombre)) + `<div class="mb2">
    <div class="alert al-i">La venta no se modifica ni se anula: la nota de crédito la revierte total o parcialmente. Primero cancela el saldo de esa venta.</div>
    <div class="tabs" style="margin:-4px 0 10px;border-radius:6px"><span class="tab active" data-t="prod">Por productos</span><span class="tab" data-t="imp">Por importe (bonificación)</span></div>
    <div id="${mid}_prod">${grilla('g_nc', [{ t: 'Producto', k: 'producto' }, { t: 'Vendido', k: 'cantidad', f: 'n', cls: 'tr' }, { t: 'Ya acreditado', k: 'devuelto', f: 'n', cls: 'tr' }, { t: 'Importe unit.', k: 'u', f: r => fmt(Number(r.total) / Number(r.cantidad)), cls: 'tr' }, { t: 'A acreditar', k: 'x', f: r => `<input type="number" min="0" max="${Number(r.cantidad) - Number(r.devuelto)}" step="any" class="fi mono nc-q" data-id="${r.id}" data-u="${Number(r.total) / Number(r.cantidad)}" style="width:90px" value="0">` }], its, { vacio: 'No queda nada por acreditar en este comprobante.' })}
      <div class="flex jb aic mt3"><label class="chk"><input type="checkbox" id="${mid}_dev" checked> Vuelve la mercadería al stock</label><button class="btn btn-s btn-sm" id="${mid}_todo">Acreditar todo</button></div></div>
    <div id="${mid}_imp" class="hidden"><div class="fr"><div class="fg"><label class="fl">Importe NETO a acreditar (sin IVA)</label><input id="${mid}_neto" type="number" step="0.01" min="0" class="fi mono"></div><div class="fg"><label class="fl">Total con IVA 21%</label><input id="${mid}_netof" class="fi mono" readonly></div></div></div>
    <div class="fr mt3"><div class="fg"><label class="fl req">Motivo</label><input id="${mid}_mot" class="fi" placeholder="Ej: devolución por falla"></div>
    <div class="fg"><label class="fl">Lo que sobre después de cancelar la venta</label><select id="${mid}_rei" class="fs"><option value="">Queda a favor del cliente / se aplica a otras deudas</option><option value="1">Se le devuelve en efectivo (sale de caja)</option><option value="2">Se le devuelve por transferencia</option></select></div></div>
    <div class="fg hidden" id="${mid}_cta_w"><label class="fl">Cuenta de la que sale la transferencia</label><select id="${mid}_cta" class="fs">${OPC.cuentas().map(c => `<option value="${c[0]}">${esc(c[1])}</option>`).join('')}</select></div>
    <div class="tot-box mt3" style="margin-left:auto;max-width:300px"><div class="row big"><span>Total NC aprox.</span><span class="mono" id="${mid}_tot">$ 0,00</span></div></div>
  </div><div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p" id="${mid}_ok"><i class="fas fa-check"></i> Emitir nota de crédito</button></div>`, 'md-xl');
  let modo = 'prod';
  const recalc = () => { let t = 0; if (modo === 'prod') o.querySelectorAll('.nc-q').forEach(q => t += Number(q.value || 0) * Number(q.dataset.u)); else { t = Number($(mid + '_neto').value || 0) * 1.21; $(mid + '_netof').value = fmt(t); } $(mid + '_tot').textContent = fmt(t); };
  o.querySelectorAll('.tab').forEach(t => t.onclick = () => { modo = t.dataset.t; o.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t)); $(mid + '_prod').classList.toggle('hidden', modo !== 'prod'); $(mid + '_imp').classList.toggle('hidden', modo !== 'imp'); recalc(); });
  o.querySelectorAll('.nc-q').forEach(q => q.oninput = recalc); $(mid + '_neto').oninput = recalc;
  $(mid + '_todo').onclick = () => { o.querySelectorAll('.nc-q').forEach(q => q.value = q.max); recalc(); };
  $(mid + '_rei').onchange = () => $(mid + '_cta_w').classList.toggle('hidden', $(mid + '_rei').value !== '2');
  $(mid + '_ok').onclick = async () => {
    const p = { origen_id: origenId, motivo: val(mid + '_mot') };
    if (!p.motivo) return toast('El motivo es obligatorio.', 'r');
    if (modo === 'prod') { p.items = [...o.querySelectorAll('.nc-q')].filter(q => Number(q.value) > 0).map(q => ({ item_id: Number(q.dataset.id), cantidad: Number(q.value) })); p.devuelve_mercaderia = $(mid + '_dev').checked; if (!p.items.length) return toast('Indicá las cantidades a acreditar.', 'r'); }
    else { p.importe_neto = Number($(mid + '_neto').value || 0); if (!p.importe_neto) return toast('Indicá el importe.', 'r'); }
    if ($(mid + '_rei').value) p.reintegro = { medio_pago_id: $(mid + '_rei').value === '1' ? 1 : 2, cuenta_id: $(mid + '_rei').value === '2' ? Number($(mid + '_cta').value) : null };
    $(mid + '_ok').disabled = true;
    try { const r = await rpc('registrar_nc_venta', { p }); o.remove(); toast('Nota de crédito ' + r.numero + ' por ' + fmt(r.total) + (Number(r.devuelto_en_dinero) ? ' · devuelto ' + fmt(r.devuelto_en_dinero) : '') + (Number(r.queda_a_favor) ? ' · a favor ' + fmt(r.queda_a_favor) : ''), 'g', 7000); if (PAG.id === 'ventas') ventasCargar(); verComprobante(r.comprobante_id); }
    catch (e) { $(mid + '_ok').disabled = false; }
  };
}
async function ndNueva(clienteId, origenId) {
  const mid = 'nd' + uid();
  const o = showModal(modalHdr('Nota de débito') + `<div class="mb2"><div class="alert al-i">Para cobrar un recargo, un envío, intereses o una diferencia de precio después de emitida la venta.</div>
    <div class="fg"><label class="fl req">Cliente</label><div id="${mid}_cw"></div></div>
    <div class="fr"><div class="fg"><label class="fl req">Concepto</label><select id="${mid}_c" class="fs"><option value="CONC-RECARGO">Recargo financiero</option><option value="CONC-ENVIO">Envío</option><option value="CONC-INTERES">Intereses</option><option value="CONC-DIF-PRECIO">Diferencia de precio</option></select></div>
    <div class="fg"><label class="fl req">Importe NETO (sin IVA)</label><input id="${mid}_n" type="number" step="0.01" min="0" class="fi mono"></div></div>
    <div class="fg"><label class="fl req">Motivo</label><input id="${mid}_m" class="fi"></div><div class="ss" id="${mid}_t"></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p" id="${mid}_ok"><i class="fas fa-check"></i> Emitir nota de débito</button></div>`);
  let cli = clienteId || null;
  const c0 = clienteId ? (await cargarClientes()).find(c => c.id === clienteId) : null;
  buscador(mid + '_cw', { tipo: 'cliente', id: mid + '_cl', valor: c0 ? { id: c0.id, label: c0.nombre } : null, onSelect: c => cli = c.id });
  $(mid + '_n').oninput = () => $(mid + '_t').textContent = 'Total con IVA: ' + fmt(Number($(mid + '_n').value || 0) * 1.21);
  $(mid + '_ok').onclick = async () => {
    cli = Number($(mid + '_cl').dataset.id || 0); if (!cli) return toast('Elegí el cliente.', 'r');
    const r = await rpc('registrar_nd_venta', { p: { cliente_id: cli, origen_id: origenId || null, concepto: $(mid + '_c').value, neto: Number($(mid + '_n').value || 0), motivo: val(mid + '_m') } });
    o.remove(); toast('Nota de débito ' + r.numero + ' por ' + fmt(r.total), 'g'); if (PAG.id === 'ventas') ventasCargar(); verComprobante(r.comprobante_id);
  };
}

/* ================= PRESUPUESTOS ================= */
PAGINAS.presupuestos = async () => {
  pagina({ titulo: 'Presupuestos', icono: 'file-signature', sub: 'Cotizaciones a clientes · respetan su precio mientras están vigentes',
    botones: btnExcel(`exportarExcel('g_pre','Presupuestos')`) + btnPdf(`exportarPdf('g_pre','Listado de presupuestos',filtrosTexto())`) + btnNuevo('presupuestoNuevo()', 'Nuevo presupuesto'),
    cuerpo: `<div class="grid-4 mb3" id="pre_k"></div><div class="panel">${barraFiltros([{ k: 'desde', t: 'desde', v: hoy(-60) }, { k: 'hasta', t: 'hasta', v: hoy() }, { k: 'cliente_id', t: 'cliente', l: 'Cliente' }, { k: 'estado', t: 'sel', l: 'Estado', op: [['enviado', 'Pendiente'], ['borrador', 'En carga'], ['aceptado', 'Aceptado'], ['rechazado', 'Rechazado'], ['vencido', 'Vencido']], v: 'enviado' }, { k: 'texto', t: 'texto', ph: 'N° o cliente' }], presupuestosCargar)}<div id="pre_g"></div></div>` });
  await presupuestosCargar();
};
async function presupuestosCargar() {
  const rows = await rpc('listado_presupuestos', { f: leerFiltros() }); PAG.pres = rows;
  const c = e => rows.filter(r => r.estado === e);
  const emit = rows.filter(r => r.estado !== 'borrador').length;
  $('pre_k').innerHTML = kpi('Pendientes', c('enviado').length, fmt(c('enviado').reduce((a, r) => a + Number(r.total), 0)) + (c('borrador').length ? ' · ' + c('borrador').length + ' en carga' : ''), 'b') + kpi('Aceptados', c('aceptado').length, fmt(c('aceptado').reduce((a, r) => a + Number(r.total), 0)), 'g') + kpi('Rechazados / vencidos', c('rechazado').length + c('vencido').length, '', 'r') + kpi('Efectividad', emit ? Math.round(c('aceptado').length * 100 / emit) + '%' : '—', 'aceptados sobre enviados', 'w');
  $('pre_g').innerHTML = grilla('g_pre', [{ t: 'Fecha', k: 'fecha', f: 'd' }, { t: 'N°', k: 'numero', f: r => `<b class="mono">${esc(r.numero)}</b>`, xf: r => r.numero }, { t: 'Cliente', k: 'cliente' }, { t: 'Lista', k: 'lista' }, { t: 'Válido hasta', k: 'valido_hasta', f: 'd' }, { t: 'Líneas', k: 'lineas', f: 'n', cls: 'tr' }, { t: 'Total', k: 'total', f: 'm', cls: 'tr', sum: 1 }, { t: 'Estado', k: 'estado', f: r => badgePre(r.estado), xf: r => EST_PRE[r.estado] || r.estado }, { t: 'Venta', k: 'venta' }], rows,
    { acciones: r => `<button class="btn btn-xs btn-s" title="${r.estado === 'borrador' ? 'Seguir cargando' : 'Ver'}" onclick="editorDoc('presupuesto',${r.id})"><i class="fas fa-${r.estado === 'borrador' ? 'pen' : 'eye'}"></i></button>${r.estado !== 'borrador' ? `<button class="btn btn-xs btn-pdf" title="PDF" onclick="presupuestoPdf(${r.id})"><i class="fas fa-file-pdf"></i></button>` : ''}${r.celular && r.estado === 'enviado' ? `<button class="btn btn-xs btn-wa" title="WhatsApp" onclick="presupuestoWa(${r.id})"><i class="fab fa-whatsapp"></i></button>` : ''}${r.estado === 'enviado' ? `<button class="btn btn-xs btn-g" title="Cliente confirmó: convertir en venta" onclick="presupuestoConvertir(${r.id})"><i class="fas fa-cash-register"></i></button>` : ''}<button class="btn btn-xs btn-b" title="Duplicar" onclick="presupuestoDuplicar(${r.id})"><i class="fas fa-copy"></i></button>` });
}
async function presupuestoNuevo() { await editorDoc('presupuesto', null); }
async function presupuestoPdf(id) {
  const d = await rpc('presupuesto_detalle', { p_id: id }); const ri = d.discrimina_iva;
  const doc = pdfDocumento({ titulo: 'PRESUPUESTO', numero: d.numero, fecha: fmtD(d.fecha), sub: 'Válido hasta: ' + fmtD(d.valido_hasta),
    receptor: { titulo: 'Cliente', lineas: [d.cliente.nombre, d.cliente.documento, d.cliente.condicion_iva, d.cliente.direccion, d.cliente.celular] },
    cols: ['Código', 'Producto', 'Cant.', ri ? 'P. unit. neto' : 'P. unit.', 'Desc.', ri ? 'Neto' : 'Importe'],
    filas: d.items.map(i => [i.codigo, i.producto, fmtN(i.cantidad), fmt(ri ? i.precio_neto_unit : i.precio_final_unit), Number(i.descuento_pct) ? fmtP(i.descuento_pct) : '', fmt(ri ? i.subtotal_neto : i.total)]),
    colStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    totales: ri ? [['Subtotal neto', fmt(Number(d.subtotal_neto) - Number(d.descuento_neto))], ['IVA', fmt(d.iva)], ['TOTAL', fmt(d.total), 1]] : [...(Number(d.descuento_pct) ? [['Descuento ' + fmtP(d.descuento_pct), 'incluido']] : []), ['TOTAL', fmt(d.total), 1]],
    notas: [d.nota || '', ri ? 'Precios netos más IVA.' : 'Precios con IVA incluido.', 'Presupuesto válido hasta el ' + fmtD(d.valido_hasta) + '. Precios sujetos a disponibilidad de stock.', (M.empresa || {}).whatsapp ? 'Consultas y pedidos por WhatsApp: ' + M.empresa.whatsapp : ''].filter(Boolean).join('\n') });
  pdfSave(doc, d.numero);
}
async function presupuestoWa(id) {
  const d = await rpc('presupuesto_detalle', { p_id: id });
  if (!d.cliente.celular) return toast('El cliente no tiene celular cargado.', 'r');
  const link = location.origin + location.pathname.replace(/index\.html$/, '').replace(/\/?$/, '/') + 'presupuesto.html?t=' + d.token;
  const txt = `Hola ${d.cliente.nombre}! Te paso el presupuesto ${d.numero} de Pirotecnia Boom por ${fmt(d.total)}, válido hasta el ${fmtD(d.valido_hasta)}.\n\nPodés verlo y descargarlo acá: ${link}\n\n¡Cualquier consulta escribinos!`;
  waAbrir(d.cliente.celular, txt);
}
async function presupuestoValidez() { const f = $('ed_val').value; if (!f) return toast('Elegí la fecha.', 'r'); await rpc('presupuesto_validez', { p_id: ED.id, p_fecha: f }); await editorRecargar(); toast('Vence el ' + fmtD(f), 'g'); }
async function presupuestoGrabar(id) {
  if ($('ed_val') && $('ed_val').value && $('ed_val').value !== ED.det.valido_hasta) await rpc('presupuesto_validez', { p_id: id, p_fecha: $('ed_val').value });
  await rpc('presupuesto_estado', { p_id: id, p_estado: 'enviado' });
  await editorRecargar(); toast('Presupuesto ' + ED.det.numero + ' grabado · vence el ' + fmtD(ED.det.valido_hasta), 'g', 6000);
}
async function presupuestoRechazar(id) { const m = await pedirTexto('Presupuesto rechazado', 'Motivo (opcional)', { obligatorio: false }); if (m === null) return; await rpc('presupuesto_estado', { p_id: id, p_estado: 'rechazado', p_motivo: m }); toast('Presupuesto rechazado', 'g'); ir('presupuestos'); }
async function presupuestoDuplicar(id) { const n = await rpc('presupuesto_duplicar', { p_id: id }); toast('Presupuesto duplicado con precios actuales', 'g'); await editorDoc('presupuesto', n); }
async function presupuestoConvertir(id) {
  const d = await rpc('presupuesto_detalle', { p_id: id }); const mid = 'pc' + uid();
  const o = showModal(modalHdr('Convertir ' + esc(d.numero) + ' en venta') + `<div class="mb2"><div class="alert al-g">Se emite la venta con los precios del presupuesto: <b>${fmt(d.total)}</b>.</div>
    <div class="fg"><label class="fl">Condición</label><select id="${mid}_c" class="fs"><option value="contado">Contado (cobro ahora)</option><option value="cuenta_corriente">Cuenta corriente</option></select></div>
    <div class="fg"><label class="fl">N° de factura ARCA (si se emitió aparte)</label><input id="${mid}_f" class="fi"></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p" id="${mid}_ok"><i class="fas fa-arrow-right"></i> Continuar</button></div>`, 'md-sm');
  $(mid + '_ok').onclick = async () => {
    const cond = $(mid + '_c').value; const fact = val(mid + '_f') || null; o.remove();
    const fin = async r => { toast('Venta ' + r.numero + ' emitida', 'g', 6000); await ir('ventas'); verComprobante(r.comprobante_id); };
    if (cond === 'cuenta_corriente') fin(await rpc('presupuesto_convertir', { p_id: id, p: { condicion: cond, factura_externa: fact, clave: 'p' + id } }));
    else modalPagos({ total: Number(d.total), titulo: 'Cobro · ' + esc(d.numero), onConfirm: async (pagos, ent) => fin(await rpc('presupuesto_convertir', { p_id: id, p: { condicion: cond, pagos, efectivo_entregado: ent, factura_externa: fact, clave: 'p' + id } })) });
  };
}

/* ================= COBRANZAS ================= */
PAGINAS.cobranzas = async () => {
  pagina({ titulo: 'Cobranzas', icono: 'hand-holding-dollar', sub: 'Recibos de cobro a clientes',
    botones: btnExcel(`exportarExcel('g_rec','Cobranzas')`) + btnPdf(`exportarPdf('g_rec','Cobranzas',filtrosTexto())`) + btnNuevo('cobroNuevo()', 'Nuevo cobro'),
    cuerpo: `<div class="grid-3 mb3" id="rec_k"></div><div class="panel">${barraFiltros([{ k: 'desde', t: 'desde', v: hoy(-30) }, { k: 'hasta', t: 'hasta', v: hoy() }, { k: 'cliente_id', t: 'cliente', l: 'Cliente' }, { k: 'estado', t: 'sel', l: 'Estado', op: [['emitido', 'Emitido'], ['anulado', 'Anulado']] }, { k: 'solo_cobranzas', t: 'chk', l: 'Sin ventas de contado', v: true }, { k: 'texto', t: 'texto' }], cobranzasCargar)}<div id="rec_g"></div></div>` });
  await cobranzasCargar();
};
async function cobranzasCargar() {
  const rows = await rpc('listado_recibos', { f: leerFiltros() }); const v = rows.filter(r => r.estado === 'emitido');
  $('rec_k').innerHTML = kpi('Cobrado', fmt(v.reduce((a, r) => a + Number(r.total), 0)), v.length + ' recibos', 'g') + kpi('Aplicado a deudas', fmt(v.reduce((a, r) => a + Number(r.aplicado), 0))) + kpi('Quedó a favor', fmt(v.reduce((a, r) => a + Number(r.total) - Number(r.aplicado), 0)), 'anticipos / saldo a favor', 'w');
  $('rec_g').innerHTML = grilla('g_rec', [{ t: 'Fecha', k: 'fecha', f: 'dt' }, { t: 'Recibo', k: 'numero', f: r => `<b class="mono">${esc(r.numero)}</b>`, xf: r => r.numero }, { t: 'Cliente', k: 'cliente' }, { t: 'Medios', k: 'medios' }, { t: 'Total', k: 'total', f: 'm', cls: 'tr', sum: 1 }, { t: 'Aplicado', k: 'aplicado', f: 'm', cls: 'tr' }, { t: 'Origen', k: 'o', f: r => r.es_venta_contado ? 'Venta contado' : 'Cobranza' }, { t: 'Estado', k: 'estado', f: 'e' }], rows,
    { claseFila: r => r.estado === 'anulado' ? 'anulado' : '', acciones: r => `<button class="btn btn-xs btn-s" title="Ver" onclick="verRecibo(${r.id})"><i class="fas fa-eye"></i></button><button class="btn btn-xs btn-pdf" title="PDF" onclick="pdfRecibo(${r.id})"><i class="fas fa-file-pdf"></i></button>${ES_DUENO && r.estado === 'emitido' ? `<button class="btn btn-xs btn-d" title="Anular" onclick="anularRecibo(${r.id})"><i class="fas fa-ban"></i></button>` : ''}` });
}
async function cobroNuevo(clienteId, comprobanteId) {
  const mid = 'cb' + uid();
  const o = showModal(modalHdr('Nuevo cobro') + `<div class="mb2"><div class="fg"><label class="fl req">Cliente</label><div id="${mid}_cw"></div></div><div id="${mid}_info"></div>
    <div class="fr mt3"><div class="fg"><label class="fl req">Importe a cobrar</label><input id="${mid}_imp" type="number" step="0.01" min="0" class="fi mono"></div><div class="fg"><label class="fl">Aplicar primero a</label><select id="${mid}_comp" class="fs"><option value="">Las deudas más viejas</option></select></div></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-y hidden" id="${mid}_af"><i class="fas fa-wand-magic-sparkles"></i> Aplicar saldo a favor</button><button class="btn btn-p" id="${mid}_ok"><i class="fas fa-arrow-right"></i> Elegir medios de pago</button></div>`, 'md-lg');
  let cli = null, cc = null;
  const cargar = async id => {
    cli = id; cc = await rpc('cta_cte_cliente', { p_cliente: id, p_desde: hoy(-3650), p_hasta: hoy() });
    $(mid + '_info').innerHTML = `<div class="grid-3 mb3">${kpi('Debe', fmt(cc.deuda), cc.pendientes.length + ' comprobantes', 'r')}${kpi('A favor', fmt(cc.a_favor), 'recibos o NC sin aplicar', 'g')}${kpi('Saldo', fmt(Number(cc.deuda) - Number(cc.a_favor)), '', 'b')}</div>` + (cc.pendientes.length ? grilla('g_cbp', [{ t: 'Comprobante', k: 'numero' }, { t: 'Fecha', k: 'fecha', f: 'd' }, { t: 'Días', k: 'dias', f: 'n', cls: 'tr' }, { t: 'Total', k: 'total', f: 'm', cls: 'tr' }, { t: 'Saldo', k: 'saldo', f: 'm', cls: 'tr', sum: 1 }], cc.pendientes) : '<div class="alert al-g">No tiene deuda. Lo que cobres queda a favor (anticipo / seña).</div>');
    $(mid + '_comp').innerHTML = '<option value="">Las deudas más viejas</option>' + cc.pendientes.map(p => `<option value="${p.id}" ${p.id === comprobanteId ? 'selected' : ''}>${esc(p.numero)} · saldo ${fmt(p.saldo)}</option>`).join('');
    const sel = cc.pendientes.find(p => p.id === comprobanteId);
    $(mid + '_imp').value = sel ? sel.saldo : (Number(cc.deuda) > 0 ? cc.deuda : '');
    $(mid + '_af').classList.toggle('hidden', !(Number(cc.a_favor) > 0 && Number(cc.deuda) > 0));
  };
  const c0 = clienteId ? (await cargarClientes()).find(c => c.id === clienteId) : null;
  buscador(mid + '_cw', { tipo: 'cliente', id: mid + '_cl', valor: c0 ? { id: c0.id, label: c0.nombre } : null, onSelect: c => cargar(c.id) });
  if (clienteId) cargar(clienteId);
  $(mid + '_af').onclick = async () => { const n = await rpc('aplicar_saldo_a_favor', { p_cliente: cli }); toast('Se aplicaron ' + fmt(n) + ' del saldo a favor', 'g'); cargar(cli); };
  $(mid + '_ok').onclick = () => {
    if (!cli) return toast('Elegí el cliente.', 'r'); const imp = numIn(mid + '_imp'); if (!imp || imp <= 0) return toast('Indicá el importe.', 'r');
    const comp = $(mid + '_comp').value ? Number($(mid + '_comp').value) : null; const nombre = $(mid + '_cl').value; const clave = 'c' + uid();
    modalPagos({ total: imp, titulo: 'Cobro a ' + esc(nombre), onConfirm: async (pagos) => {
      const r = await rpc('registrar_cobro', { p_cliente: cli, p_pagos: pagos, p_comprobante: comp, p_nota: null, p_clave: clave, p_puesto: 'Caja 1' });
      o.remove(); toast('Recibo ' + r.recibo + ' por ' + fmt(r.total) + (Number(r.saldo_a_favor) ? ' · queda a favor ' + fmt(r.saldo_a_favor) : ''), 'g', 7000);
      CLIENTES = null; if (PAG.id === 'cobranzas') cobranzasCargar(); else if (PAG.id === 'ventas') ventasCargar(); else if (PAG.id === 'ctacte') ctacteCargar();
    } });
  };
}
async function verRecibo(id) {
  const d = await rpc('recibo_detalle', { p_id: id });
  showModal(modalHdr('Recibo ' + esc(d.numero)) + `<div class="mb2"><div class="kv mb3"><b>Fecha</b><span>${fmtDT(d.fecha)}</span><b>Cliente</b><span>${esc(d.cliente.nombre)}</span><b>Total</b><span class="mono"><b>${fmt(d.total)}</b></span><b>Estado</b><span>${badgeEstado(d.estado)} ${esc(d.motivo_anulacion || '')}</span>${Number(d.vuelto) ? `<b>Entregó / vuelto</b><span>${fmt(d.efectivo_entregado)} / ${fmt(d.vuelto)}</span>` : ''}</div>
    <div class="pt mb3">Medios</div>${grilla('g_rm', [{ t: 'Medio', k: 'medio' }, { t: 'Detalle', k: 'd', f: r => esc([r.referencia, r.cheque, r.cuotas ? r.cuotas + ' cuotas' : ''].filter(Boolean).join(' · ')) }, { t: 'Importe', k: 'importe', f: 'm', cls: 'tr' }], d.medios)}
    <div class="pt mb3 mt3">Aplicado a</div>${grilla('g_ra', [{ t: 'Comprobante', k: 'numero' }, { t: 'Fecha', k: 'fecha', f: 'd' }, { t: 'Importe', k: 'importe', f: 'm', cls: 'tr' }], d.aplicado_a, { vacio: 'Sin aplicar: quedó a favor' })}
    ${Number(d.a_favor) > 0 && d.estado === 'emitido' ? `<div class="alert al-w mt3">Quedan ${fmt(d.a_favor)} a favor del cliente.</div>` : ''}</div>
    <div class="mf"><button class="btn btn-pdf" onclick="pdfRecibo(${d.id})"><i class="fas fa-file-pdf"></i> PDF</button>${ES_DUENO && d.estado === 'emitido' ? `<button class="btn btn-d" onclick="closeModal(this);anularRecibo(${d.id})"><i class="fas fa-ban"></i> Anular</button>` : ''}<button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-lg');
}
async function pdfRecibo(id) {
  const d = await rpc('recibo_detalle', { p_id: id });
  const doc = pdfDocumento({ titulo: 'RECIBO', numero: d.numero + (d.estado === 'anulado' ? ' (ANULADO)' : ''), fecha: fmtD(d.fecha),
    receptor: { titulo: 'Recibimos de', lineas: [d.cliente.nombre, d.cliente.documento, d.cliente.celular] },
    cols: ['Medio', 'Detalle', 'Importe'], filas: d.medios.map(m => [m.medio, [m.referencia, m.cheque, m.cuotas ? m.cuotas + ' cuotas' : ''].filter(Boolean).join(' · '), fmt(m.importe)]), colStyles: { 2: { halign: 'right' } },
    totales: [['TOTAL RECIBIDO', fmt(d.total), 1]], notas: (d.aplicado_a.length ? 'Aplicado a: ' + d.aplicado_a.map(a => a.numero + ' (' + fmt(a.importe) + ')').join(', ') : '') + (Number(d.a_favor) > 0 ? '\nQueda a favor: ' + fmt(d.a_favor) : '') });
  pdfSave(doc, d.numero);
}
async function anularRecibo(id) {
  const m = await pedirTexto('Anular recibo', 'Motivo', { ayuda: 'El recibo queda anulado (no se borra): se revierte la caja y la deuda vuelve a quedar pendiente.' }); if (!m) return;
  await rpc('anular_recibo', { p_recibo: id, p_motivo: m }); toast('Recibo anulado', 'g'); cobranzasCargar();
}

/* ================= CUENTA CORRIENTE CLIENTES ================= */
PAGINAS.ctacte = async () => {
  pagina({ titulo: 'Cuenta corriente de clientes', icono: 'address-book', sub: 'Saldos y estado de cuenta',
    botones: btnExcel(`exportarExcel('g_sal','Saldos de clientes')`) + btnPdf(`exportarPdf('g_sal','Saldos de clientes')`) + btnNuevo('cobroNuevo()', 'Nuevo cobro'),
    cuerpo: `<div class="grid-3 mb3" id="sal_k"></div><div class="panel">${barraFiltros([{ k: 'texto', t: 'texto', ph: 'Cliente' }, { k: 'todos', t: 'chk', l: 'Incluir saldo cero' }, { k: 'vencido', t: 'chk', l: 'Solo con deuda de +30 días' }], ctacteCargar)}<div id="sal_g"></div></div>` });
  await ctacteCargar();
};
async function ctacteCargar() {
  const f = leerFiltros(); const n = norm(f.texto || '');
  const rows = (await rpc('saldos_clientes', { p_solo_con_saldo: !f.todos })).filter(r => (!n || norm(r.nombre + ' ' + (r.celular || '')).includes(n)) && (!f.vencido || Number(r.vencido_30) > 0));
  $('sal_k').innerHTML = kpi('Total deuda', fmt(rows.reduce((a, r) => a + Number(r.deuda), 0)), rows.filter(r => r.deuda > 0).length + ' clientes', 'r') + kpi('Deuda +30 días', fmt(rows.reduce((a, r) => a + Number(r.vencido_30), 0)), '', 'w') + kpi('Saldos a favor', fmt(rows.reduce((a, r) => a + Number(r.a_favor), 0)), '', 'g');
  $('sal_g').innerHTML = grilla('g_sal', [{ t: 'Cliente', k: 'nombre', f: r => `<b>${esc(r.nombre)}</b>`, xf: r => r.nombre }, { t: 'Celular', k: 'celular' }, { t: 'Límite', k: 'limite_credito', f: 'm', cls: 'tr' }, { t: 'Deuda', k: 'deuda', f: 'm', cls: 'tr', sum: 1 }, { t: '+30 días', k: 'vencido_30', f: 'm', cls: 'tr', sum: 1 }, { t: 'A favor', k: 'a_favor', f: 'm', cls: 'tr', sum: 1 }, { t: 'Saldo', k: 'saldo', f: r => `<b class="${r.saldo > 0 ? 'td' : 'tg'}">${fmt(r.saldo)}</b>`, xf: r => Number(r.saldo), cls: 'tr' }, { t: 'Último mov.', k: 'ultimo_movimiento', f: 'd' }], rows,
    { acciones: r => `<button class="btn btn-xs btn-s" title="Estado de cuenta" onclick="estadoCuenta(${r.id})"><i class="fas fa-eye"></i></button>${Number(r.deuda) > 0 ? `<button class="btn btn-xs btn-g" title="Cobrar" onclick="cobroNuevo(${r.id})"><i class="fas fa-hand-holding-dollar"></i></button>` : ''}${r.celular && Number(r.saldo) > 0 ? `<button class="btn btn-xs btn-wa" title="Recordar saldo por WhatsApp" onclick="waAbrir('${r.celular}','Hola ${esc(r.nombre).replace(/'/g, '')}! Te recordamos que tu saldo en Pirotecnia Boom es de ${fmt(r.saldo)}. Cualquier consulta, escribinos.')"><i class="fab fa-whatsapp"></i></button>` : ''}` });
}
function irCtaCli(id) { estadoCuenta(id); }
async function estadoCuenta(id, desde = hoy(-180), hasta = hoy()) {
  const d = await rpc('cta_cte_cliente', { p_cliente: id, p_desde: desde, p_hasta: hasta }); const mid = 'ec' + uid();
  document.querySelectorAll('.mo').forEach(m => m.remove());
  PAG.ec = d;
  showModal(modalHdr('Estado de cuenta · ' + esc(d.cliente.nombre)) + `<div class="mb2"><div class="fbar mb3" style="border-radius:8px"><div class="fg"><label class="fl">Desde</label><input type="date" id="${mid}_d" class="fi" value="${desde}"></div><div class="fg"><label class="fl">Hasta</label><input type="date" id="${mid}_h" class="fi" value="${hasta}"></div><div class="fg"><button class="btn btn-s btn-sm" id="${mid}_r"><i class="fas fa-rotate"></i> Actualizar</button></div></div>
    <div class="grid-4 mb3">${kpi('Saldo anterior', fmt(d.saldo_anterior))}${kpi('Saldo final', fmt(d.saldo_final), '', Number(d.saldo_final) > 0 ? 'r' : 'g')}${kpi('Debe hoy', fmt(d.deuda), '', 'w')}${kpi('A favor', fmt(d.a_favor), '', 'g')}</div>
    ${grilla('g_ec', [{ t: 'Fecha', k: 'fecha', f: 'dt' }, { t: 'Tipo', k: 'tipo' }, { t: 'Número', k: 'numero' }, { t: 'Detalle', k: 'detalle' }, { t: 'Debe', k: 'debe', f: r => Number(r.debe) ? fmt(r.debe) : '', xf: r => Number(r.debe), cls: 'tr' }, { t: 'Haber', k: 'haber', f: r => Number(r.haber) ? fmt(r.haber) : '', xf: r => Number(r.haber), cls: 'tr' }, { t: 'Saldo', k: 'saldo', f: 'm', cls: 'tr' }], d.movimientos,
      { vacio: 'Sin movimientos en el período', acciones: r => r.ref === 'comprobante' ? `<button class="btn btn-xs btn-s" onclick="verComprobante(${r.ref_id})"><i class="fas fa-eye"></i></button>` : `<button class="btn btn-xs btn-s" onclick="verRecibo(${r.ref_id})"><i class="fas fa-eye"></i></button>` })}</div>
    <div class="mf"><button class="btn btn-excel" onclick="exportarExcel('g_ec','Cuenta ${esc(d.cliente.nombre).replace(/'/g, '')}')"><i class="fas fa-file-excel"></i> Excel</button><button class="btn btn-pdf" onclick="pdfEstadoCuenta()"><i class="fas fa-file-pdf"></i> PDF</button>${Number(d.deuda) > 0 ? `<button class="btn btn-g" onclick="closeModal(this);cobroNuevo(${id})"><i class="fas fa-hand-holding-dollar"></i> Cobrar</button>` : ''}<button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-xl');
  $(mid + '_r').onclick = () => estadoCuenta(id, $(mid + '_d').value, $(mid + '_h').value);
}
function pdfEstadoCuenta() {
  const d = PAG.ec;
  const doc = pdfDocumento({ titulo: 'ESTADO DE CUENTA', numero: 'Del ' + fmtD(d.desde) + ' al ' + fmtD(d.hasta), fecha: fmtD(hoy()),
    receptor: { titulo: 'Cliente', lineas: [d.cliente.nombre, d.cliente.documento, d.cliente.direccion, d.cliente.celular] },
    cols: ['Fecha', 'Tipo', 'Número', 'Detalle', 'Debe', 'Haber', 'Saldo'],
    filas: [['', '', '', 'Saldo anterior', '', '', fmt(d.saldo_anterior)], ...d.movimientos.map(m => [fmtD(m.fecha), m.tipo, m.numero, m.detalle || '', Number(m.debe) ? fmt(m.debe) : '', Number(m.haber) ? fmt(m.haber) : '', fmt(m.saldo)])],
    colStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    totales: [['Saldo al ' + fmtD(d.hasta), fmt(d.saldo_final), 1]] });
  pdfSave(doc, 'Cuenta_' + d.cliente.nombre.replace(/\W+/g, '_'));
}

/* ================= PEDIDOS WEB ================= */
PAGINAS.pedidos = async () => {
  pagina({ titulo: 'Pedidos web', icono: 'cart-shopping', sub: 'Pedidos del catálogo: confirmar, editar o cancelar',
    botones: btnExcel(`exportarExcel('g_ped','Pedidos')`) + btnPdf(`exportarPdf('g_ped','Pedidos web')`),
    cuerpo: `<div class="alert al-i">Cada pedido web se guarda primero y después el cliente avisa por WhatsApp. Vence solo a las ${(M.empresa && M.empresa.plazo_pedido_horas) || 48} h si no se confirma. Al confirmarlo se emite la venta con los precios del pedido.</div><div class="panel">${barraFiltros([{ k: 'estado', t: 'sel', l: 'Estado', op: [['abierto', 'Abierto'], ['confirmado', 'Confirmado'], ['cancelado', 'Cancelado'], ['vencido', 'Vencido']], v: 'abierto' }, { k: 'desde', t: 'desde', v: hoy(-30) }, { k: 'hasta', t: 'hasta', v: hoy() }, { k: 'texto', t: 'texto', ph: 'N°, nombre o celular' }], pedidosCargar)}<div id="ped_g"></div></div>` });
  await pedidosCargar();
};
async function pedidosCargar() {
  const rows = await rpc('listado_pedidos', { f: leerFiltros() });
  $('ped_g').innerHTML = grilla('g_ped', [{ t: 'Fecha', k: 'fecha', f: 'dt' }, { t: 'Pedido', k: 'numero', f: r => `<b class="mono">${esc(r.numero)}</b>`, xf: r => r.numero }, { t: 'Nombre', k: 'nombre' }, { t: 'Celular', k: 'celular' }, { t: 'Canal', k: 'canal' }, { t: 'Líneas', k: 'lineas', f: 'n', cls: 'tr' }, { t: 'Total', k: 'total', f: 'm', cls: 'tr', sum: 1 }, { t: 'Vence', k: 'vence_at', f: r => r.estado === 'abierto' ? fmtDT(r.vence_at) : '' }, { t: 'Estado', k: 'estado', f: 'e' }, { t: 'Venta', k: 'venta' }], rows,
    { acciones: r => `<button class="btn btn-xs btn-s" title="Ver" onclick="verPedido(${r.id})"><i class="fas fa-eye"></i></button><button class="btn btn-xs btn-wa" title="WhatsApp" onclick="waAbrir('${r.celular}','Hola ${esc(r.nombre).replace(/'/g, '')}! Recibimos tu pedido ${r.numero}.')"><i class="fab fa-whatsapp"></i></button>${r.estado === 'abierto' ? `<button class="btn btn-xs btn-b" title="Editar" onclick="pedidoEditar(${r.id})"><i class="fas fa-pen"></i></button><button class="btn btn-xs btn-g" title="Confirmar (emitir venta)" onclick="pedidoConfirmar(${r.id})"><i class="fas fa-check"></i></button><button class="btn btn-xs btn-d" title="Cancelar" onclick="pedidoCancelar(${r.id})"><i class="fas fa-ban"></i></button>` : ''}` });
}
async function verPedido(id) {
  const d = await rpc('pedido_detalle', { p_id: id });
  showModal(modalHdr('Pedido ' + esc(d.numero)) + `<div class="mb2"><div class="grid-2 mb3"><div class="kv"><b>Fecha</b><span>${fmtDT(d.fecha)}</span><b>Nombre</b><span>${esc(d.nombre)}</span><b>Celular</b><span>${esc(d.celular)}</span><b>Canal</b><span>${esc(d.canal)} · ${esc(d.lista)}</span></div><div class="kv"><b>Estado</b><span>${badgeEstado(d.estado)}</span><b>Vence</b><span>${fmtDT(d.vence_at)}</span>${d.nota ? `<b>Nota</b><span>${esc(d.nota)}</span>` : ''}${d.motivo_cierre ? `<b>Cierre</b><span>${esc(d.motivo_cierre)}</span>` : ''}</div></div>
    ${grilla('g_pi', [{ t: 'Código', k: 'codigo' }, { t: 'Producto', k: 'producto' }, { t: 'Cant.', k: 'cantidad', f: 'n', cls: 'tr' }, { t: 'P. unit. final', k: 'precio_final_unit', f: 'm', cls: 'tr' }, { t: 'Disponible', k: 'disponible', f: r => r.disponible == null ? '—' : `<span class="${Number(r.disponible) < Number(r.cantidad) ? 'td' : ''}">${fmtN(r.disponible)}</span>`, cls: 'tr' }], d.items)}
    <div class="tot-box mt3" style="margin-left:auto;max-width:300px"><div class="row"><span>Neto</span><b class="mono">${fmt(d.subtotal_neto)}</b></div>${Number(d.descuento_neto) ? `<div class="row"><span>Descuento</span><b class="mono">- ${fmt(d.descuento_neto)}</b></div>` : ''}<div class="row"><span>IVA</span><b class="mono">${fmt(d.iva)}</b></div><div class="row big"><span>TOTAL</span><span class="mono">${fmt(d.total)}</span></div></div></div>
    <div class="mf">${d.estado === 'abierto' ? `<button class="btn btn-g" onclick="closeModal(this);pedidoConfirmar(${d.id})"><i class="fas fa-check"></i> Confirmar</button>` : ''}${d.venta ? `<button class="btn btn-b" onclick="closeModal(this);verComprobante(${d.venta.id})"><i class="fas fa-eye"></i> Ver venta</button>` : ''}<button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-lg');
}
async function pedidoEditar(id) {
  const d = await rpc('pedido_detalle', { p_id: id }); const mid = 'pe' + uid(); let items = d.items.map(i => ({ producto_id: i.producto_id, label: i.codigo + ' · ' + i.producto, cantidad: Number(i.cantidad) }));
  const o = showModal(modalHdr('Editar pedido ' + esc(d.numero)) + `<div class="mb2"><div class="alert al-w">Los productos que ya estaban conservan su precio. Los que se agregan toman el precio de hoy.</div><div id="${mid}_l"></div>
    <div class="fr mt3" style="grid-template-columns:3fr 1fr auto;align-items:end"><div class="fg" style="margin:0"><label class="fl">Agregar producto</label><div id="${mid}_pw"></div></div><div class="fg" style="margin:0"><label class="fl">Cantidad</label><input id="${mid}_q" type="number" class="fi mono" value="1"></div><button class="btn btn-s" id="${mid}_a"><i class="fas fa-plus"></i></button></div>
    <div class="fg mt3"><label class="fl req">Motivo del cambio</label><input id="${mid}_m" class="fi" placeholder="Ej: el cliente pidió sumar 2 tortas"></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p" id="${mid}_ok"><i class="fas fa-floppy-disk"></i> Guardar</button></div>`, 'md-lg');
  const pintar = () => $(mid + '_l').innerHTML = '<table><thead><tr><th>Producto</th><th class="tr">Cantidad</th><th></th></tr></thead><tbody>' + items.map((x, i) => `<tr><td>${esc(x.label)}</td><td class="tr"><input type="number" min="0" step="any" class="fi mono" style="width:100px" value="${x.cantidad}" onchange="this.closest('.mo')._it[${i}].cantidad=Number(this.value)"></td><td><button class="btn btn-xs btn-d" onclick="this.closest('.mo')._it.splice(${i},1);this.closest('.mo')._pintar()"><i class="fas fa-trash"></i></button></td></tr>`).join('') + '</tbody></table>';
  o._it = items; o._pintar = pintar; pintar();
  buscador(mid + '_pw', { tipo: 'producto', id: mid + '_p', lista: () => d.lista_id });
  $(mid + '_a').onclick = () => { const pid = Number($(mid + '_p').dataset.id || 0); if (!pid) return; const ex = items.find(x => x.producto_id === pid); if (ex) ex.cantidad += Number($(mid + '_q').value || 1); else items.push({ producto_id: pid, label: $(mid + '_p').value, cantidad: Number($(mid + '_q').value || 1) }); pintar(); };
  $(mid + '_ok').onclick = async () => { const it = items.filter(x => x.cantidad > 0).map(x => ({ producto_id: x.producto_id, cantidad: x.cantidad })); if (!it.length) return toast('El pedido quedaría vacío: cancelalo.', 'r'); const t = await rpc('editar_pedido', { p_pedido: id, p_items: it, p_motivo: val(mid + '_m') }); o.remove(); toast('Pedido actualizado: total ' + fmt(t), 'g'); pedidosCargar(); };
}
async function pedidoConfirmar(id) {
  const d = await rpc('pedido_detalle', { p_id: id }); const mid = 'pf' + uid();
  const o = showModal(modalHdr('Confirmar pedido ' + esc(d.numero)) + `<div class="mb2"><div class="alert al-g">Se emite la venta a <b>${esc(d.nombre)}</b> por <b>${fmt(d.total)}</b> con los precios del pedido.</div>
    <div class="fg"><label class="fl">Condición</label><select id="${mid}_c" class="fs"><option value="contado">Contado (cobro ahora)</option><option value="cuenta_corriente">Cuenta corriente</option></select></div>
    <div class="fr"><div class="fg"><label class="fl">Recargo (neto)</label><input id="${mid}_r" type="number" step="0.01" class="fi mono" value="0"></div><div class="fg"><label class="fl">Envío (neto)</label><input id="${mid}_e" type="number" step="0.01" class="fi mono" value="0"></div></div>
    <div class="fg"><label class="fl">N° de factura ARCA (si se emitió aparte)</label><input id="${mid}_f" class="fi"></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p" id="${mid}_ok"><i class="fas fa-arrow-right"></i> Continuar</button></div>`, 'md-sm');
  $(mid + '_ok').onclick = async () => {
    const base = { pedido_id: id, cliente_id: d.cliente_id, condicion: $(mid + '_c').value, recargo_neto: numIn(mid + '_r') || 0, envio_neto: numIn(mid + '_e') || 0, factura_externa: val(mid + '_f') || null, clave: 'ped' + id };
    o.remove();
    const fin = async r => { toast('Venta ' + r.numero + ' emitida', 'g', 6000); actualizarBadges(); await ir('ventas'); verComprobante(r.comprobante_id); };
    if (base.condicion === 'cuenta_corriente') return fin(await rpc('registrar_venta', { p_venta: base }));
    const cot = await rpc('cotizar_venta', { p_venta: base });
    modalPagos({ total: Number(cot.total), titulo: 'Cobro del pedido ' + esc(d.numero), onConfirm: async (pagos, ent) => fin(await rpc('registrar_venta', { p_venta: { ...base, pagos, efectivo_entregado: ent } })) });
  };
}
async function pedidoCancelar(id) {
  const m = await pedirTexto('Cancelar pedido', 'Motivo', { ayuda: 'El pedido queda cancelado (no se borra) y libera el stock reservado.' }); if (!m) return;
  await rpc('cancelar_pedido', { p_pedido: id, p_motivo: m }); toast('Pedido cancelado', 'g'); actualizarBadges(); pedidosCargar();
}
