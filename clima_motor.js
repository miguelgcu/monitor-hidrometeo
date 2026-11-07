/* Contratos de producto, controles y seguimiento climático. 03-nov-2026. */
// 5-nov-2026: «Todo el catálogo» por defecto, como lo aprobado el 29-oct (las 1.121 estaciones con registro)
const CM={panel:'producto',leyenda:true,estaciones:'todas',limites:'provincias',opacidad:.9,referencia:'historia',capas:[],turno:0,enso:null};
function cmProducto(p){
  const nombres={ci_qth_pr:'Porcentaje de días sobre P95 de lluvia',interp_lluvia:'Estimación mensual independiente · lluvia',interpdia_mensual:'Suma de días · lluvia del mes',obs_tmax:'Anomalía de temperatura máxima · Δ°C',obs_tmin:'Anomalía de temperatura mínima · Δ°C',prev_tmin:'IFS · anomalía de temperatura mínima · Δ°C',prev_lluvia_pct:'IFS · lluvia prevista · % de la normal',prev_lluvia_pctl:'IFS · lluvia prevista · percentil',umbral_p90:'Referencia de días lluviosos · P90',umbral_p95:'Referencia de días lluviosos · P95',umbral_p99:'Referencia de días lluviosos · P99'};
  Object.assign(nombres,{obs_lluvia_pct:'Lluvia reciente respecto a la normal (%)',obs_lluvia_pctl:'Lluvia reciente, posición histórica (percentil)',interp_lluvia_pct:'Lluvia mensual respecto a la normal (%)',normal_lluvia:'Lluvia normal mensual',normal_tmax:'Temperatura máxima normal mensual',normal_tmin:'Temperatura mínima normal mensual'});
  return {...p,nombre:nombres[p.clave]||p.nombre,variable:p.variable||(/tmax|tmin|temperatura/.test(p.clave)?'temp_aire':'precipitacion')};
}
// Restricción de producto independiente del tamaño al que se remuestree el archivo.
function cmProductoAdmitido(p){return !!p&&!p.retirado&&p.apto_mapa!==false&&!p.clave.startsWith('estacional_');}
function cmMallaAdmitida(c){
  const grados=+(c?.meta?.resolucion_origen_grados||c?.meta?.resolucion_predictiva_grados||Math.max(c?.dlat,c?.dlon));
  return Number.isFinite(grados)&&grados>0&&grados<.5;
}
function cmFamilia(p){
  if(p?.pronostico_ml)return p.clave.includes('_semanal_')?'mlsemanal':'mlmensual';
  if(p?.clave?.startsWith('ci_'))return 'indices';
  if(p?.clave?.startsWith('obs_'))return 'observado';
  if(p?.clave?.startsWith('normal_')||p?.clave?.startsWith('umbral_'))return 'referencia';
  if(p?.clave?.startsWith('prev_'))return 'previsto';
  if(p?.clave?.startsWith('soporte_'))return 'soporte';
  return 'estimacion';
}
function cmOpciones(ps,p){return ps.filter(q=>cmProductoAdmitido(q)&&q.variable===p.variable&&cmFamilia(q)===cmFamilia(p));}
const CM_FAMILIAS={mlsemanal:'Pronóstico semanal ML',mlmensual:'Pronóstico mensual ML',indices:'Indicadores climáticos',observado:'Observado',referencia:'Normales y percentiles',estimacion:'Estimaciones',soporte:'Cobertura de la referencia',previsto:'Pronóstico a corto plazo'};
function cmDiscreto(m){return m.discreto||/dias_secos|dias_lluvia|conteo|anios/.test(m.escala);}
function cmRecortar(ctx,W,H,n,s,o,e){
  const fs=[M.carto?.provincias,M.carto?.provincias_insular].filter(Boolean);
  if(!fs.length)return;
  const mask=document.createElement('canvas');mask.width=W;mask.height=H;const a=mask.getContext('2d');
  a.fillStyle='#000';
  for(const fc of fs)for(const f of fc.features||[]){
    const g=f.geometry,pol=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
    // Unión por composición: el solape de dos provincias no debe abrir un hueco.
    for(const p of pol){a.beginPath();for(const ring of p){ring.forEach((q,i)=>{const x=(q[0]-o)/(e-o)*W,y=(n-q[1])/(n-s)*H;i?a.lineTo(x,y):a.moveTo(x,y);});a.closePath();}a.fill('evenodd');}
  }
  ctx.save();ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.restore();
}
function cmHoy(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function cmFecha(t){const d=new Date(t);return Number.isFinite(+d)?new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',dateStyle:'medium',timeStyle:'short'}).format(d)+' (Ecuador)':String(t||'—');}
function cmCaducado(p,it){
  if(!p)return false;
  if(p.pronostico_ml)return !it?.hasta||it.hasta<cmHoy()||(it.vence&&it.vence<=cmHoy());
  if(p.viejo===true)return true;
  if(p?.clave?.startsWith('prev_')){const source=(CLI.idx?.prevista||{})[p.clave.includes('tmin')?'tmin':'prcp'],t=Date.parse(source?.corrida_utc);return !it?.hasta||it.hasta<cmHoy()||!Number.isFinite(t)||Date.now()-t>72*3600e3;}
  return false;
}
function cmPeriodo(it){return it?.fecha||it?.mes||it?.hasta||it?.etiqueta||'';}
function cmPosicion(p,it){
  if(!it)return cliPosDefecto(p);
  if(p.tipo==='indice'){const k=it.id&&p.items.findIndex(x=>x.id===it.id&&x.tipo===it.tipo);return Number.isInteger(k)&&k>=0?k:cliPosDefecto(p);}
  // Windows match duration, not the index of two unrelated arrays.
  if(p.tipo==='ventana'){const j=p.items.findIndex(z=>z.dias!=null&&z.dias===it.dias);return j>=0?j:cliPosDefecto(p);}
  const exact=p.items.findIndex(z=>cmPeriodo(z)===cmPeriodo(it));
  return exact>=0?exact:cliPosDefecto(p);
}
function cmSubtitulo(p,it){
  if(p.tipo_mapa==='estaciones')return esc(it.desde+' a '+it.hasta)+` · ${it.estaciones} estaciones con resultado · datos puntuales`+(it.parcial?' · parcial':'');
  const c=CLI.campos[it.campo],meta=cliMeta(it.campo)||{},k=p.clave;
  const grado=c?.dlat||meta.resolucion_grados||(k.startsWith('interpdia_')?(/prob|distancia/.test(k)?.05:.03):k.startsWith('interp_')?(/tmax$|tmin$/.test(k)?.01:.02):.05);
  const src=p.fuente||(k.startsWith('obs_')?'Climatología e interpolado observado':k.startsWith('prev_')?((CLI.idx?.prevista||{})[k.includes('tmin')?'tmin':'prcp']?.fuente||'Fuente no disponible').split(' · ')[0]:k.startsWith('interp')?'Interpolado de estaciones':'Climatología calibrada');
  const periodo=p.tipo==='mes'?`${it.etiqueta} · referencia 1991–2020`:(it.periodo&&!/estaciones/.test(it.periodo)?it.periodo.replace(/ · (provisional|definitiva|rapida)$/,''):it.etiqueta||it.fecha||it.mes||'');
  return [esc(periodo),it.emision?'emisión '+esc(it.emision):null,esc(src),meta.resolucion_origen_grados&&meta.resolucion_origen_grados>grado*1.01?`origen ${num(meta.resolucion_origen_grados,2)}° (≈${num(meta.resolucion_origen_grados*111,1)} km) · malla de visualización ${num(grado,2)}°`:`rejilla publicada ${num(grado,2)}° (≈${num(grado*111,1)} km)`,finito(it.estaciones)?`${it.estaciones} estaciones`:null,it.version?`versión ${esc(it.version)}`:null,it.anclado?'ajustada al mes':null].filter(Boolean).join(' · ');
}
function cmEstacion(){const x=M.d?.estaciones.find(z=>z.codigo===M.sel);if(x)return x;const e=histSoloRegistro();return e?{codigo:e.c,nombre:e.n,latitud:e.la,longitud:e.lo}:null;}
function cmEncuadreResponsive(){
  if(!MAPA_L||CM.resize)return;
  const e=MAPA_L.getContainer();CM.manual=false;
  MAPA_L.on('dragstart',()=>{CM.manual=true;});
  e.addEventListener('wheel',()=>{CM.manual=true;},{passive:true});
  e.addEventListener('touchstart',ev=>{if(ev.touches.length>1)CM.manual=true;},{passive:true});
  let t;CM.resize=new ResizeObserver(()=>{clearTimeout(t);t=setTimeout(()=>{if(M.fam!=='clima')return;MAPA_L.invalidateSize({pan:false});if(!CM.manual)ajustarMapaEcuador();},120);});CM.resize.observe(e);
}
function cmMostrarEstacion(e){
  if(CM.estaciones==='ninguna')return false;
  if(CM.estaciones==='seleccion'&&e.c!==M.sel)return false;
  if(CM.estaciones==='recientes'&&e.c!==M.sel&&!(M.d?.estaciones||[]).some(x=>x.codigo===e.c))return false;
  if(M.busca&&!slug([e.c,e.n,e.p].join(' ')).includes(slug(M.busca)))return false;
  if(M.soloLinea&&!filtradas().some(x=>(x.x||x).codigo===e.c))return false;
  return true;
}
async function cmElegir(clave){
  if(clave==='indicadores')clave=cliProducto()?.clave.startsWith('ci_')?cliProducto().clave:((CI.indice?.productos||[]).find(p=>p.clave===($('#f-var').value==='precipitacion'?'ci_sum_pr':'ci_mean_tx'))||(CI.indice?.productos||[])[0])?.clave;
  CI.panel=String(clave).startsWith('ci_');
  const anterior=cliItem();CLI.sel=clave;const p=cliProducto();if(!p)return;
  CLI.pos[clave]=cmPosicion(p,anterior);
  if(p.tipo_mapa==='estaciones'){M.vista='indices';if(CM.antesIndices===undefined){CM.antesIndices=CM.estaciones;CM.estaciones='todas';}}else{M.vista='producto';if(CM.antesIndices!==undefined){CM.estaciones=CM.antesIndices;delete CM.antesIndices;}}
  if(p.variable==='temp_aire')CMP_CLI.var=/tmin/.test(clave)?'tmin':'tmax';
  cerrarFicha();cliQuitar();
  $('#serie').innerHTML='<div class="vacio">Cargando el producto seleccionado…</div>';
  if($('#f-var').value!==p.variable){$('#f-var').value=p.variable;await latir(true);}
  else{cliPintarCapa();histPintar();pintarSerie();if(p.tipo_mapa!=='estaciones')cliRejilla();}
}
function cmSeguirVariable(v){
  const p=cliProducto();if(p?.variable===v)return;
  const ps=cliProductos().filter(x=>x.variable===v),q=ps.find(x=>x.grupo===p?.grupo)||ps.find(x=>cmFamilia(x)===cmFamilia(p||{}))||ps[0];
  if(q){CLI.pos[q.clave]=cmPosicion(q,cliItem());CLI.sel=q.clave;}
}
// Climatología: el producto y el periodo pertenecen al mapa y a su detalle.
function cmMontar(pn){
  const mapa=document.getElementById('mapa'),contenedor=mapa.querySelector('.mapa-paneles');
  if(pn.parentElement!==contenedor)contenedor.appendChild(pn);
  document.getElementById('cm-controles')?.remove();
  pn.hidden=CM.panel!=='producto';
  mapa.setAttribute('aria-label','Mapa del producto climático seleccionado');cmBotonProducto();
}
function cmGrupo(p){
  const k=p.clave;
  if(p.pronostico_ml)return k.includes('_semanal_')?'Pronóstico semanal':'Pronóstico mensual';
  if(k.startsWith('soporte_')||k==='interpdia_distancia')return 'Cobertura y calidad';
  if(k.startsWith('normal_'))return 'Normales 1991–2020';
  if(k.startsWith('umbral_'))return 'Percentiles de lluvia diaria';
  if(k.startsWith('prev_'))return 'Pronóstico diario frente a la normal';
  if(k.startsWith('ci_spi'))return 'Indicadores — sequía';
  if(k.startsWith('ci_rs_'))return 'Indicadores — temporada lluviosa';
  if(k.startsWith('ci_')){
    if(p.variable!=='precipitacion')return 'Indicadores — temperatura';
    if(['dd','th','cdd','cwd','spells'].includes(p.familia_indice))return 'Indicadores — días y rachas';
    return 'Indicadores — acumulados e intensidad';
  }
  if(k.startsWith('interp_'))return 'Observado — meses completos';
  if(k.startsWith('interpdia_'))return 'Observado — días y acumulados';
  return 'Observado — comparación climática';
}
const CM_ORDEN_GRUPOS=['Observado — comparación climática','Observado — días y acumulados','Observado — meses completos','Normales 1991–2020','Percentiles de lluvia diaria','Indicadores — acumulados e intensidad','Indicadores — días y rachas','Indicadores — sequía','Indicadores — temporada lluviosa','Indicadores — temperatura','Pronóstico semanal','Pronóstico mensual','Pronóstico diario frente a la normal'];
function cmMenuProductos(ps,p){
  const lista=ps.filter(q=>cmProductoAdmitido(q)&&q.variable===p.variable&&!q.clave.startsWith('ci_'));
  const indices=(CI.indice?.productos||[]).filter(q=>q.variable===p.variable),gruposCI=CM_ORDEN_GRUPOS.filter(g=>g.startsWith('Indicadores'));
  const grupos=['Observado — comparación climática','Observado — meses completos','Normales 1991–2020','Percentiles de lluvia diaria','Pronóstico semanal','Pronóstico mensual','Pronóstico diario frente a la normal'];
  const nombres={'Observado — comparación climática':'Comparación reciente con el clima','Observado — meses completos':'Meses completos','Normales 1991–2020':'Clima de referencia 1991–2020','Percentiles de lluvia diaria':'Umbrales de lluvia intensa'};
  return grupos.map(g=>{const rows=lista.filter(q=>cmGrupo(q)===g);return rows.length?`<optgroup label="${esc(nombres[g]||g)}">${rows.map(q=>`<option value="${q.clave}" ${q.clave===p.clave?'selected':''}>${esc(q.nombre+(q.pronostico_ml?(q.clave.includes('_semanal_')?' semanal':' mensual'):''))}</option>`).join('')}</optgroup>`:'';}).join('')
    +gruposCI.map(g=>{const rows=indices.filter(q=>cmGrupo(q)===g);return rows.length?`<optgroup label="${esc(g)}">${rows.map(q=>`<option value="${q.clave}" ${q.clave===p.clave?'selected':''}>${esc(ciNombre(q))}</option>`).join('')}</optgroup>`:'';}).join('');
}
function cmBotonProducto(){
  document.getElementById('v-producto')?.remove();ciBotonPanel();
  const anchor=document.getElementById('v-clima');if(!anchor)return;
  let info=document.getElementById('cm-info-grafico');
  if(!info){info=document.createElement('button');info.id='cm-info-grafico';info.className='cm-info';info.textContent='i';info.setAttribute('aria-label','Información del producto');info.onclick=()=>cmAyudaGrafico();anchor.parentElement.after(info);}
  info.hidden=M.fam!=='clima';
}
function cmControles(p,it,meta){
  const mapa=document.getElementById('mapa'),barra=mapa?.querySelector('.mapa-botones');if(!barra)return;
  barra.setAttribute('aria-orientation','vertical');
  if(!barra.querySelector('[data-cm-panel]')){
    const botones=[['producto','layout-grid','Producto y periodo'],['estaciones','map-pin','Estaciones'],['limites','map','Cartografía'],['opacidad','adjustments-horizontal','Ajustes'],['enso','chart-histogram','El Niño y ENSO']];
    barra.insertAdjacentHTML('beforeend',botones.map(([k,ico,nom])=>`<button type="button" class="mapa-boton cm-mapa-boton" data-cm-panel="${k}" aria-label="${nom} de climatología" title="${nom}" aria-expanded="false">${iconoUI(ico)}</button>`).join(''));
    barra.querySelectorAll('[data-cm-panel]').forEach(b=>b.onclick=()=>{if(b.dataset.cmPanel==='enso'){cmENSO();return;}CM.panel=CM.panel===b.dataset.cmPanel?null:b.dataset.cmPanel;cliPanelPintar();});
    mapa.querySelector('.mapa-paneles').insertAdjacentHTML('beforeend','<div id="cm-flotante" class="capa-panel" hidden></div>');
    mapa.insertAdjacentHTML('beforeend','<div id="cm-leyenda" aria-label="Escala del producto climático"></div>');
  }
  barra.querySelectorAll('[data-cm-panel]').forEach(b=>{b.setAttribute('aria-expanded',CM.panel===b.dataset.cmPanel);b.setAttribute('aria-pressed',CM.panel===b.dataset.cmPanel);});
  const ley=document.getElementById('cm-leyenda');ley.hidden=!CM.leyenda||CM.panel==='producto';
  ley.innerHTML=`<div class="cm-ley-titulo"><b>${esc(meta?.unidad||p.nombre)}</b><span>${esc(cmEtiquetaPeriodo(p,it))}</span></div>${cliEscalaHTML(meta)}${cmLeyendaEstaciones(p)}`;
  const f=document.getElementById('cm-flotante');f.hidden=!['estaciones','limites','opacidad'].includes(CM.panel);
  const cab=t=>`<div class="cm-cab"><b>${t}</b><button type="button" data-cm-cerrar aria-label="Cerrar herramientas del mapa">×</button></div>`;
  const grupo=(key,items,actual)=>`<div class="cm-opciones" role="group">${items.map(([v,t])=>`<button type="button" data-cm-${key}="${v}" aria-pressed="${v===actual}">${t}</button>`).join('')}</div>`;
  if(CM.panel==='estaciones'){
    const puntual=p.tipo_mapa==='estaciones';
    f.innerHTML=cab('Estaciones en el mapa')+grupo('est',puntual?[['todas','Con resultado'],['seleccion','Seleccionada'],['ninguna','Ocultar']]:[['recientes','Red reciente'],['todas','Todo el catálogo'],['seleccion','Seleccionada'],['ninguna','Ocultar']],CM.estaciones)
      +`<p>${puntual?'Cada punto muestra el indicador del periodo elegido. Pulse una estación para ver su serie.':'Pulse una estación para ver el producto en su ubicación, sus Normales y su Evolución. "Red reciente" deja solo las estaciones del monitoreo y el catálogo suma las históricas.'}</p>`
      +'<button type="button" class="cm-enlace" data-cm-buscar>Buscar una estación</button>';
    f.querySelectorAll('[data-cm-est]').forEach(b=>b.onclick=()=>{CM.estaciones=b.dataset.cmEst;histPintar();if(puntual)ciPintar();else cmCatalogo();cliPanelPintar();});
    f.querySelector('[data-cm-buscar]').onclick=()=>{CM.panel=null;cliPanelPintar();$('#f-buscar').focus();};
  }else if(CM.panel==='limites'){
    f.innerHTML=cab('Cartografía')+grupo('lim',[['provincias','Provincias'],['cantones','Cantones'],['parroquias','Parroquias'],['ninguno','Ocultar']],CM.limites)+'<p>Límites administrativos en negro. Acerca el mapa para distinguir cantones y parroquias.</p>';
    f.querySelectorAll('[data-cm-lim]').forEach(b=>b.onclick=()=>{CM.limites=b.dataset.cmLim;cmCartografia();cliPanelPintar();});
  }else if(CM.panel==='opacidad'){
    f.innerHTML=cab('Presentación del mapa')+`<label>Opacidad <output>${Math.round(CM.opacidad*100)} %</output><input type="range" min="0" max="100" value="${CM.opacidad*100}" aria-label="Opacidad de la capa climática"></label><button type="button" data-cm-ley aria-pressed="${CM.leyenda}">${CM.leyenda?'Ocultar':'Mostrar'} leyenda</button>`;
    f.querySelector('input').oninput=e=>{CM.opacidad=+e.target.value/100;if(CLI.capa?.setOpacity)CLI.capa.setOpacity(CM.opacidad);else CLI.capa?.eachLayer?.(l=>l.setStyle?.({fillOpacity:CM.opacidad}));f.querySelector('output').textContent=e.target.value+' %';};
    f.querySelector('[data-cm-ley]').onclick=()=>{CM.leyenda=!CM.leyenda;cliPanelPintar();};
    const soporte=cliProductos().filter(q=>q.variable===p.variable&&cmGrupo(q)==='Cobertura y calidad');
    if(soporte.length){f.insertAdjacentHTML('beforeend',`<label class="cm-calidad">Cobertura de los datos<select data-cm-calidad aria-label="Capa de cobertura"><option value="">Elegir capa</option>${soporte.map(q=>`<option value="${esc(q.clave)}">${esc(q.nombre)}</option>`).join('')}</select></label>`);f.querySelector('[data-cm-calidad]').onchange=e=>{if(e.target.value){CM.panel='producto';cmElegir(e.target.value);}};}

  }
  if(!f.hidden)f.querySelector('[data-cm-cerrar]').onclick=()=>{const k=CM.panel;CM.panel=null;cliPanelPintar();barra.querySelector(`[data-cm-panel="${k}"]`)?.focus();};
  if(!CM.escape){CM.escape=true;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&M.fam==='clima'&&CM.panel){CM.panel=null;cliPanelPintar();}});}
}
/* Segundo bloque de la leyenda: las estaciones con registro (aprobado el 30-oct,
   retirado el 3-nov y devuelto el 5-nov). Solo cuando esos puntos están en el mapa. */
