/* Proyecto meteorológico: preparar primero, descargar mediante un enlace nativo. */
async function resolverDescargaAlertas(d){
  if(window.MONITOR_ESTATICO||location.protocol!=='http:')return d;
  // Algunos navegadores dejan pendientes las descargas HTTP de la red local.
  // Usar HTTPS solo si el nombre firmado coincide con el archivo recién creado.
  const publico='https://miguelgcu.github.io/monitor-hidrometeo/';
  try{
    const r=await fetch(publico+'datos/proyectos_alertas/indice.json?v='+Date.now(),
      {cache:'no-store',signal:AbortSignal.timeout(4000)});
    if(!r.ok)return d;
    const indice=await r.json(),nombre=d.url.split('/').pop();
    const copia=indice.proyectos?.find(p=>p.url==='datos/proyectos_alertas/'+nombre);
    if(copia){
      const pagina=await fetch(publico+'descarga_qgis.html',{method:'HEAD',cache:'no-store',signal:AbortSignal.timeout(4000)});
      if(pagina.ok)return {...d,url:publico+'descarga_qgis.html?archivo='+nombre,externa:true};
    }
  }catch(_){}
  return d;
}

const QGIS_PREPARADOS=new Map();
async function abrirDescargaAlertas(){
  const anterior=document.querySelector('#alertas-descarga');
  if(anterior){anterior.close();anterior.remove();}
  const foco=document.activeElement,dialog=document.createElement('dialog'),vida=new AbortController();
  dialog.id='alertas-descarga';dialog.className='alertas-descarga';
  dialog.setAttribute('aria-labelledby','alertas-descarga-titulo');
  dialog.innerHTML='<header><img src="icons/qgis.png" width="28" height="28" alt=""><div><b id="alertas-descarga-titulo">Exportar alertas</b><small>Proyecto QGIS editable</small></div><button type="button" data-cerrar aria-label="Cerrar descarga"><span class="ui-icon" aria-hidden="true" style="--icono:url(icons/tabler/x.svg)"></span></button></header>'+
    '<div class="alertas-cuerpo"><fieldset class="alertas-periodo"><legend>Período <span data-dias></span></legend><div class="alertas-fechas"><label>Desde<select name="desde" aria-label="Desde" disabled></select></label><label>Hasta<select name="hasta" aria-label="Hasta" disabled></select></label></div></fieldset>'+
    '<fieldset class="alertas-territorio"><legend>Área</legend><details><summary><span data-area>Todo el país</span><small data-conteo></small></summary><div class="alertas-busqueda"><input type="search" aria-label="Buscar provincia" placeholder="Buscar provincia…" autocomplete="off"><button type="button" data-limpiar>Limpiar</button></div><label class="alertas-todas"><input type="checkbox" name="pais" checked> Todo el país</label><div class="alertas-provincias"></div><small class="alertas-sin-resultados" hidden>Sin coincidencias</small></details></fieldset>'+
    '<fieldset class="alertas-limites"><legend>Límites políticos <small>Negro · 1 pt</small></legend><label><input type="checkbox" name="limites" aria-label="Límites provinciales" checked> Provincias</label><label><input type="checkbox" name="cantones" aria-label="Añadir cantones"> Cantones</label></fieldset></div>'+
    '<footer><p class="alertas-incluye">Lluvia · T. máxima · T. mínima <span>Mapas diarios y general</span></p><a class="alertas-bajar" role="button" aria-disabled="true" tabindex="-1">Preparando proyecto…</a><p class="alertas-estado" role="status" aria-live="polite"></p><button class="alertas-reintentar" type="button" hidden>Reintentar</button></footer>';
  let revision=0,descargaBase=null,preparacion=null,temporizador=null,indiceVersion='',manifest=null;
  const selects=[...dialog.querySelectorAll('select')],estado=dialog.querySelector('[role=status]');
  const enlace=dialog.querySelector('.alertas-bajar'),reintentar=dialog.querySelector('.alertas-reintentar');
  const pais=dialog.querySelector('[name=pais]'),provincias=dialog.querySelector('.alertas-provincias');
  const buscador=dialog.querySelector('[type=search]'),detalle=dialog.querySelector('details');
  const plegar=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const elegidas=()=>[...provincias.querySelectorAll('input:checked')];
  const desactivar=texto=>{enlace.removeAttribute('href');enlace.setAttribute('aria-disabled','true');enlace.tabIndex=-1;enlace.textContent=texto;};
  const actualizar=()=>{
    const lista=elegidas(),total=provincias.children.length;
    pais.checked=!!total&&lista.length===total;pais.indeterminate=lista.length>0&&!pais.checked;
    dialog.querySelector('[data-area]').textContent=pais.checked?'Todo el país':lista.length===0?'Selecciona provincias':lista.length<=2?lista.map(c=>c.dataset.nombre).join(', '):'Selección de provincias';
    dialog.querySelector('[data-conteo]').textContent=lista.length===1?'1 provincia':lista.length+' provincias';
    const dias=Math.round((Date.parse(selects[1].value)-Date.parse(selects[0].value))/86400000)+1;
    dialog.querySelector('[data-dias]').textContent=dias>0?(dias===1?'1 día':dias+' días'):'';
    if(!lista.length){desactivar('Selecciona una provincia');return;}
    if(!descargaBase)return;
    const url=descargaBase.externa?new URL(descargaBase.url):new URL('descarga_qgis.html',location.href);
    if(!descargaBase.externa){url.searchParams.set('archivo',descargaBase.url.split('/').pop());if(!window.MONITOR_ESTATICO)url.searchParams.set('local','1');}
    if(!pais.checked)url.searchParams.set('provincias',lista.map(c=>c.value).join(','));
    url.searchParams.set('limites',dialog.querySelector('[name=limites]').checked?'1':'0');
    url.searchParams.set('cantones',dialog.querySelector('[name=cantones]').checked?'1':'0');
    url.searchParams.set('tema',document.documentElement.dataset.tema||'claro');
    enlace.href=url.href;enlace.target='_blank';enlace.rel='noopener';enlace.tabIndex=0;
    enlace.setAttribute('aria-disabled','false');enlace.textContent='Descargar proyecto';
  };
  const pedir=async(url,signal=vida.signal)=>{
    const r=await fetch(url,{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(125000)])});
    if(!(r.headers.get('Content-Type')||'').includes('application/json'))throw Error('No se pudo consultar esta descarga. Intenta de nuevo.');
    const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo preparar el proyecto.');return d;
  };
  const preparar=async()=>{
    clearTimeout(temporizador);preparacion?.abort();preparacion=new AbortController();
    const rev=++revision;descargaBase=null;reintentar.hidden=true;desactivar('Preparando proyecto…');estado.textContent='';actualizar();
    const clave=indiceVersion+'|'+selects[0].value+'|'+selects[1].value;
    try{
      let descarga=QGIS_PREPARADOS.get(clave);
      if(!descarga||Date.now()-descarga.t>30000){
        const desde=selects[0].value,hasta=selects[1].value;
        const respuesta=window.MONITOR_ESTATICO?(manifest||=await pedir('datos/proyectos_alertas/indice.json',preparacion.signal)):
          await pedir('api/alertas/proyecto?'+new URLSearchParams({desde,hasta}),preparacion.signal);
        const d=window.MONITOR_ESTATICO?respuesta.proyectos?.find(p=>p.desde===desde&&p.hasta===hasta):respuesta;
        if(!d)throw Error('Este período todavía no está publicado.');
        if(!/^(?:\/?api\/alertas\/archivo|datos\/proyectos_alertas)\/alertas_[\d-]+_[\d-]+_[a-f0-9]{24}\.zip$/.test(d.url))throw Error('La descarga recibida no es válida.');
        descarga={...await resolverDescargaAlertas(d),t:Date.now()};
        if(QGIS_PREPARADOS.size>28)QGIS_PREPARADOS.clear();QGIS_PREPARADOS.set(clave,descarga);
      }
      if(rev!==revision||!dialog.open)return;
      descargaBase=descarga;actualizar();
    }catch(e){if(rev!==revision||!dialog.open||e.name==='AbortError')return;desactivar('Proyecto no disponible');estado.textContent=e.message;reintentar.hidden=false;}
  };
  const programar=()=>{revision++;preparacion?.abort();descargaBase=null;desactivar('Preparando proyecto…');actualizar();clearTimeout(temporizador);temporizador=setTimeout(preparar,220);};
  const seleccionarTodas=valor=>{provincias.querySelectorAll('input').forEach(c=>c.checked=valor);actualizar();};
  pais.onchange=()=>seleccionarTodas(pais.checked);
  provincias.onchange=actualizar;
  dialog.querySelector('[data-limpiar]').onclick=()=>{seleccionarTodas(false);buscador.focus();};
  buscador.oninput=()=>{let visibles=0;for(const l of provincias.children){l.hidden=!plegar(l.textContent).includes(plegar(buscador.value.trim()));if(!l.hidden)visibles++;}dialog.querySelector('.alertas-sin-resultados').hidden=visibles>0;};
  dialog.querySelectorAll('.alertas-limites input').forEach(c=>c.onchange=actualizar);
  enlace.onclick=e=>{if(enlace.getAttribute('aria-disabled')==='true'){e.preventDefault();if(!elegidas().length){detalle.open=true;buscador.focus();}return;}estado.textContent='La descarga se prepara en otra pestaña.';};
  enlace.onkeydown=e=>{if(e.key===' '){e.preventDefault();enlace.click();}};
  dialog.querySelector('[data-cerrar]').onclick=()=>dialog.close();
  dialog.addEventListener('click',ev=>{if(ev.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{revision++;clearTimeout(temporizador);vida.abort();preparacion?.abort();dialog.remove();if(foco?.isConnected)foco.focus();});
  document.body.appendChild(dialog);dialog.showModal();
  const cargar=async()=>{
    try{
      reintentar.hidden=true;desactivar('Consultando fechas…');
      const [indice,catalogo]=await Promise.all([pedir('datos/productos/alertas.json'),pedir('provincias_alertas.json')]);
      if(!dialog.open)return;indiceVersion=indice.generado||'';
      provincias.replaceChildren();
      for(const p of catalogo.provincias){const l=document.createElement('label'),c=document.createElement('input');c.type='checkbox';c.value=p.codigo;c.dataset.nombre=p.nombre;c.checked=true;l.append(c,document.createTextNode(p.nombre));provincias.append(l);}
      const listas=['lluvia','tmax','tmin'].map(k=>(indice.productos?.find(p=>p.clave===k)?.items||[]).map(d=>d.fecha));
      const dias=listas[0].filter(d=>listas.every(l=>l.includes(d))).sort();
      if(!dias.length)throw Error('No hay fechas comunes para lluvia y temperaturas.');
      const formato=new Intl.DateTimeFormat('es-EC',{day:'2-digit',month:'short',timeZone:'UTC'});
      selects.forEach(s=>{s.replaceChildren();dias.forEach(d=>s.add(new Option(formato.format(new Date(d+'T12:00:00Z')),d)));s.disabled=false;});
      const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      selects.forEach(s=>s.value=dias.find(d=>d>=hoy)||dias.at(-1));
      const ordenarFechas=()=>{for(const o of selects[1].options)o.disabled=o.value<selects[0].value;if(selects[1].value<selects[0].value)selects[1].value=selects[0].value;};
      ordenarFechas();selects[0].onchange=()=>{ordenarFechas();programar();};selects[1].onchange=programar;
      reintentar.onclick=preparar;await preparar();
    }catch(e){if(!dialog.open||e.name==='AbortError')return;desactivar('Proyecto no disponible');estado.textContent=e.message;reintentar.hidden=false;reintentar.onclick=cargar;}
  };
  await cargar();
}
