/* ============================================================
   Comparativa de modelos del pronóstico meteorológico (8-oct-2026).

   Panel lateral, a la derecha, con la serie de la estación y cada modelo
   por separado: pestañas Lluvia / T. máxima / T. mínima, Serie / Validación,
   filtros Observado + corregidos / Numéricos / ML / Todo y «Miembros (N)»
   para encender o apagar cada uno. Copia la forma de abrir y de leer la
   comparativa del visor de HidroMet, con el estilo de este visor.

   Lee lo que ya publica modelo_meteo.py en api/pronostico-meteo:
     modelos      cada modelo corregido en la estación (sesgo por plazo), el
                  ML y el PONDERADO (pesos por desempeño, calibrado_meteo.py)
     crudos       cada modelo tal como sale
     metricas     verificación con las emisiones reales, por plazo
     validacion   walk-forward de la estación (día 0-1)

   Se abre con el botón «Comparar modelos» del panel del gráfico (fila de la
   emisión) o con Comparativa.abrir(codigo). Nunca desde la ficha del mapa.
   ============================================================ */
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
  // Vistas rápidas, como en HidroMet. El combinado (ponderado) va siempre.
  const VISTAS = [
    { id: "corregidos", rotulo: "Observado + corregidos", grupos: ["corregido"] },
    { id: "numericos", rotulo: "Numéricos", grupos: ["numerico"] },
    { id: "ml", rotulo: "ML", grupos: ["ml"] },
    { id: "todo", rotulo: "Todo", grupos: null },
  ];
  const COLOR = {
    ecmwf_ifs025: "#4E79A7", ecmwf_aifs025_single: "#17BECF", gfs_seamless: "#F28E2B",
    icon_seamless: "#59A14F", ML_ridge: "#E15759", ML_xgboost: "#B07AA1", ML_lightgbm: "#EDC948",
    ML_extra_trees: "#9C755F", ML_random_forest: "#FF9DA7", ML_hist_gbt: "#BCBD22",
    ML_knn: "#BAB0AC", ML_mlp: "#8E6BD9",
  };
  const CLAVE_LS = "monitor-comparativa";
  const E = { codigo: null, serie: SERIES[0][0], pestana: "serie", vista: "corregidos",
              ocultos: new Set(), abierto: false, datos: null };
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
#cmp-panel{position:fixed;top:0;right:0;bottom:0;width:min(600px,100vw);z-index:5000;
  background:var(--fondo,#fff);color:var(--tinta,#12181F);border-left:1px solid var(--linea,#DDE1E8);
  box-shadow:-8px 0 24px rgba(0,0,0,.18);display:flex;flex-direction:column;
  font-family:var(--sans,system-ui,sans-serif);font-size:12px}