function cmLeyendaEstaciones(p){
  if(!p||p.tipo_mapa==='estaciones'||CM.estaciones==='ninguna')return '';
  // sin la clase capa-sub: cliPintarCapa escribe su aviso de carga en la primera capa-sub del panel
  return '<div class="hist-ley cm-hist-ley" title="Pulse una estación para ver sus Normales y su Evolución"><b>Estaciones con registro</b>'
    +'<span><i class="ll"></i>con datos este año</span><span><i class="hh"></i>solo historia</span><span class="cm-hist-tam">tamaño por años de serie</span></div>';
}
function cmPanel(pn,ps,p,it,meta,i,n){
  cmMontar(pn);cmEncuadreResponsive();cmControles(p,it,meta);
  const cad=cmCaducado(p,it),indices=p.items.map((z,j)=>({z,j})).filter(({z})=>p.tipo!=='indice'||z.tipo===it.tipo),paso=indices.findIndex(x=>x.j===i);
  const firma=JSON.stringify([p.clave,it,i,ps.map(x=>x.clave),cad,CM.leyenda,CM.estaciones]);if(pn.dataset.cmFirma===firma)return;pn.dataset.cmFirma=firma;
  pn.innerHTML=`<div class="capa-fila ct-sel"><select data-cli-sel aria-label="Producto de climatología">${cmMenuProductos(ps,p)}</select><button type="button" class="cm-info" data-cm-ayuda aria-label="Información del producto y del gráfico" title="Información del producto y del gráfico">i</button></div>`
    +`<div class="ct-paso cm-tiempo"><button type="button" class="ct-btn" data-cm-prev aria-label="Periodo anterior" ${paso<=0?'disabled':''}>‹</button><select data-cm-fecha aria-label="Fecha o periodo">${cmOpcionesFecha(p,i)}</select><button type="button" class="ct-btn" data-cm-next aria-label="Periodo siguiente" ${paso>=indices.length-1?'disabled':''}>›</button></div>`
    +`<div class="cm-corte"><span>${esc(cmRango(p,it))}</span></div>`
    
    +(CM.leyenda?`<div class="cm-escala-producto">${cliEscalaHTML(meta)}</div>${cmLeyendaEstaciones(p)}`:'')
    +(cad?'<p class="cm-alerta" role="status">Emisión vencida. No se muestra el pronóstico.</p>':'')+'<div class="capa-sub cm-carga" role="status" aria-live="polite"></div>';
  pn.querySelector('[data-cm-ayuda]').onclick=()=>cmAyuda(p,cliItem());
  pn.querySelector('[data-cli-sel]').onchange=e=>cmElegir(e.target.value);
  pn.querySelector('[data-cm-fecha]').onchange=e=>cmCambiarPeriodo(+e.target.value);
  pn.querySelector('[data-cm-prev]').onclick=()=>cmCambiarPeriodo(indices[Math.max(0,paso-1)].j);
  pn.querySelector('[data-cm-next]').onclick=()=>cmCambiarPeriodo(indices[Math.min(indices.length-1,paso+1)].j);
}
// Fecha del indicador: meses, años y ciclos en el mismo selector, cada uno en su grupo.
function cmOpcionesFecha(p,i){
  const op=({z,j})=>`<option value="${j}" ${j===i?'selected':''}>${esc(cmEtiquetaPeriodo(p,z))}${cmParcial(p,z)?' (parcial)':''}</option>`,filas=p.items.map((z,j)=>({z,j}));
  if(p.tipo!=='indice')return filas.map(op).join('');
  const nombres={mensual:'Meses',anual:'Años',ciclo:'Ciclos de octubre a septiembre'},tipos=[...new Set(p.items.map(z=>z.tipo))];
  return tipos.map(t=>`<optgroup label="${esc(nombres[t]||t)}">${filas.filter(({z})=>z.tipo===t).reverse().map(op).join('')}</optgroup>`).join('');
}
function cmCambiarPeriodo(j){
  const p=cliProducto();CI.panel=p.clave.startsWith('ci_');CLI.pos[p.clave]=Math.min(p.items.length-1,Math.max(0,j));cerrarFicha();cliQuitar();
  M.vista=p.tipo_mapa==='estaciones'?'indices':'producto';cliPintarCapa();pintarSerie();
}
function cmPeriodoAgrupado(p,it,tipo){
  const candidatos=p.items.map((z,j)=>({z,j})).filter(({z})=>z.tipo===tipo);
  const fecha=it.hasta||it.desde||'';
  return (candidatos.find(({z})=>z.desde<=fecha&&z.hasta>=fecha)||candidatos.filter(({z})=>!z.parcial).at(-1)||candidatos.at(-1))?.j??0;
}

