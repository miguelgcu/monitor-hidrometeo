/* Índices de estaciones: mapa, serie y descarga comparten los mismos valores. */
const CI={indice:null,datos:new Map(),promesas:new Map(),turno:0};
async function ciIndice(){
  const r=await fetch('datos/productos/indices_climindvis.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
  if(r&&r.generado!==CI.indice?.generado){CI.datos.clear();CI.promesas.clear();}
  if(r)CI.indice=r;return CI.indice;
}
async function ciDatos(p){
  if(CI.datos.has(p.archivo))return CI.datos.get(p.archivo);
  if(!CI.promesas.has(p.archivo))CI.promesas.set(p.archivo,fetch('datos/productos/'+p.archivo,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('No se pudo leer el índice');return r.json();}).then(d=>{CI.datos.set(p.archivo,d);return d;}).finally(()=>CI.promesas.delete(p.archivo)));
  return CI.promesas.get(p.archivo);
}
function ciColor(meta,v){return meta.paleta===LLUVIA_MENSUAL.paleta?lluviaMensualColor(v):meta.colores[Math.min(s5Clase(v,meta),meta.colores.length-1)];}
function ciVisible(e){
  if(M.busca&&!slug(e.c+' '+e.n).includes(slug(M.busca)))return false;
  if(M.soloLinea&&!filtradas().some(x=>(x.x||x).codigo===e.c))return false;
  return true;
}
async function ciPintar(){
  const p=cliProducto(),it=cliItem(),turno=++CI.turno;if(p?.tipo_mapa!=='estaciones')return;
  // Cada indicador se pinta con su valor y su escala; solo se baja el archivo del indicador elegido.
  let d;try{d=await ciDatos(p);}catch(e){const el=document.querySelector('#clima-panel .capa-sub');if(el)el.textContent=e.message;return;}
  if(turno!==CI.turno||M.fam!=='clima'||cliProducto()?.clave!==p.clave||cliItem()?.campo!==it.campo)return;
  const abrir=!String(CLI.dibujado||'').startsWith('ci_');
  cliQuitar();histQuitar();cmCartografia();const meta=cliMeta(it.campo),k=meta.posicion,vals=cmCaducado(p,it)?d.valores[k].map(()=>null):d.valores[k];
  if(!M.sel){const j=d.estaciones.findIndex((e,j)=>e.c==='M0024'&&finito(vals[j])&&ciVisible(e)),e=j>=0?d.estaciones[j]:d.estaciones.find((e,j)=>finito(vals[j])&&ciVisible(e)&&e.lo>-82);if(e)M.sel=e.c;}
  if(!MAPA_L.getPane('indices-estaciones')){const pane=MAPA_L.createPane('indices-estaciones');pane.style.zIndex='435';}
  const group=L.layerGroup();let visibles=0,seleccionada=null;
  d.estaciones.forEach((e,j)=>{
    const v=vals[j];if(!ciVisible(e)||(!finito(v)&&e.c!==M.sel)||!finito(e.la)||!finito(e.lo)||CM.estaciones==='ninguna')return;
    // El índice es una capa de puntos; "Seleccionada" conserva el campo completo y resalta la elegida.
    const selected=e.c===M.sel;if(CM.estaciones==='seleccion'&&!selected)return;
    if(CM.estaciones==='recientes'&&!selected&&!(M.d?.estaciones||[]).some(x=>x.codigo===e.c))return;
    const marker=L.circleMarker([e.la,e.lo],{pane:'indices-estaciones',className:selected?'ci-seleccionada':'',radius:selected?7:4.5,color:selected?'#ffd43b':'#202b35',weight:selected?2.5:.8,fillColor:finito(v)?ciColor(meta,v):colorTema('--fondo','#10202a'),fillOpacity:finito(v)?CM.opacidad:.9});
    if(selected)seleccionada=marker;
    marker.bindTooltip(`${esc(e.n)} (${esc(e.c)}) · ${finito(v)?num(v,Number.isInteger(v)?0:2)+' '+esc(ciUnidadTexto(meta.unidad,v)):'Sin resultado en este periodo'}`,{direction:'top'});
    marker.on('click',()=>{M.sel=e.c;M.vista='indices';ciPintar();pintarSerie();});group.addLayer(marker);visibles++;
  });
  CLI.capa=group.addTo(MAPA_L);CLI.dibujado=it.campo;
  seleccionada?.bringToFront();
  if(abrir&&!CM.manual)ajustarMapaEcuador();
  const sub=document.querySelector('#clima-panel .capa-sub');if(sub)sub.textContent='';
  ciRejilla(d,p,k);if(M.vista==='indices')ciSerie();
}
function ciRejilla(d,p,k){
  if(p.pronostico_ml)return cmMLRejilla(d,p,k);
  const meta=cliMeta(p.items[k].campo);const rows=d.estaciones.map((e,j)=>({e,j,v:d.valores[k][j]})).filter(x=>ciVisible(x.e)&&(finito(x.v)||x.e.c===M.sel)).sort((a,b)=>(finito(b.v)?1:0)-(finito(a.v)?1:0)||(b.v??0)-(a.v??0));
  $('#rej-n').textContent=rows.filter(x=>finito(x.v)).length+' con valor';$('#rej-sub').textContent=p.nombre+' · '+d.periodos[k].etiqueta;
  $('#rejilla').classList.remove('red-tabla','red-tarjetas');$('#red-cab').hidden=true;$('#red-provincia').hidden=true;
  $('#rejilla').innerHTML=rows.map(({e,j,v})=>`<button type="button" class="mini ci-estacion" data-ci-est="${esc(e.c)}" aria-pressed="${e.c===M.sel}" title="${esc(e.n)}"><span class="c">${esc(e.c)}</span><span class="n">${esc(e.n)}</span><span class="v">${finito(v)?num(v,Number.isInteger(v)?0:2)+' '+esc(ciUnidadTexto(meta.unidad,v)):'Sin resultado válido'}</span><small>${num(d.cobertura[k][j]||0,1)} % de días con dato</small></button>`).join('');
  $('#rejilla').querySelectorAll('[data-ci-est]').forEach(b=>b.onclick=()=>{M.sel=b.dataset.ciEst;M.vista='indices';ciPintar();pintarSerie();});
}
function ciBoton(){cmBotonProducto();const b=document.getElementById('v-indices');if(b)b.hidden=true;}
function ciPeriodosSerie(d,actual){
  const rows=d.periodos.map((z,i)=>({z,i})).filter(({z})=>z.tipo===actual.tipo);
  if(actual.tipo==='mensual')return rows.filter(({z})=>z.id.slice(0,4)===actual.id.slice(0,4));
  const pos=rows.findIndex(({z})=>z.id===actual.id),start=Math.max(0,Math.min(pos-10,rows.length-20));return rows.slice(start,start+20);
}
async function ciSerie(){
  if(cliProducto()?.clave.startsWith('ci_'))return ciPanelEstacion();
  if(cliProducto()?.pronostico_ml)return cmMLSerie();
  ciBoton();const caja=$('#serie'),p=cliProducto();
  if(p?.tipo_mapa!=='estaciones'){M.vista='producto';return cmDetalleProducto();}
  const turno=CI.serieTurno=(CI.serieTurno||0)+1;
  if(!CI.datos.has(p.archivo))caja.innerHTML='<div class="vacio">Cargando el indicador de las estaciones…</div>';
  let d;try{d=await ciDatos(p);}catch(e){if(cliProducto()?.clave===p.clave)caja.innerHTML='<div class="vacio">No se pudo cargar este indicador. Vuelva a seleccionarlo para reintentar.</div>';return;}
  if(turno!==CI.serieTurno||M.fam!=='clima'||M.vista!=='indices'||cliProducto()?.clave!==p.clave)return;
  let j=d.estaciones.findIndex(e=>e.c===M.sel);const k=CLI.pos[p.clave]??p.defecto;
  if(j<0){j=d.estaciones.findIndex((e,j)=>e.c==='M0024'&&finito(d.valores[k][j])&&ciVisible(e));if(j<0)j=d.estaciones.findIndex((e,j)=>finito(d.valores[k][j])&&ciVisible(e)&&e.lo>-82);if(j>=0)M.sel=d.estaciones[j].c;}
  $('#serie-stats').innerHTML='';if(j<0){caja.innerHTML='<div class="vacio">No hay estaciones con datos suficientes para este periodo y filtro.</div>';return;}
  const e=d.estaciones[j],actual=d.periodos[k],meta=cliMeta(p.items[k].campo),def=cmDescripcion(p,actual),v=d.valores[k][j];
  $('#serie-tit').innerHTML=esc(e.c)+' <span class="nomest">'+esc(e.n)+'</span>';
  caja.innerHTML=`<div class="cm-serie-cab"><b>${esc(p.nombre)}</b><span>${esc(cmRango(p,actual))}${actual.parcial?' · parcial':''}</span></div><div class="cm-lectura">${esc(cmLecturaBarras(p,actual))}</div><div class="ci-cab"><span>${actual.tipo==='mensual'?'Meses de '+actual.id.slice(0,4):actual.tipo==='anual'?'Comparación entre años':'Comparación entre ciclos'} · ${num(d.cobertura[k][j]||0,1)} % de días con dato</span><button type="button" data-ci-csv>Descargar</button></div><div class="ci-serie-scroll" tabindex="0" role="region" aria-label="Serie histórica de indicadores"><div id="ci-serie-graf"></div></div><div class="ci-desliza" hidden>Desliza para ver los demás periodos.</div><div class="cm-detalle-pie">Pulsa una barra para ver ese periodo en el mapa. El rayado señala un periodo parcial y la falta de barra indica datos insuficientes, no un cero.</div>`;
  const ids=ciPeriodosSerie(d,actual),xs=ids.map(({z})=>z.id),ys=ids.map(({i})=>d.valores[i][j]);
  const graf=document.getElementById('ci-serie-graf'),sc=caja.querySelector('.ci-serie-scroll');
  if(ys.some(finito))graf.style.minWidth=(xs.length*34+76)+'px';
  if(ys.some(finito)){
    await cmPlot('ci-serie-graf',[{type:'bar',x:xs,y:ys,customdata:ids.map(({z,i})=>[d.cobertura[i][j],z.parcial?'parcial':'cerrado',cmRango(p,z)]),marker:{color:ys.map(v=>finito(v)?ciColor(meta,v):'#888'),line:{color:colorTema('--tinta','#dce7ef'),width:ids.map(({i})=>i===k?2:0)},pattern:{shape:ids.map(({z})=>z.parcial?'/':'')}},hovertemplate:'%{customdata[2]}<br><b>%{y:.2f} '+esc(meta.unidad)+'</b><br>Cobertura %{customdata[0]:.1f} % · %{customdata[1]}<extra></extra>',name:p.nombre}],{margin:{t:24,l:58,r:18,b:55},xaxis:{type:'category',tickvals:xs,ticktext:ids.map(({z})=>actual.tipo==='mensual'?CM_MESES[+z.id.slice(5)-1].slice(0,3):z.id),tickangle:ids.length>12?-40:0,title:actual.tipo==='mensual'?'Mes de '+actual.id.slice(0,4):actual.tipo==='anual'?'Año':'Ciclo octubre–septiembre'},yaxis:{title:meta.unidad,zeroline:true},showlegend:false});
    if(turno!==CI.serieTurno||!graf.isConnected)return;
    graf.on('plotly_click',ev=>{const id=ev.points?.[0]?.x,j=d.periodos.findIndex(z=>z.tipo===actual.tipo&&z.id===id);if(j>=0)cmCambiarPeriodo(j);});
  }else graf.innerHTML='<div class="vacio">La estación no reúne los datos necesarios en este año o periodo. Elige otro periodo arriba o revisa la referencia con ⓘ.</div>';
  caja.querySelector('.ci-desliza').hidden=sc.scrollWidth<=sc.clientWidth+1;
  sc.scrollLeft=Math.max(0,58+(ids.findIndex(z=>z.i===k)+1)*34-sc.clientWidth+24);
  caja.querySelector('[data-ci-csv]').onclick=()=>{
    const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    const rows=[['codigo','nombre','indice','desde','hasta','periodo','valor','unidad','cobertura_pct','parcial'],...d.periodos.map((z,i)=>[e.c,e.n,p.clave,z.desde,z.hasta,z.tipo,d.valores[i][j],meta.unidad,d.cobertura[i][j],z.parcial])];
    const blob=new Blob(['\ufeff'+rows.map(r=>r.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=e.c+'_'+p.clave+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
}

