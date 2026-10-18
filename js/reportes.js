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
