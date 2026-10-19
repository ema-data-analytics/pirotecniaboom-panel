/* Pirotecnia Boom · Reportes */
'use strict';
PAGINAS.resultados = async () => {
  pagina({ titulo: 'Estado de resultados', icono: 'chart-line', sub: 'Ventas − costo de lo vendido − mermas − gastos',
    botones: btnPdf('pdfResultados()'), cuerpo: `<div class="panel mb3">${barraFiltros([{ k: 'desde', t: 'desde', v: iniMes() }, { k: 'hasta', t: 'hasta', v: hoy() }], resultadosCargar)}</div><div id="res_c"></div>` });
  await resultadosCargar();
};
async function resultadosCargar() {
  const f = leerFiltros(); const r = await rpc('estado_resultados', { p_desde: f.desde || iniMes(), p_hasta: f.hasta || hoy() }); PAG.res = r;
  const fila = (l, v, cl = '', ind = 0) => `<tr><td style="padding-left:${10 + ind * 18}px" class="${cl}">${l}</td><td class="tr mono ${cl}">${fmt(v)}</td><td class="tr mono tdim">${Number(r.ventas_netas) ? Math.round(Number(v) * 1000 / Number(r.ventas_netas)) / 10 + '%' : ''}</td></tr>`;
  $('res_c').innerHTML = `<div class="grid-4 mb3">${kpi('Ventas netas', fmt(r.ventas_netas), 'sin IVA', 'g')}${kpi('Margen bruto', fmt(r.margen_bruto), Number(r.ventas_netas) ? Math.round(r.margen_bruto * 100 / r.ventas_netas) + '% de las ventas' : '', 'b')}${kpi('Gastos', fmt(r.total_gastos), '', 'r')}${kpi('Resultado', fmt(r.resultado), Number(r.resultado) >= 0 ? 'ganancia' : 'pérdida', Number(r.resultado) >= 0 ? 'g' : 'r')}</div>
  <div class="panel"><table><thead><tr><th>Concepto (importes sin IVA)</th><th class="tr">Importe</th><th class="tr">% ventas</th></tr></thead><tbody>
  ${fila('Ventas brutas', r.ventas_brutas)}${fila('− Descuentos', -r.descuentos, '', 1)}${fila('+ Recargos y envíos', r.recargos_envios, '', 1)}${fila('− Notas de crédito', -r.notas_credito, '', 1)}${fila('+ Notas de débito', r.notas_debito, '', 1)}
  ${fila('<b>Ventas netas</b>', r.ventas_netas, 'tg')}${fila('− Costo de la mercadería vendida', -r.costo_mercaderia, '', 1)}${fila('− Mermas, roturas y ajustes', -r.mermas_ajustes, '', 1)}${fila('<b>Margen bruto</b>', r.margen_bruto, 'tb')}
  ${r.gastos.map(g => fila('− ' + esc(g.tipo), -g.importe, '', 1)).join('')}${fila('<b>Resultado del período</b>', r.resultado, Number(r.resultado) >= 0 ? 'tg' : 'td')}</tbody></table></div>`;
}
function pdfResultados() {
  const r = PAG.res; const doc = pdfNew('ESTADO DE RESULTADOS', 'Del ' + fmtD(r.desde) + ' al ' + fmtD(r.hasta), false);
  const L = [['Ventas brutas', r.ventas_brutas], ['  Descuentos', -r.descuentos], ['  Recargos y envíos', r.recargos_envios], ['  Notas de crédito', -r.notas_credito], ['  Notas de débito', r.notas_debito], ['VENTAS NETAS', r.ventas_netas], ['  Costo de la mercadería vendida', -r.costo_mercaderia], ['  Mermas y ajustes', -r.mermas_ajustes], ['MARGEN BRUTO', r.margen_bruto], ...r.gastos.map(g => ['  ' + g.tipo, -g.importe]), ['RESULTADO', r.resultado]];
  pdfTable(doc, ['Concepto (sin IVA)', 'Importe'], L.map(x => [x[0], fmt(x[1])]), null, 40, { 1: { halign: 'right' } });
  pdfSave(doc, 'Estado_resultados');
}
PAGINAS.rventas = async () => {
  pagina({ titulo: 'Ventas por producto', icono: 'chart-column', sub: 'Qué se vende, cuánto y con qué margen',
    botones: btnExcel(`exportarExcel('g_rv','Ventas resumen')`) + btnPdf(`exportarPdf('g_rv','Ventas por ' + (leerFiltros().por||'producto'), filtrosTexto())`),
    cuerpo: `<div class="panel">${barraFiltros([{ k: 'desde', t: 'desde', v: iniMes() }, { k: 'hasta', t: 'hasta', v: hoy() }, { k: 'por', t: 'sel', l: 'Agrupar por', op: [['producto', 'Producto'], ['categoria', 'Categoría'], ['cliente', 'Cliente'], ['lista', 'Lista de precios'], ['dia', 'Día']], v: 'producto' }], rventasCargar)}<div id="rv_g"></div></div>` });
  await rventasCargar();
};
async function rventasCargar() {
  const f = leerFiltros(); const rows = await rpc('ventas_resumen', { p_desde: f.desde || iniMes(), p_hasta: f.hasta || hoy(), p_por: f.por || 'producto' });
  $('rv_g').innerHTML = grilla('g_rv', [{ t: { producto: 'Producto', categoria: 'Categoría', cliente: 'Cliente', lista: 'Lista', dia: 'Día' }[f.por || 'producto'], k: 'clave' }, { t: 'Cantidad', k: 'cantidad', f: 'n', cls: 'tr', sum: 1 }, { t: 'Neto', k: 'neto', f: 'm', cls: 'tr', sum: 1 }, { t: 'Total con IVA', k: 'total', f: 'm', cls: 'tr', sum: 1 }, ...(ES_DUENO ? [{ t: 'Costo', k: 'costo', f: 'm', cls: 'tr', sum: 1 }, { t: 'Ganancia', k: 'ganancia', f: 'm', cls: 'tr', sum: 1 }, { t: 'Margen', k: 'margen_pct', f: 'p', cls: 'tr' }] : [])], rows);
}
PAGINAS.ivacompras = async () => {
  pagina({ titulo: 'Libro IVA Compras', icono: 'book-open', sub: 'Facturas, notas de crédito y débito de proveedores del período (las NC restan)',
    botones: btnExcel(`exportarExcel('g_ivc','Libro IVA Compras')`) + btnPdf(`exportarPdf('g_ivc','Libro IVA Compras',filtrosTexto(),true)`),
    cuerpo: `<div class="grid-4 mb3" id="ivc_k"></div><div class="panel">${barraFiltros([{ k: 'desde', t: 'desde', v: iniMes() }, { k: 'hasta', t: 'hasta', v: hoy() }], ivaComprasCargar)}<div id="ivc_g"></div></div>` });
  await ivaComprasCargar();
};
async function ivaComprasCargar() {
  const f = leerFiltros(); const rows = await rpc('libro_iva_compras', { p_desde: f.desde || iniMes(), p_hasta: f.hasta || hoy() });
  const s = k => rows.reduce((a, r) => a + Number(r[k] || 0), 0);
  $('ivc_k').innerHTML = kpi('Neto gravado', fmt(s('neto_gravado')), rows.length + ' comprobantes', 'b') + kpi('IVA crédito fiscal', fmt(s('iva_21') + s('iva_10_5') + s('iva_27')), '21 %, 10,5 % y 27 %', 'g') + kpi('Percepciones', fmt(s('perc_iva') + s('perc_iibb')), 'IVA e IIBB', 'w') + kpi('Total', fmt(s('total')), '');
  $('ivc_g').innerHTML = grilla('g_ivc', [{ t: 'Fecha', k: 'fecha', f: 'd' }, { t: 'Tipo', k: 'tipo', cls: 'mono', f: r => esc(r.tipo + ' ' + (r.letra || '')), xf: r => r.tipo + ' ' + (r.letra || '') }, { t: 'Número', k: 'comprobante', cls: 'mono' }, { t: 'Proveedor', k: 'proveedor' }, { t: 'CUIT', k: 'cuit', cls: 'mono' }, { t: 'Cond. IVA', k: 'condicion_iva' },
    { t: 'Neto gravado', k: 'neto_gravado', f: 'm', cls: 'tr', sum: 1 }, { t: 'No gravado', k: 'no_gravado', f: 'm', cls: 'tr', sum: 1 }, { t: 'IVA 21 %', k: 'iva_21', f: 'm', cls: 'tr', sum: 1 }, { t: 'IVA 10,5 %', k: 'iva_10_5', f: 'm', cls: 'tr', sum: 1 }, { t: 'IVA 27 %', k: 'iva_27', f: 'm', cls: 'tr', sum: 1 },
    { t: 'Perc. IVA', k: 'perc_iva', f: 'm', cls: 'tr', sum: 1 }, { t: 'Perc. IIBB', k: 'perc_iibb', f: 'm', cls: 'tr', sum: 1 }, { t: 'Otros', k: 'otros', f: 'm', cls: 'tr', sum: 1 }, { t: 'Total', k: 'total', f: 'm', cls: 'tr', sum: 1 }], rows,
    { vacio: 'No hay compras en el período', acciones: r => `<button class="btn btn-xs btn-s" title="Ver" onclick="verCompra(${r.id})"><i class="fas fa-eye"></i></button>` });
}