#cmp-panel[hidden]{display:none}
#cmp-panel .cmp-cab{display:flex;align-items:center;gap:8px;padding:10px 12px 6px}
#cmp-panel .cmp-tit{flex:1 1 auto;min-width:0}
#cmp-panel .cmp-tit b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cmp-panel .cmp-tit span{color:var(--tinta3,#8A94A6);font-size:11px}
#cmp-panel .cmp-cerrar{appearance:none;border:1px solid var(--linea,#DDE1E8);background:var(--fondo,#fff);
  color:var(--tinta2,#4A5568);width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:16px;line-height:1}
#cmp-panel .cmp-fila{display:flex;flex-wrap:nowrap;align-items:center;gap:4px;padding:4px 12px 8px;
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
#cmp-panel .cmp-graf{width:100%;height:320px}
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
@media (max-width:480px){#cmp-panel{width:100vw;border-left:0}#cmp-panel .cmp-graf{height:280px}}
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
    if (E.datos) return E.datos;
    if (typeof cargarPronMeteo === "function") {
      E.datos = await cargarPronMeteo();
    } else {
      const r = await fetch("api/pronostico-meteo", { cache: "no-store" });
      E.datos = await r.json();
    }
    return E.datos;
  }

  // Cada curva con su grupo. «combinado» es el ponderado y no depende de la
  // vista; «obs» tampoco.
  function curvas(d, s) {
    const t = (s.pron && s.pron.t) || [];
    const lista = [];
    const nombreDe = id => {
      const m = (s.modelos || []).find(x => x.id === id);
      return (m && m.nombre) || id.replace(/^ML_/, "ML ").replace(/_/g, " ");
    };
    for (const m of (s.modelos || [])) {
      if (m.alias_de) continue;
      if (m.id === "PONDERADO") {
        lista.push({ clave: "PONDERADO", nombre: "Ponderado por desempeño", grupo: "combinado", v: m.v });
        continue;
      }
      const ml = /^ML_/.test(m.id);
      lista.push({ clave: (ml ? "" : "cor:") + m.id, id: m.id, rango: m.rango,
        nombre: ml ? m.nombre : `${m.nombre} corregido`,
        grupo: ml ? "ml" : "corregido", v: m.v });
    }
    if (s.pron && s.pron.v)
      lista.push({ clave: "ENSAMBLE", nombre: "Ensamble (mediana)", grupo: "corregido", v: s.pron.v, linea: true });
    for (const m of (s.crudos || []))
      lista.push({ clave: "cru:" + m.id, id: m.id, nombre: `${m.nombre} crudo`, grupo: "numerico", v: m.v });
    const principal = ((d.principal || {})[E.serie]) || "ENSAMBLE";
    for (const c of lista) if (c.clave === principal) c.principal = true;
    return { t, lista };
  }
  const enVista = c => {
    if (c.grupo === "combinado") return true;
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
    return panel;
  }

  async function abrir(codigo) {
    if (!codigo) return;
    crearPanel();
    ultimoFoco = document.activeElement;
    E.codigo = codigo;
    E.abierto = true;
    panel.hidden = false;
    document.getElementById("cmp-cuerpo").innerHTML = `<div class="cmp-vacio">Cargando…</div>`;
    try { await cargar(); } catch (e) { E.datos = { puntos: {} }; }
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

  const colorDe = c => {
    // magenta: no lo usa ningun modelo ni el observado, y se lee en los dos temas
    if (c.grupo === "combinado") return esOscuro() ? "#F06FB5" : "#C2185B";
    if (c.clave === "ENSAMBLE") return tema("--hidro", "#16835F");
    return COLOR[c.id] || tema("--tinta3", "#8A94A6");
  };

  function pintarSerie(cuerpo, d, s) {
    cuerpo.innerHTML = `<div id="cmp-graf" class="cmp-graf" role="img"
        aria-label="Serie observada y pronóstico de cada modelo"></div><p class="cmp-nota" id="cmp-nota"></p>`;
    dibujar(document.getElementById("cmp-graf"), d, s);
    const lluvia = E.serie.startsWith("precipitacion");
    const p = s.prob;
    let nota = "Ponderado por desempeño: los cuatro modelos corregidos en esta estación, combinados con más "
      + "peso para el que menos se equivoca aquí (contraído hacia su región mientras la estación tiene pocos datos).";
    const pr = (d.principal || {})[E.serie];
    if (pr && pr !== "PONDERADO") {
      const n = pr === "ENSAMBLE" ? "el ensamble (mediana)" : (((s.modelos || []).find(m => m.id === pr) || {}).nombre || pr);
      nota += ` La línea principal del visor es ${n}, la que mejor verifica en toda la red`
        + (lluvia ? " con el puntaje de lluvia fuerte." : ".");
    }
    if (lluvia && p && p["25"]) {
      const i = p["25"].map((x, j) => [x, j]).filter(([x]) => fin(x) && x >= 0.2);
      if (i.length) {
        const dias = i.map(([, j]) => s.pron.t[j].split("-").reverse().slice(0, 2).join("/"));
        nota += ` Probabilidad de 25 mm o más de al menos 20 %: ${dias.join(", ")}.`;
      }
    }
    document.getElementById("cmp-nota").textContent = nota;
  }

  function dibujar(gd, d, s) {
    if (!gd) return;
    if (!window.Plotly) { setTimeout(() => dibujar(gd, d, s), 200); return; }
    const lluvia = E.serie.startsWith("precipitacion");
    const unidad = lluvia ? "mm" : "°C";
    const { t, lista } = curvas(d, s);
    const tinta = tema("--tinta", "#12181F"), tinta3 = tema("--tinta3", "#8A94A6"),
      linea = tema("--linea", "#DDE1E8"), fondo = tema("--fondo", "#FFFFFF");
    const trazas = [];
    // observado de las tres semanas anteriores, huecos de fecha en discontinuo
    const ini = t.length ? new Date(t[0] + "T00:00:00") : null;
    const desde = ini ? new Date(ini.getTime() - 10 * 864e5).toISOString().slice(0, 10) : "";
    const o = s.obs || { t: [], v: [] };
    const ot = [], ov = [];
    o.t.forEach((x, i) => { if (x >= desde && fin(o.v[i])) { ot.push(x); ov.push(+o.v[i]); } });
    const dia = x => Math.round(new Date(x + "T00:00:00").getTime() / 864e5);
    const hx = [], hy = [];
    for (let i = 1; i < ot.length; i++)
      if (dia(ot[i]) - dia(ot[i - 1]) > 1) { hx.push(ot[i - 1], ot[i], null); hy.push(ov[i - 1], ov[i], null); }
    // segmentos continuos: sin unir a través del hueco
    const sx = [], sy = [];
    for (let i = 0; i < ot.length; i++) {
      if (i && dia(ot[i]) - dia(ot[i - 1]) > 1) { sx.push(null); sy.push(null); }
      sx.push(ot[i]); sy.push(ov[i]);
    }
    // los miembros
    const vis = lista.filter(c => c.grupo !== "combinado" && visible(c));
    vis.forEach(c => {
      const col = colorDe(c);
      if (lluvia && !c.linea) {
        trazas.push({ type: "bar", x: t, y: c.v, name: c.nombre + (c.principal ? " · principal" : ""), offsetgroup: c.clave,
          marker: { color: col, opacity: c.grupo === "numerico" ? 0.55 : 0.8, line: { width: 0 } },
          hovertemplate: `${esc(c.nombre)} <b>%{y:.1f} ${unidad}</b><extra></extra>` });
      } else {
        trazas.push({ type: "scatter", mode: "lines", x: t, y: c.v, name: c.nombre + (c.principal ? " · principal" : ""),
          line: { color: col, width: c.principal ? 2.2 : 1.3, dash: c.grupo === "numerico" ? "dot" : "solid" },
          connectgaps: false, opacity: 0.9,
          hovertemplate: `${esc(c.nombre)} <b>%{y:.1f} ${unidad}</b><extra></extra>` });
      }
    });
    if (hx.length) trazas.push({ type: "scatter", mode: "lines", x: hx, y: hy, showlegend: false, hoverinfo: "skip",
      line: { color: tinta, width: 1.3, dash: "4px,3px" }, opacity: 0.7 });
    if (sx.length) trazas.push({ type: "scatter", mode: "lines+markers", x: sx, y: sy, name: "Observado",
      line: { color: tinta, width: 2 }, marker: { size: 6, color: tinta, line: { color: fondo, width: 1.2 } },
      connectgaps: false, hovertemplate: `%{x|%d/%m} · Observado <b>%{y:.1f} ${unidad}</b><extra></extra>` });
    // el combinado: puntos y líneas en color de contraste, una cifra por día
    const comb = lista.find(c => c.grupo === "combinado");
    if (comb) {
      const col = colorDe(comb);
      const cx = [], cy = [];
      if (sx.length && t.length && ot[ot.length - 1] < t[0]) { cx.push(ot[ot.length - 1]); cy.push(ov[ov.length - 1]); }
      t.forEach((x, i) => { cx.push(x); cy.push(fin(comb.v[i]) ? +comb.v[i] : null); });
      const texto = cy.map((v, i) => (i === 0 && cx[0] !== t[0]) || !fin(v) ? "" : num(v, lluvia ? 1 : 1));
      trazas.push({ type: "scatter", mode: "lines+markers+text", x: cx, y: cy, name: comb.nombre,
        line: { color: col, width: 2.6 }, marker: { size: 7, color: col, line: { color: fondo, width: 1.2 } },
        text: texto, textposition: "top center", textfont: { size: 9, color: col }, cliponaxis: false,
        connectgaps: true, hovertemplate: `${esc(comb.nombre)} <b>%{y:.1f} ${unidad}</b><extra></extra>` });
    }
    const angosto = gd.clientWidth < 420;
    const layout = {
      paper_bgcolor: fondo, plot_bgcolor: fondo, separators: ",.",
      font: { family: tema("--sans", "system-ui"), size: 11, color: tinta },
      // en el telefono la leyenda se come el grafico: los colores estan en
      // «Miembros (N)», que es donde se encienden y se apagan
      showlegend: !angosto,
      margin: { l: 40, r: 8, t: 18, b: angosto ? 28 : 70 },
      barmode: "group", bargap: 0.25, bargroupgap: 0.05,
      hovermode: "x unified", hoverlabel: { bgcolor: fondo, bordercolor: linea, font: { color: tinta } },
      xaxis: { type: "date", tickformat: "%d/%m", gridcolor: linea, linecolor: linea, tickfont: { color: tinta3 },
        range: [desde || undefined, t.length ? t[t.length - 1] : undefined].every(Boolean)
          ? [new Date(new Date(desde + "T00:00:00").getTime() - 432e5).toISOString().slice(0, 19),
             new Date(new Date(t[t.length - 1] + "T00:00:00").getTime() + 432e5).toISOString().slice(0, 19)] : undefined },
      yaxis: { title: { text: unidad, font: { size: 10, color: tinta3 } }, gridcolor: linea, zerolinecolor: linea,
        tickfont: { color: tinta3 }, rangemode: lluvia ? "tozero" : "normal" },
      legend: { orientation: "h", y: -0.18, x: 0, font: { size: angosto ? 9 : 10 } },
      shapes: t.length ? [{ type: "line", xref: "x", yref: "paper", x0: t[0], x1: t[0], y0: 0, y1: 1,
        line: { color: tinta3, width: 1, dash: "dot" } }] : [],
      annotations: t.length ? [{ x: t[0], y: 1, xref: "x", yref: "paper", text: "emisión", showarrow: false,
        xanchor: "left", yanchor: "bottom", font: { size: 9, color: tinta3 } }] : [],
    };
    Plotly.react(gd, trazas, layout, { responsive: true, displayModeBar: false, scrollZoom: false });
  }

  function pintarValidacion(cuerpo, s) {
    const lluvia = E.serie.startsWith("precipitacion");
    const partes = [];
    // 1) emisiones reales, por plazo (modelo_meteo.py)
    const m = s.metricas || {};
    const bandas = m.bandas || [];
    if ((m.filas || []).length && bandas.length) {
      const cols = bandas.map(b => `<th>${esc(b)} d<br>MAE</th>` + (lluvia ? `<th>${esc(b)} d<br>ETS 1</th>` : "")).join("");
      const mejor = {};
      bandas.forEach(b => {
        let best = null;
        (m.filas || []).forEach(f => { const x = (f[b] || {}).mae; if (fin(x) && (best === null || x < best)) best = x; });
        mejor[b] = best;
      });
      const filas = m.filas.map(f => `<tr><td>${esc(f.nombre)}${f.rango ? ` (${f.rango}.º)` : ""}</td>`
        + bandas.map(b => {
          const x = f[b] || {};
          return `<td${fin(x.mae) && x.mae === mejor[b] ? ' style="font-weight:700"' : ""}>${num(x.mae, lluvia ? 1 : 2)}</td>`
            + (lluvia ? `<td>${num(x.ets, 2)}</td>` : "");
        }).join("") + "</tr>").join("");
      const per = m.periodo || {};
      partes.push(`<h3>Con los pronósticos emitidos (fuera de muestra)</h3>
        <div class="cmp-tabla"><table><thead><tr><th>Modelo</th>${cols}</tr></thead><tbody>${filas}</tbody></table></div>
        <p class="cmp-nota">${per.emisiones ? `${per.emisiones} emisiones, del ${esc((per.desde || "").split("-").reverse().join("/"))} al ${esc((per.hasta || "").split("-").reverse().join("/"))}. ` : ""}Por plazo: días 1-3, 4-7 y 8-16. En negrita, el menor error de cada plazo.</p>`);
    } else {
      partes.push(`<h3>Con los pronósticos emitidos</h3><p class="cmp-nota">Esta estación todavía no tiene pronósticos verificados con lo observado.</p>`);
    }
    // 2) walk-forward de la estación (calibrado_meteo.py --validar)
    const v = s.validacion;
    if (v && (v.filas || []).length) {
      const f = v.filas;
      let iMejor = -1, vMejor = null;
      f.forEach((x, i) => {
        const k = lluvia ? x.puntaje : x.mae;
        if (!fin(k)) return;
        if (vMejor === null || (lluvia ? k > vMejor : k < vMejor)) { vMejor = k; iMejor = i; }
      });
      const cab = lluvia
        ? "<th>Método</th><th>n</th><th>MAE</th><th>Sesgo %</th><th>ETS 10</th><th>ETS 25</th><th>ETS 50</th><th>Puntaje</th>"
        : "<th>Método</th><th>n</th><th>MAE</th><th>Sesgo</th>";
      const filas = f.map((x, i) => `<tr${i === iMejor ? ' class="cmp-mejor"' : ""}><td>${esc(x.nombre)}</td><td>${x.n}</td>`
        + (lluvia
          ? `<td>${num(x.mae, 1)}</td><td>${num(x.sesgo_pct, 0)}</td><td>${num(x.ets10, 2)}</td><td>${num(x.ets25, 2)}</td><td>${num(x.ets50, 2)}</td><td>${num(x.puntaje, 2)}</td>`
          : `<td>${num(x.mae, 2)}</td><td>${num(x.sesgo, 2)}</td>`) + "</tr>").join("");
      partes.push(`<h3>Validación por meses, solo con el pasado</h3>
        <div class="cmp-tabla"><table><thead><tr>${cab}</tr></thead><tbody>${filas}</tbody></table></div>
        <p class="cmp-nota">${esc(v.periodo || "")}. Cada mes se calibra con lo anterior y se mide en ese mes; plazo de un día. `
        + (lluvia ? "Puntaje = (ETS 10 + 2·ETS 25 + 2·ETS 50) / 5: premia acertar la lluvia fuerte, no solo el día de lluvia. "
          : "") + "Resaltado, el mejor.</p>");
    } else {
      partes.push(`<h3>Validación por meses</h3><p class="cmp-nota">Sin archivo de pronósticos pasados para esta estación (estación nueva o sin lo observado suficiente). Se medirá con sus emisiones a medida que lleguen.</p>`);
    }
    cuerpo.innerHTML = partes.join("");
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
    const fila = document.getElementById("pron-emi");
    if (!fila || fila.querySelector(".cmp-abrir")) return;
    ponerEstilo();
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cmp-abrir";
    b.textContent = "Comparar modelos";
    b.title = "Abre a la derecha cada modelo por separado y su validación en esta estación";
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

  // El PONDERADO tambien en el grafico principal del visor, con el mismo
  // color que aqui (sin el salia gris, como un modelo sin nombre).
  try {
    if (typeof COLOR_MODELO === "object" && COLOR_MODELO && !COLOR_MODELO.PONDERADO)
      COLOR_MODELO.PONDERADO = "#C2185B";
  } catch (e) { /* visor sin paleta de modelos */ }

  window.Comparativa = { abrir, cerrar };
})();
