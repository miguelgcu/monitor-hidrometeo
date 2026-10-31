/* Encuadre y etiquetas de previsión. No modifica datos ni la serie observada. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.PrevisionGrafico=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const DIA=864e5,fin=v=>typeof v==='number'&&Number.isFinite(v);
  const fecha=v=>v==null?NaN:v instanceof Date?+v:Date.parse(v);
  const iso=t=>new Date(t).toISOString().slice(0,10);
  function fechas(trazas){
    const t=new Set();for(const tr of trazas)tr.y?.forEach((y,i)=>{
      const x=fecha(tr.x[i]);if(fin(y)&&fin(x))t.add(iso(x));
    });return [...t].sort();
  }
  function ventana({emision,fechas,ancho,modo='prevision',offset=0,miembros=10}){
    const e=fecha(emision),a=fecha(fechas[0]||emision),b=fecha(fechas.at(-1)||emision);
    const n=Math.max(4,Math.min(24,Math.floor((ancho-84)/Math.max(60,miembros*5+12))));
    let ini,fin;
    if(modo==='prevision'&&offset===0){ini=Math.max(a,e-5*DIA);fin=b;}else if(modo==='todo'){ini=a;fin=b;}else{
      const origen=modo==='historia'?e-n*DIA:e-Math.min(3,n-2)*DIA;
      ini=Math.max(a,Math.min(origen+offset*DIA,Math.max(a,b-(n-1)*DIA)));
      fin=Math.min(b,ini+(n-1)*DIA);
    }
    return {rango:[new Date(ini-DIA*.5).toISOString(),new Date(fin+DIA*.5).toISOString()],
      inicio:iso(ini),fin:iso(fin),paso:n,anterior:ini>a,siguiente:fin<b,
      // El desplazamiento se calcula desde la ventana efectiva, nunca desde una fecha fuera del archivo.
      offset:(ini-(modo==='historia'?e-n*DIA:e-Math.min(3,n-2)*DIA))/DIA};
  }
  function escala(trazas,rango,lluvia){
    const a=fecha(rango[0]),b=fecha(rango[1]),valores=[];
    for(const tr of trazas)if(tr.visible!==false&&tr.visible!=='legendonly')tr.y?.forEach((y,i)=>{
      const x=fecha(tr.x[i]);if(fin(y)&&x>=a&&x<=b)valores.push(y);
    });
    if(lluvia){
      const hi=valores.some(v=>v>100)?200:100;
      const ticks=[];for(let v=0;v<=hi;v+=20)ticks.push(v);
      return {range:[-hi*.025,hi],autorange:false,fixedrange:true,tickmode:'array',tickvals:ticks,ticktext:ticks.map(String),zeroline:true,zerolinewidth:1.3};
    }
    const minimo=valores.length?Math.min(...valores):0,maximo=valores.length?Math.max(...valores):1;
    const amplitud=lluvia?Math.max(1,maximo):Math.max(2,maximo-minimo);
    const bajo=lluvia?0:minimo-amplitud*.14,alto=lluvia?Math.max(1,maximo+amplitud*.16):maximo+amplitud*.16;
    const bruto=Math.max(1e-6,(alto-bajo)/6),base=10**Math.floor(Math.log10(bruto));
    const paso=[1,2,2.5,5,10].reduce((a,b)=>Math.abs(b*base-bruto)<Math.abs(a*base-bruto)?b:a)*base;
    const lo=bajo,hi=alto;
    const ticks=[];for(let t=Math.ceil(lo/paso)*paso;t<=hi+paso*.001;t+=paso)ticks.push(+t.toPrecision(10));
    // Aire bajo el cero para que punto, barra de altura cero y etiqueta sean visibles.
    return {range:[lluvia?-Math.max(hi*.045,.045):lo,hi],autorange:false,fixedrange:false,
      tickmode:'array',tickvals:ticks,ticktext:ticks.map(t=>t.toLocaleString('es-EC',{maximumFractionDigits:4})),
      zeroline:true,zerolinewidth:1.3};
  }
  // Una flecha conserva visible el valor real cuando supera el límite solicitado.
  function excesos(trazas,rango){
    const a=fecha(rango[0]),b=fecha(rango[1]),dias=new Map();
    for(const tr of trazas)if(tr.visible!==false&&tr.visible!=='legendonly')tr.y?.forEach((y,i)=>{
      const x=fecha(tr.x[i]);if(!fin(y)||y<=200||x<a||x>b)return;
      const f=iso(x),anterior=dias.get(f);if(!anterior||y>anterior.y)dias.set(f,{x:tr.x[i],y,nombre:tr.name||''});
    });
    return [...dias.values()].map(v=>({name:'exceso-lluvia',x:v.x,xref:'x',y:200,yref:'y',yanchor:'top',showarrow:false,
      text:'↑ '+v.y.toLocaleString('es-EC',{maximumFractionDigits:1}),
      hovertext:v.nombre+': '+v.y.toLocaleString('es-EC')+' mm · supera el eje de 200 mm',font:{size:10}}));
  }
  function etiquetas(valores){
    return valores.map(v=>fin(v)?v===0?'0':v.toLocaleString('es-EC',{minimumFractionDigits:1,maximumFractionDigits:1}):'');
  }
  function posiciones(valores,techo){
    return valores.map((y,i)=>fin(y)&&((fin(techo)&&y>=techo*.9)||(y>15&&fin(valores[i-1])&&fin(valores[i+1])&&y<valores[i-1]&&y<valores[i+1]))?'bottom center':'top center');
  }
  function contexto(estado,clave){
    if(estado.clave!==clave)Object.assign(estado,{clave,modo:'prevision',offset:0,rango:null});
    return estado;
  }
  return {fechas,ventana,escala,excesos,etiquetas,posiciones,contexto};
});
