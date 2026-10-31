/* Cálculos comunes del gráfico y la comparativa. Sin dependencia de Plotly. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.MeteoComparacion=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const fin=v=>typeof v==='number'&&Number.isFinite(v);
  const retirados=new Set(['ML_tweedie_reciente','MOTOR_OPERATIVO','PONDERADO','PONDERADO_QM','ENSAMBLE','ml','MONAN','monan','gem_seamless','jma_seamless','ecmwf_ifs','meteofrance_arpege_world']);
  const nwp=new Set(['ecmwf_ifs025','ecmwf_aifs025_single','gfs_seamless','icon_seamless']);
  const nombresNwp={ecmwf_ifs025:'IFS',ecmwf_aifs025_single:'AIFS',gfs_seamless:'GFS',icon_seamless:'ICON'};
  const nombreModelo=(id,nombre)=>nombresNwp[id.replace(/^NWP_/,'')]||(/^NWP_NATIVO_(IFS|AIFS|GFS|ICON)$/.exec(id)?.[1])||nombre;
  const esNwpCalibrado=id=>nwp.has(id);
  const permitido=id=>!retirados.has(id)&&!/^PONDERADO/.test(id)&&(!id.startsWith('NWP_')||nwp.has(id.slice(4))||/^NWP_NATIVO_(IFS|AIFS|GFS|ICON)$/.test(id));
  const masDia=(d,n=1)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
  function metricas(p,o,lluvia){
    const pares=p.map((v,i)=>[v,o[i]]).filter(([a,b])=>fin(a)&&fin(b));
    const n=pares.length;if(!n)return {n:0};
    const errores=pares.map(([a,b])=>a-b),media=a=>a.reduce((s,x)=>s+x,0)/a.length;
    const r={n,mae:media(errores.map(Math.abs)),rmse:Math.sqrt(media(errores.map(e=>e*e))),sesgo:media(errores)};
    const mp=media(pares.map(x=>x[0])),mo=media(pares.map(x=>x[1]));
    const sp=pares.reduce((s,[a])=>s+(a-mp)**2,0),so=pares.reduce((s,[,b])=>s+(b-mo)**2,0);
    r.r=n>=3&&sp>0&&so>0?pares.reduce((s,[a,b])=>s+(a-mp)*(b-mo),0)/Math.sqrt(sp*so):null;
    if(lluvia){r.umbrales={};for(const u of [1,10,25,50,100]){
      let a=0,b=0,c=0,d=0;for(const [p,o] of pares){if(p>=u&&o>=u)a++;else if(p>=u)b++;else if(o>=u)c++;else d++;}
      const azar=(a+b)*(a+c)/n,den=a+b+c-azar;
      r.umbrales[u]={aciertos:a,falsas:b,omisiones:c,secos:d,pod:a+c?a/(a+c):null,far:a+b?b/(a+b):null,
        csi:a+b+c?a/(a+b+c):null,ets:den?(a-azar)/den:null};
    }Object.assign(r,r.umbrales[1]);}
    return r;
  }
  function historico(s,emisiones,lluvia){
    const datos=new Map(),nombres=new Map((s.modelos||[]).map(m=>[m.id,m.nombre]));
    const pon=(id,nombre,f,v,origen,plazo=1)=>{if(!permitido(id)||!fin(v))return;
      if(!datos.has(id))datos.set(id,{id,nombre:nombreModelo(id,nombre),fechas:{},plazos:{},porPlazo:{},origen});const m=datos.get(id);
      (m.porPlazo[plazo]??={})[f]=v;
      if((m.plazos[f]??Infinity)<plazo)return;m.fechas[f]=v;m.plazos[f]=plazo;};
    // El histórico heredado se reconstruye con una calibración temporal; no se
    // atribuye retrospectivamente la condición de emisión operativa.
    for(const m of s.hindcast?.modelos||[])for(const [h,dias] of Object.entries(m.plazos||{}))
      for(const [f,v] of Object.entries(dias))pon(m.id,m.nombre,f,v,'Hindcast · corrida histórica 00 UTC',Number(h));
    if(!lluvia||s.ventana!=='00-24')for(const [e,h] of Object.entries(emisiones||{})){
      for(const [id,v] of Object.entries(h.modelos||{}))if(!esNwpCalibrado(id))for(let plazo=1;plazo<v.length;plazo++)
        pon(id,nombres.get(id)||id.replace(/^ML_/,'ML '),masDia(e,plazo),v[plazo],'Validación temporal',plazo);
    }
    const c=s.contraste||{};
    for(const m of c.modelos||[]){const id=nwp.has(m.id)?'NWP_'+m.id:m.id;
      (c.t||[]).forEach((f,i)=>pon(id,m.nombre,f,m.v[i],'Archivo operativo'));
    }
    for(const m of s.archivo_nativo||[])for(const [h,dias] of Object.entries(m.plazos||{}))
      for(const [f,v] of Object.entries(dias))pon(m.id,m.nombre,f,v,'Carta nativa archivada',Number(h));
    return [...datos.values()];
  }
  function ranking(hist,observado,emision,candidatos,lluvia=false,plazo=1){
    const ids=new Set(candidatos.map(m=>m.id));
    const corte=masDia(emision,-1);
    const elegibles=hist.filter(h=>ids.has(h.id)).map(h=>({...h,fechas:h.porPlazo?.[plazo]||(plazo===1?h.fechas:{})})).map(h=>({...h,dias:Object.keys(h.fechas).filter(f=>f<corte&&fin(observado[f])&&fin(h.fechas[f])&&(h.porPlazo||!h.plazos||h.plazos[f]===plazo))}))
      .filter(h=>h.dias.length>=3).sort((a,b)=>b.dias.length-a.dias.length||a.id.localeCompare(b.id));
    let comunes=null;const aceptados=[];
    for(const h of elegibles){const dias=comunes===null?h.dias:comunes.filter(f=>h.dias.includes(f));if(dias.length>=3){comunes=dias;aceptados.push(h);}}
    if(!comunes)return {filas:[],fechas:[]};
    const filas=aceptados.map(h=>({id:h.id,nombre:h.nombre,origen:h.origen,...metricas(comunes.map(f=>h.fechas[f]),comunes.map(f=>observado[f]),lluvia)}))
      .sort((a,b)=>a.mae-b.mae||a.rmse-b.rmse||a.id.localeCompare(b.id));
    return {filas:lluvia?ordenEquilibrado(filas):filas,fechas:comunes.sort()};
  }
  function ordenEquilibrado(filas){
    // Frentes no dominados: no mezclar pronósticos ni ajustar pesos. Un modelo
    // se posterga si otro mejora su MAE y su RMSE a la vez. Dentro del frente,
    // menor MAE, después RMSE. Así no se descarta la mejor señal de extremos
    // sólo porque el error de los días de poca lluvia es algo mayor.
    let resto=[...filas],frente=1;const salida=[];
    while(resto.length){
      const mejores=resto.filter(a=>!resto.some(b=>b!==a&&b.mae<=a.mae&&b.rmse<=a.rmse&&(b.mae<a.mae||b.rmse<a.rmse)))
        .sort((a,b)=>a.mae-b.mae||a.rmse-b.rmse||a.id.localeCompare(b.id));
      for(const m of mejores)salida.push({...m,frente});
      const ids=new Set(mejores.map(m=>m.id));resto=resto.filter(m=>!ids.has(m.id));frente++;
    }
    return salida;
  }
  function seleccionar(t,modelos,observado,orden,limite=10,ordenes={},emision=null){
    return t.map((f,i)=>{
      const plazo=emision?Math.round((Date.parse(f)-Date.parse(emision))/864e5):1;
      const propio=ordenes[plazo],o=propio?.filas.length?propio:orden;
      const rango=new Map((o.filas||[]).map((m,i)=>[m.id,i]));
      const respaldo=emision&&plazo!==1&&!propio?.filas.length;
      const hay=fin(observado[f]);
      return modelos.filter(m=>permitido(m.id)&&fin(m.v[i])).sort((a,b)=>{
        if(hay)return Math.abs(a.v[i]-observado[f])-Math.abs(b.v[i]-observado[f])||(rango.get(a.id)??1e6)-(rango.get(b.id)??1e6)||a.id.localeCompare(b.id);
        return (rango.get(a.id)??1e6)-(rango.get(b.id)??1e6)||a.id.localeCompare(b.id);
      }).slice(0,limite).map(m=>({id:m.id,criterio:hay?'Cercanía a la observación':rango.has(m.id)?respaldo?`Respaldo D+1; sin validación suficiente D+${plazo}`:emision?`Desempeño histórico D+${plazo}`:'Desempeño histórico':'Sin verificación suficiente',
        error:hay?Math.abs(m.v[i]-observado[f]):null,rango:rango.has(m.id)?rango.get(m.id)+1:null}));
    });
  }
  function preparar(s,emisiones,emision,lluvia,actuales,tActual,filtro=null,limite=10){
    const obs={...(s.hindcast?.obs||{}),...Object.fromEntries((s.obs?.t||[]).map((f,i)=>[f,s.obs.v[i]]))};
    const hist=historico(s,emisiones,lluvia).filter(m=>!filtro||filtro.has(m.id));
    const modelosActuales=actuales.filter(m=>permitido(m.id)&&!esNwpCalibrado(m.id)&&!m.alias_de).map(m=>({...m,nombre:nombreModelo(m.id,m.nombre)}));
    const orden=ranking(hist,obs,emision,modelosActuales,lluvia);
    const ordenes=Object.fromEntries(Array.from({length:16},(_,i)=>[i+1,ranking(hist,obs,emision,modelosActuales,lluvia,i+1)]));
    const tiempos=new Set([...tActual,...Object.keys(obs)]),mapa=new Map();
    for(const h of hist){const fechas=Object.fromEntries(Object.entries(h.fechas).filter(([f])=>f<emision));Object.keys(fechas).forEach(f=>tiempos.add(f));mapa.set(h.id,{...h,fechas});}
    for(const m of modelosActuales){const h=mapa.get(m.id)||{id:m.id,nombre:m.nombre,fechas:{},origen:'Pronóstico'};h.nombre=m.nombre;
      h.fuentes=Object.fromEntries(tActual.map((f,i)=>[f,m.fuente_por_fecha?.[i]==='carta_nativa'?'Carta nativa'+(m.corrida_utc?.[i]?' · corrida '+m.corrida_utc[i]:''):m.fuente_por_fecha?.[i]==='open_meteo'?'Open-Meteo · respaldo sin carta para este plazo':null]));
      tActual.forEach((f,i)=>{h.fechas[f]=m.v[i];if(h.plazos)delete h.plazos[f];});mapa.set(m.id,h);}
    const t=[...tiempos].sort(),modelos=[...mapa.values()].map(m=>({...m,v:t.map(f=>m.fechas[f]??null)}));
    const seleccion=seleccionar(t,modelos,obs,orden,limite,ordenes,emision);
    // Todos los miembros, incluso sin pares, y cada plazo con sus propios casos.
    // La selección de diez barras no interviene en esta verificación.
    const miembros=new Map([...modelosActuales,...hist].map(m=>[m.id,m]));
    const metricasPorPlazo=Object.fromEntries(Array.from({length:16},(_,i)=>{
      const plazo=i+1;
      return [plazo,[...miembros.values()].map(m=>{
        const h=hist.find(h=>h.id===m.id),datos=h?.porPlazo?.[plazo]||(plazo===1?h?.fechas:{} )||{};
        const fechas=Object.keys(datos).filter(f=>f<emision&&fin(datos[f])&&fin(obs[f])).sort();
        return {id:m.id,nombre:m.nombre,origen:h?.origen||'Sin pares verificados',desde:fechas[0]||null,hasta:fechas.at(-1)||null,
          ...metricas(fechas.map(f=>datos[f]),fechas.map(f=>obs[f]),lluvia)};
      })];
    }));
    return {t,modelos,seleccion,orden,ordenes,obs,emision,metricas:metricasPorPlazo[1],metricasPorPlazo,hindcast:s.hindcast};
  }

  function barras(datos,colores,unidad,esc=x=>x){
    const tr=[];
    for(const m of datos.modelos){const x=[],y=[],offset=[],width=[],customdata=[];
      datos.t.forEach((f,i)=>{const sel=datos.seleccion[i],j=sel.findIndex(z=>z.id===m.id);if(j<0)return;
        const ancho=864e5*.78/sel.length,centro=Math.floor((sel.length-1)/2);
        const pos=centro+(j%2?Math.ceil(j/2):-j/2);
        x.push(f);y.push(m.v[i]);offset.push(-864e5*.39+pos*ancho+ancho*.05);width.push(ancho*.9);
        customdata.push([esc(sel[j].criterio),sel[j].error==null?'':` · error absoluto ${sel[j].error.toFixed(2)} ${unidad}`,
          sel[j].rango==null?'':` · puesto histórico ${sel[j].rango}`,esc(m.fuentes?.[f]||m.origen)+(m.plazos?.[f]?` · D+${m.plazos[f]}`:'')]);
      });
      if(x.length)tr.push({type:'bar',x,y,name:m.nombre,offset,width,marker:{color:colores[m.id]||colores[m.id.replace(/^NWP_/,'')]||'#8495AB',line:{width:.6,color:colores[m.id]||colores[m.id.replace(/^NWP_/,'')]||'#8495AB'},
        pattern:{shape:m.id.startsWith('NWP_')?'/':m.id==='BC_QM_MONITOR'?'.':m.id==='BC_MONITOR'?'\\':'',solidity:.25,size:5}},
        customdata,hovertemplate:`%{x|%d/%m} · ${esc(m.nombre)} <b>%{y:.2f} ${unidad}</b><br>%{customdata[0]}%{customdata[1]}%{customdata[2]}<br>%{customdata[3]}<extra></extra>`});
    }return tr;
  }
  function detalleDia(datos,fecha,unidad,esc=x=>x){
    const i=datos.t.indexOf(fecha);if(i<0||!datos.seleccion[i].length)return 'Sin pronóstico archivado anterior para este día';
    const sel=datos.seleccion[i],n=datos.modelos.filter(m=>fin(m.v[i])).length;
    return `Se muestran ${sel.length} de ${n} modelos disponibles<br>`+sel.map((z,j)=>{
      const m=datos.modelos.find(m=>m.id===z.id);return `${j+1}. ${esc(m.nombre)}: ${m.v[i].toFixed(1)} ${unidad}`;
    }).join('<br>');
  }
  function popupDia(datos,fecha,unidad,esc=x=>x,colores={}){
    const i=datos.t.indexOf(fecha);if(i<0)return '';
    const sel=datos.seleccion[i]||[],rango=new Map(sel.map((z,j)=>[z.id,j]));
    const plazo=datos.emision?Math.round((Date.parse(fecha)-Date.parse(datos.emision))/864e5):1;
    const orden=datos.ordenes?.[plazo]?.filas.length?datos.ordenes[plazo]:datos.orden;
    const rendimiento=new Map((orden?.filas||sel).map((m,j)=>[m.id,j]));
    const observado=datos.obs[fecha],hay=fin(observado);
    const filas=datos.modelos.filter(m=>permitido(m.id)&&fin(m.v[i])).sort((a,b)=>
      hay?Math.abs(a.v[i]-observado)-Math.abs(b.v[i]-observado)||(rango.get(a.id)??1e6)-(rango.get(b.id)??1e6):
      (rendimiento.get(a.id)??1e6)-(rendimiento.get(b.id)??1e6)||a.nombre.localeCompare(b.nombre));
    const num=v=>v.toLocaleString('es-EC',{minimumFractionDigits:1,maximumFractionDigits:2});
    return `<header><b>${esc(fecha.split('-').reverse().join('/'))}</b><button type="button" data-pron-cerrar aria-label="Cerrar detalle">×</button></header>`+
      `<div class="pron-dia-observado">Observado <strong>${hay?num(observado)+' '+esc(unidad):'NIL'}</strong></div>`+
      `<div class="pron-dia-tabla"><table><thead><tr><th>Modelo</th><th>${esc(unidad)}</th></tr></thead><tbody>`+
      filas.map(m=>`<tr${rango.has(m.id)?' class="pron-dia-visible"':''}><td>${esc(m.nombre)}</td><td>${num(m.v[i])}</td></tr>`).join('')+
      `</tbody></table></div>`;
  }
  return {fin,permitido,esNwpCalibrado,nombreModelo,metricas,historico,ranking,ordenEquilibrado,seleccionar,preparar,barras,detalleDia,popupDia};
});