function cmCartografiaQuitar(){CM.turno++;for(const c of CM.capas)MAPA_L?.removeLayer(c);CM.capas=[];}
async function cmCartografia(){
  cmCartografiaQuitar();const turno=CM.turno,nivel=CM.limites;
  if(M.fam!=='clima')return;
  if(!MAPA_L.getPane('clima-limites')){const pn=MAPA_L.createPane('clima-limites');pn.style.zIndex='415';pn.style.pointerEvents='none';}
  // Fondo neutro para distinguir los límites negros y los puntos en ambos temas.
  if(cliProducto()?.tipo_mapa==='estaciones')for(const g of [M.carto?.provincias,M.carto?.provincias_insular].filter(Boolean))CM.capas.push(L.geoJSON(g,{pane:'clima-limites',interactive:false,style:{stroke:false,fillColor:'#d6e0e4',fillOpacity:.82}}).addTo(MAPA_L));
  if(nivel==='ninguno')return;
  const niveles=mosLimNiveles(nivel),datos=await Promise.all(niveles.map(mosLimitesDatos));
  if(turno!==CM.turno||M.fam!=='clima')return;
  datos.forEach((g,i)=>{if(g)CM.capas.push(L.geoJSON(g,{pane:'clima-limites',interactive:false,style:{color:'#000',weight:niveles[i]==='provincias'?1:.5,opacity:niveles[i]==='parroquias'?.55:.9,fill:false}}).addTo(MAPA_L));});
}
function cmReferencia(x){
  if(CM.referencia!=='1991-2020'||!x||x.tipo!=='mensual')return x;
  const fondo=Object.fromEntries(Object.entries(x.fondo||{}).filter(([y])=>+y>=1991&&+y<=2020));
  const q=(a,p)=>{const t=(a.length-1)*p,i=Math.floor(t);return a[i]+(a[Math.min(a.length-1,i+1)]-a[i])*(t-i);};
  const cols=Array.from({length:12},(_,m)=>Object.values(fondo).map(a=>a[m]).filter(finito).sort((a,b)=>a-b));
  return {...x,fondo,desde:1991,hasta:2020,n_anios:Object.keys(fondo).length,n_anios_mes:cols.map(a=>a.length),media:cols.map(a=>a.length>=24?a.reduce((s,v)=>s+v,0)/a.length:null),p25:cols.map(a=>a.length>=24?q(a,.25):null),p75:cols.map(a=>a.length>=24?q(a,.75):null),aviso:'Solo meses con al menos 24 años completos. Un hueco no se cuenta como cero.'};
}
function cmReferenciaControl(){return `<label class="cm-ref">Referencia <select data-cm-ref><option value="historia" ${CM.referencia==='historia'?'selected':''}>Todo el registro · promedio histórico</option><option value="1991-2020" ${CM.referencia==='1991-2020'?'selected':''}>1991–2020 · mínimo 24 años por mes</option></select></label>`;}
function cmReferenciaEventos(xs,d,lluvia){document.querySelectorAll('[data-cm-ref]').forEach(el=>el.onchange=()=>{CM.referencia=el.value;dibujarNormalesLargas(xs,d,lluvia);});}
function cmDialogo(titulo){
  document.getElementById('cm-dialogo')?.remove();
  const d=document.createElement('dialog');d.id='cm-dialogo';d.innerHTML=`<header><h2>${esc(titulo)}</h2><button type="button" aria-label="Cerrar">✕</button></header><div class="cm-contenido"></div>`;
  document.body.appendChild(d);d.querySelector('button').onclick=()=>d.close();d.addEventListener('close',()=>{d.querySelectorAll('.js-plotly-plot').forEach(n=>Plotly.purge(n));d.remove();});d.showModal();return d.querySelector('.cm-contenido');
}
async function cmPlot(target,tr,layout,config={}){
  target=typeof target==='string'?document.getElementById(target):target;
  if(!target)return;
  for(let n=0;n<100&&!window.Plotly;n++)await new Promise(r=>setTimeout(r,50));
  if(!target.isConnected)return;
  if(!window.Plotly){target.textContent='No se pudo cargar el gráfico. Vuelve a seleccionar el producto para reintentar.';return;}
  const k=_cliColores(),barras=tr.filter(t=>t.type==='bar'&&Array.isArray(t.y)),el=typeof target==='string'?document.getElementById(target):target;
  let lay={...layout};
  if(barras.length){
    const grupos=lay.barmode==='group'?barras.length:1;
    barras.forEach(t=>{
      if(!t.text)t.text=t.y.map(v=>finito(v)?num(v,Number.isInteger(v)?0:Math.abs(v)<10?2:Math.abs(v)<100?1:0):'');
      const celda=Math.max(1,((el?.clientWidth||600)-80)/Math.max(1,t.y.length)/grupos),tam=celda<18?10:12;
      const largo=Math.max(...t.text.map(x=>String(x||'').length))*tam*.57;
      Object.assign(t,{textposition:'outside',textangle:largo>celda*.9?-90:0,textfont:{size:tam,color:k.tinta},cliponaxis:false,constraintext:'none'});
    });
    if(!lay.yaxis?.range){
      const ys=tr.filter(t=>!t.yaxis||t.yaxis==='y').flatMap(t=>Array.isArray(t.y)?t.y.flatMap((v,i)=>finito(v)?[v,v+(t.error_y?.array?.[i]||0),v-(t.error_y?.arrayminus?.[i]||0)]:[]):[]);
      if(ys.length){const lo=Math.min(0,...ys),hi=Math.max(0,...ys),amplitud=hi-lo||1;lay.yaxis={...lay.yaxis,range:[lo<0?lo-.2*amplitud:0,hi+.2*amplitud]};}
    }
    lay.margin={...lay.margin,t:Math.max(lay.margin?.t||0,32)};
  }
  try{Plotly.purge(target);}catch(_){}
  try{await Plotly.newPlot(target,tr,{paper_bgcolor:k.fondo,plot_bgcolor:k.fondo,font:{family:'Segoe UI,sans-serif',color:k.tinta,size:12},...lay},{responsive:true,displaylogo:false,...config});}catch(e){if(!target.isConnected)return;throw e;}
  if(!target.isConnected)return;
  cmSeguirGrafico(target);return target;
}
function cmNombreModelo(k){return ({climatologia:'Climatología (referencia)',seas5_sin_corregir:'SEAS5 · crudo',seas5_razon:'SEAS5 · corregido',mm_iguales:'Multimodelo · pesos iguales',mm_calibrado:'Multimodelo · calibrado',razon_ecmwf_51:'SEAS5 · corregido',razon_meteo_france_9:'System 9 · Francia',razon_ukmo_610:'GloSea6 · Reino Unido',razon_dwd_22:'GCFS2.2 · Alemania',razon_cmcc_4:'SPS4 · Italia',razon_ncep_2:'CFSv2 · Estados Unidos',razon_jma_4:'CPS4 · Japón',razon_eccc_4:'CanESM5.1 · Canadá',razon_eccc_5:'GEM5.2-NEMO · Canadá',razon_bom_2:'ACCESS-S2 · Australia'})[k]||k;}
function cmTabla(rows,columns){return `<div class="cm-tabla"><table><thead><tr>${columns.map(([,n])=>`<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(([k])=>`<td>${esc(r[k]==null?'—':typeof r[k]==='number'?num(Math.abs(r[k])<.005?0:r[k],/^(n|n_estaciones|percentil_nominal|pares|anios|plazo|mes|pares_validacion)$/.test(k)?0:2):String(r[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
async function cmValidacion(p,it){
  if(p?.pronostico_ml)return cmMLValidacion(p,it);
  if(p.tipo_mapa==='estaciones')return cmAyudaGrafico();
  const c=cmDialogo('Validación · '+p.nombre),v=CLI.motor?.validacion;
  if(p.grupo==='Pronóstico estacional'){
    const vs=v?.[p.variable==='temp_aire'?'temperatura':'lluvia'];
    if(!vs){c.textContent='Este producto no publica una tabla de métricas.';return;}
    c.innerHTML=`<p>${esc(vs.metodo)}</p><p>${esc(vs.referencia)} · ${esc(vs.periodo)}</p><label>Región <select data-cm-region aria-label="Región de validación">${['País','Costa','Sierra','Amazonía'].map(r=>`<option>${r}</option>`).join('')}</select></label><p>Valores de habilidad mayores que cero mejoran la climatología y los menores o iguales a cero no la mejoran. Los pares de una misma temporada no son observaciones independientes.</p><div data-cm-metricas></div><div id="cm-fiabilidad" class="cm-grafico" ${vs.fiabilidad?'':'hidden'}></div><p data-cm-ic></p>`;
    const dibuja=()=>{
      const region=c.querySelector('[data-cm-region]').value,rows=(vs.metricas||[]).filter(r=>(!it.plazo||+r.plazo===+it.plazo)&&r.region===region&&!r.metodo.startsWith('cand_'));
      c.querySelector('[data-cm-metricas]').innerHTML=cmTabla(rows.filter(r=>r.metodo!=='razon_ecmwf_51').map(r=>({...r,metodo:cmNombreModelo(r.metodo)})),vs.columnas?.map(c=>c[0]==='bss_calido'?(p.clave.endsWith('_frio')?['bss_frio','BSS frío']:p.clave.endsWith('_normal')?['bss_normal','BSS intermedio']:c):c)||[['metodo','Modelo'],['plazo','Plazo'],['region','Región'],['error_medio_abs_pp','MAE (puntos %)'],['rpss','RPSS'],['pares','Pares']]);
      const model=p.clave.replace('estacional_temp_','').replace(/_(media|anom|calido|frio|normal)$/,'');
      const cat=p.clave.endsWith('_frio')?'bajo':p.clave.endsWith('_normal')?'normal':'alto',categoria={bajo:'Tercil frío',normal:'Tercil intermedio',alto:'Tercil cálido'}[cat];
      const puntos=(vs.fiabilidad||[]).filter(r=>r.modelo===model&&r.region===region&&+r.plazo===+it.plazo&&(r.categoria||'alto')===cat);
      if(puntos.length)cmPlot('cm-fiabilidad',[{x:[0,1],y:[0,1],name:'Fiabilidad perfecta',mode:'lines',line:{dash:'dot',color:'#888'}},{x:puntos.map(z=>z.p),y:puntos.map(z=>z.frecuencia),customdata:puntos.map(z=>z.n),hovertemplate:'Pronosticado %{x:.0%}<br>Observado %{y:.0%}<br>Pares %{customdata}<extra></extra>',name:categoria,mode:'lines+markers',line:{color:'#bd573c'}}],{title:'Fiabilidad · '+categoria+' · '+region,margin:{l:65,r:15,t:45,b:80},xaxis:{title:'Probabilidad pronosticada',range:[0,1],tickformat:'.0%'},yaxis:{title:'Frecuencia observada',range:[0,1],tickformat:'.0%'},legend:{orientation:'h',y:-.3}});
      const ci=rows.find(r=>r.metodo===p.fuente?.replace('C3S · ',''))?.maess_ic95||rows.find(r=>p.clave.includes('multimodelo')&&r.metodo.startsWith('Multimodelo'))?.maess_ic95;
      c.querySelector('[data-cm-ic]').textContent=ci?'Intervalo del 95 % para MAESS del sistema seleccionado, de '+ci.map(z=>num(z,2)).join(' a ')+'. Si contiene cero, no hay una mejora concluyente en esta muestra.':'';
    };c.querySelector('[data-cm-region]').onchange=dibuja;dibuja();return;
  }
  if(p?.clave?.startsWith('prev_')){
    const v=(CLI.idx?.prevista||{})[p.clave.includes('tmin')?'tmin':'prcp'];
    c.innerHTML=`<p>Fuente ${esc((v?.fuente||'—').split(' · ')[0])}. Corrida ${esc(v?.corrida_modelo||'—')}.</p>`;
    const m=v?.validacion||{},keys=p.clave.includes('tmin')?['mae_tmin','n_tmin']:['mae','n'];
    c.innerHTML+=cmTabla(['1-3','4-7'].map(b=>({plazo:b,mae:m[keys[0]]?.[b],n:m[keys[1]]?.[b]})),[['plazo','Días'],['mae','MAE · '+(p.clave.includes('tmin')?'°C':'mm')],['n','Pares']]);return;
  }
  const ref=v?.referencia,familia=cmFamilia(p),termica=p.variable==='temp_aire';
  if(['referencia','soporte','observado'].includes(familia)){
    if(!ref){c.innerHTML='<p>Este producto no publica una tabla de métricas.</p>';return;}
    const variable=termica?(/tmin/.test(p.clave)?'tmin':'tmax'):'prcp';
    c.innerHTML=`<p><b>Climatología calibrada v${esc(ref.version)}</b> · referencia ${esc(ref.periodo)}.</p>`;
    if(familia==='soporte'){
      c.innerHTML+='<p>Esta capa describe el soporte de la referencia en estaciones, años o distancia a la red.</p><p>Consulte conjuntamente las cuatro capas de cobertura.</p>';return;
    }
    if(p.clave.startsWith('umbral_')){
      const nominal=+p.clave.slice(-2),rows=(ref.excedencia||[]).filter(r=>r.variable==='precip'&&r.percentil_nominal===nominal);
      c.innerHTML+='<p>Control de excedencia de los percentiles diarios de lluvia de la fuente. El mapa muestra su promedio mensual.</p>';
      c.innerHTML+=cmTabla(rows.map(r=>({...r,observada_pct:r.frec_obs*100,esperada_pct:r.frec_esperada*100})),[['correccion','Ensayo de la fuente'],['percentil_nominal','Percentil'],['n_estaciones','Estaciones'],['n','Pares'],['observada_pct','Excedencia observada %'],['esperada_pct','Esperada %']]);return;
    }
    if(!termica){
      const normal=familia==='referencia',summary=normal?ref.normal_lluvia_cv?.global?.C9:ref.cadena_lluvia_cv?.mensual?.C9;
      c.innerHTML+=normal?'<p>Validación espacial del fondo C9 con cinco bloques de estaciones retenidas. Las estaciones evaluadas no se usan para ajustar su predicción.</p>':'<p>Validación espacial de la lluvia mensual C9 de la fuente histórica.</p>';
      if(summary)c.innerHTML+=cmTabla([summary],[['n','Pares estación-mes'],['MAE','MAE mm'],['RMSE','RMSE mm'],['PBIAS','Sesgo %'],['r','Correlación']]);
    }
    const comparison=ref.normales_dentro_muestra?.[variable],unit=termica?'°C':'mm';
    if(comparison){c.innerHTML+=`<p><b>Comprobación dentro de muestra.</b> Normales de la malla frente a ${comparison.estaciones} estaciones.</p>`;
      c.innerHTML+=cmTabla(Object.entries(comparison.nueva||{}).map(([region,r])=>({region,...r})),[['region','Región'],['n','Pares estación-mes'],['MAE','MAE '+unit],['RMSE','RMSE '+unit],['sesgo','Sesgo '+unit]]);}
    c.innerHTML+=`<p>Informe de la fuente del ${esc(cmFecha(ref.generado))}. Las capas de cobertura permiten consultar dónde hay menos estaciones o historia.</p>`;return;
  }
  c.innerHTML='<p>El interpolado se valida dejando fuera cada estación y comparando su observado con la estimación.</p><p>Las capas de soporte indican años de referencia, estaciones y distancia a la red. La cobertura y la habilidad predictiva se evalúan por separado.</p>';
}
// El estado oficial llega en inglés y con «:». Se dice en español y sin siglas.
function cmEnsoResumen(s){
  s=String(s||'').replace(/^\s*Estado oficial\s+[A-Z]{2,5}\s*:\s*/i,'');
  const t={'el niño advisory':'condiciones de El Niño','la niña advisory':'condiciones de La Niña','el niño watch':'vigilancia de El Niño','la niña watch':'vigilancia de La Niña','final el niño advisory':'fin de El Niño','final la niña advisory':'fin de La Niña','not active':'sin episodio activo'}[s.trim().toLowerCase()];
  return 'Estado oficial del Pacífico, '+(t||s.replace(/[:;]\s*/g,'. '));
}
async function cmENSO(){
  const caja=cmDialogo('El Niño · océano, atmósfera y respuesta en Ecuador');caja.textContent='Cargando seguimiento…';
  const d=await _pedirJSON('datos/productos/clima_enso.json');if(!caja.isConnected)return;
  if(!d){caja.textContent='No se ha podido cargar el seguimiento ENSO.';return;}
  caja.innerHTML=`<p>${esc(cmEnsoResumen(d.resumen))} · Actualizado el ${esc(cmFecha(d.generado))}</p><div class="cm-enso-kpi">${(d.series||[]).map(s=>`<div><b>${esc(s.nombre)}</b><strong>${num(s.datos.at(-1)?.valor,2)} ${esc(s.unidad)}</strong><small>${esc(s.datos.at(-1)?.periodo||'')} · ${esc(s.frecuencia)}</small></div>`).join('')}</div><label>Periodo <select data-cm-rango aria-label="Periodo de seguimiento ENSO"><option value="60">Últimos 5 años</option><option value="240">Últimos 20 años</option><option value="9999">Toda la serie disponible</option></select></label><div id="cm-enso-hist" class="cm-grafico"></div><p>RONI es la señal relativa del Pacífico tropical, ONI da la continuidad histórica y Niño 1+2 corresponde al Pacífico oriental cercano a Ecuador. Un trimestre cálido aislado no declara por sí solo un episodio.</p><div id="cm-enso-fut" class="cm-grafico"></div><p>${esc(d.pronostico?.nota||'')}</p><div id="cm-enso-local"></div><details><summary>Fuentes y control de calidad</summary><p>${esc(d.validacion?.metodo||'')}</p>${(d.fuentes||[]).map(f=>`<p><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nombre)}</a> · ${esc(f.version||'')}</p>`).join('')}</details>`;
  const dibuja=()=>{
    const n=+caja.querySelector('[data-cm-rango]').value,tr=d.series.filter(s=>s.unidad==='°C').map((s,i)=>({x:s.datos.slice(-n).map(z=>z.fecha),y:s.datos.slice(-n).map(z=>z.valor),name:s.nombre,mode:'lines',line:{width:i?1.7:3},connectgaps:false}));
    cmPlot('cm-enso-hist',tr,{title:'Evolución observada',margin:{t:45,l:50,r:15,b:55},yaxis:{title:'Anomalía · °C',zeroline:true},legend:{orientation:'h',y:-.2},shapes:[-.5,.5].map(y=>({type:'line',xref:'paper',x0:0,x1:1,y0:y,y1:y,line:{dash:'dot',color:'#666'}}))});
    if(d.oceano){let sst=document.getElementById('cm-enso-sst');if(!sst){sst=document.createElement('div');sst.id='cm-enso-sst';sst.className='cm-grafico';document.getElementById('cm-enso-hist').after(sst);}cmPlot(sst,d.oceano.map(s=>({x:s.datos.slice(-n).map(z=>z.fecha),y:s.datos.slice(-n).map(z=>z.valor),mode:'lines',name:s.nombre})),{title:'Temperatura superficial del mar · valor absoluto',margin:{t:45,l:55,r:15,b:55},yaxis:{title:'TSM · °C'},legend:{orientation:'h',y:-.2}});}
    let atmos=document.getElementById('cm-enso-atmos');if(!atmos){atmos=document.createElement('div');atmos.id='cm-enso-atmos';atmos.className='cm-grafico';document.getElementById('cm-enso-hist').after(atmos);}
    cmPlot(atmos,d.series.filter(s=>s.unidad!=='°C').map(s=>({x:s.datos.slice(-n).map(z=>z.fecha),y:s.datos.slice(-n).map(z=>z.valor),name:s.nombre,mode:'lines',yaxis:s.id==='olr'?'y2':'y',connectgaps:false})),{title:'Acoplamiento atmosférico',margin:{t:45,l:55,r:60,b:55},yaxis:{title:'SOI · σ'},yaxis2:{title:'OLR · W/m²',overlaying:'y',side:'right'},legend:{orientation:'h',y:-.2}});
  };caja.querySelector('[data-cm-rango]').onchange=dibuja;dibuja();
  const f=d.pronostico?.periodos||[],xf=f.map(x=>x.periodo),tr=[];
  for(const [lo,hi,op] of [['p05','p95',.12],['p15','p85',.15],['p25','p75',.2]]){
    tr.push({x:xf,y:f.map(z=>z[lo]),mode:'lines',line:{width:0},showlegend:false,hoverinfo:'skip'});
    tr.push({x:xf,y:f.map(z=>z[hi]),mode:'lines',line:{width:0},fill:'tonexty',fillcolor:`rgba(184,58,38,${op})`,name:`Intervalo ${lo==='p05'?90:lo==='p15'?70:50}%`});
  }
  tr.push({x:xf,y:f.map(z=>z.p50),mode:'lines+markers',name:'Mediana RONI',line:{color:colorTema('--calor','#b83a26'),width:2.5}});
  cmPlot('cm-enso-fut',tr,{title:'Pronóstico oficial RONI · '+(d.pronostico?.emision||''),margin:{t:45,l:50,r:15,b:75},yaxis:{title:'RONI · °C'},legend:{orientation:'h',y:-.3}});
  const local=d.respuesta_ecuador;
  if(d.lluvia_reciente){const box=document.createElement('section');box.innerHTML='<h3>Lluvia registrada en Ecuador</h3><label>Región <select data-cm-lluvia-region aria-label="Región de lluvia"></select></label><div id="cm-lluvia-actual" class="cm-grafico"></div><p>Promedio espacial de la malla calibrada, en milímetros. El asterisco marca un mes parcial, que se compara con la normal de los mismos días.</p>';document.getElementById('cm-enso-local').before(box);const r=d.lluvia_reciente;box.querySelector('select').innerHTML=r.filas.map(z=>`<option>${esc(z.nombre)}</option>`).join('');const graf=()=>{const f=r.filas.find(z=>z.nombre===box.querySelector('select').value),xx=r.meses.slice(-12).map(z=>z.mes+(z.parcial?'*':''));cmPlot('cm-lluvia-actual',[{type:'bar',x:xx,y:f.mm.slice(-12),name:'Lluvia',marker:{color:'#3696c1',pattern:{shape:r.meses.slice(-12).map(z=>z.parcial?'/':'')}}},{type:'scatter',x:xx,y:f.normal.slice(-12),mode:'lines+markers',name:'Normal del periodo',line:{color:'#bf8d4c'}}],{title:f.nombre+' · hasta '+r.hasta,margin:{t:45,l:55,r:15,b:90},xaxis:{type:'category',tickangle:-35},yaxis:{title:'Lluvia · mm',rangemode:'tozero'},legend:{orientation:'h',y:-.3}});};box.querySelector('select').onchange=graf;graf();}
  const region=document.getElementById('cm-enso-local');
  region.innerHTML=local?`<h3>Relación histórica con Ecuador</h3><p>${esc(local.metodo)}</p><label>Mes objetivo <select data-cm-mes aria-label="Mes de validación ENSO">${MES.map((m,i)=>`<option value="${i+1}" ${i===new Date().getMonth()?'selected':''}>${esc(m)}</option>`).join('')}</select></label><div id="cm-enso-habilidad" class="cm-grafico"></div><div data-cm-local-tabla></div>`:'<p>La respuesta local requiere contrastar lluvias, persistencia, extremos y caudales. El índice oceánico no atribuye por sí solo un evento de lluvia.</p>';
  if(local){const dibuja=()=>{const rows=local.metricas.filter(r=>r.mes===+region.querySelector('[data-cm-mes]').value);region.querySelector('[data-cm-local-tabla]').innerHTML=cmTabla(rows,[['region','Región'],['indice','Índice'],['r','Correlación'],['n','Años'],['pares_validacion','Años de prueba'],['maess','MAESS']]);cmPlot('cm-enso-habilidad',['RONI','ONI','Niño 1+2'].map(ind=>{const rr=rows.filter(r=>r.indice===ind);return {type:'bar',name:ind,x:rr.map(r=>r.region),y:rr.map(r=>r.maess)};}),{title:'Habilidad para lluvia del mes frente a climatología',margin:{t:45,l:55,r:15,b:55},barmode:'group',yaxis:{title:'MAESS',zeroline:true},legend:{orientation:'h',y:-.2}});};region.querySelector('[data-cm-mes]').onchange=dibuja;dibuja();}
}

// La leyenda y los controles cambian de alto al girar el teléfono. Plotly debe
// seguir la caja del gráfico, no sólo el resize de la ventana.
function cmSeguirGrafico(target){
  target._cmObserver?.disconnect();
  let anterior='',pendiente=0;
  const ajustar=()=>{
    pendiente=0;
    if(!target.isConnected){target._cmObserver?.disconnect();return;}
    const w=Math.floor(target.clientWidth),h=Math.floor(target.clientHeight);
    if(w<100||h<100)return;
    const firma=w+'x'+h;if(firma===anterior)return;anterior=firma;
    Plotly.relayout(target,{width:w,height:h,autosize:false}).catch(()=>{});
  };
  target._cmObserver=new ResizeObserver(()=>{if(!pendiente)pendiente=requestAnimationFrame(ajustar);});
  target._cmObserver.observe(target);ajustar();
}

// Interpretación por producto: misma definición para mapa, ayuda y gráfico.
const CM_MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function cmFechaDia(s){const [y,m,d]=String(s).slice(0,10).split('-').map(Number);return y&&m&&d?`${d} ${CM_MESES[m-1]} ${y}`:String(s||'');}
function cmEtiquetaPeriodo(p,it){
  if(!it)return '';
  if(it.tipo==='mensual'&&/^\d{4}-\d{2}$/.test(it.id||''))return `${CM_MESES[+it.id.slice(5)-1]} ${it.id.slice(0,4)}`;
  if(it.tipo==='anual')return String(it.id);
  if(it.tipo==='ciclo')return `oct ${it.desde.slice(0,4)} – sep ${it.hasta.slice(0,4)}`;
  return String(it.etiqueta||it.fecha||it.mes||it.id||'Referencia');
}
function cmRango(p,it){
  if(it.desde&&it.hasta)return `${cmFechaDia(it.desde)} – ${cmFechaDia(it.hasta)}`;
  if(p.tipo==='mes')return `${cmEtiquetaPeriodo(p,it)} · referencia 1991–2020`;
  const per=String(it.periodo||'');return per&&!/estaciones$/.test(per)?per.split(' · ')[0]:cmEtiquetaPeriodo(p,it);
}
function cmParcial(p,it){
  if(it.parcial)return true;
  if(p.clave==='interpdia_mensual'&&it.fecha){const [y,m,d]=it.fecha.split('-').map(Number);return d<new Date(Date.UTC(y,m,0)).getUTCDate();}
  if(p.clave==='interpdia_anual'&&it.fecha)return it.fecha.slice(5)!=='12-31';
  return /_mes$/.test(it.campo||'')&&it.hasta?.slice(0,7)===cmHoy().slice(0,7);
}
function cmDescripcion(p,it={}){
  if(p?.pronostico_ml)return {corta:it.tipo==='semanal'?'Pronóstico de siete días en estaciones con desempeño comprobado.':'Pronóstico del mes completo en estaciones con desempeño comprobado.',mapa:'Pronóstico puntual que no se interpola entre estaciones.',grafico:'Mediana e intervalo del 80 % por semana o mes completo.',unidad:p.variable_objetivo==='precipitacion'?'mm':'°C',referencia:p.referencia};
  const k=p.clave,f=p.familia_indice,t=p.parametros||{},lluvia=p.variable==='precipitacion';let corta='',calculo='',ejemplo='';
  if(p.tipo_mapa==='estaciones'){
    const variable=/(_tx|tmax|^ci_tx|^ci_su|wsdi|th_range|minmax_xdays)/.test(k)?'temperatura máxima':lluvia?'lluvia':'temperatura mínima';
    const defs={
      sum:['Cantidad total de lluvia en el periodo.','Se suman los acumulados diarios válidos. El resultado se expresa en mm.'],
      mean:[`Promedio diario de ${variable} en el periodo.`,'Se suman los valores diarios válidos y se dividen por el número de días con dato.'],
      prcptot:['Lluvia acumulada únicamente en días con al menos 1 mm.','Se suman los mm de los días con lluvia ≥1 mm. No es una cantidad de días.'],
      sdii:['Intensidad media de los días lluviosos.','Lluvia acumulada en días ≥1 mm dividida por la cantidad de esos días. Se expresa en mm por día lluvioso.'],
      rx:[`Mayor lluvia acumulada en ${t.rx||1} ${(t.rx||1)===1?'día':'días consecutivos'} dentro del periodo.`,`Se comparan las sumas de ventanas completas de ${t.rx||1} ${(t.rx||1)===1?'día':'días'}. Se conserva la mayor y las ventanas no cruzan el límite del periodo.`],
      minmax_xdays:[`Mayor suma de ${variable} en ${t.rx||3} días consecutivos.`,`Se suman ${t.rx||3} temperaturas diarias y se conserva el máximo. No es la temperatura de un solo día ni un promedio.`],
      dd:['Número de días secos dentro del periodo.','Se cuentan los días con lluvia <1 mm. Pueden estar separados entre sí.'],
      th:[`Número de ${k==='ci_tropical'?'noches':'días'} con ${variable} ${t.operator||'≥'} ${t.threshold??1} ${lluvia?'mm':'°C'} dentro del periodo.`,`Se cuenta una vez cada día con ${variable} ${t.operator||'≥'} ${t.threshold??1} ${lluvia?'mm':'°C'}. Los días no tienen que ser consecutivos.`],
      th_range:[`Número de días con ${variable} entre ${t.threshold} y ${t.threshold2} °C.`,`Se cuentan los días con valor ≥${t.threshold} y ≤${t.threshold2} °C, incluidos ambos límites.`],
      fd:['Número de días con helada (Tmin <0 °C).','Se cuentan los días cuya temperatura mínima baja de 0 °C. No tienen que ser consecutivos.'],
      sud:[`Número de días con Tmax >${t.threshold} °C.`,`Se cuentan las temperaturas máximas diarias estrictamente mayores que ${t.threshold} °C.`],
      th_tmax:[`Número de días con Tmax >${t.threshold} °C.`,`Se cuenta un día si su temperatura máxima supera ${t.threshold} °C.`],
      th_tmin:[`Número de días con Tmin <${t.threshold} °C.`,`Se cuenta un día si su temperatura mínima baja de ${t.threshold} °C.`],
      cdd:['Duración de la mayor racha seca del periodo.','Máxima cantidad de días consecutivos con lluvia <1 mm. Un día faltante interrumpe la racha.'],
      cwd:['Duración de la mayor racha lluviosa del periodo.','Máxima cantidad de días consecutivos con lluvia ≥1 mm. Un día faltante interrumpe la racha.'],
      cxd:['Duración de la mayor racha de heladas del periodo.','Máxima cantidad de días consecutivos con Tmin <0 °C. No es la suma de todos los días con helada.'],
      spells:['Duración media de las rachas lluviosas del periodo.','Se identifican los tramos consecutivos de días con lluvia ≥1 mm y se promedian sus duraciones.'],
      qval:[`Percentil ${t.percentile} de la lluvia diaria del periodo.`,`Valor por debajo del cual se encuentra aproximadamente el ${t.percentile} % de los acumulados diarios. No es el percentil respecto a 1991–2020.`],
      qrange:['Amplitud del rango central de la lluvia diaria.','Diferencia P75 − P25 de los valores diarios del periodo. Expresa dispersión en mm.'],
      rXptot:[`Lluvia acumulada en los días que superan el P${t.percentile} de referencia.`,`Se suman los mm de días por encima del percentil ${t.percentile} de la referencia 1991–2020. No se cuentan días ni se expresa probabilidad.`],
      qth:[`Porcentaje de días por encima del P${t.percentile} de referencia.`,`100 × días que superan el P${t.percentile} / días válidos del periodo. El umbral procede de 1991–2020.`],
      tx10p:['Porcentaje de días con Tmax bajo el P10 de referencia.','100 × días con temperatura máxima bajo el umbral diario P10 / días válidos. Referencia 1991–2020.'],
      tx90p:['Porcentaje de días con Tmax sobre el P90 de referencia.','100 × días con temperatura máxima sobre el umbral diario P90 / días válidos. Referencia 1991–2020.'],
      tn10p:['Porcentaje de días con Tmin bajo el P10 de referencia.','100 × días con temperatura mínima bajo el umbral diario P10 / días válidos. Referencia 1991–2020.'],
      tn90p:['Porcentaje de días con Tmin sobre el P90 de referencia.','100 × días con temperatura mínima sobre el umbral diario P90 / días válidos. Referencia 1991–2020.'],
      wsdi:['Días que forman parte de rachas cálidas de al menos 6 días.','Se suman los días de rachas consecutivas con Tmax sobre P90 que duran al menos 6 días. No es el número de episodios.'],
      csdi:['Días que forman parte de rachas frías de al menos 6 días.','Se suman los días de rachas consecutivas con Tmin bajo P10 que duran al menos 6 días. No es el número de episodios.'],
      spi:[`Humedad o sequía de la lluvia acumulada en ${t.timescale} ${t.timescale===1?'mes':'meses'}.`,`El acumulado de ${t.timescale} ${t.timescale===1?'mes':'meses'} hasta el mes indicado se compara con su distribución 1991–2020 y se transforma a una escala estandarizada. Los valores positivos indican condiciones más húmedas, los negativos más secas y el cero el centro de la referencia. No tiene unidades de lluvia.`],
      rainy_season_start:['Fecha candidata de inicio de la temporada lluviosa.','El valor numérico indica el día contado desde el inicio de la ventana de búsqueda. La búsqueda va de octubre a marzo y requiere días posteriores para confirmar el candidato.'],
      rainy_season_end:['Fecha candidata de fin de la temporada lluviosa.','El valor numérico indica el día contado desde el inicio de la ventana de búsqueda de fin (marzo–septiembre). Se exige confirmación con datos posteriores.'],
      rainy_season_dur:['Duración de la temporada lluviosa candidata.','Días entre el inicio y el fin identificados por el método seleccionado. Solo hay resultado si ambos pueden confirmarse.']
    };
    const extremos={tnn:['mínimo','temperatura mínima'],tnx:['máximo','temperatura mínima'],txn:['mínimo','temperatura máxima'],txx:['máximo','temperatura máxima'],varmin:['mínimo','lluvia diaria'],varmax:['máximo','lluvia diaria']};
    if(extremos[f]){const [ext,v]=extremos[f];corta=`Valor ${ext} de ${v} dentro del periodo.`;calculo=`Se toma el ${ext} de los valores diarios válidos. Cada barra resume el periodo completo.`;}
    else [corta,calculo]=defs[f]||[ciNombre(p),ciNota(p)||'Consulte la definición del producto.'];
    if(['th','dd','fd','sud','th_tmax','th_tmin','th_range'].includes(f))ejemplo=k==='ci_wd'?'Por ejemplo, 12 días en octubre significa que 12 fechas de ese mes tuvieron al menos 1 mm de lluvia.':'Por ejemplo, una barra de 8 días para octubre significa que 8 fechas de ese mes cumplieron la condición.';
  }else{
    const defs={
      obs_lluvia_mm:['Lluvia acumulada en el intervalo seleccionado.','Suma de la lluvia diaria de la malla observada. El color expresa mm dentro de ese intervalo.'],
      obs_lluvia_pct:['Lluvia del intervalo como porcentaje de su normal.','100 × lluvia acumulada / normal 1991–2020 de los mismos días. 100 % equivale a la normal y 200 % es el doble. Donde la normal es menor de 0,5 mm por día el porcentaje no se calcula.'],
      obs_lluvia_pctl:['Posición de la lluvia del intervalo frente al clima histórico.','Percentil de la lluvia acumulada frente a los mismos días de la referencia 1991–2020. P90 indica un acumulado mayor que aproximadamente el 90 % de los casos de referencia. No es probabilidad de lluvia futura.'],
      obs_tmax:['Diferencia de la temperatura máxima media frente a la normal.','Promedio de las máximas diarias menos su referencia 1991–2020 para los mismos días. +2 °C significa 2 °C por encima. No una temperatura de 2 °C.'],
      obs_tmin:['Diferencia de la temperatura mínima media frente a la normal.','Promedio de las mínimas diarias menos su referencia 1991–2020 para los mismos días. Los valores negativos indican noches más frías.'],
      prev_lluvia_pct:['Lluvia prevista por IFS frente a la normal del intervalo.','100 × acumulado previsto / normal 1991–2020 de las fechas previstas. Es un pronóstico, no lluvia medida. Donde la normal es menor de 0,5 mm por día el porcentaje no se calcula.'],
      prev_lluvia_pctl:['Percentil del acumulado previsto por IFS.','Posición del acumulado previsto frente a la distribución histórica de esas fechas. El percentil no es la probabilidad de que llueva.'],
      prev_tmin:['Anomalía de la temperatura mínima prevista por IFS.','Temperatura mínima media prevista menos la normal de las mismas fechas. Los valores están en Δ°C.'],
      normal_lluvia:['Lluvia mensual normal de 1991–2020.','Media de los acumulados del mes calendario en el periodo de referencia. Enero representa en conjunto los eneros de la referencia, no enero del año actual.'],
      normal_tmax:['Temperatura máxima media normal de cada mes.','Promedio climatológico de las temperaturas máximas diarias del mes en 1991–2020. No es la máxima absoluta del mes.'],
      normal_tmin:['Temperatura mínima media normal de cada mes.','Promedio climatológico de las temperaturas mínimas diarias del mes en 1991–2020. No es la mínima absoluta del mes.'],
      interp_lluvia:['Estimación de la lluvia total de un mes calendario.','Mapa mensual construido a partir de estaciones. Su valor es una estimación espacial. No necesariamente coincide con el registro de una estación ni con la suma de mapas diarios.'],
      interp_lluvia_pct:['Estimación mensual expresada como porcentaje de la normal.','100 × total mensual estimado / normal del mes. 100 % equivale a lo normal. No indica porcentaje de días lluviosos. Donde la normal es menor de 0,5 mm por día el porcentaje no se calcula.'],
      interpdia_lluvia:['Lluvia estimada para un día de 07h00 a 07h00.','Acumulado del día señalado, desde las 07h00 hasta las 07h00 del día siguiente (Ecuador). El mapa puede actualizarse al llegar más estaciones.'],
      interpdia_prob:['Probabilidad estimada de que el día alcance 1 mm.','Probabilidad del modelo de interpolación, expresada entre 0 y 100 %. No cuenta días ni equivale al porcentaje de la normal.'],
      interpdia_distancia:['Distancia a la estación usada más cercana.','Kilómetros desde la celda hasta la estación de apoyo más cercana del día seleccionado. Describe cobertura espacial, no cantidad de lluvia ni error demostrado.'],
      interpdia_tres_dias:['Lluvia acumulada en tres días hasta la fecha elegida.','Se suman tres mapas diarios consecutivos. Las barras de fechas contiguas comparten dos días y no deben sumarse entre sí.'],
      interpdia_semanal:['Lluvia acumulada en siete días hasta la fecha elegida.','Se suman siete mapas diarios consecutivos. Las ventanas de fechas contiguas se solapan. No deben sumarse entre sí.'],
      interpdia_mensual:['Lluvia acumulada desde el inicio del mes hasta el corte disponible.','Suma de los mapas diarios del mismo mes. Si el mes está abierto, solo incluye los días disponibles.'],
      interpdia_anual:['Lluvia acumulada desde enero hasta el corte disponible.','Suma de los mapas diarios del año. El año en curso queda parcial hasta el último día con dato.'],
      interpdia_dias_secos:['Días secos consecutivos que terminan en la fecha elegida.','Se cuentan hacia atrás los días con lluvia <1 mm hasta encontrar un día lluvioso o un dato faltante. No es la cantidad total de días secos del mes.'],
      interpdia_dias_lluvia:['Días lluviosos consecutivos que terminan en la fecha elegida.','Se cuentan hacia atrás los días con lluvia ≥1 mm. No es la cantidad total de días lluviosos del mes ni la mayor racha del mes.'],
      interpdia_tmax:['Temperatura máxima estimada del día.','Mayor temperatura del día estimada espacialmente, en °C. No es la temperatura media ni una anomalía.'],
      interpdia_tmin:['Temperatura mínima estimada del día.','Menor temperatura del día estimada espacialmente, en °C. No es la temperatura media ni una anomalía.']
    };
    if(defs[k])[corta,calculo]=defs[k];
    else if(k.startsWith('umbral_')){const q=k.split('_p')[1];corta=`Umbral P${q} de la lluvia de días lluviosos.`;calculo=`Acumulado diario que deja por debajo aproximadamente el ${q} % de los días lluviosos de referencia. Se expresa en mm por día. No es un total mensual ni una probabilidad.`;}
    else if(/^interp_t/.test(k)){const v=k.includes('tmax')?'máximas':'mínimas';corta=k.endsWith('_anom')?`Anomalía mensual de las temperaturas ${v}.`:`Media mensual estimada de las temperaturas ${v}.`;calculo=k.endsWith('_anom')?'Estimación mensual menos normal del mes. Los valores positivos indican más calor y los negativos más frío. Se expresa en Δ°C.':`Promedio de las temperaturas ${v} diarias, estimado para cada celda del mes elegido. Se expresa en °C.`;}
    else if(k.startsWith('soporte_')){
      if(k.includes('n_estaciones'))[corta,calculo]=['Número de estaciones de apoyo de la referencia.','Conteo de estaciones de referencia asociadas a la celda. No son estaciones transmitiendo hoy ni días con lluvia.'];
      else if(k.includes('dist_estacion'))[corta,calculo]=['Distancia a la estación de referencia más cercana.','Distancia en km. Un valor mayor señala menor proximidad a datos de estación. No cuantifica por sí mismo el error.'];
      else if(k.includes('anios_estacion_max'))[corta,calculo]=['Mayor cantidad de años disponibles en una estación de apoyo.','Longitud máxima de historia de estación asociada a la celda de referencia. No equivale a años completos en todas las estaciones.'];
      else [corta,calculo]=['Cantidad de años disponibles en la malla de referencia.','Cobertura temporal de la referencia, en años con dato.'];
    }else [corta,calculo]=[p.nombre,p.nota||'Consulte la fuente y la validación de este producto.'];
  }
  return {corta,calculo,ejemplo};
}
function cmLecturaBarras(p,it){
  if(p.tipo_mapa==='estaciones'){
    if(p.familia_indice==='spi')return `Cada barra corresponde al mes de cierre de una ventana de ${p.parametros.timescale} ${p.parametros.timescale===1?'mes':'meses'}. La barra resaltada coincide con el mapa.`;
    return `Cada barra resume ${it.tipo==='mensual'?'un mes calendario':it.tipo==='anual'?'un año calendario':'un ciclo de octubre a septiembre'}. La barra resaltada coincide con el periodo del mapa.`;
  }
  if(p.tipo==='ventana')return 'Cada barra representa un intervalo de acumulación o promedio. Los intervalos se solapan y no se suman las barras.';
  if(p.tipo==='mes')return 'Cada barra representa un mes de la climatología 1991–2020, no un mes observado del año actual.';
  if(p.tipo==='fijo')return 'Valor de cobertura de la referencia en esta ubicación. Este producto no es una serie temporal.';
  if(p.clave==='interpdia_mensual'||p.tipo==='mes_anio')return 'Cada barra representa un mes. La barra resaltada coincide con el mes del mapa.';
  if(p.clave==='interpdia_anual')return 'Cada barra representa un año hasta su último día disponible.';
  if(/interpdia_dias_/.test(p.clave))return 'Cada barra es la duración de la racha que termina en esa fecha. Para contar los días de un mes, consulte Indicadores climáticos.';
  return 'Cada barra representa la fecha de un mapa publicado. La barra resaltada coincide con la fecha elegida.';
}
function cmAyuda(p,it){
  if(p?.pronostico_ml)return cmMLValidacion(p,it);
  if(p?.clave.startsWith('ci_'))return cmAyudaGrafico();
  const c=cmPopup(document.activeElement,'Cómo leer · '+p.nombre,''),d=cmDescripcion(p,it),m=cliMeta(it.campo)||{},puntual=p.tipo_mapa==='estaciones';
  c.innerHTML=`<p class="cm-ayuda-intro">${esc(d.corta)}</p><dl class="cm-definicion"><dt>Periodo seleccionado</dt><dd>${esc(cmRango(p,it))}${cmParcial(p,it)?' · parcial, puede cambiar al llegar nuevos datos.':''}</dd><dt>Qué mide y cómo se calcula</dt><dd>${esc(d.calculo)}${d.ejemplo?'<p>'+esc(d.ejemplo)+'</p>':''}</dd><dt>Cómo leer el mapa</dt><dd>${puntual?'Cada punto de estación tiene el valor del indicador para el periodo seleccionado. El fondo entre estaciones no contiene valores interpolados.':'Cada zona coloreada representa una celda de la malla. Consultar una estación muestra el valor de la celda en su ubicación. No convierte esa estimación en una medición de la estación.'} La leyenda expresa ${esc(m.unidad||'la unidad del producto')}. ${m.nulo?'Las zonas grises con trama no tienen porcentaje porque su normal es menor de 0,5 mm por día.'+(m.componentes?' Sus mm aparecen en la ficha.':''):''}</dd><dt>Qué muestra el detalle de la estación</dt><dd>${esc(['obs_lluvia_pct','obs_lluvia_pctl','interp_lluvia_pct'].includes(p.clave)?'Se presentan la lluvia diaria observada, su acumulado frente a la normal y la comparación mensual entre el interpolado y la medición, según las series disponibles. El valor del mapa procede de su celda. Los gráficos identifican por separado las observaciones de la estación.':cmLecturaBarras(p,it))} ${['obs_lluvia_pct','obs_lluvia_pctl','interp_lluvia_pct'].includes(p.clave)?'La lluvia se expresa en milímetros. Los gráficos de porcentaje indican su propia unidad.':`Los valores se expresan en ${esc(m.unidad||'la unidad indicada')}. ${puntual?'Los datos insuficientes quedan sin barra, nunca como cero.':'La serie se extrae de la misma malla del mapa en la ubicación seleccionada.'}`}</dd><dt>Al pulsar una estación</dt><dd>El mapa y los gráficos responden al producto y periodo elegidos. Los indicadores disponibles se organizan por grupos. Las métricas se muestran debajo de los resultados cuando existe una comparación con observaciones.</dd><dt>Fuente y condiciones de uso</dt><dd>${puntual?esc(p.nota):cliSubtitulo(p,it)}${p.referencia?'<p>Referencia '+esc(p.referencia)+'</p>':''}</dd></dl><button type="button" data-cm-validar>Ver fuente y validación</button>`;
  c.querySelector('[data-cm-validar]').onclick=()=>cmValidacion(p,it);
}
function cmAyudaGrafico(){
  if(cliProducto()?.clave.startsWith('ci_')&&M.vista==='indices'){cmPopup(document.activeElement,'Indicadores climáticos de la estación','').innerHTML='<p>Cada gráfico muestra un indicador calculable para la estación y el periodo seleccionados. Las barras comparan meses, años o ciclos completos. El valor destacado corresponde al periodo del mapa.</p><p>Los grupos separan lluvia, rachas, sequía y temperaturas. El botón i de cada gráfico explica su cálculo, unidades y requisitos. Los datos ausentes no se sustituyen por cero.</p>';return;}
  if(['producto','indices'].includes(M.vista))return cmAyuda(cliProducto(),cliItem());
  const tipos={clima:['Observaciones diarias recientes','Cada barra de lluvia es el acumulado de una fecha, de 07h00 a 07h00 del día siguiente. La temperatura muestra máximas y mínimas diarias. El panel inferior acumula solo días completos. Las líneas discontinuas son referencias climatológicas, y las claras o huecas indican días incompletos. Esta vista tiene su propia ventana reciente y no cambia al elegir otro mes del mapa.'],normal:['Normales de la estación','Cada barra corresponde a un mes calendario. Resume el promedio de los años de la referencia elegida. La referencia y la cantidad de años disponibles se muestran en el gráfico. Un mes sin barra no tiene años suficientes y no equivale a cero.'],evolucion:['Evolución de la estación','Compara el año mostrado con los años anteriores de la estación y su referencia. En lluvia y temperatura, cada posición del eje representa un mes. Una estación sin datos este año muestra su último año con registro, indicado sobre el gráfico.'],meses:['Meses observados de la estación','Cada mes observado en la estación se compara con su normal y su rango típico. Es una consulta de observaciones, independiente del producto del mapa. Los meses incompletos o en curso se identifican como parciales.'],interp:['Validación del mapa frente a estaciones','Compara estimación y medición en meses o días. La validación que deja fuera una estación evita evaluarla solo con el mapa que ya la utilizó. El panel indica fuente, periodo y errores disponibles.']};
  const [titulo,texto]=tipos[M.vista]||['Detalle de estación','Consulte el periodo, la unidad y la fuente indicados sobre el gráfico.'];
  // 5-nov-2026: el botón de la ficha se llama Producto (C2). Sin «Producto del mapa», sin tuteo ni «:» ni «;»
  const prod=document.getElementById('v-prod'),conProd=prod&&!prod.hidden;
  cmPopup(document.activeElement,'Cómo leer · '+titulo,'').innerHTML=`<p class="cm-ayuda-intro">${esc(texto)}</p>${conProd?'<p>Para ver en la estación el producto y el periodo elegidos en el mapa, pulse Producto.</p>':''}`;
}
function cmContextoGrafico(){cmBotonProducto();document.getElementById('cm-contexto-grafico')?.remove();}
function cmMuestra(c,x,crudo){
  const lat=x.latitud??x.lat,lon=x.longitud??x.lon;
  if(!c||!finito(lat)||!finito(lon))return null;
  const i=Math.floor((c.lat_n+c.dlat/2-lat)/c.dlat),j=Math.floor((lon-c.lon_o+c.dlon/2)/c.dlon);
  if(i<0||i>=c.nlat||j<0||j>=c.nlon)return null;
  const v=c.v[i*c.nlon+j];return finito(v)&&(crudo||!(c.meta?.nulo&&v<0))?v:null;
}
function cmSerieItems(p,k){
  if(p.tipo==='ventana'||p.tipo==='mes'||p.tipo==='fijo')return p.items.map((z,i)=>({z,i}));
  const start=Math.max(0,Math.min(k-7,p.items.length-12));return p.items.map((z,i)=>({z,i})).slice(start,start+12);
}
function cmEstacionesCatalogo(){
  const v=(VAR_EVOL[M.d?.variable]||[])[0],por=new Map(HIST.listo[v]||[]);
  for(const e of M.d?.estaciones||[]){const h=por.get(e.codigo)||{};por.set(e.codigo,{...h,c:e.codigo,n:e.nombre,la:e.lat??h.la,lo:e.lon??h.lo,ac:true});}
  return [...por.values()];
}
function cmCatalogo(){
  const p=cliProducto(),it=cliItem();if(!p||!it||p.tipo_mapa==='estaciones')return;
  const v=(VAR_EVOL[M.d?.variable]||[])[0],cat=HIST.listo[v],c=CLI.campos[it.campo],meta=cliMeta(it.campo)||{};
  const reciente=new Set((M.d?.estaciones||[]).map(e=>e.codigo));
  const lista=cmEstacionesCatalogo();
  if(!M.sel){const primera=lista.find(e=>e.c==='M0024')||lista.find(e=>reciente.has(e.c));if(primera)M.sel=primera.c;}
  const rows=lista.filter(e=>(CM.estaciones==='todas'||reciente.has(e.c)||e.c===M.sel)&&(!M.busca||slug(e.c+' '+e.n).includes(slug(M.busca)))&&(!M.soloLinea||filtradas().some(x=>x.codigo===e.c))).map(e=>({e,v:cmMuestra(c,{lat:e.la,lon:e.lo},meta.escala==='porcentaje')})).sort((a,b)=>(a.e.c===M.sel?-1:b.e.c===M.sel?1:0)||(finito(b.v)?1:0)-(finito(a.v)?1:0)||a.e.c.localeCompare(b.e.c));
  $('#rej-n').textContent=rows.length;$('#rej-sub').textContent=p.nombre+' · '+cmEtiquetaPeriodo(p,it)+' · valor del mapa';
  $('#rejilla').classList.remove('red-tabla','red-tarjetas');$('#red-cab').hidden=true;$('#red-provincia').hidden=true;
  $('#rejilla').innerHTML=rows.length?rows.map(({e,v})=>`<button type="button" class="mini ci-estacion" data-cm-estacion="${esc(e.c)}" aria-pressed="${e.c===M.sel}"><span class="c">${esc(e.c)}</span><span class="n">${esc(e.n)}</span><span class="v">${finito(v)&&v<0?'Sin %':finito(v)?num(v,Number.isInteger(v)?0:1)+' '+esc(meta.unidad||''):'—'}</span><small>${esc(cmEtiquetaPeriodo(p,it))}</small></button>`).join(''):'<div class="vacio">Ninguna estación cumple el filtro. Revise la búsqueda o muestre todo el catálogo.</div>';
  $('#rejilla').querySelectorAll('[data-cm-estacion]').forEach(b=>b.onclick=()=>histElegir(b.dataset.cmEstacion));
}
async function cmDetalleProducto(){
  const p=cliProducto();if(!p)return;
  if(p.tipo_mapa==='estaciones'){M.vista='indices';return ciSerie();}
  const caja=$('#serie'),x=cmEstacion(),it=cliItem(),k=CLI.pos[p.clave]??0;
  const turno=CM.detalleTurno=(CM.detalleTurno||0)+1;
  caja.classList.remove('pron');$('#serie-stats').innerHTML='';
  if(!x){caja.innerHTML='<div class="vacio">Selecciona una estación en el mapa o en el catálogo para consultar este producto.</div>';return;}
  $('#serie-tit').innerHTML=esc(x.codigo)+' <span class="nomest">'+esc(x.nombre||'')+'</span>';
  if(cmCaducado(p,it)){caja.innerHTML='<div class="vacio">El pronóstico seleccionado está vencido. El detalle estará disponible con una nueva emisión.</div>';return;}
  const def=cmDescripcion(p,it),meta=cliMeta(it.campo)||{};
  const vigenteLluvia=()=>turno===CM.detalleTurno&&M.fam==='clima'&&M.vista==='producto'&&cliProducto()?.clave===p.clave&&cliItem()?.campo===it.campo&&M.sel===x.codigo;
  if(['obs_lluvia_pct','obs_lluvia_pctl','interp_lluvia_pct'].includes(p.clave))return cmLluviaContexto(caja,p,it,x,vigenteLluvia);
  caja.innerHTML=`<div class="cm-serie-cab"><b>${esc(p.nombre)}</b><span>${esc(cmRango(p,it))}</span></div><div class="cm-graf-wrap"><div id="cm-producto-graf" aria-label="Serie del producto climático"></div></div>`;
  const ids=cmSerieItems(p,k),datos=new Array(ids.length);let cursor=0;
  const vigente=()=>turno===CM.detalleTurno&&M.fam==='clima'&&M.vista==='producto'&&cliProducto()?.clave===p.clave&&cliItem()?.campo===it.campo&&M.sel===x.codigo;
  // Dos lecturas simultáneas como máximo; se detiene si cambia la selección.
  await Promise.all([0,1].map(async()=>{while(cursor<ids.length&&vigente()){const a=cursor++,c=await cliCampo(ids[a].z.campo);datos[a]=cmMuestra(c,x);}}));
  if(!vigente())return;
  if(!datos.some(finito)){document.getElementById('cm-producto-graf').innerHTML='<div class="vacio">La ubicación no tiene valores válidos en esta malla. Los huecos no se sustituyen por cero. Selecciona otra estación o consulta sus observaciones.</div>';return;}
  const labels=ids.map(({z})=>cmEtiquetaPeriodo(p,z));
  await cmPlot('cm-producto-graf',[{type:'bar',x:ids.map(a=>String(a.i)),y:datos,customdata:ids.map(({z})=>[cmEtiquetaPeriodo(p,z),cmRango(p,z)]),marker:{color:datos.map(v=>finito(v)&&meta.colores?ciColor(meta,v):'#888'),line:{color:colorTema('--tinta','#ddd'),width:ids.map(a=>a.i===k?2:0)}},hovertemplate:'%{customdata[0]}<br>%{customdata[1]}<br><b>%{y:.2f} '+esc(meta.unidad||'')+'</b><extra></extra>'}],{margin:{l:50,r:14,b:45,t:25},xaxis:{type:'category',tickvals:ids.map(a=>String(a.i)),ticktext:labels,tickangle:ids.length>6?-35:0},yaxis:{title:meta.unidad||'',zeroline:true},showlegend:false});
  if(!vigente())return;
  const plot=document.getElementById('cm-producto-graf');plot.on('plotly_click',ev=>{const j=Number(ev.points?.[0]?.x);if(Number.isInteger(j))cmCambiarPeriodo(j);});
  await cmObservacionesInline(caja,p,it,x.codigo,vigente);
}

// Pronósticos puntuales: una ventana, una variable y una validación por estación.
const CLIMA_ML={indice:null};
async function cmMLCargar(){
  const d=await fetch('datos/productos/pronostico_climatico_ml.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
  if(d&&d.generado!==CLIMA_ML.indice?.generado){
    for(const k of CI.datos.keys())if(k.startsWith('ml_'))CI.datos.delete(k);
    CLIMA_ML.indice=d;
    CML_COMPARE.ml=null;CML_COMPARE.nwp=null;CML_COMPARE.nwps=null;
  }
}
function cmMLRejilla(d,p,k){
  const meta=cliMeta(p.items[k].campo),vencido=cmCaducado(p,p.items[k]);
  const rows=d.estaciones.map((e,j)=>({e,j,f:d.pronosticos[k]?.[j]})).filter(x=>ciVisible(x.e)).sort((a,b)=>+!!b.f?.habilitado-+!!a.f?.habilitado||a.e.n.localeCompare(b.e.n));
  $('#rej-n').textContent=rows.filter(x=>x.f?.habilitado&&!vencido).length+' admitidas';$('#rej-sub').textContent=p.nombre+' · '+d.periodos[k].etiqueta;
  $('#rejilla').classList.remove('red-tabla','red-tarjetas');$('#red-cab').hidden=true;$('#red-provincia').hidden=true;
  $('#rejilla').innerHTML=rows.map(({e,f})=>`<button type="button" class="mini ci-estacion" data-ci-est="${esc(e.c)}" aria-pressed="${e.c===M.sel}" title="${esc(e.n)}"><span class="c">${esc(e.c)}</span><span class="n">${esc(e.n)}</span><span class="v">${!vencido&&f?.habilitado?num(f.valor,1)+' '+esc(meta.unidad):vencido?'Emisión vencida':'Sin modelo admitido'}</span><small>${f?.validacion?f.validacion.n+' casos de prueba':'Sin antecedentes recientes'}</small></button>`).join('');
  $('#rejilla').querySelectorAll('[data-ci-est]').forEach(b=>b.onclick=()=>{M.sel=b.dataset.ciEst;M.vista='indices';ciPintar();pintarSerie();});
}
function cmMLExplicacion(p,it){
  const lluvia=p.variable_objetivo==='precipitacion',termica=p.variable_objetivo==='temp_min'?'mínimas':'máximas';
  return `Cada punto corresponde a una estación y el espacio entre estaciones no está interpolado. ${lluvia?'Se pronostica la lluvia acumulada de todo el periodo, en milímetros.':`Se pronostica el promedio de las temperaturas ${termica} diarias durante el periodo, en grados Celsius.`} Cada grupo de barras representa ${it.tipo==='semanal'?'una semana de siete días':'un mes calendario completo'} y cada color un modelo. El ML muestra la mediana y su intervalo del 80 % y el NWP mensual muestra la media y los percentiles 10–90 del conjunto. Las barras rayadas son candidatos no admitidos para el mapa. El mapa muestra sólo estaciones y plazos que superan los controles. Un punto seleccionado sin resultado permanece como localizador. Los NWP mensuales representan una celda de 1°, no el clima exacto de esa estación.`;
}
async function cmMLValidacion(p,it){
  const c=cmDialogo('Pronóstico climático y validación');
  c.innerHTML=`<h3>${esc(p.nombre)}</h3><p>${esc(cmMLExplicacion(p,it))}</p><p>Periodo del ${esc(it.desde)} al ${esc(it.hasta)}. Emisión del ${esc(it.emision)}.</p><h3>Cómo se comprueba</h3><p>${esc(CLIMA_ML.indice?.metodo||'')}</p><p>${esc(CLIMA_ML.indice?.controles||'')}</p><h3>Alcance de la evidencia</h3><p>MAE es el error medio absoluto. MAESS y CRPSS miden la mejora frente a la climatología y un número negativo indica peor desempeño. El intervalo de confianza se calcula por bloques mensuales.</p>`;
}

const CML_COMPARE={ml:null,nwp:null,nwps:null,obs:null,vista:'serie',prueba:'ml',grupo:'todos',ocultos:new Set(),atras:0};
const CML_ALGOS=[['ridge','Ridge','#E15759'],['xgboost','XGBoost','#B07AA1'],['lightgbm','LightGBM','#EDC948'],['extra_trees','Extra Trees','#9C755F'],['random_forest','Random Forest','#FF9DA7'],['boosting','Hist. boosting','#BCBD22'],['knn','KNN','#BAB0AC'],['mlp','MLP','#8E6BD9']];
async function cmMLComparacion(){
  const cargar=async name=>fetch('datos/productos/'+name,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
  if(!CML_COMPARE.ml)CML_COMPARE.ml=await cargar('comparacion_ml_climatico.json');
  if(!CML_COMPARE.nwp)CML_COMPARE.nwp=await cargar('comparacion_nwp_climatico.json');
  if(!CML_COMPARE.nwps)CML_COMPARE.nwps=await cargar('comparacion_nwp_semanal.json');
  if(!CML_COMPARE.obs)CML_COMPARE.obs=await cargar('observaciones_comparacion_clima.json');
}
function cmMLModelos(p,codigo,d){
  const varid=p.variable_objetivo,tipo=d.tipo;
  const out=CML_ALGOS.map(([id,nombre,color])=>({id,familia:'ml',nombre:'ML '+nombre,color,emision:CML_COMPARE.ml?.emisiones?.[tipo]||CML_COMPARE.ml?.emision,
    valores:d.periodos.map(z=>CML_COMPARE.ml?.modelos?.find(x=>x.variable===varid&&x.tipo===tipo&&x.plazo===z.plazo&&x.modelo===id)?.estaciones?.[codigo]||null)}));
  for(const model of (tipo==='mensual'?CML_COMPARE.nwp:CML_COMPARE.nwps)?.modelos||[]){
    if(model.variable!==varid)continue;
    out.push({...model,familia:'nwp',valores:d.periodos.map(z=>model.periodos?.find(t=>t.desde===z.desde&&t.hasta===z.hasta)?.estaciones?.[codigo]||null)});
  }
  return out.filter(m=>m.valores.some(x=>x&&finito(x.valor)));
}
function cmMLFecha(z,tipo){return tipo==='mensual'?CM_MESES[+z.desde.slice(5,7)-1].slice(0,3)+' '+z.desde.slice(2,4):z.desde.slice(8)+'–'+z.hasta.slice(8)+' '+CM_MESES[+z.hasta.slice(5,7)-1].slice(0,3);}
function cmMLHistoria(modelos,k,familia){
  const lista=modelos.filter(m=>m.familia===familia).map(m=>({...m,prueba:m.valores[k]?.prueba||[]})).filter(m=>m.prueba.length);
  const fechas=[...new Set(lista.flatMap(m=>m.prueba.map(r=>r.desde)))].sort();
  return {lista,filas:fechas.map(fecha=>{
    const rows=lista.map(m=>m.prueba.find(r=>r.desde===fecha)).filter(Boolean),obs=rows.filter(r=>finito(r.observado));
    const consistente=obs.length&&obs.every(r=>Math.abs(r.observado-obs[0].observado)<1e-4);
    return {...rows[0],observado:consistente?obs[0].observado:null};
  })};
}
async function cmMLSerie(){
  const p=cliProducto(),it=cliItem(),codigo=M.sel,turno=CI.serieTurno=(CI.serieTurno||0)+1,caja=$('#serie');
  let d;try{[d]=await Promise.all([ciDatos(p),cmMLComparacion()]);}catch(e){caja.innerHTML='<div class="vacio">No se pudo cargar la comparación.</div>';return;}
  if(M.fam!=='clima'||M.sel!==codigo||cliProducto()?.clave!==p.clave||turno!==CI.serieTurno)return;
  const j=d.estaciones.findIndex(e=>e.c===codigo),k=CLI.pos[p.clave]??0;
  $('#serie-stats').innerHTML='';
  if(j<0){caja.innerHTML='<div class="vacio">Selecciona una estación en el mapa o en las tarjetas.</div>';return;}
  const e=d.estaciones[j],meta=cliMeta(it.campo),vigente=!cmCaducado(p,it),modelos=cmMLModelos(p,codigo,d),hist=CML_COMPARE.vista==='hindcast';
  $('#serie-tit').innerHTML=esc(e.c)+' <span class="nomest">'+esc(e.n)+'</span>';
  const titulo=p.variable_objetivo==='precipitacion'?'Precipitación acumulada':p.variable_objetivo==='temp_max'?'Temperatura máxima media':'Temperatura mínima media';
  caja.innerHTML=`<div class="cm-serie-cab"><b>${titulo} ${d.tipo}</b><span>${d.tipo==='semanal'?'7 días por grupo':'Un mes completo por grupo'}</span></div>
    <div class="cml-toolbar" role="toolbar" aria-label="Comparación climática"><div class="cml-vistas"><button data-cml-vista="serie" aria-pressed="${!hist}">Observado y pronóstico</button><button data-cml-vista="hindcast" aria-pressed="${hist}">Retropronóstico</button></div><select data-cml-grupo aria-label="Modelos del gráfico"><option value="todos">Todos los modelos</option><option value="ml">ML</option><option value="nwp">Numéricos (NWP)</option></select><button data-cml-valores aria-pressed="${M.mostrarValores!==false}">Valores</button></div>
    <div class="cml-periodos"><button data-cml-anterior aria-label="Periodos históricos anteriores">‹</button><span id="cml-intervalo"></span><button data-cml-siguiente aria-label="Periodos históricos siguientes">›</button>${hist?'<select data-cml-prueba aria-label="Archivo de retropronóstico"><option value="ml">ML desde 2023</option><option value="nwp">NWP '+(d.tipo==='mensual'?'1993–2016':'prospectivo')+'</option></select>':''}</div>
    <div class="cml-graf-wrap" role="region" aria-label="Observaciones y barras por modelo"><div id="cml-graf"></div></div><label class="cml-recorrer"><span>Periodos</span><input type="range" data-cml-recorrer aria-label="Recorrer los periodos del gráfico" min="0" step="1"><output></output></label><div id="cml-ley" class="hm-leyenda" role="group" aria-label="Mostrar u ocultar modelos"></div><p id="cml-nota" class="cm-serie-nota"></p>
    <section class="cml-metricas"><div class="hm-cab"><b>Validación por modelo</b><label>Anticipación <select data-cml-plazo aria-label="Anticipación evaluada">${d.periodos.map((z,i)=>`<option value="${i}" ${i===k?'selected':''}>${d.tipo==='semanal'?'Semana':'Mes'} ${z.plazo}</option>`).join('')}</select></label></div><div id="cml-validacion"></div></section>`;
  caja.querySelectorAll('[data-cml-vista]').forEach(b=>b.onclick=()=>{CML_COMPARE.vista=b.dataset.cmlVista;CML_COMPARE.atras=0;cmMLSerie();});
  const grupo=caja.querySelector('[data-cml-grupo]');grupo.value=CML_COMPARE.grupo;grupo.onchange=()=>{CML_COMPARE.grupo=grupo.value;cmMLSerie();};
  caja.querySelector('[data-cml-valores]').onclick=()=>{M.mostrarValores=M.mostrarValores===false;cmMLSerie();};
  const sel=caja.querySelector('[data-cml-prueba]');if(sel){sel.value=CML_COMPARE.prueba;sel.onchange=()=>{CML_COMPARE.prueba=sel.value;CML_COMPARE.atras=0;cmMLSerie();};}
  // Cada observación y cada hindcast representan exactamente el mismo intervalo.
  const historia=cmMLHistoria(modelos,hist?k:0,hist?CML_COMPARE.prueba:'ml'),n=hist?8:5;
  const obs=CML_COMPARE.obs?.productos?.find(z=>z.variable===p.variable_objetivo&&z.tipo===d.tipo)?.estaciones?.[codigo];
  const archivo=!hist&&obs?.length?obs:historia.filas;
  const end=Math.max(0,archivo.length-CML_COMPARE.atras),past=archivo.slice(Math.max(0,end-n),end);
  const future=hist?[]:d.periodos,periodos=[...past,...future],xs=periodos.map(z=>z.desde),labels=periodos.map(z=>cmMLFecha(z,d.tipo));
  const prev=caja.querySelector('[data-cml-anterior]'),next=caja.querySelector('[data-cml-siguiente]');prev.disabled=end<=n;next.disabled=!CML_COMPARE.atras;
  prev.onclick=()=>{CML_COMPARE.atras+=n;cmMLSerie();};next.onclick=()=>{CML_COMPARE.atras=Math.max(0,CML_COMPARE.atras-n);cmMLSerie();};
  $('#cml-intervalo').textContent=past.length?(past[0].desde+' a '+(future.at(-1)?.hasta||past.at(-1).hasta)):'Sin observaciones históricas comparables';
  const visible=modelos.filter(m=>(CML_COMPARE.grupo==='todos'||m.familia===CML_COMPARE.grupo)&&(!hist||m.familia===CML_COMPARE.prueba));
  const traces=[],plotted=[];
  for(const m of visible){
    const h=historia.lista.find(z=>z.id===m.id),rows=past.map(z=>h?.prueba.find(r=>r.desde===z.desde)||null);
    const valores=[...rows.map(r=>r?.valor??null),...future.map((z,i)=>vigente?m.valores[i]?.valor??null:null)];if(!valores.some(finito))continue;
    traces.push({type:'bar',name:m.nombre,x:xs,y:valores,visible:CML_COMPARE.ocultos.has(m.id)?'legendonly':true,
      marker:{color:m.color,opacity:.84},error_y:{type:'data',array:[...past.map(()=>null),...future.map((z,i)=>finito(m.valores[i]?.p90)?Math.max(0,m.valores[i].p90-m.valores[i].valor):null)],arrayminus:[...past.map(()=>null),...future.map((z,i)=>finito(m.valores[i]?.p10)?Math.max(0,m.valores[i].valor-m.valores[i].p10):null)],visible:true,thickness:.7,width:2},
      customdata:periodos.map((z,i)=>[z.desde,z.hasta,i<past.length?rows[i]?.emision:m.emision,i<past.length?'Predicción histórica fuera de entrenamiento':cmMLEstado(m,m.valores[i-past.length])]),
      hovertemplate:'%{customdata[0]} a %{customdata[1]}<br>Emitido el %{customdata[2]}<br><b>%{y:.1f} '+esc(meta.unidad)+'</b><br>%{customdata[3]}<extra>'+esc(m.nombre)+'</extra>',text:M.mostrarValores===false?valores.map(()=>''):undefined});plotted.push(m);
  }
  if(past.some(z=>finito(z.observado)))traces.push({type:'scatter',mode:'lines+markers+text',name:'Observado',x:xs,y:[...past.map(z=>z.observado),...future.map(()=>null)],connectgaps:false,line:{color:colorTema('--tinta','#dce7ef'),width:2.2},marker:{size:5},text:[...past.map(z=>finito(z.observado)&&M.mostrarValores!==false?num(z.observado,1):''),...future.map(()=>'')],textposition:'top center',textfont:{size:11},cliponaxis:false,hovertemplate:'%{x}<br>Observado %{y:.1f} '+esc(meta.unidad)+'<extra></extra>',_etiquetasPropias:true});
  const zona=caja.querySelector('.cml-graf-wrap'),graf=$('#cml-graf');
  let cuantos=Math.min(periodos.length,zona.clientWidth<440?2:4);const inicio=hist?Math.max(0,periodos.length-cuantos):Math.max(0,past.length-2);
  graf.style.width='100%';
  if(traces.length)await cmPlot(graf,traces,{barmode:'group',bargap:.2,bargroupgap:.08,margin:{l:52,r:12,t:32,b:37},xaxis:{type:'category',categoryorder:'array',categoryarray:xs,tickvals:xs,ticktext:labels.map((s,i)=>s+(periodos[i].cerrado===false?'*':'')),range:[inicio-.5,inicio+cuantos-.5],fixedrange:true},yaxis:{title:meta.unidad,rangemode:p.variable_objetivo==='precipitacion'?'tozero':'normal',fixedrange:true},showlegend:false,hovermode:'x unified',shapes:future.length&&past.length?[{type:'line',xref:'x',x0:past.length-.5,x1:past.length-.5,yref:'paper',y0:0,y1:1,line:{color:colorTema('--tinta3','#8498a6'),dash:'dot',width:1}}]:[],annotations:future.length?[{xref:'paper',yref:'paper',x:1,y:1.09,text:'Pronóstico →',showarrow:false,font:{size:10,color:colorTema('--acento','#50b8e8')},xanchor:'right'}]:[]},{displayModeBar:false});
  else graf.innerHTML='<div class="vacio">Sin predicciones históricas comparables en este archivo. Las observaciones disponibles se conservan en la serie.</div>';
  if(turno!==CI.serieTurno||!graf.isConnected)return;
  const recorrer=caja.querySelector('[data-cml-recorrer]'),salida=recorrer.nextElementSibling;
  recorrer.max=Math.max(0,periodos.length-cuantos);recorrer.value=Math.min(inicio,+recorrer.max);recorrer.disabled=!+recorrer.max;
  const rango=()=>{const v=+recorrer.value;salida.textContent=labels[v]+' — '+labels[Math.min(v+cuantos-1,labels.length-1)];return v;};rango();
  recorrer.oninput=()=>{const v=rango();Plotly.relayout(graf,{'xaxis.range':[v-.5,v+cuantos-.5]});};
  const observarAncho=new ResizeObserver(()=>{if(!graf.isConnected){observarAncho.disconnect();return;}const nuevo=Math.min(periodos.length,zona.clientWidth<440?2:4);if(nuevo===cuantos)return;cuantos=nuevo;recorrer.max=Math.max(0,periodos.length-cuantos);recorrer.value=Math.min(+recorrer.value,+recorrer.max);recorrer.oninput();});observarAncho.observe(zona);
  $('#cml-ley').innerHTML=(past.length?'<span class="cml-observado">—● Observado</span>':'')+plotted.map((m,i)=>`<button data-cml-traza="${i}" data-cml-id="${esc(m.id)}" aria-pressed="${!CML_COMPARE.ocultos.has(m.id)}"><i style="background:${m.color}"></i>${esc(m.nombre)}</button>`).join('');
  caja.querySelectorAll('[data-cml-traza]').forEach(b=>b.onclick=async()=>{const oculto=!CML_COMPARE.ocultos.has(b.dataset.cmlId);if(oculto)CML_COMPARE.ocultos.add(b.dataset.cmlId);else CML_COMPARE.ocultos.delete(b.dataset.cmlId);await Plotly.restyle(graf,{visible:oculto?'legendonly':true},[+b.dataset.cmlTraza]);b.setAttribute('aria-pressed',String(!oculto));});
  $('#cml-nota').textContent=hist?(CML_COMPARE.prueba==='ml'?'Retropronóstico del aprendizaje automático en periodos que no se usaron para entrenarlo.':'Retropronóstico numérico calibrado sin el año evaluado.'):'La línea es lo observado y las barras el retropronóstico y el pronóstico, con su intervalo del 10 al 90 %. El asterisco marca un periodo sin cerrar. Un hueco es un periodo sin dato, nunca un cero.';
  const tabla=pos=>{const fecha=d.periodos[pos];$('#cml-validacion').innerHTML=`<p class="hm-nota">${d.tipo==='semanal'?'Semana':'Mes'} ${fecha.plazo}, del ${fecha.desde} al ${fecha.hasta}. Las métricas usan el archivo de prueba indicado en cada fila.</p><div class="hm-scroll"><table><thead><tr><th>Modelo</th><th>Prueba</th><th>Casos</th><th>MAE (${p.variable_objetivo==='precipitacion'?'mm':'°C'})</th><th>Mejora / normal</th><th>CRPSS</th><th>Estado</th></tr></thead><tbody>${modelos.map(m=>{const v=m.valores[pos]?.validacion;return `<tr><th><i style="background:${m.color}"></i>${esc(m.nombre)}</th><td>${m.familia==='ml'?'2023–2026':d.tipo==='mensual'?'1993–2016':'Prospectiva'}</td><td>${v?.n??0}</td><td>${finito(v?.mae)?num(v.mae,2):'—'}</td><td>${finito(v?.maess)?num(100*v.maess,1)+' %':'—'}</td><td>${finito(v?.crpss)?num(100*v.crpss,1)+' %':'—'}</td><td>${esc(cmMLEstado(m,m.valores[pos]))}</td></tr>`;}).join('')}</tbody></table></div><p class="hm-nota">MAE es el error absoluto medio y un valor menor es mejor. Mejora y CRPSS positivos superan la climatología. Sin muestra suficiente no se declara habilidad.</p><details><summary>Emisiones y método de validación</summary><p class="hm-nota">${esc(CML_COMPARE.ml?.metodo||'')}</p><p class="hm-nota">${esc((d.tipo==='mensual'?CML_COMPARE.nwp:CML_COMPARE.nwps)?.metodo||'')}</p><p class="hm-nota">${[...new Set(modelos.map(m=>(m.familia==='ml'?'ML':m.nombre)+' emitido el '+m.emision))].map(esc).join('. ')}.</p></details>`;};
  tabla(k);caja.querySelector('[data-cml-plazo]').onchange=e=>tabla(+e.target.value);
}
function cmMLEstado(m,v){
  if(!v||!finito(v.valor))return 'Sin pronóstico para este plazo';
  if(v.habilitado)return 'Supera los controles';
  if(m.familia==='nwp')return m.tipo==='semanal'?'NWP semanal de referencia':v.corregido?'NWP corregido por sesgo':'NWP crudo de referencia';
  return 'Candidato fuera del mapa';
}

// Los resultados se consultan por código de estación, sin rellenar huecos ni mezclar periodos.
// El producto y el periodo seleccionados gobiernan mapa y detalle de estación.
const CI_PANEL={turno:0,filas:[],grupo:'Resumen',firma:null};
function ciGrupoEstacion(p){
  if(p.variable_dato==='temp_max')return 'Temperatura máxima';
  if(p.variable_dato==='temp_min')return 'Temperatura mínima';
  if(p.familia_indice==='spi')return 'Sequía';
  if(p.clave.startsWith('ci_rs_'))return 'Temporada lluviosa';
  if(['dd','th','cdd','cwd','spells'].includes(p.familia_indice))return 'Días y rachas';
  return 'Lluvia';
}
function ciBotonPanel(){document.getElementById('v-indicadores')?.remove();}
function ciUnidad(p,it){return cliMeta(it?.campo)?.unidad||CI.indice?.escalas?.[CI.indice?.campos?.[it?.campo]?.escala]?.unidad||'—';}
function ciNombre(p){
  const nombres={ci_sum_pr:'Lluvia total',ci_prcptot:'PRCPTOT · lluvia en días de al menos 1 mm',ci_rx1:'Rx1día · máximo de lluvia en un día',ci_rx5:'Rx5día · máximo de lluvia en cinco días',ci_dd:'Días sin lluvia',ci_cdd:'CDD · racha más larga sin lluvia',ci_cwd:'CWD · racha más larga con lluvia',ci_qval_pr:'P95 de la lluvia diaria del periodo'};
  if(nombres[p.clave])return nombres[p.clave];
  const m=/^ci_rs_(start|end|dur)_(.+)$/.exec(p.clave);
  if(m)return ({start:'Inicio de lluvias',end:'Fin de lluvias',dur:'Duración de lluvias'})[m[1]]+', '+(CI_METODOS[m[2]]||m[2]);
  return p.nombre;
}
const CI_METODOS={climandes:'Climandes',garcia:'García',gurgiser:'Gurgiser',jd:'lluvia de cinco días',sos:'decenas lluviosas',consec_th:'umbral consecutivo',consec_th_maxcdd:'umbral consecutivo sin racha seca',th:'umbral de fin'};
// Nota del productor en redacción formal, sin dos puntos ni punto y coma.
function ciNota(p){
  let s=String(p?.nota||'').trim();if(!s)return '';
  const cambios=[['; faltantes no son cero','. Los días faltantes no se cuentan como cero'],['asignadas al último día; adaptación explícita del suavizado centrado de ClimIndVis','asignadas al último día en lugar del suavizado centrado de ClimIndVis'],['Búsqueda de inicio: oct–mar; de fin: mar–sep.','El inicio se busca de octubre a marzo y el fin de marzo a septiembre.'],['Confirmación futura completa.','Cada candidato se confirma con los días siguientes.'],[', que puede ser bimodal',', que en algunas zonas tiene dos temporadas'],['SPI acotado a ±4; sin ajuste válido no se muestra valor.','El SPI se limita a ±4 y sin ajuste válido no se muestra valor.']];
  for(const [a,b] of cambios)s=s.replaceAll(a,b);
  s=s.replace(/Candidato según ([a-z_]+)\./,(_,k)=>'Candidato según el método '+(CI_METODOS[k]||k)+'.');
  return s.replace(/\s*;\s*/g,'. ').replace(/:\s*/g,' ').replace(/\.\s+([a-záéíóúñ])/g,(_,c)=>'. '+c.toUpperCase());
}
function ciFrase(t){t=String(t||'').trim();return t&&!/[.!?]$/.test(t)?t+'.':t;}
// Unidad para leer junto a un número, con singular y plural.
function ciUnidadTexto(u,v){
  u=String(u||'');const uno=Number(v)===1;
  if(u==='día desde 1 oct')return (uno?'día':'días')+' desde el 1 de octubre';
  if(u==='día desde 1 mar')return (uno?'día':'días')+' desde el 1 de marzo';
  if(u==='días'&&uno)return 'día';
  return u;
}
function ciFilasDisponibles(rows){return rows.filter(r=>finito(r.v)&&r.it&&r.j>=0&&r.k>=0&&r.p.clave!=='ci_varmax_pr');}
async function ciPanelEstacion(){
  CI.panel=true;const caja=$('#serie'),codigo=M.sel,itActual=cliItem(),turno=++CI_PANEL.turno;
  if(!codigo||!itActual)return;
  const firma=codigo+'|'+itActual.tipo+'|'+itActual.id+'|'+CI.indice?.generado+'|'+CI_PANEL.grupo+'|'+cliProducto()?.clave;
  const vigente=()=>turno===CI_PANEL.turno&&M.sel===codigo&&M.fam==='clima'&&cliProducto()?.clave.startsWith('ci_')&&cliItem()?.id===itActual.id&&cliItem()?.tipo===itActual.tipo;
  $('#serie-stats').innerHTML='';caja.classList.remove('pron');
  const e=cmEstacion();if(e)$('#serie-tit').innerHTML=esc(codigo)+' <span class="nomest">'+esc(e.nombre||'')+'</span>';
  if(CI_PANEL.firma===firma){await ciPanelGraficos(caja,itActual,vigente);return;}
  caja.innerHTML='<div class="vacio" role="status">Cargando indicadores…</div>';
  const todos=(CI.indice?.productos||[]).filter(p=>p.items.some(z=>z.id===itActual.id&&z.tipo===itActual.tipo));
  CI_PANEL.grupos=['Lluvia','Días y rachas','Sequía','Temperatura máxima','Temperatura mínima','Temporada lluviosa'].filter(g=>todos.some(p=>ciGrupoEstacion(p)===g));
  if(CI_PANEL.grupo!=='Resumen'&&!CI_PANEL.grupos.includes(CI_PANEL.grupo))CI_PANEL.grupo='Resumen';
  const ps=ciPanelNecesarios(todos),resumen=CI_PANEL.grupo==='Resumen';
  let cursor=0;const rows=[];let fallos=0;
  const conDato=()=>ciFilasDisponibles(rows).length;
  await Promise.all([0,1,2].map(async()=>{while(cursor<ps.length&&vigente()&&!(resumen&&conDato()>=6)){
    const p=ps[cursor++],it=p.items.find(z=>z.id===itActual.id&&z.tipo===itActual.tipo);let d;
    try{d=await ciDatos(p);}catch(_){fallos++;continue;}
    const j=d.estaciones.findIndex(z=>z.c===codigo),k=d.periodos.findIndex(z=>z.id===it.id&&z.tipo===it.tipo);
    rows.push({p,it,d,j,k,v:j>=0&&k>=0?d.valores[k][j]:null,cob:j>=0&&k>=0?d.cobertura[k][j]:null,unit:ciUnidad(p,it)});
  }}));
  if(!vigente())return;
  CI_PANEL.filas=ciFilasDisponibles(rows);CI_PANEL.firma=fallos?null:firma;CI_PANEL.fallos=fallos;
  await ciPanelGraficos(caja,itActual,vigente);
}
// El resumen recorre todos los indicadores del periodo en orden de preferencia (el del mapa, los
// principales, uno por grupo y el resto) y se detiene al reunir seis con dato. Cada grupo, los suyos.
function ciPanelNecesarios(todos){
  if(CI_PANEL.grupo!=='Resumen')return todos.filter(p=>ciGrupoEstacion(p)===CI_PANEL.grupo);
  const actual=cliProducto(),out=[];const sumar=p=>{if(p&&!out.includes(p))out.push(p);};
  sumar(todos.find(p=>p.clave===actual?.clave));
  for(const k of ['ci_sum_pr','ci_wd','ci_rx1','ci_cdd','ci_mean_tx','ci_mean_tn'])sumar(todos.find(p=>p.clave===k));
  for(const g of CI_PANEL.grupos||[])if(!out.some(p=>ciGrupoEstacion(p)===g))sumar(todos.find(p=>ciGrupoEstacion(p)===g));
  for(const p of todos)sumar(p);
  return out;
}
async function ciPanelGraficos(caja,it,vigente){
  const filas=CI_PANEL.filas,grupos=CI_PANEL.grupos||[];
  caja.querySelectorAll('.js-plotly-plot').forEach(el=>Plotly.purge(el));
  caja.innerHTML=`<div class="ci-panel-cab"><b>Indicadores climáticos</b><span>${esc(cmEtiquetaPeriodo({},it))}${it.parcial?' (parcial)':''}</span><button data-ci-exportar>Descargar</button></div><nav class="ci-grupos" aria-label="Grupo de indicadores">${['Resumen',...grupos].map(g=>`<button data-ci-grupo="${esc(g)}" aria-pressed="${CI_PANEL.grupo===g}">${esc(g)}</button>`).join('')}</nav><div id="ci-panel-grupos" class="ci-graficos"></div>`;
  caja.querySelectorAll('[data-ci-grupo]').forEach(b=>b.onclick=()=>{CI_PANEL.grupo=b.dataset.ciGrupo;ciPanelEstacion();});
  caja.querySelector('[data-ci-exportar]').onclick=e=>ciExportarFilas(it,e.currentTarget);
  const cont=caja.querySelector('#ci-panel-grupos');
  if(!filas.length){cont.innerHTML=`<div class="vacio">${CI_PANEL.fallos?'No se pudieron leer los indicadores. Vuelva a elegir el grupo para reintentar.':'Sin indicadores calculables en este periodo.'}</div>`;return;}
  const preferidas=[cliProducto()?.clave,'ci_sum_pr','ci_wd','ci_rx1','ci_cdd','ci_mean_tx','ci_mean_tn'];
  const resumen=[];
  for(const key of preferidas){const r=filas.find(r=>r.p.clave===key);if(r)resumen.push(r);}
  for(const g of grupos){const r=filas.find(r=>ciGrupoEstacion(r.p)===g&&!resumen.includes(r));if(r&&!resumen.some(r=>ciGrupoEstacion(r.p)===g))resumen.push(r);}
  for(const r of filas)if(resumen.length<6&&!resumen.includes(r))resumen.push(r);
  const mostrar=CI_PANEL.grupo==='Resumen'?resumen:filas.filter(r=>ciGrupoEstacion(r.p)===CI_PANEL.grupo);
  for(const r of mostrar){
    const card=document.createElement('section');card.className='ci-grafico';card.dataset.indicador=r.p.clave;
    card.innerHTML=`<header><h3>${esc(ciNombre(r.p))}</h3><button class="cm-info" aria-label="Explicación de ${esc(ciNombre(r.p))}">i</button></header><div class="ci-cifra"><b>${num(r.v,Number.isInteger(r.v)?0:2)}</b> <span>${esc(ciUnidadTexto(r.unit,r.v))}</span></div><div class="ci-mini-plot" role="img" aria-label="Serie de ${esc(ciNombre(r.p))}"></div>`;
    card.querySelector('.cm-info').onclick=e=>ciAyudaIndividual(r.p,r.it,r.unit,e.currentTarget,r.cob);
    cont.appendChild(card);
    const todos=r.d.periodos.map((z,k)=>({z,k})).filter(a=>a.z.tipo===it.tipo&&a.z.desde<=it.desde),ids=todos.slice(-8);
    const xs=ids.map(a=>a.z.id),ys=ids.map(a=>r.d.valores[a.k][r.j]),col=ciColorIndicador(r.p);
    await cmPlot(card.querySelector('.ci-mini-plot'),[{type:'bar',x:xs,y:ys,marker:{color:ids.map(a=>a.z.id===it.id?col:mezcla(col,colorTema('--fondo','#10202a'),.55)),line:{color:colorTema('--tinta','#ddd'),width:ids.map(a=>a.z.id===it.id?1.3:0)},pattern:{shape:ids.map(a=>a.z.parcial?'/':'')}},customdata:ids.map(a=>[cmEtiquetaPeriodo(r.p,a.z),r.d.cobertura[a.k][r.j]]),hovertemplate:'%{customdata[0]}<br>%{y:.2f} '+esc(r.unit)+'<br>%{customdata[1]:.1f} % de días con dato<extra></extra>'}],{height:155,margin:{l:35,r:8,t:26,b:32},xaxis:{type:'category',tickvals:xs,ticktext:ids.map(a=>it.tipo==='mensual'?CM_MESES[+a.z.id.slice(5)-1].slice(0,3)+(a.z.id.slice(5)==='01'?'<br>'+a.z.id.slice(0,4):''):a.z.id),tickfont:{size:10}},yaxis:{tickfont:{size:10},nticks:4,zeroline:true},showlegend:false},{displayModeBar:false});
    if(!vigente())return;
  }
}
async function ciExportarFilas(it,boton){
  // Todos los indicadores de la estación y el periodo, no solo los que el panel ya bajó.
  const codigo=M.sel,ps=(CI.indice?.productos||[]).filter(p=>p.items.some(z=>z.id===it.id&&z.tipo===it.tipo)),todas=[];let cursor=0;
  if(boton)boton.disabled=true;
  try{await Promise.all([0,1,2].map(async()=>{while(cursor<ps.length){const p=ps[cursor++],pit=p.items.find(z=>z.id===it.id&&z.tipo===it.tipo);let d;try{d=await ciDatos(p);}catch(_){continue;}
    const j=d.estaciones.findIndex(z=>z.c===codigo),k=d.periodos.findIndex(z=>z.id===it.id&&z.tipo===it.tipo);
    todas.push({p,it:pit,j,k,v:j>=0&&k>=0?d.valores[k][j]:null,cob:j>=0&&k>=0?d.cobertura[k][j]:null,unit:ciUnidad(p,pit)});}}));}
  finally{if(boton)boton.disabled=false;}
  const rows=ciFilasDisponibles(todas).sort((a,b)=>ps.indexOf(a.p)-ps.indexOf(b.p));
  const q=x=>'"'+String(x??'').replaceAll('"','""')+'"',data=[['estacion','indicador','desde','hasta','valor','unidad','cobertura_pct'],...rows.map(r=>[codigo,ciNombre(r.p),r.it.desde,r.it.hasta,r.v,r.unit,r.cob])];
  const url=URL.createObjectURL(new Blob(['\ufeff'+data.map(r=>r.map(q).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=codigo+'_indicadores_'+it.id+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function ciAyudaIndividual(p,it,unit,boton,cob){
  const def=cmDescripcion(p,it);
  const contenido=`<p>${esc(def.corta)}</p><dl class="cm-definicion"><dt>Unidad</dt><dd>${esc(ciUnidadTexto(unit))}</dd><dt>Cálculo</dt><dd>${esc(def.calculo||ciNota(p))}${def.ejemplo?'<p>'+esc(def.ejemplo)+'</p>':''}</dd><dt>Periodo</dt><dd>${esc(cmRango(p,it))}${it.parcial?' (parcial)':''}. Cada barra corresponde a un ${it.tipo==='mensual'?'mes':it.tipo==='anual'?'año':'ciclo de octubre a septiembre'}. Las rachas son días consecutivos y los conteos son días del periodo.</dd><dt>Cobertura</dt><dd>${finito(cob)?num(cob,1)+' % en el periodo seleccionado. ':''}Porcentaje de días con dato válido. El panel incluye solo resultados calculables en este periodo. Una barra de valor cero es un resultado válido. Un hueco no se considera cero.</dd><dt>Referencia y requisitos</dt><dd>${esc(ciFrase(p.referencia||'Serie diaria de la estación'))} ${esc(ciNota(p))}</dd></dl>`;
  cmPopup(boton,ciNombre(p),contenido);
}


function cmEsLluviaMeteo(p){return p.clave==='obs_lluvia_mm'||p.clave==='interp_lluvia'||(p.clave.startsWith('interpdia_')&&!/tmax|tmin/.test(p.clave));}
async function cmIndiceMeteo(){
  const fuentes=await Promise.all(['clima','clima_interpolado','clima_interpolado_diario'].map(n=>_pedirJSON('datos/productos/'+n+'.json')));
  const out={nombre:'Lluvia observada',productos:[],campos:{},generado:null};
  for(const x of fuentes.filter(Boolean)){
    out.productos.push(...(x.productos||[]).map(cmProducto).filter(cmEsLluviaMeteo));
    for(const [k,c] of Object.entries(x.campos||{}))out.campos[k]={...(x.escalas?.[c.escala]||{}),...c};
    if(!out.generado||x.generado>out.generado)out.generado=x.generado;
  }
  return out;
}
async function cmCampoMeteo(campo){
  const key='lluvia_observada|'+campo;if(PR.campos[key])return PR.campos[key];
  const meta=PR.idx.lluvia_observada?.campos[campo];if(!meta)return null;
  const g=await _pedirJSON('datos/productos/'+meta.archivo);if(!g)return null;
  const c={...g,v:cliDecodificar(g),meta,factor:Math.max(1,Math.min(48,Math.round(1100/Math.max(g.nlon,g.nlat))))};
  if(!cmMallaAdmitida(c))return null;
  PR.campos[key]=c;return c;
}
async function cmComparacionObservada(p,codigo){
  const C=await cliComparativas(),variable=/tmax/.test(p.clave)?'tmax':/tmin/.test(p.clave)?'tmin':'lluvia';
  const mensual=p.clave.startsWith('interp_');
  if(mensual){const r=C.interp?.estaciones?.[codigo]?.[variable];return r?{...r,fechas:C.interp.meses,unidad:variable==='lluvia'?'mm':'°C',mensual:true}:null;}
  const B=C.dias?.[variable+'_diaria'],r=B?.series?.[codigo];
  return r?{o:r[0],m:r[1],l:r[2],fechas:B.fechas,unidad:B.unidad|| (variable==='lluvia'?'mm':'°C'),mensual:false}:null;
}
function cmMetricasHTML(r){
  const pares=(b)=>r.fechas.map((f,i)=>({f,o:r.o[i],v:b?.[i]})).filter(x=>finito(x.o)&&finito(x.v));
  const rows=[['Mapa publicado',r.m],['Sin utilizar esta estación',r.l]].map(([nombre,vs])=>{
    const a=pares(vs),m=_cliMetricas(a.map(x=>x.o),a.map(x=>x.v),r.unidad==='mm');
    return `<tr><th>${nombre}</th><td>${a.length?a[0].f+' a '+a.at(-1).f:'—'}</td><td>${m?.n||0}</td><td>${m?num(m.mae,2):'—'}</td><td>${m?num(m.sesgo,2):'—'}</td></tr>`;
  }).join('');
  return `<section class="cm-metricas"><h3>Validación del interpolado ${r.mensual?'mensual':'diario'}</h3><div class="hm-scroll"><table><thead><tr><th>Comparación con observaciones</th><th>Periodo evaluado</th><th>Casos</th><th>MAE (${esc(r.unidad)})</th><th>Sesgo (${esc(r.unidad)})</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
async function cmObservacionesInline(caja,p,it,codigo,activa,principal=false){
  if(!/^(obs_|interp)/.test(p.clave))return;
  const r=await cmComparacionObservada(p,codigo);if(!activa())return;
  if(!r)return;
  const id='cm-obs-graf',n=r.mensual?12:31,start=Math.max(0,r.fechas.length-n),fechas=r.fechas.slice(start);
  caja.insertAdjacentHTML('beforeend',`<section class="cm-obs"><h3>${r.mensual?'Meses observados e interpolados':'Observaciones e interpolado diario'}</h3><div class="cm-obs-scroll"><div id="${id}"></div></div></section>${cmMetricasHTML(r)}`);
  const tinta=colorTema('--tinta','#dce7ef'),azul=colorTema('--acento','#48b9ed');
  const tr=[{type:'bar',name:'Interpolado',x:fechas,y:r.m.slice(start),marker:{color:r.mensual&&r.unidad==='mm'?r.m.slice(start).map(lluviaMensualColor):azul,line:{width:.5,color:azul}}},
    {type:'scatter',mode:'lines+markers+text',name:'Observado',x:fechas,y:r.o.slice(start),line:{color:tinta,width:2},marker:{size:5},text:r.o.slice(start).map(v=>finito(v)?num(v,Math.abs(v)<10?1:0):''),textposition:'top center',textfont:{size:10},cliponaxis:false}];
  await cmPlot(id,tr,{margin:{l:52,r:18,t:30,b:56},xaxis:{type:'category',tickvals:fechas,ticktext:fechas.map(f=>r.mensual?_cliMesTxt(f):_cliFechaCorta(f)),tickangle:fechas.length>10?-35:0},yaxis:{title:r.unidad},legend:{orientation:'h',y:-.28},showlegend:true});
}
async function cmDetalleMeteo(){
  const a=prProducto(),it=prItem(),x=cmEstacion(),caja=$('#serie'),seleccion=PR.sel,codigo=M.sel;
  if(!a||!it||!x)return false;
  $('#serie-stats').innerHTML='';$('#serie-tit').innerHTML=esc(x.codigo)+' <span class="nomest">'+esc(x.nombre||'')+'</span>';
  const c=await cmCampoMeteo(it.campo),v=cmMuestra(c,x),activa=()=>M.fam==='meteo'&&M.sel===codigo&&PR.sel===seleccion&&prItem()?.campo===it.campo&&M.mapa.productos;
  if(!activa())return true;
  caja.innerHTML=`<div class="cm-serie-cab"><b>${esc(a.q.nombre)}</b><span>${esc(it.periodo||it.etiqueta||it.fecha||it.mes||'')}</span><span>${finito(v)?num(v,1)+' '+esc(c.meta.unidad)+' en la celda':'Sin valor en esta celda'}</span></div>`;
  await cmObservacionesInline(caja,a.q,it,codigo,activa,true);return true;
}

// 5/11/2026, la misma escala «porcentaje» que exporta exportar_clima.py (19 tonos centrados en 100)
const CM_PORCENTAJE={niveles:[25,33,40,50,57,67,75,83,91,110,120,133,150,175,200,250,300,400],colores:['#4a2408','#7a3d0c','#a3581b','#c2782f','#d89b54','#e8bb7c','#f2d4a6','#f9eacf','#fbf1e3','#ffffff','#e8f5f2','#e3f2ef','#bfe3dc','#8ccbc0','#58ada7','#2f8b8c','#1c6b78','#174e68','#103558'],extend:'both',unidad:'% de la normal',marcas:[25,50,67,150,200,400],centro:[100,'100 %'],extremos:['más seco','más lluvioso'],nulo:{color:'#bfc4cc',trama:'#7c848f',texto:'sin %, normal menor de 0,5 mm por día'}};
function cmMetaPorcentaje(meta){return meta.escala==='porcentaje'?{...meta,...CM_PORCENTAJE}:meta;}
function cmPorcentaje(){return CM_PORCENTAJE;}
async function cmLluviaContexto(caja,p,it,x,vigente){
  const mensual=p.clave==='interp_lluvia_pct';
  const [E,meses]=await Promise.all([cliCargarEstaciones('lluvia'),cmComparacionObservada({clave:'interp_lluvia'},x.codigo)]);
  if(!vigente())return;
  const s=E?.estaciones?.[x.codigo],V=E?.ventanas||[],raw=M.d?.estaciones.find(e=>e.codigo===x.codigo),dias=(raw?.acum_diario||[]).filter(z=>z.estado!=='recortado'&&z.dia>=it.desde&&z.dia<=it.hasta),tinta=colorTema('--tinta','#e0edf4'),azul=colorTema('--acento','#48b9ed');
  const campo=await cliCampo(it.campo);if(!vigente())return;
  const valor=cmMuestra(campo,x),crudo=cmMuestra(campo,x,true),obs=campo?.componentes?.observado?cmMuestra(campo.componentes.observado,x):null,norm=campo?.componentes?.normal?cmMuestra(campo.componentes.normal,x):null;
  caja.innerHTML=`<div class="cm-serie-cab"><b>${esc(p.nombre)}</b><span>${esc(cmRango(p,it))}</span></div><div class="cm-resumen-linea">${finito(valor)&&valor>=0?`<b>${num(valor,0)} ${p.clave.endsWith('pctl')?'percentil':'%'}</b> en el mapa`:finito(crudo)&&crudo<0?'<b>Sin %</b> en el mapa':''}${finito(obs)?`<span>Lluvia ${num(obs,1)} mm</span>`:''}${finito(norm)?`<span>Normal ${num(norm,finito(crudo)&&crudo<0?2:1)} mm</span>`:''}</div><div class="cm-contexto-graficos"></div>`;
  const cont=caja.querySelector('.cm-contexto-graficos');
  const eje={type:'category',tickangle:0,tickfont:{size:10}};
  if(!mensual&&dias.length){
    const xs=dias.map(z=>z.dia),normales=dias.map(z=>s?cliInterp(V,s.m,cliDoy(z.dia)):null);
    cont.innerHTML='<section><h3>Lluvia diaria en la estación <small>mm</small></h3><div id="cm-contexto-diario"></div></section><section><h3>Acumulado de la estación y su normal <small>mm</small></h3><div id="cm-contexto-acumulado"></div></section>';
    await cmPlot('cm-contexto-diario',[{type:'bar',x:xs,y:dias.map(z=>z.mm),name:'Observado',marker:{color:azul,pattern:{shape:dias.map(z=>z.completo?'':'/')}},hovertemplate:'%{x}<br>%{y:.1f} mm<extra></extra>'},{type:'scatter',mode:'lines',x:xs,y:normales,name:'Normal diaria',line:{color:'#d1ba8f',dash:'dot'},hovertemplate:'%{x}<br>%{y:.1f} mm<extra></extra>'}],{height:205,margin:{l:40,r:12,t:26,b:48},xaxis:{...eje,tickvals:xs.filter((_,j)=>j%5===0),ticktext:xs.filter((_,j)=>j%5===0).map(_cliFechaCorta)},yaxis:{nticks:4},showlegend:false},{displayModeBar:false});
    if(!vigente())return;
    let a=0,b=0;const yo=[],yn=[];dias.forEach((z,j)=>{if(z.completo&&finito(z.mm)){a+=z.mm;if(finito(normales[j]))b+=normales[j];yo.push(a);yn.push(s?b:null);}else{yo.push(null);yn.push(null);}});
    await cmPlot('cm-contexto-acumulado',[{type:'scatter',mode:'lines',x:xs,y:yo,name:'Observado',line:{color:azul,width:2.4}},{type:'scatter',mode:'lines',x:xs,y:yn,name:'Normal',line:{color:'#d1ba8f',dash:'dot'}}],{height:185,margin:{l:40,r:12,t:14,b:45},xaxis:{...eje,tickvals:xs.filter((_,j)=>j%5===0),ticktext:xs.filter((_,j)=>j%5===0).map(_cliFechaCorta)},yaxis:{nticks:4,range:[0,Math.max(1,...yo.filter(finito),...yn.filter(finito))*1.1]},legend:{orientation:'h',y:-.3,font:{size:10}}},{displayModeBar:false});
  }
  if(!vigente())return;
  if(meses){
    const hasta=mensual?it.mes:(it.hasta||cmHoy()).slice(0,7),ix=meses.fechas.map((f,i)=>({f,i})).filter(a=>a.f<=hasta).slice(-12),xs=ix.map(a=>a.f),o=ix.map(a=>meses.o[a.i]),m=ix.map(a=>meses.m[a.i]);
    const se=document.createElement('section');se.innerHTML='<h3>Lluvia mensual observada e interpolada <small>mm</small></h3><div id="cm-contexto-mensual"></div>';cont.appendChild(se);
    await cmPlot('cm-contexto-mensual',[{type:'bar',x:xs,y:m,name:'Interpolado',marker:{color:m.map(v=>finito(v)?lluviaMensualColor(v):azul)}},{type:'scatter',mode:'lines+markers+text',x:xs,y:o,name:'Observado',line:{color:tinta,width:1.8},marker:{size:4},text:o.map(v=>finito(v)?num(v,0):''),textposition:'top center',textfont:{size:10},cliponaxis:false}],{height:220,margin:{l:45,r:12,t:26,b:60},xaxis:{...eje,tickvals:xs,ticktext:xs.map(f=>CM_MESES[+f.slice(5)-1].slice(0,3)+(f.endsWith('-01')?'<br>'+f.slice(0,4):''))},yaxis:{nticks:5},legend:{orientation:'h',y:-.3,font:{size:10}}},{displayModeBar:false});
    if(!vigente())return;
    if(mensual){
      const ps=CLI.interp.productos.find(z=>z.clave==='interp_lluvia_pct'),ids=ps.items.filter(z=>z.mes<=it.mes).slice(-12),vals=[];
      for(const z of ids){const c=await cliCampo(z.campo);if(!vigente())return;const v=cmMuestra(c,x);vals.push(finito(v)&&v>=0?v:null);}
      const se2=document.createElement('section');se2.innerHTML='<h3>Lluvia mensual respecto a la normal <small>%</small></h3><div id="cm-contexto-porcentaje"></div>';cont.appendChild(se2);
      await cmPlot('cm-contexto-porcentaje',[{type:'bar',x:ids.map(z=>z.mes),y:vals,marker:{color:vals.map(v=>{const e=cmPorcentaje();return e&&finito(v)?ciColor(e,v):azul;})}},{type:'scatter',mode:'lines',x:ids.map(z=>z.mes),y:ids.map(()=>100),line:{color:tinta,dash:'dot'},name:'Normal 100 %'}],{height:205,margin:{l:45,r:12,t:26,b:45},xaxis:{...eje,tickvals:ids.map(z=>z.mes),ticktext:ids.map(z=>CM_MESES[+z.mes.slice(5)-1].slice(0,3))},yaxis:{nticks:4},showlegend:false},{displayModeBar:false});
    }
    caja.insertAdjacentHTML('beforeend',cmMetricasHTML(meses));
  }
  if(!cont.children.length)cont.innerHTML='<div class="vacio">Sin serie observada disponible para esta estación y periodo.</div>';
}

function ciColorIndicador(p){
  const claves=(CI.indice?.productos||[]).filter(x=>ciGrupoEstacion(x)===ciGrupoEstacion(p)).map(x=>x.clave);
  const paletas={Lluvia:['#4ba6c8','#55b6a5','#9ba66e','#b690c9','#dda16a','#739bd1','#ca829d'],
    'Días y rachas':['#c69a62','#52aaa5','#829ccd','#b68cbc','#8ea96c','#c88272','#71acbf'],
    'Temperatura máxima':['#d98b62','#c7aa57','#b97c95','#c86b68','#9d8bba'],
    'Temperatura mínima':['#789fd1','#74b7bc','#a08ed1','#899fb5','#71a78d'],
    'Sequía':['#ba9965','#7bafa6','#9993c6','#81a6ba'],
    'Temporada lluviosa':['#6ca9a5','#9391c4','#b89b68','#759db9','#a289a9']};
  const cs=paletas[ciGrupoEstacion(p)]||paletas.Lluvia;return cs[Math.max(0,claves.indexOf(p.clave))%cs.length];
}
function cmPopup(boton,titulo,contenido){
  document.getElementById('cm-ayuda-popup')?.remove();
  const pop=document.createElement('dialog');pop.id='cm-ayuda-popup';pop.setAttribute('aria-label',titulo);
  pop.innerHTML=`<header><b>${esc(titulo)}</b><button type="button" aria-label="Cerrar explicación">×</button></header><div>${contenido}</div>`;
  document.body.appendChild(pop);boton.setAttribute('aria-expanded','true');boton.setAttribute('aria-controls',pop.id);
  const fuera=e=>{if(pop.isConnected&&!pop.contains(e.target)&&e.target!==boton)pop.close();},tecla=e=>{if(e.key==='Escape')pop.close();};
  pop.querySelector('button').onclick=()=>pop.close();
  pop.addEventListener('close',()=>{boton.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',fuera,true);document.removeEventListener('keydown',tecla);pop.remove();});
  pop.show();setTimeout(()=>{document.addEventListener('pointerdown',fuera,true);document.addEventListener('keydown',tecla);});
  const r=boton.getBoundingClientRect(),h=pop.offsetHeight,w=pop.offsetWidth;
  pop.style.left=Math.max(8,Math.min(window.innerWidth-w-8,r.right-w))+'px';
  pop.style.top=Math.max(8,Math.min(window.innerHeight-h-8,r.bottom+7))+'px';
  requestAnimationFrame(()=>{if(pop.isConnected)pop.style.top=Math.max(8,Math.min(window.innerHeight-pop.offsetHeight-8,r.bottom+7))+'px';});
  return pop.lastElementChild;
}
