/* Pirotecnia Boom · Compras, notas de proveedores, pagos a proveedores, cuenta corriente de proveedores */
'use strict';

/* ================= COMPRAS ================= */
PAGINAS.compras = async () => {
  pagina({ titulo: 'Compras', icono: 'truck-ramp-box', sub: 'Facturas, notas de crédito y débito de proveedores · suman stock y actualizan costos',
    botones: btnExcel(`exportarExcel('g_cmp','Compras')`) + btnPdf(`exportarPdf('g_cmp','Compras',filtrosTexto())`) + btnNuevo('compraNueva()', 'Nueva compra'),
    cuerpo: `<div class="grid-3 mb3" id="cmp_k"></div><div class="panel">${barraFiltros([{ k: 'desde', t: 'desde', v: hoy(-60) }, { k: 'hasta', t: 'hasta', v: hoy() }, { k: 'proveedor_id', t: 'proveedor', l: 'Proveedor' }, { k: 'tipo', t: 'sel', l: 'Tipo', op: [['FAC', 'Factura'], ['NC', 'Nota de crédito'], ['ND', 'Nota de débito']] }, { k: 'estado', t: 'sel', l: 'Estado', op: [['registrado', 'Registrado'], ['anulado', 'Anulado']], v: 'registrado' }, { k: 'solo_pendientes', t: 'chk', l: 'Impagas' }, { k: 'texto', t: 'texto' }], comprasCargar)}<div id="cmp_g"></div></div>` });
  await comprasCargar();
};
async function comprasCargar() {
  const rows = await rpc('listado_compras', { f: leerFiltros() }); const v = rows.filter(r => r.estado === 'registrado');
  $('cmp_k').innerHTML = kpi('Compras', fmt(v.filter(r => r.tipo !== 'NC').reduce((a, r) => a + Number(r.total), 0)), v.filter(r => r.tipo === 'FAC').length + ' facturas', 'b') + kpi('Notas de crédito', fmt(v.filter(r => r.tipo === 'NC').reduce((a, r) => a + Number(r.total), 0)), '', 'g') + kpi('Impago de estas', fmt(v.reduce((a, r) => a + Number(r.saldo), 0)), '', 'r');
  $('cmp_g').innerHTML = grilla('g_cmp', [{ t: 'Fecha', k: 'fecha', f: 'd' }, { t: 'Tipo', k: 'tipo' }, { t: 'Número', k: 'numero', f: r => `<b class="mono">${esc(r.numero)}</b>`, xf: r => r.numero }, { t: 'Proveedor', k: 'proveedor' }, { t: 'Neto', k: 'subtotal_neto', f: 'm', cls: 'tr' }, { t: 'IVA', k: 'iva', f: 'm', cls: 'tr' }, { t: 'Total', k: 'total', f: 'm', cls: 'tr', sum: 1 }, { t: 'Saldo', k: 'saldo', f: 'm', cls: 'tr', sum: 1 }, { t: 'Pago', k: 'estado_pago', f: r => r.estado_pago === '—' ? '' : badgeEstado(r.estado_pago) }], rows,
    { claseFila: r => r.estado === 'anulado' ? 'anulado' : '', acciones: r => `<button class="btn btn-xs btn-s" title="Ver" onclick="verCompra(${r.id})"><i class="fas fa-eye"></i></button><button class="btn btn-xs btn-pdf" title="PDF" onclick="pdfCompra(${r.id})"><i class="fas fa-file-pdf"></i></button>${Number(r.saldo) > 0 ? `<button class="btn btn-xs btn-g" title="Pagar" onclick="pagoNuevo(${r.proveedor_id},${r.id})"><i class="fas fa-money-check-dollar"></i></button>` : ''}${r.tipo === 'FAC' && r.estado === 'registrado' ? `<button class="btn btn-xs btn-w" title="Nota de crédito / débito del proveedor" onclick="notaCompra(${r.id})"><i class="fas fa-rotate-left"></i></button>` : ''}${r.estado === 'registrado' ? `<button class="btn btn-xs btn-d" title="Anular (error de carga)" onclick="anularCompra(${r.id})"><i class="fas fa-ban"></i></button>` : ''}` });
}
const CP = {};
async function compraNueva() {
  CP.items = []; CP.edit = null; CP.rem = []; CP.remSel = new Set();
  pagina({ titulo: 'Nueva compra', icono: 'truck-ramp-box', sub: 'Factura del proveedor: suma stock y actualiza el costo', botones: `<button class="btn btn-s" onclick="ir('compras')"><i class="fas fa-arrow-left"></i> Volver al listado</button>`,
    cuerpo: `<div class="panel mb3"><div class="ph"><span class="pt"><span class="paso">1</span>Encabezado</span></div><div class="pb">
      <div class="fr4"><div class="fg" style="grid-column:span 2"><label class="fl req">Proveedor</label><div id="cp_pw"></div></div><div class="fg"><label class="fl">Fecha de la factura</label><input type="date" id="cp_fec" class="fi" value="${hoy()}"></div><div class="fg"><label class="fl">Condición</label><select id="cp_cond" class="fs"><option value="cuenta_corriente">Cuenta corriente (se paga después)</option><option value="contado">Contado (se paga ahora)</option></select></div></div>
      <div class="fr4"><div class="fg"><label class="fl">Letra</label><select id="cp_let" class="fs"><option>A</option><option>B</option><option>C</option><option>X</option></select></div><div class="fg"><label class="fl">Punto de venta</label><input id="cp_pv" type="number" class="fi mono" placeholder="0001"></div><div class="fg"><label class="fl req">Número</label><input id="cp_num" class="fi mono" placeholder="00001234"></div><div class="fg"><label class="chk" style="margin-top:18px"><input type="checkbox" id="cp_act" checked> Actualizar el costo de los productos</label></div></div>
      <div class="fr4"><div class="fg"><label class="fl">Bonificación (neto)</label><input id="cp_bon" type="number" step="0.01" class="fi mono" value="0"></div><div class="fg"><label class="fl">Flete (neto)</label><input id="cp_fle" type="number" step="0.01" class="fi mono" value="0"></div><div class="fg"><label class="fl">Percepción IVA</label><input id="cp_piva" type="number" step="0.01" class="fi mono" value="0"></div><div class="fg"><label class="fl">Percepción IIBB</label><input id="cp_piibb" type="number" step="0.01" class="fi mono" value="0"></div></div>
      <div class="fr4"><div class="fg"><label class="fl">IVA que dice la factura (control)</label><input id="cp_ivainf" type="number" step="0.01" class="fi mono" placeholder="opcional"></div></div><div id="cp_rem"></div></div></div>
      <div class="panel mb3"><div class="ph"><span class="pt"><span class="paso">2</span>Productos</span></div><div class="pb">
      <div class="fr4 mb3" style="grid-template-columns:3fr 1fr 1fr 1fr auto;align-items:end"><div class="fg" style="margin:0"><label class="fl">Producto</label><div id="cp_prw"></div></div><div class="fg" style="margin:0"><label class="fl">Cantidad</label><input id="cp_q" type="number" step="any" class="fi mono" value="1"></div><div class="fg" style="margin:0"><label class="fl">Costo neto unit.</label><input id="cp_cu" type="number" step="0.01" class="fi mono"></div><div class="fg" style="margin:0" id="cp_lotew"><label class="fl">Lote / vence</label><div class="flex gap2"><input id="cp_lote" class="fi" placeholder="lote"><input id="cp_venc" type="date" class="fi"></div></div><button class="btn btn-p" id="cp_add"><i class="fas fa-plus"></i> Agregar</button></div>
      <div id="cp_g"></div></div></div>
      <div class="flex jb fw gap3"><div><button class="btn btn-p btn-xl" id="cp_ok"><i class="fas fa-check"></i> Registrar compra</button></div><div class="tot-box" id="cp_tot"></div></div>` });
  CP.prods = await rpc('abm_listar', { p_tabla: 'productos' });
  buscador('cp_pw', { tipo: 'proveedor', id: 'cp_prov', onSelect: p => compraRemitos(p.id), onClear: () => compraRemitos(null) });
  buscador('cp_prw', { tipo: 'producto', id: 'cp_prod', neto: true, onSelect: p => { const x = CP.prods.find(q => q.id === p.id) || {}; $('cp_cu').value = x.costo ?? ''; $('cp_lotew').style.visibility = x.controla_vencimiento ? 'visible' : 'hidden'; $('cp_q').focus(); $('cp_q').select(); } });
  $('cp_lotew').style.visibility = 'hidden';
  ['cp_bon', 'cp_fle', 'cp_piva', 'cp_piibb'].forEach(i => $(i).oninput = compraTotales);
  $('cp_add').onclick = compraAgregar; $('cp_cu').onkeydown = e => { if (e.key === 'Enter') compraAgregar(); };
  $('cp_ok').onclick = compraRegistrar; compraPintar();
}
async function compraRemitos(prov) {
  CP.remSel = new Set(); CP.items = CP.items.filter(i => !i.rem); CP.rem = prov ? await rpc('remitos_para_facturar', { p_proveedor: prov }) : [];
  $('cp_rem').innerHTML = !CP.rem.length ? (prov ? '<div class="ss mt3">Este proveedor no tiene remitos sin facturar: la factura da entrada al stock y genera su remito sola.</div>' : '')
    : `<div class="alert al-i mt3"><b>Remitos de este proveedor sin facturar.</b> Tildá los que corresponden a esta factura: sus productos se cargan solos y el stock no se suma dos veces.<div class="mt3" style="display:flex;flex-direction:column;gap:6px">${CP.rem.map(r => `<label class="chk"><input type="checkbox" class="cp-rem" data-id="${r.id}"> <b class="mono">${esc(r.numero)}</b> · ${fmtD(r.fecha)}${r.nro_proveedor ? ' · rem. ' + esc(r.nro_proveedor) : ''} · ${r.items.map(i => fmtN(i.cantidad) + ' ' + esc(i.producto)).join(', ')}</label>`).join('')}</div></div>`;
  $('cp_rem').querySelectorAll('.cp-rem').forEach(c => c.onchange = () => { c.checked ? CP.remSel.add(Number(c.dataset.id)) : CP.remSel.delete(Number(c.dataset.id)); compraDesdeRemitos(); });
  compraPintar();
}
function compraDesdeRemitos() {
  const previos = Object.fromEntries(CP.items.filter(i => i.rem).map(i => [i.producto_id, i.costo_neto_unit]));
  CP.items = CP.items.filter(i => !i.rem); const ag = {};
  CP.rem.filter(r => CP.remSel.has(r.id)).forEach(r => r.items.forEach(i => { ag[i.producto_id] = ag[i.producto_id] || { producto_id: i.producto_id, codigo: i.codigo, nombre: i.producto, cantidad: 0 }; ag[i.producto_id].cantidad += Number(i.cantidad); }));
  Object.values(ag).forEach(a => { const p = CP.prods.find(x => x.id === a.producto_id) || {}; CP.items.push({ ...a, iva: Number(p.iva_pct || 21), costo_neto_unit: previos[a.producto_id] ?? Number(p.costo || 0), rem: true }); });
  compraPintar();
}
function compraAgregar() {
  const pid = Number($('cp_prod').dataset.id || 0); if (!pid) return toast('Elegí el producto.', 'r');
  const p = CP.prods.find(x => x.id === pid) || {}; const q = numIn('cp_q'); const cu = numIn('cp_cu');
  if (!q || q <= 0) return toast('Cantidad inválida.', 'r'); if (cu === null || cu < 0) return toast('Indicá el costo.', 'r');
  if (p.controla_vencimiento && (!val('cp_lote') || !val('cp_venc'))) return toast('Este producto pide lote y vencimiento.', 'r');
  const it = { producto_id: pid, codigo: p.codigo, nombre: p.nombre, iva: Number(p.iva_pct || 21), cantidad: q, costo_neto_unit: cu, lote: val('cp_lote') || undefined, vencimiento: val('cp_venc') || undefined, rem: CP.edit !== null ? CP.items[CP.edit].rem : false };
  if (CP.edit !== null) CP.items[CP.edit] = it; else CP.items.push(it);
  CP.edit = null; $('cp_prod').fijar(null); $('cp_q').value = 1; $('cp_cu').value = ''; $('cp_lote').value = ''; $('cp_venc').value = '';
  compraPintar(); $('cp_prod').focus();
}
function compraPintar() {
  $('cp_g').innerHTML = grilla('g_cpi', [{ t: 'Código', k: 'codigo' }, { t: 'Producto', k: 'nombre', f: r => esc(r.nombre) + (r.rem ? ' <span class="badge bb">del remito</span>' : '') }, { t: 'Cant.', k: 'cantidad', f: 'n', cls: 'tr' }, { t: 'Costo unit.', k: 'costo_neto_unit', f: 'm', cls: 'tr' }, { t: 'IVA', k: 'iva', f: 'p', cls: 'tr' }, { t: 'Lote', k: 'lote' }, { t: 'Subtotal neto', k: 'st', f: r => fmt(r.cantidad * r.costo_neto_unit), cls: 'tr' }], CP.items,
    { vacio: 'Agregá los productos de la factura', acciones: (r, i) => `<button class="btn btn-xs btn-b" onclick="compraEditarLinea(${i})"><i class="fas fa-pen"></i></button><button class="btn btn-xs btn-d" onclick="CP.items.splice(${i},1);compraPintar()"><i class="fas fa-trash"></i></button>` });
  compraTotales();
}
function compraEditarLinea(i) { const r = CP.items[i]; CP.edit = i; $('cp_prod').fijar({ id: r.producto_id, label: r.codigo + ' · ' + r.nombre }); $('cp_q').value = r.cantidad; $('cp_cu').value = r.costo_neto_unit; $('cp_lote').value = r.lote || ''; $('cp_venc').value = r.vencimiento || ''; }
function compraTotales() {
  const s = CP.items.reduce((a, r) => a + Math.round(r.cantidad * r.costo_neto_unit * 100) / 100, 0);
  const bon = numIn('cp_bon') || 0, fle = numIn('cp_fle') || 0, perc = (numIn('cp_piva') || 0) + (numIn('cp_piibb') || 0);
  const iva = CP.items.reduce((a, r) => { const sub = r.cantidad * r.costo_neto_unit; const b = s ? bon * sub / s : 0; return a + (sub - b) * r.iva / 100; }, 0) + fle * 0.21;
  CP.total = Math.round((s - bon + fle + iva + perc) * 100) / 100;
  $('cp_tot').innerHTML = `<div class="row"><span>Mercadería neto</span><b class="mono">${fmt(s)}</b></div>${bon ? `<div class="row"><span>Bonificación</span><b class="mono">- ${fmt(bon)}</b></div>` : ''}${fle ? `<div class="row"><span>Flete</span><b class="mono">${fmt(fle)}</b></div>` : ''}<div class="row"><span>IVA</span><b class="mono">${fmt(iva)}</b></div>${perc ? `<div class="row"><span>Percepciones</span><b class="mono">${fmt(perc)}</b></div>` : ''}<div class="row big"><span>TOTAL</span><span class="mono">${fmt(CP.total)}</span></div>`;
}
async function compraRegistrar() {
  const prov = Number($('cp_prov').dataset.id || 0); if (!prov) return toast('Elegí el proveedor.', 'r');
  if (!val('cp_num')) return toast('Indicá el número de la factura.', 'r'); if (!CP.items.length) return toast('Agregá productos.', 'r');
  const perc = []; if (numIn('cp_piva')) perc.push({ tipo: 'PERC_IVA', importe: numIn('cp_piva') }); if (numIn('cp_piibb')) perc.push({ tipo: 'PERC_IIBB', importe: numIn('cp_piibb') });
  const p = { proveedor_id: prov, letra: $('cp_let').value, punto_venta: numIn('cp_pv'), numero: val('cp_num'), fecha: $('cp_fec').value, condicion: $('cp_cond').value, actualiza_costo: $('cp_act').checked,
    bonificacion_neto: numIn('cp_bon') || 0, flete_neto: numIn('cp_fle') || 0, iva_informado: numIn('cp_ivainf'), percepciones: perc,
    items: CP.items.map(r => ({ producto_id: r.producto_id, cantidad: r.cantidad, costo_neto_unit: r.costo_neto_unit, lote: r.lote, vencimiento: r.vencimiento })), remito_ids: [...CP.remSel] };
  if (CP.items.some(i => !(Number(i.costo_neto_unit) > 0))) { if (!await confirmar('Hay productos con costo $ 0. ¿Registrar igual?')) return; }
  if (CP.remSel.size) {
    const rq = {}; CP.rem.filter(r => CP.remSel.has(r.id)).forEach(r => r.items.forEach(i => rq[i.producto_id] = (rq[i.producto_id] || 0) + Number(i.cantidad)));
    const fq = {}; CP.items.forEach(i => fq[i.producto_id] = (fq[i.producto_id] || 0) + Number(i.cantidad));
    const dif = [...new Set([...Object.keys(rq), ...Object.keys(fq)])].filter(k => Math.abs((rq[k] || 0) - (fq[k] || 0)) > 0.0001).map(k => { const it = CP.items.find(i => String(i.producto_id) === k) || {}; const nom = it.nombre || (CP.prods.find(x => String(x.id) === k) || {}).nombre || k; return `${esc(nom)}: remito ${fmtN(rq[k] || 0)} · factura ${fmtN(fq[k] || 0)}`; });
    if (dif.length && !await confirmar(`<b>La factura no coincide con los remitos:</b><br>${dif.join('<br>')}<br><br>El stock va a quedar como dice la factura. ¿Registrar igual?`)) return;
  }
  const fin = async r => { toast('Compra registrada por ' + fmt(r.total) + (r.pago ? ' · pago ' + r.pago : '') + (r.remitos && r.remitos.length ? ' · remito ' + r.remitos.join(', ') : ''), 'g', 7000); await ir('compras'); verCompra(r.compra_id); };
  if (p.condicion === 'contado') modalPagosProv({ total: CP.total, proveedor: prov, titulo: 'Pago de la compra', onConfirm: async pagos => fin(await rpc('registrar_compra_remitos', { p: { ...p, pagos } })) });
  else { if (!await confirmar(`¿Registrar la compra por <b>${fmt(CP.total)}</b> en cuenta corriente?`)) return; fin(await rpc('registrar_compra_remitos', { p })); }
}
async function verCompra(id) {
  const d = await rpc('compra_detalle', { p_id: id });
  showModal(modalHdr(esc(d.tipo + ' ' + d.numero) + ' · ' + esc(d.proveedor.nombre)) + `<div class="mb2"><div class="grid-2 mb3"><div class="kv"><b>Fecha</b><span>${fmtD(d.fecha)}</span><b>Proveedor</b><span>${esc(d.proveedor.nombre)} ${esc(d.proveedor.cuit || '')}</span><b>Estado</b><span>${badgeEstado(d.estado)} ${esc(d.motivo_anulacion || '')}</span></div><div class="kv">${d.origen ? `<b>Factura origen</b><span>${esc(d.origen.numero)}</span>` : ''}<b>Actualizó costos</b><span>${d.actualiza_costo ? 'Sí' : 'No'}</span>${d.devuelve_mercaderia ? '<b>Devolución</b><span>Sí, salió del stock</span>' : ''}</div></div>
    ${grilla('g_cdi', [{ t: 'Código', k: 'codigo' }, { t: 'Producto', k: 'producto' }, { t: 'Cant.', k: 'cantidad', f: 'n', cls: 'tr' }, { t: 'Costo unit.', k: 'costo_neto_unit', f: 'm', cls: 'tr' }, { t: 'IVA', k: 'iva_pct', f: 'p', cls: 'tr' }, { t: 'Lote', k: 'lote' }, { t: 'Neto', k: 'subtotal_neto', f: 'm', cls: 'tr' }], d.items, { vacio: 'Sin productos (nota por importe)' })}
    <div class="flex jb fw gap3 mt3"><div class="f1"><div class="pt mb3">Impuestos</div>${d.impuestos.map(i => `<div class="ss">${esc(i.tipo)}: base ${fmt(i.base)} · ${fmt(i.importe)}</div>`).join('') || '<div class="ss">—</div>'}${d.pagos.length ? '<div class="pt mt3">Pagos aplicados</div>' + d.pagos.map(p => `<div class="ss">${esc(p.numero)} · ${fmtD(p.fecha)} · ${fmt(p.importe)}</div>`).join('') : ''}${d.notas.length ? '<div class="pt mt3">Notas del proveedor</div>' + d.notas.map(n => `<div class="ss">${esc(n.tipo + ' ' + n.numero)} · ${fmt(n.total)} ${n.estado === 'anulado' ? '(anulada)' : ''}</div>`).join('') : ''}</div>
    <div class="tot-box"><div class="row"><span>Neto</span><b class="mono">${fmt(d.subtotal_neto)}</b></div>${Number(d.bonificacion_neto) ? `<div class="row"><span>Bonificación</span><b class="mono">- ${fmt(d.bonificacion_neto)}</b></div>` : ''}${Number(d.flete_neto) ? `<div class="row"><span>Flete</span><b class="mono">${fmt(d.flete_neto)}</b></div>` : ''}<div class="row"><span>IVA</span><b class="mono">${fmt(d.iva)}</b></div>${Number(d.percepciones) ? `<div class="row"><span>Percepciones</span><b class="mono">${fmt(d.percepciones)}</b></div>` : ''}<div class="row big"><span>TOTAL</span><span class="mono">${fmt(d.total)}</span></div>${d.tipo !== 'NC' ? `<div class="row"><span>Saldo</span><b class="mono">${fmt(d.saldo)}</b></div>` : ''}</div></div></div>
    <div class="mf"><button class="btn btn-pdf" onclick="pdfCompra(${d.id})"><i class="fas fa-file-pdf"></i> PDF</button>${Number(d.saldo) > 0 && d.estado === 'registrado' ? `<button class="btn btn-g" onclick="closeModal(this);pagoNuevo(${d.proveedor.id},${d.id})"><i class="fas fa-money-check-dollar"></i> Pagar</button>` : ''}${d.tipo === 'FAC' && d.estado === 'registrado' ? `<button class="btn btn-w" onclick="closeModal(this);notaCompra(${d.id})"><i class="fas fa-rotate-left"></i> NC / ND del proveedor</button>` : ''}<button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-xl');
}
async function pdfCompra(id) {
  const d = await rpc('compra_detalle', { p_id: id });
  const doc = pdfDocumento({ titulo: { FAC: 'FACTURA DE COMPRA', NC: 'NC DE PROVEEDOR', ND: 'ND DE PROVEEDOR' }[d.tipo], numero: d.numero + (d.estado === 'anulado' ? ' (ANULADA)' : ''), fecha: fmtD(d.fecha), sub: 'Registro interno de compra',
    receptor: { titulo: 'Proveedor', lineas: [d.proveedor.nombre, d.proveedor.cuit ? 'CUIT ' + d.proveedor.cuit : ''] },
    cols: ['Código', 'Producto', 'Cant.', 'Costo unit.', 'IVA', 'Neto'], filas: d.items.map(i => [i.codigo, i.producto, fmtN(i.cantidad), fmt(i.costo_neto_unit), fmtP(i.iva_pct), fmt(i.subtotal_neto)]),
    colStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    totales: [['Neto', fmt(d.subtotal_neto)], ...(Number(d.bonificacion_neto) ? [['Bonificación', '- ' + fmt(d.bonificacion_neto)]] : []), ...(Number(d.flete_neto) ? [['Flete', fmt(d.flete_neto)]] : []), ['IVA', fmt(d.iva)], ...(Number(d.percepciones) ? [['Percepciones', fmt(d.percepciones)]] : []), ['TOTAL', fmt(d.total), 1]] });
  pdfSave(doc, 'Compra_' + d.numero.replace(/\W+/g, '_'));
}
async function notaCompra(id) {
  const d = await rpc('compra_detalle', { p_id: id }); const mid = 'ncp' + uid();
  const o = showModal(modalHdr('Nota del proveedor sobre ' + esc(d.numero)) + `<div class="mb2">
    <div class="fr4"><div class="fg"><label class="fl">Tipo</label><select id="${mid}_t" class="fs"><option value="NC">Nota de crédito</option><option value="ND">Nota de débito</option></select></div><div class="fg"><label class="fl">Letra</label><select id="${mid}_l" class="fs"><option>A</option><option>B</option><option>C</option><option>X</option></select></div><div class="fg"><label class="fl">Punto de venta</label><input id="${mid}_pv" type="number" class="fi mono"></div><div class="fg"><label class="fl req">Número</label><input id="${mid}_n" class="fi mono"></div></div>
    <div class="fr"><div class="fg"><label class="fl">Fecha</label><input type="date" id="${mid}_f" class="fi" value="${hoy()}"></div><div class="fg"><label class="fl req">Motivo</label><input id="${mid}_m" class="fi"></div></div>
    <label class="chk"><input type="checkbox" id="${mid}_dev"> Devolvemos mercadería (sale del stock)</label>
    <div id="${mid}_items" class="hidden">${grilla('g_ncpi', [{ t: 'Producto', k: 'producto' }, { t: 'Comprado', k: 'cantidad', f: 'n', cls: 'tr' }, { t: 'Costo unit.', k: 'costo_neto_unit', f: 'm', cls: 'tr' }, { t: 'Devolver', k: 'x', f: r => `<input type="number" min="0" max="${r.cantidad}" step="any" class="fi mono ncp-q" data-p="${r.producto_id}" style="width:90px" value="0">` }], d.items)}</div>
    <div id="${mid}_imp" class="fr"><div class="fg"><label class="fl">Importe neto</label><input id="${mid}_neto" type="number" step="0.01" class="fi mono"></div><div class="fg"><label class="fl">Alícuota IVA</label><select id="${mid}_al" class="fs"><option value="21">21%</option><option value="10.5">10,5%</option><option value="27">27%</option><option value="0">0%</option></select></div></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p" id="${mid}_ok"><i class="fas fa-check"></i> Registrar</button></div>`, 'md-lg');
  $(mid + '_dev').onchange = () => { const v = $(mid + '_dev').checked; $(mid + '_items').classList.toggle('hidden', !v); $(mid + '_imp').classList.toggle('hidden', v); if (v) $(mid + '_t').value = 'NC'; };
  $(mid + '_ok').onclick = async () => {
    const p = { tipo: $(mid + '_t').value, letra: $(mid + '_l').value, punto_venta: numIn(mid + '_pv'), numero: val(mid + '_n'), fecha: $(mid + '_f').value, motivo: val(mid + '_m'), proveedor_id: d.proveedor.id, comprobante_origen_id: id, devuelve_mercaderia: $(mid + '_dev').checked };
    if (p.devuelve_mercaderia) p.items = [...o.querySelectorAll('.ncp-q')].filter(q => Number(q.value) > 0).map(q => ({ producto_id: Number(q.dataset.p), cantidad: Number(q.value) }));
    else { p.neto = numIn(mid + '_neto'); p.alicuota_iva_pct = Number($(mid + '_al').value); }
    const r = await rpc('registrar_nota_compra', { p }); o.remove(); toast((r.tipo === 'NC' ? 'Nota de crédito' : 'Nota de débito') + ' registrada por ' + fmt(r.total), 'g'); if (PAG.id === 'compras') comprasCargar();
  };
}
async function anularCompra(id) {
  const m = await pedirTexto('Anular compra', 'Motivo', { ayuda: 'Solo para errores de carga. La compra queda anulada (no se borra): se saca del stock lo que entró y se restaura el costo anterior. Si venía de remitos, esos remitos vuelven a quedar sin facturar. Si el proveedor hizo una devolución real, cargá una nota de crédito.' }); if (!m) return;
  await rpc('anular_compra_remitos', { p_compra: id, p_motivo: m }); toast('Compra anulada', 'g'); comprasCargar();
}

/* ================= PAGOS A PROVEEDORES ================= */
async function modalPagosProv(opt) {
  const total = Number(opt.total || 0); const mid = 'pp' + uid();
  const cheq = (await rpc('panel_cheques')).filter(c => c.tipo === 'tercero' && c.estado === 'cartera');
  const medios = (M.medios || []).filter(m => ['efectivo', 'transferencia', 'billetera', 'cheque'].includes(m.tipo));
  const o = showModal(modalHdr(opt.titulo || 'Pago al proveedor') + `<div class="mb2"><div class="flex jb aic mb3"><div><div class="sl">A PAGAR</div><div class="sv r">${fmt(total)}</div></div><div class="tr"><div class="sl">FALTA</div><div class="sv" id="${mid}_falta">${fmt(total)}</div></div></div>
    <div id="${mid}_lins"></div><button class="btn btn-s btn-sm mt3" id="${mid}_add"><i class="fas fa-plus"></i> Agregar otro medio</button></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p btn-xl" id="${mid}_ok"><i class="fas fa-check"></i> Confirmar pago</button></div>`, 'md-lg');
  const lins = $(mid + '_lins');
  const opc = [...medios.filter(m => m.tipo !== 'cheque').map(m => [String(m.id), m.nombre]), ['cartera', 'Cheque de terceros (de la cartera)'], ['propio', 'Cheque propio / e-cheq']];
  function extra(div) {
    const v = div.querySelector('.p-med').value; const ex = div.querySelector('.p-ex'); const m = medios.find(x => String(x.id) === v);
    const imp = div.querySelector('.p-imp'); imp.readOnly = false;
    if (m && m.tipo !== 'efectivo') ex.innerHTML = `<div class="fr"><div class="fg"><label class="fl req">Cuenta de la que sale</label><select class="fs p-cta">${(M.cuentas || []).map(c => `<option value="${c.id}" ${c.id === m.cuenta_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div><div class="fg"><label class="fl">Referencia</label><input class="fi p-ref"></div></div>`;
    else if (v === 'cartera') { ex.innerHTML = `<div class="fg"><label class="fl req">Cheque</label><select class="fs p-ch"><option value="">Elegí…</option>${cheq.map(c => `<option value="${c.id}" data-i="${c.importe}">${esc(c.banco + ' N° ' + c.numero + ' · ' + c.librador + ' · vto ' + fmtD(c.fecha_pago))} · ${fmt(c.importe)}</option>`).join('')}</select></div>${cheq.length ? '' : '<div class="ss td">No hay cheques en cartera.</div>'}`; ex.querySelector('.p-ch').onchange = e => { const op = e.target.selectedOptions[0]; imp.value = op && op.dataset.i ? op.dataset.i : ''; imp.readOnly = true; recalc(); }; }
    else if (v === 'propio') ex.innerHTML = `<div class="fr4"><div class="fg"><label class="fl req">Cuenta</label><select class="fs c-cta">${(M.cuentas || []).map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select></div><div class="fg"><label class="fl req">Banco</label><input class="fi c-banco"></div><div class="fg"><label class="fl req">N° cheque</label><input class="fi c-num"></div><div class="fg"><label class="fl req">Fecha de pago</label><input type="date" class="fi c-fp" value="${hoy()}"></div></div><label class="chk"><input type="checkbox" class="c-eq"> e-cheq</label>`;
    else ex.innerHTML = '';
    recalc();
  }
  function agregar(v, importe) {
    const div = document.createElement('div'); div.className = 'panel pb mb3';
    div.innerHTML = `<div class="flex gap2 aic"><div class="fg f1" style="margin:0"><label class="fl">Medio</label><select class="fs p-med">${opc.map(x => `<option value="${x[0]}" ${x[0] === v ? 'selected' : ''}>${esc(x[1])}</option>`).join('')}</select></div><div class="fg" style="margin:0;width:180px"><label class="fl">Importe</label><input class="fi p-imp mono" type="number" step="0.01" value="${importe ?? ''}"></div><button class="btn btn-d btn-sm" style="margin-top:16px"><i class="fas fa-times"></i></button></div><div class="p-ex mt3"></div>`;
    div.querySelector('.p-med').onchange = () => extra(div); div.querySelector('.p-imp').oninput = recalc; div.querySelector('.btn-d').onclick = () => { div.remove(); recalc(); };
    lins.appendChild(div); extra(div);
  }
  function leer() {
    return [...lins.children].map(div => {
      const q = s => div.querySelector(s); const v = q('.p-med').value; const p = { importe: Number(q('.p-imp').value || 0) };
      if (v === 'cartera') { p.medio_pago_id = 6; p.cheque_id = q('.p-ch').value ? Number(q('.p-ch').value) : null; }
      else if (v === 'propio') { p.medio_pago_id = 6; p.cheque_propio = { cuenta_id: Number(q('.c-cta').value), banco: q('.c-banco').value.trim(), numero: q('.c-num').value.trim(), fecha_pago: q('.c-fp').value, echeq: q('.c-eq').checked }; }
      else { p.medio_pago_id = Number(v); if (q('.p-cta')) p.cuenta_id = Number(q('.p-cta').value); if (q('.p-ref') && q('.p-ref').value) p.referencia = q('.p-ref').value; }
      return p;
    });
  }
  function recalc() { const s = leer().reduce((a, p) => a + p.importe, 0); const f = Math.round((total - s) * 100) / 100; $(mid + '_falta').textContent = fmt(f); $(mid + '_falta').className = 'sv ' + (Math.abs(f) < 0.005 ? 'g' : 'r'); }
  $(mid + '_add').onclick = () => { const s = leer().reduce((a, p) => a + p.importe, 0); agregar('cartera', Math.max(0, Math.round((total - s) * 100) / 100) || ''); };
  agregar('1', total || '');
  $(mid + '_ok').onclick = async () => {
    const ps = leer().filter(p => p.importe > 0); if (!ps.length) return toast('Indicá cómo se paga.', 'r');
    const s = Math.round(ps.reduce((a, p) => a + p.importe, 0) * 100) / 100;
    if (opt.exacto !== false && Math.abs(s - total) > 0.004) return toast('Lo cargado (' + fmt(s) + ') no coincide con el total (' + fmt(total) + ').', 'r');
    for (const p of ps) { if (p.medio_pago_id === 6 && !p.cheque_id && !p.cheque_propio) return toast('Elegí el cheque.', 'r'); if (p.cheque_propio && (!p.cheque_propio.banco || !p.cheque_propio.numero)) return toast('Completá banco y número del cheque propio.', 'r'); }
    $(mid + '_ok').disabled = true;
    try { await opt.onConfirm(ps); o.remove(); } catch (e) { $(mid + '_ok').disabled = false; }
  };
}
PAGINAS.pagos = async () => {
  pagina({ titulo: 'Pagos a proveedores', icono: 'money-check-dollar', sub: 'Órdenes de pago con efectivo, transferencia o cheques',
    botones: btnExcel(`exportarExcel('g_pag','Pagos a proveedores')`) + btnPdf(`exportarPdf('g_pag','Pagos a proveedores',filtrosTexto())`) + btnNuevo('pagoNuevo()', 'Nuevo pago'),
    cuerpo: `<div class="panel">${barraFiltros([{ k: 'desde', t: 'desde', v: hoy(-60) }, { k: 'hasta', t: 'hasta', v: hoy() }, { k: 'proveedor_id', t: 'proveedor', l: 'Proveedor' }, { k: 'estado', t: 'sel', l: 'Estado', op: [['emitido', 'Emitido'], ['anulado', 'Anulado']] }, { k: 'texto', t: 'texto' }], pagosCargar)}<div id="pag_g"></div></div>` });
  await pagosCargar();
};
async function pagosCargar() {
  const rows = await rpc('listado_pagos_proveedor', { f: leerFiltros() });
  $('pag_g').innerHTML = grilla('g_pag', [{ t: 'Fecha', k: 'fecha', f: 'dt' }, { t: 'N°', k: 'numero', f: r => `<b class="mono">${esc(r.numero)}</b>`, xf: r => r.numero }, { t: 'Proveedor', k: 'proveedor' }, { t: 'Medios', k: 'medios' }, { t: 'Total', k: 'total', f: 'm', cls: 'tr', sum: 1 }, { t: 'Aplicado', k: 'aplicado', f: 'm', cls: 'tr' }, { t: 'Estado', k: 'estado', f: 'e' }], rows,
    { claseFila: r => r.estado === 'anulado' ? 'anulado' : '', acciones: r => `<button class="btn btn-xs btn-s" title="Ver" onclick="verPago(${r.id})"><i class="fas fa-eye"></i></button><button class="btn btn-xs btn-pdf" title="PDF" onclick="pdfPago(${r.id})"><i class="fas fa-file-pdf"></i></button>${r.estado === 'emitido' ? `<button class="btn btn-xs btn-d" title="Anular" onclick="anularPago(${r.id})"><i class="fas fa-ban"></i></button>` : ''}` });
}
async function pagoNuevo(provId, compraId) {
  const mid = 'pn' + uid();
  const o = showModal(modalHdr('Nuevo pago a proveedor') + `<div class="mb2"><div class="fg"><label class="fl req">Proveedor</label><div id="${mid}_pw"></div></div><div id="${mid}_info"></div>
    <div class="fr mt3"><div class="fg"><label class="fl req">Importe a pagar</label><input id="${mid}_imp" type="number" step="0.01" class="fi mono"></div><div class="fg"><label class="fl">Aplicar primero a</label><select id="${mid}_c" class="fs"><option value="">Las facturas más viejas</option></select></div></div>
    <div class="fg"><label class="fl">Nota</label><input id="${mid}_n" class="fi"></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-y hidden" id="${mid}_ant"><i class="fas fa-wand-magic-sparkles"></i> Aplicar anticipos</button><button class="btn btn-p" id="${mid}_ok"><i class="fas fa-arrow-right"></i> Elegir medios de pago</button></div>`, 'md-lg');
  let prov = null;
  const cargar = async id => {
    prov = id; const cc = await rpc('cta_cte_proveedor', { p_proveedor: id, p_desde: hoy(-3650), p_hasta: hoy() });
    const deuda = cc.pendientes.reduce((a, p) => a + Number(p.saldo), 0);
    $(mid + '_info').innerHTML = `<div class="grid-2 mb3">${kpi('Le debemos', fmt(deuda), cc.pendientes.length + ' comprobantes', 'r')}${kpi('Saldo de cuenta', fmt(cc.saldo), Number(cc.saldo) < deuda ? 'hay anticipos sin aplicar' : '', 'b')}</div>` + grilla('g_pnp', [{ t: 'Comprobante', k: 'numero' }, { t: 'Fecha', k: 'fecha', f: 'd' }, { t: 'Total', k: 'total', f: 'm', cls: 'tr' }, { t: 'Saldo', k: 'saldo', f: 'm', cls: 'tr', sum: 1 }], cc.pendientes, { vacio: 'No hay deuda: lo que pagues queda como anticipo.' });
    $(mid + '_c').innerHTML = '<option value="">Las facturas más viejas</option>' + cc.pendientes.filter(p => p.ref === 'compra').map(p => `<option value="${p.id}" ${p.id === compraId ? 'selected' : ''}>${esc(p.numero)} · saldo ${fmt(p.saldo)}</option>`).join('');
    const sel = cc.pendientes.find(p => p.id === compraId && p.ref === 'compra'); $(mid + '_imp').value = sel ? sel.saldo : (deuda > 0 ? deuda.toFixed(2) : '');
    $(mid + '_ant').classList.toggle('hidden', !(Number(cc.saldo) < deuda - 0.01 && deuda > 0));
  };
  const p0 = provId ? (M.proveedores || []).find(p => p.id === provId) : null;
  buscador(mid + '_pw', { tipo: 'proveedor', id: mid + '_p', valor: p0 ? { id: p0.id, label: p0.nombre } : null, onSelect: p => cargar(p.id) });
  if (provId) cargar(provId);
  $(mid + '_ant').onclick = async () => { const n = await rpc('aplicar_anticipos_proveedor', { p_proveedor: prov }); toast('Se aplicaron ' + fmt(n) + ' de anticipos', 'g'); cargar(prov); };
  $(mid + '_ok').onclick = () => {
    if (!prov) return toast('Elegí el proveedor.', 'r'); const imp = numIn(mid + '_imp'); if (!imp || imp <= 0) return toast('Indicá el importe.', 'r');
    const comp = $(mid + '_c').value ? Number($(mid + '_c').value) : null; const nota = val(mid + '_n') || null;
    modalPagosProv({ total: imp, proveedor: prov, titulo: 'Pago a ' + esc($(mid + '_p').value), onConfirm: async pagos => {
      const r = await rpc('registrar_pago_proveedor', { p_proveedor: prov, p_pagos: pagos, p_comprobante: comp, p_nota: nota });
      o.remove(); toast('Pago ' + r.numero + ' por ' + fmt(r.total), 'g', 6000); if (PAG.id === 'pagos') pagosCargar(); else if (PAG.id === 'compras') comprasCargar(); else if (PAG.id === 'ctacteprov') ctacteProvCargar();
    } });
  };
}
async function verPago(id) {
  const d = await rpc('pago_detalle', { p_id: id });
  showModal(modalHdr('Pago ' + esc(d.numero) + ' · ' + esc(d.proveedor.nombre)) + `<div class="mb2"><div class="kv mb3"><b>Fecha</b><span>${fmtDT(d.fecha)}</span><b>Total</b><span class="mono"><b>${fmt(d.total)}</b></span><b>Estado</b><span>${badgeEstado(d.estado)} ${esc(d.motivo_anulacion || '')}</span></div>
    ${grilla('g_pm', [{ t: 'Medio', k: 'medio' }, { t: 'Detalle', k: 'd', f: r => esc([r.cuenta, r.cheque, r.referencia].filter(Boolean).join(' · ')) }, { t: 'Importe', k: 'importe', f: 'm', cls: 'tr' }], d.medios)}
    <div class="pt mt3 mb3">Aplicado a</div>${grilla('g_pa', [{ t: 'Comprobante', k: 'numero' }, { t: 'Fecha', k: 'fecha', f: 'd' }, { t: 'Importe', k: 'importe', f: 'm', cls: 'tr' }], d.aplicado_a, { vacio: 'Sin aplicar (anticipo)' })}</div>
    <div class="mf"><button class="btn btn-pdf" onclick="pdfPago(${d.id})"><i class="fas fa-file-pdf"></i> PDF</button>${d.estado === 'emitido' ? `<button class="btn btn-d" onclick="closeModal(this);anularPago(${d.id})"><i class="fas fa-ban"></i> Anular</button>` : ''}<button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-lg');
}
async function pdfPago(id) {
  const d = await rpc('pago_detalle', { p_id: id });
  const doc = pdfDocumento({ titulo: 'ORDEN DE PAGO', numero: d.numero + (d.estado === 'anulado' ? ' (ANULADA)' : ''), fecha: fmtD(d.fecha), receptor: { titulo: 'Proveedor', lineas: [d.proveedor.nombre, d.proveedor.cuit ? 'CUIT ' + d.proveedor.cuit : ''] },
    cols: ['Medio', 'Detalle', 'Importe'], filas: d.medios.map(m => [m.medio, [m.cuenta, m.cheque, m.referencia].filter(Boolean).join(' · '), fmt(m.importe)]), colStyles: { 2: { halign: 'right' } },
    totales: [['TOTAL PAGADO', fmt(d.total), 1]], notas: d.aplicado_a.length ? 'Aplicado a: ' + d.aplicado_a.map(a => a.numero + ' (' + fmt(a.importe) + ')').join(', ') : 'Pago a cuenta (anticipo).' });
  pdfSave(doc, d.numero);
}
async function anularPago(id) { const m = await pedirTexto('Anular pago', 'Motivo', { ayuda: 'El pago queda anulado: vuelve la deuda, se revierte la caja/banco y los cheques vuelven a cartera.' }); if (!m) return; await rpc('anular_pago_proveedor', { p_pago: id, p_motivo: m }); toast('Pago anulado', 'g'); pagosCargar(); }

/* ================= CUENTA CORRIENTE PROVEEDORES ================= */
PAGINAS.ctacteprov = async () => {
  pagina({ titulo: 'Cuenta corriente de proveedores', icono: 'book', sub: 'Lo que se le debe a cada proveedor',
    botones: btnExcel(`exportarExcel('g_sp','Saldos proveedores')`) + btnPdf(`exportarPdf('g_sp','Saldos de proveedores')`) + btnNuevo('pagoNuevo()', 'Nuevo pago'),
    cuerpo: `<div class="grid-3 mb3" id="sp_k"></div><div class="panel">${barraFiltros([{ k: 'texto', t: 'texto', ph: 'Proveedor' }, { k: 'todos', t: 'chk', l: 'Incluir saldo cero' }], ctacteProvCargar)}<div id="sp_g"></div></div>` });
  await ctacteProvCargar();
};
async function ctacteProvCargar() {
  const f = leerFiltros(); const n = norm(f.texto || '');
  const rows = (await rpc('saldos_proveedores', { p_solo_con_saldo: !f.todos })).filter(r => !n || norm(r.nombre).includes(n));
  $('sp_k').innerHTML = kpi('Total que debemos', fmt(rows.filter(r => r.saldo > 0).reduce((a, r) => a + Number(r.saldo), 0)), rows.filter(r => r.saldo > 0).length + ' proveedores', 'r') + kpi('Anticipos a favor', fmt(-rows.filter(r => r.saldo < 0).reduce((a, r) => a + Number(r.saldo), 0)), '', 'g') + kpi('Proveedores', rows.length, '');
  $('sp_g').innerHTML = grilla('g_sp', [{ t: 'Proveedor', k: 'nombre', f: r => `<b>${esc(r.nombre)}</b>`, xf: r => r.nombre }, { t: 'CUIT', k: 'cuit' }, { t: 'Teléfono', k: 'telefono' }, { t: 'Saldo', k: 'saldo', f: 'm', cls: 'tr', sum: 1 }], rows,
    { acciones: r => `<button class="btn btn-xs btn-s" title="Estado de cuenta" onclick="estadoCuentaProv(${r.id})"><i class="fas fa-eye"></i></button>${Number(r.saldo) > 0 ? `<button class="btn btn-xs btn-g" title="Pagar" onclick="pagoNuevo(${r.id})"><i class="fas fa-money-check-dollar"></i></button>` : ''}` });
}
function irCtaProv(id) { estadoCuentaProv(id); }
async function estadoCuentaProv(id, desde = hoy(-180), hasta = hoy()) {
  const d = await rpc('cta_cte_proveedor', { p_proveedor: id, p_desde: desde, p_hasta: hasta }); const mid = 'ep' + uid(); PAG.ecp = d;
  document.querySelectorAll('.mo').forEach(m => m.remove());
  showModal(modalHdr('Cuenta corriente · ' + esc(d.proveedor.nombre)) + `<div class="mb2"><div class="fbar mb3" style="border-radius:8px"><div class="fg"><label class="fl">Desde</label><input type="date" id="${mid}_d" class="fi" value="${desde}"></div><div class="fg"><label class="fl">Hasta</label><input type="date" id="${mid}_h" class="fi" value="${hasta}"></div><div class="fg"><button class="btn btn-s btn-sm" id="${mid}_r"><i class="fas fa-rotate"></i> Actualizar</button></div></div>
    <div class="grid-3 mb3">${kpi('Saldo anterior', fmt(d.saldo_anterior))}${kpi('Saldo final', fmt(d.saldo_final), '', 'r')}${kpi('Saldo hoy', fmt(d.saldo), '', 'w')}</div>
    ${grilla('g_ecp', [{ t: 'Fecha', k: 'fecha', f: 'd' }, { t: 'Tipo', k: 'tipo' }, { t: 'Número', k: 'numero' }, { t: 'Detalle', k: 'detalle' }, { t: 'Debe (pagos/NC)', k: 'debe', f: r => Number(r.debe) ? fmt(r.debe) : '', xf: r => Number(r.debe), cls: 'tr' }, { t: 'Haber (facturas)', k: 'haber', f: r => Number(r.haber) ? fmt(r.haber) : '', xf: r => Number(r.haber), cls: 'tr' }, { t: 'Saldo', k: 'saldo', f: 'm', cls: 'tr' }], d.movimientos,
      { vacio: 'Sin movimientos en el período', acciones: r => r.ref === 'compra' ? `<button class="btn btn-xs btn-s" onclick="verCompra(${r.ref_id})"><i class="fas fa-eye"></i></button>` : r.ref === 'pago' ? `<button class="btn btn-xs btn-s" onclick="verPago(${r.ref_id})"><i class="fas fa-eye"></i></button>` : '' })}</div>
    <div class="mf"><button class="btn btn-excel" onclick="exportarExcel('g_ecp','Cuenta proveedor')"><i class="fas fa-file-excel"></i> Excel</button><button class="btn btn-pdf" onclick="pdfCtaProv()"><i class="fas fa-file-pdf"></i> PDF</button>${Number(d.saldo) > 0 ? `<button class="btn btn-g" onclick="closeModal(this);pagoNuevo(${id})"><i class="fas fa-money-check-dollar"></i> Pagar</button>` : ''}<button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-xl');
  $(mid + '_r').onclick = () => estadoCuentaProv(id, $(mid + '_d').value, $(mid + '_h').value);
}
function pdfCtaProv() {
  const d = PAG.ecp;
  const doc = pdfDocumento({ titulo: 'CUENTA PROVEEDOR', numero: 'Del ' + fmtD(d.desde) + ' al ' + fmtD(d.hasta), fecha: fmtD(hoy()), receptor: { titulo: 'Proveedor', lineas: [d.proveedor.nombre, d.proveedor.cuit ? 'CUIT ' + d.proveedor.cuit : ''] },
    cols: ['Fecha', 'Tipo', 'Número', 'Detalle', 'Debe', 'Haber', 'Saldo'], filas: [['', '', '', 'Saldo anterior', '', '', fmt(d.saldo_anterior)], ...d.movimientos.map(m => [fmtD(m.fecha), m.tipo, m.numero, m.detalle || '', Number(m.debe) ? fmt(m.debe) : '', Number(m.haber) ? fmt(m.haber) : '', fmt(m.saldo)])],
    colStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } }, totales: [['Saldo al ' + fmtD(d.hasta), fmt(d.saldo_final), 1]] });
  pdfSave(doc, 'Proveedor_' + d.proveedor.nombre.replace(/\W+/g, '_'));
}
