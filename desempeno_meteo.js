/* Tablas de desempeño: muestras explícitas, grupos de métricas y orden numérico. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.MeteoDesempeno=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const fin=x=>typeof x==='number'&&Number.isFinite(x);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(x,n=2)=>fin(x)?x.toLocaleString('es-EC',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
  const fecha=x=>x?x.split('-').reverse().join('/'):'';
  const errores=[['mae','MAE ↓','Error absoluto medio; menor es mejor.'],['rmse','RMSE ↓','Penaliza más los errores grandes; menor es mejor.'],['sesgo','Sesgo','Pronóstico menos observado: negativo subestima, positivo sobreestima.'],['r','r ↑','Correlación; entre −1 y 1.']];
  const evento=[['eventos','Eventos','Días observados que alcanzan el umbral.',0],['aciertos','Aciertos','Eventos pronosticados y observados.',0],['omisiones','Omisiones','Eventos observados que el modelo no anticipó.',0],['falsas','Falsas','Avisos sin un evento observado.',0],['pod','POD ↑','Porcentaje de eventos observados que se detectaron.','%'],['far','FAR ↓','Porcentaje de avisos que resultaron falsos.','%'],['csi','CSI ↑','Aciertos entre aciertos, omisiones y falsas alarmas.','%'],['ets','ETS ↑','Acierto descontando el azar. Cero: sin habilidad respecto al azar.']];
  function ordenar(filas,clave,asc=true){
    return [...filas].sort((a,b)=>{
      const x=a[clave],y=b[clave];if(!fin(x)||!fin(y))return fin(x)?-1:fin(y)?1:0;
      return (x-y)*(asc?1:-1)||String(a.nombre).localeCompare(String(b.nombre));
    });
  }
  function tabla(filas,cols,unidad,comun=false){
    return '<div class="dp-scroll"><table class="dp-tabla" style="--dp-columnas:'+cols.length+'"><colgroup><col class="dp-col-modelo"><col class="dp-col-casos">'+cols.map(()=>'<col>').join('')+'</colgroup><thead><tr><th class="dp-modelo">Modelo</th><th><button type="button" data-dp-sort="n" data-dp-direction="desc" title="Pares válidos de pronóstico y observación">Casos</button></th>'+
      cols.map(([k,n,t])=>`<th><button type="button" data-dp-sort="${k}" data-dp-direction="${['r','pod','csi','ets','aciertos','eventos','ss'].includes(k)?'desc':'asc'}" title="${esc(t)}">${esc(n)}</button>${['mae','rmse','sesgo'].includes(k)?`<small>${esc(unidad)}</small>`:''}</th>`).join('')+'</tr></thead><tbody>'+
      filas.map((m,i)=>'<tr'+((comun&&i<10)||m.puesto<=10?' class="dp-seleccionado"':'')+'><td class="dp-modelo">'+(comun?`<b class="dp-puesto">${i+1}</b>`:m.puesto?`<b class="dp-rango" title="Puesto en la muestra común para este plazo">${m.puesto}</b>`:'')+`<span title="${esc(m.nombre+(m.origen?' · '+m.origen:''))}">${esc(m.nombre)}</span></td>`+
        `<td data-dp-value="${fin(m.n)?m.n:''}">${num(m.n,0)}</td>`+cols.map(([k,,,form])=>`<td data-dp-value="${fin(m[k])?m[k]:''}">${form==='%'?(fin(m[k])?num(m[k]*100,1)+' %':'—'):num(m[k],form??2)}</td>`).join('')+'</tr>').join('')+
      '</tbody></table></div>';
  }
  function grupo(filas,lluvia,unidad,comun=false,plazoHTML=""){
    const opciones=[['errores','Errores de cantidad'],...(lluvia?[1,10,25,50,100].map(u=>['u'+u,'Lluvia ≥ '+u+' mm']):[])];
    return '<section class="dp-grupo"><div class="dp-controles">'+plazoHTML+'<label>Métricas <select data-dp-select aria-label="Grupo de métricas">'+opciones.map(([k,n])=>`<option value="${k}">${n}</option>`).join('')+'</select></label><span class="dp-ayuda-orden">Pulsa una columna para ordenar</span></div>'+
      opciones.map(([k])=>{
        const fs=k==='errores'?filas:filas.map(m=>{const e=m.umbrales?.[k.slice(1)]||{};return {...m,...e,eventos:fin(e.aciertos)&&fin(e.omisiones)?e.aciertos+e.omisiones:null};});
        return `<div data-dp-vista="${k}" ${k==='errores'?'':'hidden'}>${tabla(fs,k==='errores'?errores:evento,unidad,comun)}</div>`;
      }).join('')+'</section>';
  }
  function comparacion(v,lluvia,unidad){
    const hs=Object.keys(v.metricasPorPlazo||v.ordenes||{1:v.orden});
    const ex=lluvia&&v.exportacion?'<div class="dp-exportar"><button type="button" class="dp-descarga" data-dp-excel>Excel (.xlsx)</button><span role="status" data-dp-descarga-estado></span></div>':'';
    return '<section class="dp-grupo dp-validacion" aria-label="Todos los miembros disponibles">'+ex+hs.map((h,i)=>`<div data-dp-vista="h${h}" ${i?'hidden':''}>`+comparacionPlazo({...v,orden:v.ordenes?.[h]||v.orden,metricas:v.metricasPorPlazo?.[h]||v.metricas},lluvia,unidad,h,hs)+'</div>').join('')+'</section>';
  }
  function comparacionPlazo(v,lluvia,unidad,plazo,hs){
    const r=v.orden||{filas:[],fechas:[]},orden=new Map(r.filas.map((m,i)=>[m.id,i+1]));
    const todas=[...(v.metricas||[])].map(m=>({...m,puesto:orden.get(m.id)})).sort((a,b)=>(a.puesto??1e6)-(b.puesto??1e6)||(a.mae??Infinity)-(b.mae??Infinity)||a.nombre.localeCompare(b.nombre));
    const fechas=todas.flatMap(m=>[m.desde,m.hasta]).filter(Boolean).sort();
    const periodo=fechas.length?`${fecha(fechas[0])} – ${fecha(fechas.at(-1))}`:'Período según casos disponibles';
    const selector='<label>Plazo <select data-dp-plazo aria-label="Día del pronóstico">'+hs.map(h=>`<option value="h${h}" ${h===plazo?'selected':''}>D+${h}</option>`).join('')+'</select></label>';
    return `<div class="dp-panel"><div class="dp-cab"><span>D+${plazo} · ${todas.length} modelos</span><span>${periodo}</span></div>`+
      (v.hindcast?`<p class="dp-nota" title="${esc(v.hindcast.metodo)}">Hindcast 07–07 · corridas históricas 00 UTC. ML entrenado hasta ${fecha(v.hindcast.entrenamiento_hasta)}. NWP histórico: Open-Meteo; cartas actuales: fuente nativa.</p>`:'')+
      (todas.length?grupo(todas,lluvia,unidad,false,selector):'<p class="dp-vacio">Aún no hay tres días comunes para establecer un orden comparable.</p>')+
      '<p class="dp-nota">Incluye todos los casos, también cuando el modelo no apareció entre las diez barras. Las muestras pueden diferir; n indica los pares válidos. — significa indefinido o sin datos.</p>'+
      (r.filas.length?'<details class="dp-detalle"><summary>Comparación sobre los mismos días · '+r.fechas.length+' días</summary><p class="dp-nota">Orden usado para elegir las diez barras futuras de este plazo; ordenar columnas no cambia esa selección.</p>'+grupo(r.filas,lluvia,unidad,true)+'</details>':'<p class="dp-nota">Aún no hay tres días comunes para establecer un orden comparable.</p>')+
      '<details class="dp-detalle"><summary>Cómo interpretar el desempeño</summary><p class="dp-nota">Elegir los diez modelos más cercanos a una observación es una selección retrospectiva, no una validación del pronóstico futuro. La reconstrucción temporal se distingue del archivo operativo. Cada plazo conserva sus propios casos, umbrales y errores. Sesgo negativo: subestimación; positivo: sobreestimación. Con pocos eventos el resultado es provisional. ETS negativo: peor que el azar.</p></details></div>';
  }
  function plazos(m,lluvia,unidad){
    if(!m?.filas?.length)return '';
    const bandas=(m.bandas||[]).filter(b=>m.filas.some(f=>f[b]?.n));if(!bandas.length)return '';
    const cols=[errores[0],errores[1],errores[2],['ss','SS ↑','Habilidad respecto a climatología; positivo mejora la referencia.'],...(lluvia?[['pod','POD ↑','Detección de lluvia ≥1 mm.','%'],['far','FAR ↓','Falsas alarmas para lluvia ≥1 mm.','%'],['ets','ETS ↑','Acierto descontando azar; lluvia ≥1 mm.']]:[errores[3]])];
    return '<details class="dp-detalle dp-panel"><summary>Validación temporal por plazo</summary><p class="dp-nota">Sin día 0. Ajustes anteriores a cada emisión. Cada plazo utiliza todos sus pares; las muestras pueden diferir. SS = 1 − MAE / MAE de climatología.</p><section class="dp-grupo"><div class="dp-controles"><label>Plazo <select data-dp-select aria-label="Plazo de validación">'+bandas.map(b=>`<option value="${esc(b)}">Días ${esc(b)}</option>`).join('')+'</select></label></div>'+
      bandas.map((b,i)=>`<div data-dp-vista="${esc(b)}" ${i?'hidden':''}>`+tabla(ordenar(m.filas.filter(f=>f[b]?.n).map(f=>({id:f.id,nombre:f.nombre,...f[b]})),'mae'),cols,unidad)+'</div>').join('')+'</section></details>';
  }
  if(typeof document!=='undefined'){
    document.addEventListener('change',ev=>{const plazo=ev.target.closest('[data-dp-plazo]');if(plazo){const g=plazo.closest('.dp-validacion'),valor=plazo.value;g.querySelectorAll('[data-dp-plazo]').forEach(s=>s.value=valor);g.querySelectorAll(':scope > [data-dp-vista]').forEach(n=>n.hidden=n.dataset.dpVista!==valor);return;}const s=ev.target.closest('[data-dp-select]');if(!s)return;const g=s.closest('.dp-grupo');g.querySelectorAll(':scope > [data-dp-vista]').forEach(n=>n.hidden=n.dataset.dpVista!==s.value);});
    document.addEventListener('click',async ev=>{
      const descarga=ev.target.closest('[data-dp-excel]');if(descarga){
        ev.preventDefault();if(descarga.disabled)return;
        const g=descarga.closest('.dp-validacion'),estado=g.querySelector('[data-dp-descarga-estado]');
        descarga.disabled=true;estado.textContent='Preparando Excel…';
        try{await MonitorDescargas.descargar('/api/validacion/valores.xlsx?'+new URLSearchParams({estaciones:'gye',plazo:(g.querySelector('[data-dp-plazo]')?.value||'h1').slice(1)}),'xlsx');estado.textContent='Excel listo';}
        catch(e){estado.textContent=e.message;}finally{descarga.disabled=false;}return;
      }
      const b=ev.target.closest('[data-dp-sort]');if(!b)return;
      const th=b.closest('th'),t=th.closest('table'),idx=[...th.parentElement.children].indexOf(th);
      const asc=th.getAttribute('aria-sort')==='ascending'?false:th.getAttribute('aria-sort')==='descending'?true:b.dataset.dpDirection!=='desc';
      const filas=[...t.tBodies[0].rows].map((el,i)=>({el,nombre:String(i).padStart(4,'0'),v:el.cells[idx].dataset.dpValue===''?null:Number(el.cells[idx].dataset.dpValue)}));
      ordenar(filas,'v',asc).forEach(z=>t.tBodies[0].appendChild(z.el));
      t.querySelectorAll('th[aria-sort]').forEach(n=>n.removeAttribute('aria-sort'));th.setAttribute('aria-sort',asc?'ascending':'descending');
    });
  }
  return {comparacion,plazos,ordenar};
});
