/* Pirotecnia Boom · Caja, Gastos, Cheques, Bancos, Stock y ajustes */
'use strict';
const BILLETES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10];

/* ================= CAJA ================= */
PAGINAS.caja = async () => {
  const c = await rpc('panel_caja');
  pagina({ titulo: 'Caja', icono: 'cash-register', sub: c.abierta ? 'Caja abierta del ' + fmtD(c.fecha) : 'Apertura, movimientos, cierre y arqueo',
    botones: c.abierta ? `<button class="btn btn-s" onclick="cajaManual('egreso')"><i class="fas fa-circle-up"></i> Retiro</button><button class="btn btn-s" onclick="cajaManual('ingreso')"><i class="fas fa-circle-down"></i> Aporte</button><button class="btn btn-pdf" onclick="pdfCaja(${c.id})"><i class="fas fa-file-pdf"></i> PDF</button><button class="btn btn-p" onclick="cajaCerrar(${c.id})"><i class="fas fa-lock"></i> Cerrar caja</button>` : '',
    cuerpo: `<div id="caja_act"></div><div class="panel mt4"><div class="ph"><span class="pt"><i class="fas fa-clock-rotate-left"></i> Historial de cajas</span><div class="flex gap2">${btnExcel(`exportarExcel('g_cjh','Cajas')`)}${btnPdf(`exportarPdf('g_cjh','Historial de cajas')`)}</div></div>${barraFiltros([{ k: 'desde', t: 'desde', v: hoy(-30) }, { k: 'hasta', t: 'hasta', v: hoy() }, { k: 'estado', t: 'sel', l: 'Estado', op: [['abierta', 'Abierta'], ['cerrada', 'Cerrada']] }], cajasHistorial)}<div id="caja_h"></div></div>` });
  if (!c.abierta) {
    $('caja_act').innerHTML = `<div class="grid-2"><div class="panel"><div class="ph"><span class="pt"><i class="fas fa-lock-open"></i> Abrir caja</span></div><div class="pb"><div class="alert al-w">No hay caja abierta. Para vender de contado, cobrar o pagar en efectivo hay que abrirla. Se abre una por día.</div>
      <div class="fg"><label class="fl">Efectivo con el que arranca</label><input id="ca_ini" type="number" step="0.01" class="fi mono" value="0"></div>
      <details class="mb3"><summary class="ss" style="cursor:pointer">Contar billetes (opcional)</summary><div class="fr4 mt3">${BILLETES.map(b => `<div class="fg"><label class="fl">$ ${nf2.format(b).replace(',00', '')}</label><input type="number" min="0" class="fi mono ca-b" data-d="${b}" value="0"></div>`).join('')}</div></details>
      <button class="btn btn-p btn-xl" id="ca_ok"><i class="fas fa-lock-open"></i> Abrir caja</button></div></div>
      <div class="panel"><div class="ph"><span class="pt">Última caja</span></div><div class="pb">${c.ultima ? `<div class="kv"><b>Fecha</b><span>${fmtD(c.ultima.fecha)}</span><b>Estado</b><span>${badgeEstado(c.ultima.estado)}</span></div><button class="btn btn-s mt3" onclick="verCaja(${c.ultima.id})"><i class="fas fa-eye"></i> Ver detalle</button>` : 'Todavía no se abrió ninguna caja.'}</div></div></div>`;
    document.querySelectorAll('.ca-b').forEach(i => i.oninput = () => { $('ca_ini').value = [...document.querySelectorAll('.ca-b')].reduce((a, x) => a + Number(x.value || 0) * Number(x.dataset.d), 0); });
    $('ca_ok').onclick = async () => {
      const bil = [...document.querySelectorAll('.ca-b')].filter(x => Number(x.value) > 0).map(x => ({ denominacion: Number(x.dataset.d), cantidad: Number(x.value) }));
      await rpc('abrir_caja', { p_saldo_inicial: numIn('ca_ini') || 0, p_billetes: bil, p_puesto: 'Caja 1' }); toast('Caja abierta', 'g'); ir('caja');
    };
  } else {
    const d = await rpc('caja_detalle', { p_id: c.id }); PAG.caja = d;
    const ef = (d.resumen.find(r => r.medio_pago_id === 1) || {}).saldo || 0;
    $('caja_act').innerHTML = `<div class="grid-4 mb3">${kpi('Efectivo en caja', fmt(ef), 'según sistema', 'g')}${d.resumen.filter(r => r.medio_pago_id !== 1).slice(0, 3).map(r => kpi(esc(r.medio), fmt(r.saldo), 'ingresos ' + fmt(r.ingresos))).join('')}</div>
      <div class="panel"><div class="ph"><span class="pt"><i class="fas fa-list"></i> Movimientos de la caja</span><div class="flex gap2">${btnExcel(`exportarExcel('g_cjm','Movimientos de caja')`)}</div></div>${grilla('g_cjm', [{ t: 'Hora', k: 'fecha', f: 'dt' }, { t: 'Tipo', k: 'tipo', f: r => r.tipo === 'ingreso' ? '<span class="tg">Ingreso</span>' : '<span class="td">Egreso</span>', xf: r => r.tipo }, { t: 'Origen', k: 'origen' }, { t: 'Medio', k: 'medio' }, { t: 'Descripción', k: 'descripcion' }, { t: 'Importe', k: 'importe', f: r => `<span class="${r.tipo === 'ingreso' ? 'tg' : 'td'}">${r.tipo === 'egreso' ? '- ' : ''}${fmt(r.importe)}</span>`, xf: r => (r.tipo === 'egreso' ? -1 : 1) * Number(r.importe), cls: 'tr' }], d.movimientos.slice().reverse(),
        { claseFila: r => r.revertido ? 'anulado' : '', acciones: r => r.manual && !r.revertido && !r.es_reversion ? `<button class="btn btn-xs btn-d" title="Revertir" onclick="cajaRevertir(${r.id})"><i class="fas fa-rotate-left"></i></button>` : '' })}</div>`;
  }
  await cajasHistorial();
};
async function cajasHistorial() {
  const rows = await rpc('listado_cajas', { f: leerFiltros() });
  $('caja_h').innerHTML = grilla('g_cjh', [{ t: 'Fecha', k: 'fecha', f: 'd' }, { t: 'Abrió', k: 'abierta_por' }, { t: 'Inicial', k: 'saldo_inicial', f: 'm', cls: 'tr' }, { t: 'Ingresos', k: 'ingresos', f: 'm', cls: 'tr' }, { t: 'Egresos', k: 'egresos', f: 'm', cls: 'tr' }, { t: 'Efectivo final', k: 'efectivo_sistema', f: 'm', cls: 'tr' }, { t: 'Diferencia', k: 'diferencia', f: r => r.diferencia == null ? '' : `<span class="${Number(r.diferencia) ? 'td' : 'tg'}">${fmt(r.diferencia)}</span>`, xf: r => Number(r.diferencia || 0), cls: 'tr' }, { t: 'Cerró', k: 'cerrada_por' }, { t: 'Estado', k: 'estado', f: 'e' }], rows,
    { acciones: r => `<button class="btn btn-xs btn-s" title="Ver" onclick="verCaja(${r.id})"><i class="fas fa-eye"></i></button><button class="btn btn-xs btn-pdf" title="PDF" onclick="pdfCaja(${r.id})"><i class="fas fa-file-pdf"></i></button>` });
}
async function cajaManual(tipo) {
  const mid = 'cm' + uid();
  const o = showModal(modalHdr(tipo === 'egreso' ? 'Retiro de caja' : 'Aporte a caja') + `<div class="mb2"><div class="fr"><div class="fg"><label class="fl">Medio</label><select id="${mid}_m" class="fs">${(M.medios || []).filter(m => m.tipo === 'efectivo').map(m => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('')}</select></div><div class="fg"><label class="fl req">Importe</label><input id="${mid}_i" type="number" step="0.01" class="fi mono"></div></div><div class="fg"><label class="fl req">Descripción</label><input id="${mid}_d" class="fi" placeholder="${tipo === 'egreso' ? 'Ej: retiro del dueño, depósito' : 'Ej: cambio para la caja'}"></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p" id="${mid}_ok"><i class="fas fa-check"></i> Registrar</button></div>`, 'md-sm');
  $(mid + '_ok').onclick = async () => { await rpc('movimiento_caja_manual', { p_tipo: tipo, p_medio: Number($(mid + '_m').value), p_importe: numIn(mid + '_i'), p_descripcion: val(mid + '_d'), p_puesto: 'Caja 1' }); o.remove(); toast('Registrado', 'g'); ir('caja'); };
}
async function cajaRevertir(id) { const m = await pedirTexto('Revertir movimiento', 'Motivo', { ayuda: 'No se borra: se registra un movimiento inverso.' }); if (!m) return; await rpc('revertir_movimiento_caja', { p_mov: id, p_motivo: m }); toast('Revertido', 'g'); ir('caja'); }
async function cajaCerrar(id) {
  const d = PAG.caja; const mid = 'cc' + uid();
  const med = d.resumen.filter(r => r.medio_pago_id !== 6);
  const o = showModal(modalHdr('Cerrar caja · arqueo') + `<div class="mb2"><div class="alert al-i">Contá lo que hay y cargalo. Si no coincide con el sistema, la diferencia queda registrada como sobrante o faltante.</div>
    <table><thead><tr><th>Medio</th><th class="tr">Sistema</th><th class="tr">Contado</th><th class="tr">Diferencia</th></tr></thead><tbody>${med.map(r => `<tr><td>${esc(r.medio)}</td><td class="tr mono">${fmt(r.saldo)}</td><td class="tr"><input type="number" step="0.01" class="fi mono cc-c" data-m="${r.medio_pago_id}" data-s="${r.saldo}" value="${r.saldo}" style="width:150px;text-align:right"></td><td class="tr mono cc-d" data-m="${r.medio_pago_id}">${fmt(0)}</td></tr>`).join('')}</tbody></table>
    <details class="mt3"><summary class="ss" style="cursor:pointer">Contar billetes del efectivo</summary><div class="fr4 mt3">${BILLETES.map(b => `<div class="fg"><label class="fl">$ ${nf2.format(b).replace(',00', '')}</label><input type="number" min="0" class="fi mono cc-b" data-d="${b}" value="0"></div>`).join('')}</div></details>
    <div class="fr mt3"><div class="fg"><label class="fl">Observaciones</label><input id="${mid}_o" class="fi"></div><div class="fg"><label class="fl">Responsable de la diferencia (si hay)</label><input id="${mid}_r" class="fi"></div></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p btn-xl" id="${mid}_ok"><i class="fas fa-lock"></i> Cerrar caja</button></div>`, 'md-lg');
  const rec = () => o.querySelectorAll('.cc-c').forEach(i => { const df = Number(i.value || 0) - Number(i.dataset.s); const t = o.querySelector(`.cc-d[data-m="${i.dataset.m}"]`); t.textContent = fmt(df); t.className = 'tr mono cc-d ' + (Math.abs(df) > 0.004 ? 'td' : 'tg'); });
  o.querySelectorAll('.cc-c').forEach(i => i.oninput = rec);
  o.querySelectorAll('.cc-b').forEach(i => i.oninput = () => { const t = [...o.querySelectorAll('.cc-b')].reduce((a, x) => a + Number(x.value || 0) * Number(x.dataset.d), 0); const e = o.querySelector('.cc-c[data-m="1"]'); if (e) { e.value = t; rec(); } });
  $(mid + '_ok').onclick = async () => {
    const cont = [...o.querySelectorAll('.cc-c')].map(i => ({ medio_pago_id: Number(i.dataset.m), importe: Number(i.value || 0) }));
    const bil = [...o.querySelectorAll('.cc-b')].filter(x => Number(x.value) > 0).map(x => ({ denominacion: Number(x.dataset.d), cantidad: Number(x.value) }));
    if (!await confirmar('¿Cerrar la caja? Después no se puede volver a abrir la de hoy.')) return;
    await rpc('cerrar_caja', { p_caja: id, p_contado: cont, p_billetes: bil, p_observaciones: val(mid + '_o') || null, p_responsable_diferencia: val(mid + '_r') || null });
    o.remove(); toast('Caja cerrada', 'g'); await ir('caja'); pdfCaja(id);
  };
}
async function verCaja(id) {
  const d = await rpc('caja_detalle', { p_id: id });
  showModal(modalHdr('Caja del ' + fmtD(d.fecha)) + `<div class="mb2"><div class="kv mb3"><b>Estado</b><span>${badgeEstado(d.estado)}</span><b>Abrió</b><span>${esc(d.abierta_por || '')} · ${fmtDT(d.abierta_at)}</span>${d.cerrada_at ? `<b>Cerró</b><span>${esc(d.cerrada_por || '')} · ${fmtDT(d.cerrada_at)}</span>` : ''}<b>Saldo inicial</b><span>${fmt(d.saldo_inicial)}</span></div>
    <div class="pt mb3">Resumen por medio</div>${grilla('g_vcr', [{ t: 'Medio', k: 'medio' }, { t: 'Ingresos', k: 'ingresos', f: 'm', cls: 'tr' }, { t: 'Egresos', k: 'egresos', f: 'm', cls: 'tr' }, { t: 'Saldo', k: 'saldo', f: 'm', cls: 'tr' }], d.resumen)}
    ${d.arqueo ? `<div class="pt mt3 mb3">Arqueo</div>${grilla('g_vca', [{ t: 'Medio', k: 'medio' }, { t: 'Sistema', k: 'sistema', f: 'm', cls: 'tr' }, { t: 'Contado', k: 'contado', f: 'm', cls: 'tr' }, { t: 'Diferencia', k: 'diferencia', f: 'm', cls: 'tr' }], d.arqueo.medios)}${d.arqueo.observaciones ? `<div class="ss mt3">Obs.: ${esc(d.arqueo.observaciones)}</div>` : ''}` : ''}
    <div class="pt mt3 mb3">Movimientos</div>${grilla('g_vcm', [{ t: 'Hora', k: 'fecha', f: 'dt' }, { t: 'Tipo', k: 'tipo' }, { t: 'Medio', k: 'medio' }, { t: 'Descripción', k: 'descripcion' }, { t: 'Importe', k: 'importe', f: 'm', cls: 'tr' }], d.movimientos)}</div>
    <div class="mf"><button class="btn btn-pdf" onclick="pdfCaja(${d.id})"><i class="fas fa-file-pdf"></i> PDF</button><button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-xl');
}
async function pdfCaja(id) {
  const d = await rpc('caja_detalle', { p_id: id });
  const doc = pdfNew('CAJA DIARIA', 'Fecha: ' + fmtD(d.fecha) + '\nEstado: ' + d.estado, false);
  let y = pdfTable(doc, ['Medio', 'Ingresos', 'Egresos', 'Saldo'], d.resumen.map(r => [r.medio, fmt(r.ingresos), fmt(r.egresos), fmt(r.saldo)]), null, 40, { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } });
  if (d.arqueo) y = pdfTable(doc, ['Arqueo', 'Sistema', 'Contado', 'Diferencia'], d.arqueo.medios.map(r => [r.medio, fmt(r.sistema), fmt(r.contado), fmt(r.diferencia)]), null, y + 6, { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } });
  pdfTable(doc, ['Hora', 'Tipo', 'Medio', 'Descripción', 'Importe'], d.movimientos.map(m => [fmtDT(m.fecha), m.tipo, m.medio, m.descripcion, (m.tipo === 'egreso' ? '- ' : '') + fmt(m.importe)]), null, y + 6, { 4: { halign: 'right' } });
  pdfSave(doc, 'Caja_' + d.fecha);
}

/* ================= GASTOS ================= */
PAGINAS.gastos = async () => {
  pagina({ titulo: 'Gastos', icono: 'file-invoice-dollar', sub: 'Registro y control de egresos',
    botones: btnExcel(`exportarExcel('g_gas','Gastos')`) + btnPdf(`exportarPdf('g_gas','Gastos',filtrosTexto())`) + btnNuevo('gastoNuevo()', 'Nuevo gasto'),
    cuerpo: `<div class="grid-3 mb3" id="gas_k"></div><div class="panel">${barraFiltros([{ k: 'desde', t: 'desde', v: iniMes() }, { k: 'hasta', t: 'hasta', v: hoy() }, { k: 'tipo_gasto_id', t: 'sel', l: 'Tipo', op: OPC.tiposGasto() }, { k: 'concepto_id', t: 'concepto', l: 'Concepto' }, ...(ES_DUENO ? [{ k: 'proveedor_id', t: 'proveedor', l: 'Proveedor' }] : []), { k: 'estado', t: 'sel', l: 'Estado', op: [['registrado', 'Registrado'], ['anulado', 'Anulado']], v: 'registrado' }, { k: 'texto', t: 'texto' }], gastosCargar)}<div id="gas_g"></div></div>` });
  await gastosCargar();
};
async function gastosCargar() {
  const rows = await rpc('listado_gastos', { f: leerFiltros() }); const v = rows.filter(r => r.estado === 'registrado');
  $('gas_k').innerHTML = kpi('Total del período', fmt(v.reduce((a, r) => a + Number(r.total), 0)), v.length + ' gastos', 'r') + kpi('De contado', fmt(v.filter(r => r.condicion === 'contado').reduce((a, r) => a + Number(r.total), 0))) + kpi('A pagar (cta. cte.)', fmt(v.reduce((a, r) => a + Number(r.saldo || 0), 0)), '', 'w');
  $('gas_g').innerHTML = grilla('g_gas', [{ t: 'Fecha', k: 'fecha', f: 'd' }, { t: 'N°', k: 'numero' }, { t: 'Descripción', k: 'descripcion', f: r => `<b>${esc(r.descripcion)}</b>${r.automatico ? ' <span class="badge bm">automático</span>' : ''}`, xf: r => r.descripcion }, { t: 'Conceptos', k: 'conceptos' }, { t: 'Proveedor', k: 'proveedor' }, { t: 'Medio', k: 'medio' }, { t: 'Total', k: 'total', f: 'm', cls: 'tr', sum: 1 }, { t: 'Estado', k: 'estado', f: 'e' }], rows,
    { claseFila: r => r.estado === 'anulado' ? 'anulado' : '', acciones: r => `<button class="btn btn-xs btn-s" title="Ver" onclick="verGasto(${r.id})"><i class="fas fa-eye"></i></button><button class="btn btn-xs btn-pdf" title="PDF" onclick="pdfGasto(${r.id})"><i class="fas fa-file-pdf"></i></button>${ES_DUENO && r.estado === 'registrado' && !r.automatico ? `<button class="btn btn-xs btn-d" title="Anular" onclick="anularGasto(${r.id})"><i class="fas fa-ban"></i></button>` : ''}` });
}
function gastoNuevo() {
  const mid = 'gn' + uid(); let lins = [];
  const medios = (M.medios || []).filter(m => !['cheque', 'otro'].includes(m.tipo));
  const o = showModal(modalHdr('Nuevo gasto') + `<div class="mb2"><div class="fr"><div class="fg"><label class="fl req">Descripción</label><input id="${mid}_d" class="fi" placeholder="Ej: luz de octubre"></div><div class="fg"><label class="fl">Fecha</label><input type="date" id="${mid}_f" class="fi" value="${hoy()}"></div></div>
    <div class="fr3"><div class="fg"><label class="fl">Condición</label><select id="${mid}_c" class="fs"><option value="contado">Contado (se paga ahora)</option>${ES_DUENO ? '<option value="cuenta_corriente">A pagar (cuenta corriente)</option>' : ''}</select></div><div class="fg" id="${mid}_mw"><label class="fl">Medio de pago</label><select id="${mid}_m" class="fs">${medios.map(m => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('')}</select></div><div class="fg" id="${mid}_cw"><label class="fl">Cuenta de la que sale</label><select id="${mid}_cta" class="fs">${(M.cuentas || []).map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select></div></div>
    <div class="fr3"><div class="fg"><label class="fl">Proveedor ${ES_DUENO ? '' : '(opcional)'}</label><div id="${mid}_pw"></div></div><div class="fg"><label class="fl">N° de comprobante</label><input id="${mid}_nc" class="fi"></div><div class="fg"><label class="fl">IVA incluido (si tiene factura A)</label><input id="${mid}_iva" type="number" step="0.01" class="fi mono" value="0"></div></div>
    <div class="panel mt3"><div class="ph"><span class="pt">Conceptos</span></div><div class="pb"><div class="fr3" style="grid-template-columns:2fr 1fr 2fr auto;align-items:end"><div class="fg" style="margin:0"><label class="fl">Concepto</label><div id="${mid}_cpw"></div></div><div class="fg" style="margin:0"><label class="fl">Importe</label><input id="${mid}_i" type="number" step="0.01" class="fi mono"></div><div class="fg" style="margin:0"><label class="fl">Detalle</label><input id="${mid}_det" class="fi"></div><button class="btn btn-s" id="${mid}_a"><i class="fas fa-plus"></i></button></div><div id="${mid}_l" class="mt3"></div></div></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p" id="${mid}_ok"><i class="fas fa-check"></i> Registrar gasto</button></div>`, 'md-lg');
  buscador(mid + '_pw', { tipo: 'proveedor', id: mid + '_p', placeholder: 'Opcional' });
  buscador(mid + '_cpw', { tipo: 'concepto', id: mid + '_cp' });
  const vis = () => { const cc = $(mid + '_c').value === 'cuenta_corriente'; const m = medios.find(x => x.id === Number($(mid + '_m').value)) || {}; $(mid + '_mw').style.visibility = cc ? 'hidden' : ''; $(mid + '_cw').style.visibility = !cc && m.tipo !== 'efectivo' ? '' : 'hidden'; if (m.cuenta_id) $(mid + '_cta').value = m.cuenta_id; };
  $(mid + '_c').onchange = vis; $(mid + '_m').onchange = vis; vis();
  const pintar = () => $(mid + '_l').innerHTML = grilla('g_gl', [{ t: 'Concepto', k: 'nombre' }, { t: 'Detalle', k: 'detalle' }, { t: 'Importe', k: 'importe', f: 'm', cls: 'tr', sum: 1 }], lins, { vacio: 'Agregá al menos un concepto', acciones: (r, i) => `<button class="btn btn-xs btn-d" onclick="this.closest('.mo')._q(${i})"><i class="fas fa-trash"></i></button>` });
  o._q = i => { lins.splice(i, 1); pintar(); }; pintar();
  $(mid + '_a').onclick = () => { const c = Number($(mid + '_cp').dataset.id || 0); const i = numIn(mid + '_i'); if (!c) return toast('Elegí el concepto.', 'r'); if (!i || i <= 0) return toast('Importe inválido.', 'r'); lins.push({ concepto_id: c, nombre: $(mid + '_cp').value, importe: i, detalle: val(mid + '_det') }); $(mid + '_cp').fijar(null); $(mid + '_i').value = ''; $(mid + '_det').value = ''; pintar(); $(mid + '_cp').focus(); };
  $(mid + '_i').onkeydown = e => { if (e.key === 'Enter') $(mid + '_a').click(); };
  $(mid + '_ok').onclick = async () => {
    if (!lins.length && Number($(mid + '_cp').dataset.id || 0) && numIn(mid + '_i')) $(mid + '_a').click();
    if (!lins.length) return toast('Agregá al menos un concepto con su importe.', 'r');
    const cond = $(mid + '_c').value; const tot = lins.reduce((a, l) => a + l.importe, 0); const iva = numIn(mid + '_iva') || 0;
    const m = medios.find(x => x.id === Number($(mid + '_m').value)) || {};
    const p = { descripcion: val(mid + '_d'), fecha: $(mid + '_f').value, condicion: cond, proveedor_id: $(mid + '_p').dataset.id ? Number($(mid + '_p').dataset.id) : null, nro_comprobante: val(mid + '_nc') || null, iva, neto: tot - iva, items: lins.map(l => ({ concepto_id: l.concepto_id, importe: l.importe, detalle: l.detalle || null })) };
    if (cond === 'contado') { p.medio_pago_id = m.id; if (m.tipo !== 'efectivo') p.cuenta_id = Number($(mid + '_cta').value); }
    const r = await rpc('registrar_gasto', { p }); o.remove(); toast('Gasto ' + r.numero + ' por ' + fmt(r.total), 'g'); if (PAG.id === 'gastos') gastosCargar();
  };
}
async function verGasto(id) {
  const d = await rpc('gasto_detalle', { p_id: id });
  showModal(modalHdr('Gasto ' + esc(d.numero)) + `<div class="mb2"><div class="kv mb3"><b>Fecha</b><span>${fmtD(d.fecha)}</span><b>Descripción</b><span>${esc(d.descripcion)}</span><b>Proveedor</b><span>${esc(d.proveedor || '—')} ${esc(d.nro_comprobante || '')}</span><b>Condición / medio</b><span>${d.condicion === 'contado' ? 'Contado' : 'Cuenta corriente'} · ${esc(d.medio)}</span><b>Estado</b><span>${badgeEstado(d.estado)} ${esc(d.motivo_anulacion || '')}</span></div>
    ${grilla('g_gi', [{ t: 'Tipo', k: 'tipo' }, { t: 'Concepto', k: 'concepto' }, { t: 'Detalle', k: 'detalle' }, { t: 'Importe', k: 'importe', f: 'm', cls: 'tr', sum: 1 }], d.items)}</div>
    <div class="mf"><button class="btn btn-pdf" onclick="pdfGasto(${d.id})"><i class="fas fa-file-pdf"></i> PDF</button>${ES_DUENO && d.estado === 'registrado' ? `<button class="btn btn-d" onclick="closeModal(this);anularGasto(${d.id})"><i class="fas fa-ban"></i> Anular</button>` : ''}<button class="btn btn-s" onclick="closeModal(this)">Cerrar</button></div>`, 'md-lg');
}
async function pdfGasto(id) {
  const d = await rpc('gasto_detalle', { p_id: id });
  const doc = pdfDocumento({ titulo: 'GASTO', numero: d.numero + (d.estado === 'anulado' ? ' (ANULADO)' : ''), fecha: fmtD(d.fecha), receptor: { titulo: 'Detalle', lineas: [d.descripcion, d.proveedor ? 'Proveedor: ' + d.proveedor : '', d.nro_comprobante ? 'Comprobante: ' + d.nro_comprobante : '', (d.condicion === 'contado' ? 'Contado · ' : 'Cuenta corriente · ') + d.medio] },
    cols: ['Tipo', 'Concepto', 'Detalle', 'Importe'], filas: d.items.map(i => [i.tipo, i.concepto, i.detalle || '', fmt(i.importe)]), colStyles: { 3: { halign: 'right' } }, totales: [['TOTAL', fmt(d.total), 1]] });
  pdfSave(doc, d.numero);
}
async function anularGasto(id) { const m = await pedirTexto('Anular gasto', 'Motivo', { ayuda: 'El gasto queda anulado (no se borra) y se revierte el pago en caja o banco.' }); if (!m) return; await rpc('anular_gasto', { p_gasto: id, p_motivo: m }); toast('Gasto anulado', 'g'); gastosCargar(); }

/* ================= CHEQUES ================= */
PAGINAS.cheques = async () => {
  pagina({ titulo: 'Cheques', icono: 'money-check', sub: 'Cartera de terceros y cheques propios',
    botones: btnExcel(`exportarExcel('g_chq','Cheques')`) + btnPdf(`exportarPdf('g_chq','Cheques')`),
    cuerpo: `<div class="grid-4 mb3" id="chq_k"></div><div class="panel">${barraFiltros([{ k: 'tipo', t: 'sel', l: 'Tipo', op: [['tercero', 'De terceros'], ['propio', 'Propios']] }, { k: 'estado', t: 'sel', l: 'Estado', op: ['cartera', 'depositado', 'acreditado', 'endosado', 'rechazado', 'emitido', 'debitado', 'anulado'].map(e => [e, e]) }, { k: 'texto', t: 'texto', ph: 'Banco, número, librador' }], chequesPintar)}<div id="chq_g"></div></div>` });
  PAG.chq = await rpc('panel_cheques'); chequesPintar();
};
function chequesPintar() {
  const f = leerFiltros(); const n = norm(f.texto || ''); const all = PAG.chq;
  const rows = all.filter(c => (!f.tipo || c.tipo === f.tipo) && (!f.estado || c.estado === f.estado) && (!n || norm([c.banco, c.numero, c.librador, c.cliente, c.proveedor].join(' ')).includes(n)));
  const s = (t, e) => all.filter(c => c.tipo === t && e.includes(c.estado)).reduce((a, c) => a + Number(c.importe), 0);
  $('chq_k').innerHTML = kpi('En cartera', fmt(s('tercero', ['cartera'])), all.filter(c => c.estado === 'cartera').length + ' cheques', 'g') + kpi('Depositados (a acreditar)', fmt(s('tercero', ['depositado'])), '', 'b') + kpi('Propios a debitar', fmt(s('propio', ['emitido'])), '', 'r') + kpi('Rechazados', fmt(s('tercero', ['rechazado'])), '', 'w');
  $('chq_g').innerHTML = grilla('g_chq', [{ t: 'Tipo', k: 'tipo', f: r => r.tipo === 'tercero' ? 'Tercero' : 'Propio' }, { t: 'Banco', k: 'banco' }, { t: 'N°', k: 'numero' }, { t: 'Librador', k: 'librador' }, { t: 'Vence', k: 'fecha_pago', f: r => `<span class="${['cartera', 'emitido'].includes(r.estado) && r.fecha_pago <= hoy(7) ? 'td' : ''}">${fmtD(r.fecha_pago)}</span>`, xf: r => fmtD(r.fecha_pago) }, { t: 'Importe', k: 'importe', f: 'm', cls: 'tr', sum: 1 }, { t: 'De / a', k: 'q', f: r => esc(r.cliente || r.proveedor || ''), xf: r => r.cliente || r.proveedor || '' }, { t: 'Cuenta', k: 'cuenta' }, { t: 'Estado', k: 'estado', f: 'e' }], rows,
    { acciones: r => ES_DUENO ? (r.estado === 'cartera' ? `<button class="btn btn-xs btn-b" title="Depositar" onclick="chequeDepositar(${r.id})"><i class="fas fa-building-columns"></i></button>` : '') + (r.estado === 'depositado' ? `<button class="btn btn-xs btn-g" title="Acreditado" onclick="chequeAccion('acreditar_cheque',${r.id},'¿El banco acreditó el cheque?')"><i class="fas fa-check"></i></button>` : '') + (['cartera', 'depositado', 'endosado'].includes(r.estado) ? `<button class="btn btn-xs btn-d" title="Rechazado" onclick="chequeRechazar(${r.id})"><i class="fas fa-ban"></i></button>` : '') + (r.estado === 'emitido' ? `<button class="btn btn-xs btn-g" title="Debitado del banco" onclick="chequeAccion('debitar_cheque_propio',${r.id},'¿El banco debitó el cheque propio?')"><i class="fas fa-check"></i></button>` : '') : '' });
}
async function chequeDepositar(id) {
  const mid = 'cd' + uid();
  const o = showModal(modalHdr('Depositar cheque') + `<div class="mb2"><div class="fg"><label class="fl">Cuenta</label><select id="${mid}" class="fs">${(M.cuentas || []).filter(c => c.tipo === 'banco').map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select></div></div><div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p" id="${mid}_ok">Depositar</button></div>`, 'md-sm');
  $(mid + '_ok').onclick = async () => { if (!$(mid).value) return toast('Cargá una cuenta bancaria primero.', 'r'); await rpc('depositar_cheque', { p_cheque: id, p_cuenta: Number($(mid).value) }); o.remove(); toast('Cheque depositado', 'g'); PAG.chq = await rpc('panel_cheques'); chequesPintar(); };
}
async function chequeAccion(fn, id, txt) { if (!await confirmar(txt)) return; await rpc(fn, { p_cheque: id }); toast('Listo', 'g'); PAG.chq = await rpc('panel_cheques'); chequesPintar(); }
async function chequeRechazar(id) {
  const mid = 'cr' + uid();
  const o = showModal(modalHdr('Cheque rechazado') + `<div class="mb2"><div class="alert al-w">Se genera una nota de débito al cliente por el importe del cheque (y por los gastos bancarios si se cargan).</div><div class="fg"><label class="fl req">Motivo</label><input id="${mid}_m" class="fi" placeholder="Ej: sin fondos"></div><div class="fg"><label class="fl">Gastos bancarios a cobrar (neto)</label><input id="${mid}_g" type="number" step="0.01" class="fi mono" value="0"></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-d" id="${mid}_ok">Registrar rechazo</button></div>`, 'md-sm');
  $(mid + '_ok').onclick = async () => { const r = await rpc('rechazar_cheque', { p_cheque: id, p_motivo: val(mid + '_m'), p_gastos_neto: numIn(mid + '_g') || 0 }); o.remove(); toast('Cheque rechazado' + (r.aviso ? ' · ' + r.aviso : ''), 'w', 8000); PAG.chq = await rpc('panel_cheques'); chequesPintar(); };
}

/* ================= BANCOS ================= */
PAGINAS.bancos = async () => {
  pagina({ titulo: 'Bancos y billeteras', icono: 'building-columns', sub: 'Saldos, movimientos y conciliación',
    botones: `<button class="btn btn-s" onclick="bancoOp('transferencia')"><i class="fas fa-right-left"></i> Transferir entre cuentas</button><button class="btn btn-s" onclick="bancoOp('deposito')"><i class="fas fa-money-bill-transfer"></i> Depositar efectivo</button><button class="btn btn-s" onclick="bancoOp('manual')"><i class="fas fa-pen-to-square"></i> Movimiento manual</button>`,
    cuerpo: `<div class="grid-4 mb3" id="ban_k"></div><div class="panel"><div class="ph"><span class="pt">Movimientos</span><div class="flex gap2 aic"><select id="ban_c" class="fs" style="min-width:220px"></select>${btnExcel(`exportarExcel('g_ban','Movimientos banco')`)}${btnPdf(`exportarPdf('g_ban','Movimientos de cuenta')`)}</div></div><div id="ban_g"></div></div>` });
  const cs = await rpc('panel_cuentas'); PAG.ctas = cs;
  if (!cs.length) { $('ban_g').innerHTML = '<div class="pb"><div class="alert al-w">No hay cuentas cargadas. Cargalas en Maestros → Cuentas bancarias.</div></div>'; return; }
  $('ban_k').innerHTML = cs.filter(c => c.estado === 'activa').map(c => kpi(esc(c.nombre), fmt(c.saldo), esc(c.banco || c.tipo), Number(c.saldo) < 0 ? 'r' : 'g')).join('');
  $('ban_c').innerHTML = cs.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join(''); $('ban_c').onchange = bancoMovs; bancoMovs();
};
async function bancoMovs() {
  const rows = await rpc('panel_movimientos_cuenta', { p_cuenta: Number($('ban_c').value) });
  $('ban_g').innerHTML = grilla('g_ban', [{ t: 'Fecha', k: 'fecha', f: 'dt' }, { t: 'Tipo', k: 'tipo' }, { t: 'Origen', k: 'origen' }, { t: 'Descripción', k: 'descripcion' }, { t: 'Importe', k: 'importe', f: r => `<span class="${r.tipo === 'ingreso' ? 'tg' : 'td'}">${r.tipo === 'egreso' ? '- ' : ''}${fmt(r.importe)}</span>`, xf: r => (r.tipo === 'egreso' ? -1 : 1) * Number(r.importe), cls: 'tr' }, { t: 'Conciliado', k: 'conciliado', f: r => `<label class="chk" style="justify-content:center"><input type="checkbox" ${r.conciliado ? 'checked' : ''} onchange="bancoConciliar(${r.id},this.checked)"></label>`, xf: r => r.conciliado ? 'Sí' : 'No', cls: 'tc' }], rows);
}
async function bancoConciliar(id, v) { await rpc('conciliar_movimiento', { p_mov: id, p_conciliado: v }); toast(v ? 'Conciliado' : 'Desmarcado', 'g', 1500); }
function bancoOp(tipo) {
  const mid = 'bo' + uid(); const op = (M.cuentas || []).map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  const t = { transferencia: 'Transferir entre cuentas', deposito: 'Depositar efectivo de la caja', manual: 'Movimiento manual (gastos bancarios, intereses, ajustes)' }[tipo];
  const o = showModal(modalHdr(t) + `<div class="mb2">${tipo === 'transferencia' ? `<div class="fr"><div class="fg"><label class="fl">Desde</label><select id="${mid}_a" class="fs">${op}</select></div><div class="fg"><label class="fl">Hacia</label><select id="${mid}_b" class="fs">${op}</select></div></div>` : `<div class="fg"><label class="fl">Cuenta</label><select id="${mid}_a" class="fs">${op}</select></div>`}
    ${tipo === 'manual' ? `<div class="fg"><label class="fl">Tipo</label><select id="${mid}_t" class="fs"><option value="egreso">Egreso (débito)</option><option value="ingreso">Ingreso (crédito)</option></select></div>` : ''}
    <div class="fr"><div class="fg"><label class="fl req">Importe</label><input id="${mid}_i" type="number" step="0.01" class="fi mono"></div><div class="fg"><label class="fl ${tipo === 'manual' ? 'req' : ''}">Descripción</label><input id="${mid}_d" class="fi"></div></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p" id="${mid}_ok">Registrar</button></div>`, 'md-sm');
  $(mid + '_ok').onclick = async () => {
    const a = Number($(mid + '_a').value), i = numIn(mid + '_i'), d = val(mid + '_d') || null;
    if (tipo === 'transferencia') await rpc('transferir_entre_cuentas', { p_desde: a, p_hasta: Number($(mid + '_b').value), p_importe: i, p_descripcion: d });
    else if (tipo === 'deposito') await rpc('depositar_efectivo', { p_cuenta: a, p_importe: i, p_descripcion: d });
    else await rpc('movimiento_fondos_manual', { p_cuenta: a, p_tipo: $(mid + '_t').value, p_importe: i, p_descripcion: d });
    o.remove(); toast('Registrado', 'g'); ir('bancos');
  };
}

/* ================= STOCK Y AJUSTES ================= */
PAGINAS.stock = async () => {
  pagina({ titulo: 'Stock y ajustes', icono: 'boxes-stacked', sub: 'Inventario inicial, recuentos, mermas, roturas y vencidos',
    botones: btnExcel(`exportarExcel('g_aj','Ajustes de stock')`) + btnPdf(`exportarPdf('g_aj','Ajustes de stock')`) + (ES_DUENO ? btnNuevo('ajusteNuevo()', 'Nuevo ajuste') : ''),
    cuerpo: `<div class="alert al-i">El stock no se edita a mano: cada cambio es un movimiento con su motivo. Las compras suman, las ventas restan, las notas de crédito con devolución vuelven a sumar.</div><div class="panel">${barraFiltros([{ k: 'desde', t: 'desde', v: hoy(-90) }, { k: 'hasta', t: 'hasta', v: hoy() }, { k: 'tipo', t: 'sel', l: 'Tipo', op: [['inventario_inicial', 'Inventario inicial'], ['recuento', 'Recuento'], ['merma', 'Merma'], ['rotura', 'Rotura'], ['vencimiento', 'Vencimiento'], ['otro', 'Otro']] }], ajustesCargar)}<div id="aj_g"></div></div>
      <div class="panel mt4"><div class="ph"><span class="pt">Movimientos de un producto</span></div><div class="pb"><div class="fr"><div class="fg"><label class="fl">Producto</label><div id="kx_pw"></div></div></div><div id="kx_g"></div></div></div>` });
  buscador('kx_pw', { tipo: 'producto', id: 'kx_p', onSelect: async p => { const m = await rpc('movimientos_producto', { p_producto: p.id, p_desde: hoy(-365), p_hasta: hoy() }); $('kx_g').innerHTML = `<div class="flex gap3 mb3">${kpi('Saldo anterior', fmtN(m.saldo_anterior))}${kpi('Stock actual', fmtN(m.stock_actual), '', 'g')}</div>` + grilla('g_kx', [{ t: 'Fecha', k: 'fecha', f: 'dt' }, { t: 'Tipo', k: 'tipo' }, { t: 'Documento', k: 'documento' }, { t: 'Cantidad', k: 'cantidad', f: 'n', cls: 'tr' }, { t: 'Saldo', k: 'saldo', f: 'n', cls: 'tr' }, ...(ES_DUENO ? [{ t: 'Costo unit.', k: 'costo_unit', f: 'm', cls: 'tr' }] : [])], m.movimientos.slice().reverse()); } });
  await ajustesCargar();
};
async function ajustesCargar() {
  const rows = await rpc('listado_ajustes_stock', { f: leerFiltros() });
  $('aj_g').innerHTML = grilla('g_aj', [{ t: 'Fecha', k: 'fecha', f: 'dt' }, { t: 'N°', k: 'numero' }, { t: 'Tipo', k: 'tipo' }, { t: 'Motivo', k: 'motivo' }, { t: 'Productos', k: 'productos' }, { t: 'Usuario', k: 'usuario' }, ...(ES_DUENO ? [{ t: 'Valor (costo)', k: 'valor', f: 'm', cls: 'tr', sum: 1 }] : [])], rows);
}
function ajusteNuevo() {
  const mid = 'aj' + uid(); let lins = [];
  const o = showModal(modalHdr('Nuevo ajuste de stock') + `<div class="mb2"><div class="fr"><div class="fg"><label class="fl">Tipo</label><select id="${mid}_t" class="fs"><option value="inventario_inicial">Inventario inicial (entra)</option><option value="recuento">Recuento (+ o −)</option><option value="merma">Merma (sale)</option><option value="rotura">Rotura (sale)</option><option value="vencimiento">Vencimiento (sale)</option><option value="otro">Otro (+ o −)</option></select></div><div class="fg"><label class="fl req">Motivo</label><input id="${mid}_m" class="fi"></div></div>
    <div class="fr3" style="grid-template-columns:3fr 1fr auto;align-items:end"><div class="fg" style="margin:0"><label class="fl">Producto</label><div id="${mid}_pw"></div></div><div class="fg" style="margin:0"><label class="fl">Cantidad</label><input id="${mid}_q" type="number" step="any" class="fi mono" placeholder="+ entra / − sale"></div><button class="btn btn-s" id="${mid}_a"><i class="fas fa-plus"></i></button></div><div class="ss mt3">En merma, rotura y vencimiento poné la cantidad en positivo: el sistema la descuenta.</div><div id="${mid}_l" class="mt3"></div></div>
    <div class="mf"><button class="btn btn-s" onclick="closeModal(this)">Cancelar</button><button class="btn btn-p" id="${mid}_ok"><i class="fas fa-check"></i> Registrar ajuste</button></div>`, 'md-lg');
  buscador(mid + '_pw', { tipo: 'producto', id: mid + '_p' });
  const pintar = () => $(mid + '_l').innerHTML = grilla('g_ajl', [{ t: 'Producto', k: 'nombre' }, { t: 'Cantidad', k: 'cantidad', f: 'n', cls: 'tr' }], lins, { vacio: 'Agregá productos', acciones: (r, i) => `<button class="btn btn-xs btn-d" onclick="this.closest('.mo')._q(${i})"><i class="fas fa-trash"></i></button>` });
  o._q = i => { lins.splice(i, 1); pintar(); }; pintar();
  $(mid + '_a').onclick = () => { const p = Number($(mid + '_p').dataset.id || 0); const q = numIn(mid + '_q'); if (!p || !q) return toast('Elegí producto y cantidad.', 'r'); lins.push({ producto_id: p, nombre: $(mid + '_p').value, cantidad: q }); $(mid + '_p').fijar(null); $(mid + '_q').value = ''; pintar(); $(mid + '_p').focus(); };
  $(mid + '_q').onkeydown = e => { if (e.key === 'Enter') $(mid + '_a').click(); };
  $(mid + '_ok').onclick = async () => {
    if (!lins.length) return toast('Agregá productos.', 'r'); const t = $(mid + '_t').value; const sale = ['merma', 'rotura', 'vencimiento'].includes(t);
    const it = lins.map(l => ({ producto_id: l.producto_id, cantidad: sale ? -Math.abs(l.cantidad) : (t === 'inventario_inicial' ? Math.abs(l.cantidad) : l.cantidad) }));
    const n = await rpc('registrar_ajuste_stock', { p_tipo: t, p_motivo: val(mid + '_m'), p_items: it }); o.remove(); toast('Ajuste ' + n + ' registrado', 'g'); ajustesCargar();
  };
}
