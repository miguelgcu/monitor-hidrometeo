/* Comparativa independiente del Monitor: barras por modelo y observaciones como serie. */
"use strict";

(() => {
  if (window.Comparativa) return;
  const esc = v => String(v ?? "").replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fin = v => v !== null && v !== undefined && Number.isFinite(+v);
  const num = (v, nd = 1) => fin(v)
    ? (+v).toLocaleString("es-EC", { minimumFractionDigits: nd, maximumFractionDigits: nd }) : "—";

  const SERIES = [
    ["precipitacion_mm|suma", "Lluvia"],
    ["temp_aire_c|max", "T. máx."],
    ["temp_aire_c|min", "T. mín."],
  ];
  // Filtros de miembros independientes.
  const VISTAS = [
    { id: "todo", rotulo: "Mejores 10 · automático", grupos: null },
    { id: "todos", rotulo: "Todos los modelos", grupos: null },
    { id: "corregidos", rotulo: "Observado + corregidos", grupos: ["corregido"] },
    { id: "numericos", rotulo: "Numéricos", grupos: ["numerico"] },
    { id: "ml", rotulo: "ML", grupos: ["ml"] },
  ];
  const COLOR = {
    ecmwf_ifs025: "#4E79A7", ecmwf_aifs025_single: "#17BECF", gfs_seamless: "#F28E2B",
    icon_seamless: "#59A14F", ML_ridge: "#E15759", ML_xgboost: "#B07AA1", ML_lightgbm: "#EDC948",
    ML_extra_trees: "#9C755F", ML_random_forest: "#FF9DA7", ML_hist_gbt: "#BCBD22",
    ML_knn: "#BAB0AC", ML_mlp: "#8E6BD9",
  };
  const CLAVE_LS = "monitor-comparativa-v2";
  const E = { codigo: null, serie: SERIES[0][0], pestana: "serie", vista: "todo",
              ocultos: new Set(), abierto: false, datos: null, ventana:{modo:'prevision',offset:0} };
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_LS) || "null");
    if (g && VISTAS.some(v => v.id === g.vista)) E.vista = g.vista;
    if (g && Array.isArray(g.ocultos)) E.ocultos = new Set(g.ocultos);
  } catch (e) { /* sin almacenamiento */ }
  const guardar = () => {
    try { localStorage.setItem(CLAVE_LS, JSON.stringify({ vista: E.vista, ocultos: [...E.ocultos] })); }
    catch (e) { /* sin almacenamiento */ }
  };

  /* ---------------- estilo ---------------- */
  const CSS = `
#cmp-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(1120px,calc(100vw - 24px));height:min(820px,calc(100dvh - 32px));border-radius:14px;overflow:hidden;resize:both;min-width:300px;min-height:380px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);z-index:5000;
  background:var(--fondo,#fff);color:var(--tinta,#12181F);border-left:1px solid var(--linea,#DDE1E8);
  box-shadow:-8px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;
  font-family:var(--sans,system-ui,sans-serif);font-size:12px}
#cmp-panel[hidden]{display:none}
#cmp-panel .cmp-cab{display:flex;align-items:center;gap:8px;padding:10px 12px 6px;cursor:move;touch-action:none}
#cmp-panel .cmp-tit{flex:1 1 auto;min-width:0}
#cmp-panel .cmp-tit b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cmp-panel .cmp-tit span{color:var(--tinta3,#8A94A6);font-size:11px}
#cmp-panel .cmp-cerrar{appearance:none;border:1px solid var(--linea,#DDE1E8);background:var(--fondo,#fff);
  color:var(--tinta2,#4A5568);width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:16px;line-height:1}
#cmp-panel .cmp-fila{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:4px 12px 8px;
  overflow-x:auto;scrollbar-width:thin;border-bottom:1px solid var(--linea,#DDE1E8)}
#cmp-panel .cmp-seg{display:inline-flex;flex:0 0 auto;border:1px solid var(--linea,#DDE1E8);border-radius:99px;overflow:hidden}
#cmp-panel .cmp-seg button,#cmp-panel .cmp-btn{appearance:none;border:0;background:var(--fondo,#fff);
  color:var(--tinta3,#8A94A6);font:inherit;font-size:11px;font-weight:700;padding:3px 8px;cursor:pointer;white-space:nowrap}
#cmp-panel .cmp-seg button+button{border-left:1px solid var(--linea,#DDE1E8)}
#cmp-panel .cmp-seg button[aria-pressed="true"]{background:var(--acento-fondo,#E8F1F9);color:var(--acento,#0B5FA5)}
#cmp-panel .cmp-seg button:disabled{opacity:.38;cursor:not-allowed}
#cmp-panel select.cmp-vista{flex:0 0 auto;font:inherit;font-size:11px;font-weight:700;color:var(--tinta2,#4A5568);
  background:var(--fondo,#fff);border:1px solid var(--linea,#DDE1E8);border-radius:99px;padding:2px 6px}
#cmp-panel .cmp-btn{border:1px solid var(--linea,#DDE1E8);border-radius:99px;flex:0 0 auto}
#cmp-panel .cmp-btn[aria-expanded="true"]{background:var(--acento-fondo,#E8F1F9);color:var(--acento,#0B5FA5);border-color:var(--acento,#0B5FA5)}
#cmp-panel .cmp-cuerpo{flex:1 1 auto;min-height:0;overflow:auto;padding:8px 12px 14px;position:relative}
#cmp-panel .cmp-graf{width:100%;height:clamp(280px,56vh,480px)}
#cmp-panel .cmp-nota{color:var(--tinta3,#8A94A6);font-size:11px;line-height:1.45;margin:6px 0 0}
#cmp-panel .cmp-vacio{color:var(--tinta3,#8A94A6);padding:30px 6px;text-align:center;line-height:1.5}
#cmp-panel .cmp-miembros{position:absolute;right:12px;top:6px;z-index:2;background:var(--fondo,#fff);
  border:1px solid var(--linea,#DDE1E8);border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.16);
  padding:8px 10px;max-height:60vh;overflow:auto;min-width:200px}
#cmp-panel .cmp-miembros label{display:flex;align-items:center;gap:6px;padding:2px 0;cursor:pointer;white-space:nowrap}
#cmp-panel .cmp-miembros i{display:inline-block;width:10px;height:10px;border-radius:2px;flex:0 0 auto}
#cmp-panel .cmp-miembros .cmp-acc{display:flex;gap:6px;margin-top:6px}
#cmp-panel h3{font-size:12px;margin:12px 0 4px;color:var(--tinta2,#4A5568)}
#cmp-panel .cmp-tabla{overflow-x:auto}
#cmp-panel table{border-collapse:collapse;width:100%;font-size:11px;font-variant-numeric:tabular-nums}
#cmp-panel th,#cmp-panel td{padding:3px 6px;border-bottom:1px solid var(--linea,#DDE1E8);text-align:right;white-space:nowrap}
#cmp-panel th:first-child,#cmp-panel td:first-child{text-align:left}
#cmp-panel th{color:var(--tinta3,#8A94A6);font-weight:700}
#cmp-panel tr.cmp-mejor td{font-weight:700;color:var(--acento,#0B5FA5)}
.cmp-abrir{appearance:none;border:1px solid var(--linea,#DDE1E8);background:var(--fondo,#fff);color:var(--acento,#0B5FA5);
  font:inherit;font-size:11px;font-weight:700;padding:2px 9px;border-radius:99px;cursor:pointer;margin-left:auto;white-space:nowrap}
.cmp-abrir:focus-visible,#cmp-panel button:focus-visible,#cmp-panel select:focus-visible{outline:2px solid var(--acento,#0B5FA5);outline-offset:1px}
@media (max-width:600px){#cmp-panel .cmp-graf{height:340px}}
`;
  function ponerEstilo() {
    if (document.getElementById("cmp-estilo")) return;
    const s = document.createElement("style");
    s.id = "cmp-estilo";
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const tema = (n, r) => (getComputedStyle(document.documentElement).getPropertyValue(n) || "").trim() || r;
  const esOscuro = () => {
    const t = document.documentElement.getAttribute("data-tema");
    if (t === "oscuro") return true;
    if (t === "claro") return false;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  };

  /* ---------------- datos ---------------- */
  async function cargar() {
    if (typeof cargarPronMeteo === "function") {
      E.datos = await cargarPronMeteo();
    } else {
      const r = await fetch("api/pronostico-meteo", { cache: "no-store" });
      E.datos = await r.json();
    }
    return E.datos;
  }

  function curvas(d,s){
    const lista=(s.modelos||[]).filter(m=>MeteoComparacion.permitido(m.id)&&!m.alias_de)
      .map(m=>({...m,clave:m.id,grupo:/^ML_/.test(m.id)?'ml':'corregido'}));
    for(const m of s.crudos||[])if(MeteoComparacion.permitido(m.id))
      lista.push({...m,id:'NWP_'+m.id,clave:'NWP_'+m.id,nombre:m.nombre+' crudo',grupo:'numerico'});
    return {t:s.pron?.t||[],lista};
  }
  const enVista = c => {
    const v = VISTAS.find(x => x.id === E.vista);
    if (!v.grupos) return true;
    return v.grupos.includes(c.grupo);
  };
  const visible = c => enVista(c) && !E.ocultos.has(c.clave);

  /* ---------------- panel ---------------- */
  let panel = null, ultimoFoco = null;
  function crearPanel() {
    if (panel) return panel;
    ponerEstilo();
    panel = document.createElement("aside");
    panel.id = "cmp-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Comparativa de modelos");
    panel.innerHTML = `
      <div class="cmp-cab">
        <div class="cmp-tit"><b id="cmp-nombre"></b><span id="cmp-sub"></span></div>
        <button class="cmp-cerrar" type="button" aria-label="Cerrar la comparativa">×</button>
      </div>
      <div class="cmp-fila" role="toolbar" aria-label="Controles de la comparativa">
        <span class="cmp-seg" id="cmp-series"></span>
        <span class="cmp-seg" id="cmp-pestanas">
          <button type="button" data-pestana="serie">Serie</button>
          <button type="button" data-pestana="validacion">Validación</button>
        </span>
        <select class="cmp-vista" id="cmp-vista" aria-label="Qué modelos se ven">
          ${VISTAS.map(v => `<option value="${v.id}">${esc(v.rotulo)}</option>`).join("")}
        </select>
        <button type="button" class="cmp-btn" id="cmp-miembros-btn" aria-expanded="false">Miembros</button>
      </div>
      <div class="cmp-cuerpo" id="cmp-cuerpo"></div>`;
    document.body.appendChild(panel);
    panel.querySelector(".cmp-cerrar").onclick = cerrar;
    panel.querySelectorAll("[data-pestana]").forEach(b => b.onclick = () => {
      E.pestana = b.dataset.pestana; pintar();
    });
    panel.querySelector("#cmp-vista").onchange = ev => { E.vista = ev.target.value; guardar(); pintar(); };
    panel.querySelector("#cmp-miembros-btn").onclick = alternarMiembros;
    panel.addEventListener("keydown", ev => { if (ev.key === "Escape") cerrar(); });
    ventanaArrastrable(panel,panel.querySelector('.cmp-cab'));
    return panel;
  }

  async function abrir(codigo) {
    if (!codigo) return;
    crearPanel();
    ultimoFoco = document.activeElement;
    const apertura=E.apertura=(E.apertura||0)+1;
    E.codigo = codigo;
    E.abierto = true;
    panel.hidden = false;
    document.getElementById("cmp-cuerpo").innerHTML = `<div class="cmp-vacio">Cargando…</div>`;
    try { await cargar(); } catch (e) { E.datos = { puntos: {} }; }
    const historial=typeof cargarHistMeteo==='function'?await cargarHistMeteo(codigo):null;
    if(apertura!==E.apertura||!E.abierto)return;
    E.historial=historial;
    const pt = (E.datos.puntos || {})[codigo];
    if (pt && !(pt.series || {})[E.serie]) {
      const otra = SERIES.find(([k]) => (pt.series || {})[k]);
      if (otra) E.serie = otra[0];
    }
    pintar();
    panel.querySelector(".cmp-cerrar").focus();
  }
  function cerrar() {
    if (!panel) return;
    E.abierto = false;
    panel.hidden = true;
    const g = document.getElementById("cmp-graf");
    if(g?._observador)g._observador.disconnect();
    if (g && window.Plotly) Plotly.purge(g);
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  function pintar() {
    if (!panel || !E.abierto) return;
    const d = E.datos || {};
    const pt = (d.puntos || {})[E.codigo];
    document.getElementById("cmp-nombre").textContent = pt ? `${pt.nombre || E.codigo}` : E.codigo;
    document.getElementById("cmp-sub").textContent = `${E.codigo}${d.emision ? " · emisión " + d.emision.split("-").reverse().join("/") : ""}`;
    const series = document.getElementById("cmp-series");
    series.innerHTML = SERIES.map(([k, r]) => `<button type="button" data-serie="${k}"
      aria-pressed="${E.serie === k}" ${pt && (pt.series || {})[k] ? "" : "disabled"}>${esc(r)}</button>`).join("");
    series.querySelectorAll("button").forEach(b => b.onclick = () => { E.serie = b.dataset.serie; pintar(); });
    panel.querySelectorAll("[data-pestana]").forEach(b => b.setAttribute("aria-pressed", E.pestana === b.dataset.pestana));
    document.getElementById("cmp-vista").value = E.vista;
    document.getElementById("cmp-vista").disabled = E.pestana !== "serie";
    const cuerpo = document.getElementById("cmp-cuerpo");
    const anterior=document.getElementById('cmp-graf');
    if(anterior?._observador)anterior._observador.disconnect();
    if(anterior&&window.Plotly)Plotly.purge(anterior);
    const s = pt && (pt.series || {})[E.serie];
    const btnM = document.getElementById("cmp-miembros-btn");
    if (!s) {
      btnM.textContent = "Miembros";
      btnM.disabled = true;
      cuerpo.innerHTML = `<div class="cmp-vacio">Sin pronóstico de ${esc((SERIES.find(x => x[0] === E.serie) || [, ""])[1].toLowerCase())} para esta estación.</div>`;
      return;
    }
    const { lista } = curvas(d, s);
    const enV = lista.filter(c => enVista(c) && c.grupo !== "combinado");
    btnM.disabled = E.pestana !== "serie";
    btnM.textContent = `Miembros (${enV.filter(c => !E.ocultos.has(c.clave)).length})`;
    if (E.pestana === "validacion") return pintarValidacion(cuerpo, s);
    pintarSerie(cuerpo, d, s);
  }

  function alternarMiembros() {
    const cuerpo = document.getElementById("cmp-cuerpo");
    const abierto = cuerpo.querySelector(".cmp-miembros");
    const btn = document.getElementById("cmp-miembros-btn");
    if (abierto) { abierto.remove(); btn.setAttribute("aria-expanded", "false"); return; }
    const pt = (E.datos.puntos || {})[E.codigo];
    const s = pt && pt.series[E.serie];
    if (!s) return;
    const { lista } = curvas(E.datos, s);
    const cand = lista.filter(c => enVista(c) && c.grupo !== "combinado");
    const caja = document.createElement("div");
    caja.className = "cmp-miembros";
    caja.innerHTML = cand.length ? cand.map(c => `<label><input type="checkbox" data-clave="${esc(c.clave)}"
        ${E.ocultos.has(c.clave) ? "" : "checked"}><i style="background:${colorDe(c)}"></i>${esc(c.nombre)}</label>`).join("")
      + `<div class="cmp-acc"><button type="button" class="cmp-btn" data-todos="1">Todos</button>
         <button type="button" class="cmp-btn" data-todos="0">Ninguno</button></div>`
      : `<span class="cmp-nota">No hay miembros en esta vista.</span>`;
    caja.addEventListener("change", ev => {
      const k = ev.target.dataset.clave;
      if (!k) return;
      if (ev.target.checked) E.ocultos.delete(k); else E.ocultos.add(k);
      guardar(); redibujar();
    });
    caja.querySelectorAll("[data-todos]").forEach(b => b.onclick = () => {
      cand.forEach(c => b.dataset.todos === "1" ? E.ocultos.delete(c.clave) : E.ocultos.add(c.clave));
      caja.querySelectorAll("input").forEach(i => i.checked = b.dataset.todos === "1");
      guardar(); redibujar();
    });
    cuerpo.prepend(caja);
    btn.setAttribute("aria-expanded", "true");
  }
  // redibuja la serie sin cerrar la lista de miembros
  function redibujar() {
    const caja = document.querySelector("#cmp-cuerpo .cmp-miembros");
    const pt = (E.datos.puntos || {})[E.codigo];
    const s = pt && pt.series[E.serie];
    if (!s) return;
    const { lista } = curvas(E.datos, s);
    document.getElementById("cmp-miembros-btn").textContent =
      `Miembros (${lista.filter(c => enVista(c) && c.grupo !== "combinado" && !E.ocultos.has(c.clave)).length})`;
    dibujar(document.getElementById("cmp-graf"), E.datos, s);
    if (caja) document.getElementById("cmp-cuerpo").prepend(caja);
  }

  const colorDe=c=>(typeof COLOR_MODELO==='object'?COLOR_MODELO[c.id]||COLOR_MODELO[c.id.replace(/^NWP_/,'')]:null)||COLOR[c.id.replace(/^NWP_/,'')]||'#8495AB';
  function datosVista(d,s,filtrar=true){
    s=serieMeteoViva(s,E.codigo,E.serie);
    const {t,lista}=curvas(d,s),miembros=filtrar?lista.filter(visible):lista;
    const ids=new Set(miembros.map(m=>m.id));
    const hs=E.historial?.series?.[E.serie]?.emisiones||E.historial?.series?.[E.serie]||{};
    return MeteoComparacion.preparar(s,hs,s.emision_motor||d.emision,E.serie.startsWith('precipitacion'),miembros,t,filtrar?ids:null,filtrar&&E.vista==='todos'?Infinity:10);
  }
  function pintarSerie(cuerpo,d,s){
    cuerpo.innerHTML='<div id="cmp-navega" class="meteo-navega"></div><div id="cmp-graf" class="cmp-graf" role="img" aria-label="Modelos en barras y observaciones en puntos y líneas"></div><div id="cmp-leyenda" class="meteo-leyenda"></div><p class="cmp-nota">Selección automática: diez modelos más cercanos a cada observación; para el futuro, los diez de mejor desempeño histórico D+1. Todos los miembros se conservan y pueden verse en «Todos los modelos». Las métricas incluyen todos los casos. Los valores observados llevan etiquetas; los modelos crudos, barras rayadas.</p>';
    dibujar(document.getElementById('cmp-graf'),d,s);
  }
  function dibujar(gd,d,s){
    if(!gd)return;if(!window.Plotly){setTimeout(()=>dibujar(gd,d,s),200);return;}
    s=serieMeteoViva(s,E.codigo,E.serie);
    const lluvia=E.serie.startsWith('precipitacion'),unidad=lluvia?'mm':'°C',v=datosVista(d,s);
    const tinta=tema('--tinta','#12181F'),linea=tema('--linea','#DDE1E8'),fondo=tema('--fondo','#FFFFFF');
    const colores=Object.fromEntries(v.modelos.map(m=>[m.id,colorDe(m)]));
    const tr=MeteoComparacion.barras(v,colores,unidad,esc),o=s.obs||{t:[],v:[]};
    const sx=[],sy=[];
    o.t.forEach((f,i)=>{if(i&&Date.parse(f)-Date.parse(o.t[i-1])>864e5){sx.push(null);sy.push(null);}sx.push(f);sy.push(o.v[i]);});
    tr.push({type:'scatter',mode:'lines+markers+text',x:sx,y:sy,name:'Observado',connectgaps:false,
      line:{color:tinta,width:2.6},marker:{size:6,color:tinta,line:{color:fondo,width:1}},
      text:PrevisionGrafico.etiquetas(sy),textposition:posicionEtiquetasMeteo(sy),textfont:{size:11,color:tinta},cliponaxis:true,
      customdata:sx.map(f=>MeteoComparacion.detalleDia(v,f,unidad,esc)),
      hovertemplate:`%{x|%d/%m} · Observado <b>%{y:.2f} ${unidad}</b><br>%{customdata}<extra></extra>`});
    const emision=s.emision_motor||d.emision;
    const [desde,hasta]=encuadreMeteo(E.ventana,`${E.codigo}|${E.serie}|${emision}`,emision,tr,gd.clientWidth);
    navegarMeteo(document.getElementById('cmp-navega'),E.ventana,()=>dibujar(gd,d,s));
    document.getElementById('cmp-leyenda').innerHTML=leyendaModelosMeteo(tr,tinta);
    Plotly.react(gd,tr,{paper_bgcolor:fondo,plot_bgcolor:fondo,separators:',.',font:{size:11,color:tinta},
      margin:{l:52,r:20,t:34,b:40},showlegend:false,barmode:'overlay',hovermode:'closest',dragmode:'pan',
      hoverlabel:{bgcolor:fondo,bordercolor:linea,font:{color:tinta}},
      xaxis:{type:'date',range:[desde,hasta],tickformat:'%d/%m',nticks:Math.max(4,Math.floor(gd.clientWidth/70)),gridcolor:linea},
      yaxis:{title:{text:unidad},gridcolor:linea,zerolinecolor:linea,...ejeMeteo(tr,[desde,hasta],lluvia)},
      shapes:[{type:'line',xref:'x',yref:'paper',x0:emision,x1:emision,y0:0,y1:1,line:{color:tinta,width:1,dash:'dot'}}],
      annotations:[{x:emision,y:1,xref:'x',yref:'paper',text:'emisión',showarrow:false,yanchor:'bottom',font:{size:10}}]
    },{responsive:true,displayModeBar:true,displaylogo:false,modeBarButtonsToRemove:['select2d','lasso2d']}).then(()=>seguirVentanaMeteo(gd,tr,lluvia,E.ventana));
  }
  function pintarValidacion(cuerpo,s){
    const lluvia=E.serie.startsWith('precipitacion');
    cuerpo.innerHTML=metricasComparacionHTML(datosVista(E.datos,s,false),lluvia,lluvia?'mm':'°C')
      +metricasPorPlazoHTML(s.metricas,lluvia,lluvia?'mm':'°C');
  }

  /* ---------------- tema ---------------- */
  new MutationObserver(() => { if (E.abierto) pintar(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(() => { if (E.abierto) pintar(); });
  }

  /* ---------------- botón en el panel del gráfico ----------------
     Va en la fila de la emisión del pronóstico meteorológico (#pron-emi),
     que el visor rehace en cada dibujo: se vuelve a poner cada vez. */
  function ponerBoton() {
    return; // La tabla y la leyenda ya están en el panel; no añadir un botón duplicado.
    const fila = document.getElementById("pron-emi");
    if (!fila || fila.querySelector(".cmp-abrir")) return;
    ponerEstilo();
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cmp-abrir";
    b.textContent = "Comparar modelos";
    b.title = "Abre la comparativa flotante y su validación en esta estación";
    b.onclick = () => {
      const sel = (typeof M !== "undefined" && M && M.sel) || null;
      const vista = (typeof M !== "undefined" && M && M.vista) || "";
      const clave = vista.startsWith("meteo:") ? vista.slice(6) : null;
      if (clave && SERIES.some(([k]) => k === clave)) E.serie = clave;
      abrir(sel);
    };
    fila.appendChild(b);
  }
  function vigilar() {
    const raiz = document.getElementById("serie") || document.body;
    new MutationObserver(ponerBoton).observe(raiz, { childList: true, subtree: true });
    ponerBoton();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", vigilar);
  else vigilar();

  window.addEventListener('monitor-observaciones',async()=>{
    if(!E.abierto||E.refrescando)return;E.refrescando=true;const codigo=E.codigo;
    try{await cargar();const h=await cargarHistMeteo(codigo);
      if(E.abierto&&E.codigo===codigo){E.historial=h;pintar();}}
    finally{E.refrescando=false;}
  });
  window.Comparativa = { abrir, cerrar };
})();
