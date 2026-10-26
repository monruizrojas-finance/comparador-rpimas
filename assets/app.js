/* Seguros Generales en Chile — ranking, comparador de prima y estado de resultados */
(() => {
  const $ = (s) => document.querySelector(s);
  const fmt = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const signo = (n) => (n >= 0 ? "+" : "−");
  const abreviar = (n) => {
    const x = Math.abs(n), s = n < 0 ? "−" : "";
    if (x >= 1e6) return s + fmt1.format(x / 1e6) + " M";
    if (x >= 1e3) return s + fmt.format(x / 1e3) + " mil";
    return s + fmt.format(x);
  };
  const uf = (n) => (n < 0 ? "−" : "") + fmt.format(Math.abs(n));
  const pct = (v, t) => (t ? fmt1.format((v / t) * 100) + " %" : "–");

  const D = window.DATOS;
  if (!D) {
    document.querySelector("main").innerHTML =
      '<p class="tarjeta">No se encontraron los datos. Revisa que la carpeta <code>data</code> esté junto a <code>index.html</code>.</p>';
    return;
  }
  const C = D.companias;
  const TOP_N = 12;
  const PESTANAS = ["ranking", "comparador", "eerr"];
  const cuenta = Object.fromEntries(D.eerr.map((c) => [c.codigo, c]));

  const state = {
    tab: "ranking", a: null, b: null,
    metrica: "uf", verTodos: false, verDetalle: false,
    ordenRanking: { campo: "rank", dir: 1 }, busqueda: "",
  };

  /* =================== URL (pestaña y compañías) =================== */
  function leerHash() {
    const [tab, q] = location.hash.slice(1).split("?");
    if (PESTANAS.includes(tab)) state.tab = tab;
    const p = new URLSearchParams(q || "");
    if (C.includes(p.get("a"))) state.a = p.get("a");
    if (C.includes(p.get("b"))) state.b = p.get("b");
  }
  function escribirHash() {
    const q = state.tab === "ranking" ? "" : "?" + new URLSearchParams({ a: state.a, b: state.b });
    history.replaceState(null, "", "#" + state.tab + q);
  }

  /* =================== Tooltip compartido =================== */
  const tip = $("#tooltip");
  function mostrarTip(e, html) {
    tip.innerHTML = html;
    tip.hidden = false;
    let x = e.clientX + 14;
    if (x + tip.offsetWidth > window.innerWidth - 8) x = e.clientX - tip.offsetWidth - 14;
    let y = e.clientY + 12;
    if (y + tip.offsetHeight > window.innerHeight - 8) y = e.clientY - tip.offsetHeight - 12;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }
  const ocultarTip = () => (tip.hidden = true);

  /* =================== Gráfico de barras A vs B (SVG) =================== */
  function ticksBonitos(min, max, n = 6) {
    const paso0 = (max - min || 1) / n;
    const mag = Math.pow(10, Math.floor(Math.log10(paso0)));
    const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= paso0);
    const ini = Math.floor(min / paso) * paso, fin = Math.ceil(max / paso) * paso;
    const t = [];
    for (let v = ini; v <= fin + paso * 0.001; v += paso) t.push(+v.toFixed(10));
    return t;
  }

  function dibujarBarras(cont, filas, { fmtTick, fmtValor, conDiferencia }) {
    cont._ultimo = [filas, { fmtTick, fmtValor, conDiferencia }];
    const W = cont.clientWidth || 800;
    const movil = W < 560;
    const ROW = 44, BAR = 14, GAP = 2, TOP = 8, BOTTOM = 28;
    const labelW = movil ? 0 : Math.min(260, W * 0.34);
    const rowH = movil ? ROW + 18 : ROW;
    const plotX = labelW + 8, plotW = W - plotX - 12;
    const H = TOP + filas.length * rowH + BOTTOM;

    const vals = filas.flatMap((f) => [f.a, f.b]);
    const ticks = ticksBonitos(Math.min(0, ...vals), Math.max(0, ...vals, 1));
    const x0 = ticks[0], x1 = ticks[ticks.length - 1];
    const sx = (v) => plotX + ((v - x0) / (x1 - x0)) * plotW;
    const corta = (l, n) => (l.length > n ? l.slice(0, n - 1) + "…" : l);

    // Barra con extremo de datos redondeado (4 px), anclada a la línea base
    const barra = (v, y, cls) => {
      if (!v) return "";
      const a = sx(Math.min(0, v)), b = sx(Math.max(0, v));
      const w = Math.max(b - a, 1.5), r = Math.min(4, w / 2);
      return v > 0
        ? `<path class="${cls}" d="M${a},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${BAR - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - r} Z"/>`
        : `<path class="${cls}" d="M${b},${y} h-${w - r} a${r},${r} 0 0 0 -${r},${r} v${BAR - 2 * r} a${r},${r} 0 0 0 ${r},${r} h${w - r} Z"/>`;
    };

    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras: ${esc(state.a)} versus ${esc(state.b)}">`;
    for (const t of ticks) {
      svg += `<line class="grid" x1="${sx(t)}" x2="${sx(t)}" y1="${TOP}" y2="${H - BOTTOM}"/>`;
      svg += `<text class="tick" x="${sx(t)}" y="${H - 8}" text-anchor="middle">${fmtTick(t)}</text>`;
    }
    filas.forEach((f, i) => {
      const y = TOP + i * rowH;
      const yb = y + (movil ? 18 : (ROW - 2 * BAR - GAP) / 2);
      svg += `<g class="fila" data-i="${i}"><rect class="hit" x="0" y="${y}" width="${W}" height="${rowH}"/>`;
      svg += movil
        ? `<text class="lbl" x="${plotX}" y="${y + 13}">${esc(corta(f.etiqueta, 48))}</text>`
        : `<text class="lbl" x="${labelW}" y="${y + rowH / 2 + 4}" text-anchor="end">${esc(corta(f.etiqueta, 36))}</text>`;
      svg += barra(f.a, yb, "serie-a") + barra(f.b, yb + BAR + GAP, "serie-b") + `</g>`;
    });
    svg += `<line class="base" x1="${sx(0)}" x2="${sx(0)}" y1="${TOP}" y2="${H - BOTTOM}"/></svg>`;
    cont.innerHTML = svg;

    cont.querySelectorAll(".fila").forEach((g) => {
      g.addEventListener("mousemove", (e) => {
        const f = filas[+g.dataset.i];
        const d = f.a - f.b;
        mostrarTip(e, `<strong>${esc(f.etiqueta)}</strong>
          <div><i class="punto a"></i>${esc(state.a)}: ${fmtValor(f.a)}</div>
          <div><i class="punto b"></i>${esc(state.b)}: ${fmtValor(f.b)}</div>` +
          (conDiferencia ? `<div class="tdif">Diferencia: ${signo(d)}${fmt.format(Math.abs(d))} UF</div>` : ""));
        g.classList.add("activa");
      });
      g.addEventListener("mouseleave", () => { ocultarTip(); g.classList.remove("activa"); });
    });
  }

  function leyendas() {
    document.querySelectorAll(".leyenda").forEach((el) => {
      el.innerHTML = `<span><i class="punto a"></i>${esc(state.a)}</span><span><i class="punto b"></i>${esc(state.b)}</span>`;
    });
  }

  /* =================== 1. Ranking =================== */
  function datosRanking() {
    const total = D.prima.mercado;
    const filas = C.map((n, i) => ({ nombre: n, prima: D.prima.totales[i] }))
      .sort((x, y) => y.prima - x.prima);
    let acum = 0;
    filas.forEach((f, i) => {
      f.rank = i + 1;
      f.part = f.prima / total;
      acum += f.part;
      f.acum = acum;
    });
    return filas;
  }

  function renderRanking() {
    const filas = datosRanking();
    const total = D.prima.mercado, ant = D.prima.mercado_anterior;
    const varAnual = ant ? (total / ant - 1) * 100 : null;
    const top5 = filas.slice(0, 5).reduce((s, f) => s + f.part, 0);
    const activas = filas.filter((f) => f.prima > 0).length;

    $("#kpisRanking").innerHTML = `
      <div class="kpi"><div class="etq"><span>Prima directa del mercado</span></div>
        <div class="valor">${abreviar(total)} UF</div>
        <div class="det">${varAnual === null ? "" : `<span class="${varAnual >= 0 ? "pos" : "neg"}">${signo(varAnual)}${fmt1.format(Math.abs(varAnual))} %</span> vs ${D.prima.fecha_anterior}`}</div></div>
      <div class="kpi"><div class="etq"><span>Compañías con prima</span></div>
        <div class="valor">${activas}</div>
        <div class="det">de ${C.length} compañías informadas</div></div>
      <div class="kpi"><div class="etq"><span>Concentración: 5 mayores</span></div>
        <div class="valor">${fmt1.format(top5 * 100)} %</div>
        <div class="det">${filas.slice(0, 5).map((f) => esc(f.nombre)).join(", ")}</div></div>`;

    const { campo, dir } = state.ordenRanking;
    const q = state.busqueda.trim().toLowerCase();
    const maxPart = filas[0].part || 1;
    const vista = filas
      .filter((f) => !q || f.nombre.toLowerCase().includes(q))
      .sort((x, y) => (campo === "nombre" ? x.nombre.localeCompare(y.nombre, "es") : x[campo] - y[campo]) * dir);

    document.querySelectorAll("#tablaRanking th[data-orden]").forEach((th) => {
      th.classList.remove("orden-asc", "orden-desc");
      if (th.dataset.orden === campo) th.classList.add(dir === 1 ? "orden-asc" : "orden-desc");
    });

    $("#tablaRanking tbody").innerHTML = vista.map((f) => `
      <tr>
        <td>${f.rank}</td>
        <td>${esc(f.nombre)}</td>
        <td>${uf(f.prima)}</td>
        <td><div class="barra-part"><div class="pista"><div class="relleno" style="width:${Math.max(0, (f.part / maxPart) * 100)}%"></div></div><span>${fmt1.format(f.part * 100)} %</span></div></td>
        <td>${fmt1.format(f.acum * 100)} %</td>
        <td><button class="btn-comparar" data-c="${esc(f.nombre)}">Comparar</button></td>
      </tr>`).join("") + (q ? "" : `
      <tr class="total"><td></td><td>Total mercado</td><td>${uf(total)}</td><td>100,0 %</td><td></td><td></td></tr>`);
  }

  /* =================== 2. Comparador de prima =================== */
  function renderComparador() {
    const ia = C.indexOf(state.a), ib = C.indexOf(state.b);
    const totA = D.prima.totales[ia], totB = D.prima.totales[ib], mer = D.prima.mercado;
    const rank = datosRanking();
    const rk = (n) => rank.find((f) => f.nombre === n).rank;
    const diff = totA - totB;
    const ratio = totB ? (totA / totB - 1) * 100 : null;

    $("#kpisPrima").innerHTML = `
      <div class="kpi"><div class="etq"><i class="punto a"></i><span>${esc(state.a)}</span></div>
        <div class="valor">${abreviar(totA)} UF</div>
        <div class="det">${pct(totA, mer)} del mercado · #${rk(state.a)} de ${C.length}</div></div>
      <div class="kpi"><div class="etq"><i class="punto b"></i><span>${esc(state.b)}</span></div>
        <div class="valor">${abreviar(totB)} UF</div>
        <div class="det">${pct(totB, mer)} del mercado · #${rk(state.b)} de ${C.length}</div></div>
      <div class="kpi"><div class="etq"><span>Diferencia (A − B)</span></div>
        <div class="valor ${diff >= 0 ? "pos" : "neg"}">${signo(diff)}${abreviar(Math.abs(diff))} UF</div>
        <div class="det">${ratio === null ? "B no registra prima" :
          `${esc(state.a)} es ${fmt1.format(Math.abs(ratio))} % ${ratio >= 0 ? "mayor" : "menor"} que ${esc(state.b)}`}</div></div>`;

    const base = D.prima.ramos
      .map((r) => ({ etiqueta: r.nombre, a: r.valores[ia], b: r.valores[ib] }))
      .filter((f) => Math.abs(f.a) >= 1 || Math.abs(f.b) >= 1);

    // Gráfico
    const esPct = state.metrica === "pct";
    let filas = base
      .map((f) => (esPct ? { ...f, a: totA ? (f.a / totA) * 100 : 0, b: totB ? (f.b / totB) * 100 : 0 } : f))
      .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b));
    if (!state.verTodos && filas.length > TOP_N + 1) {
      const resto = filas.slice(TOP_N);
      filas = filas.slice(0, TOP_N);
      filas.push({ etiqueta: `Otros ramos (${resto.length})`, a: resto.reduce((s, f) => s + f.a, 0), b: resto.reduce((s, f) => s + f.b, 0) });
    }
    $("#tituloPrima").textContent = esPct ? "Composición de la cartera por ramo (% de la prima de cada compañía)" : "Prima directa por ramo (UF)";
    document.querySelectorAll("#metrica button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === state.metrica)));
    dibujarBarras($("#graficoPrima"), filas, {
      fmtTick: (v) => (esPct ? fmt.format(v) + " %" : abreviar(v)),
      fmtValor: (v) => (esPct ? fmt1.format(v) + " %" : fmt.format(v) + " UF"),
      conDiferencia: !esPct,
    });

    // Tabla
    $("#tablaPrima thead").innerHTML = `<tr><th>Ramo</th>
      <th>${esc(state.a)}<br><small>UF</small></th><th><small>% cartera</small></th>
      <th>${esc(state.b)}<br><small>UF</small></th><th><small>% cartera</small></th>
      <th>Diferencia A − B<br><small>UF</small></th></tr>`;
    $("#tablaPrima tbody").innerHTML = [...base].sort((x, y) => y.a + y.b - (x.a + x.b)).map((f) => {
      const d = f.a - f.b;
      return `<tr><td class="cuenta">${esc(f.etiqueta)}</td>
        <td>${uf(f.a)}</td><td>${pct(f.a, totA)}</td><td>${uf(f.b)}</td><td>${pct(f.b, totB)}</td>
        <td class="${d >= 0 ? "pos" : "neg"}">${signo(d)}${fmt.format(Math.abs(d))}</td></tr>`;
    }).join("") + `<tr class="total"><td>Total</td><td>${uf(totA)}</td><td>100 %</td><td>${uf(totB)}</td><td>100 %</td>
        <td class="${diff >= 0 ? "pos" : "neg"}">${signo(diff)}${fmt.format(Math.abs(diff))}</td></tr>`;
  }

  /* =================== 3. Estado de resultados =================== */
  const LINEAS_GRAFICO = [
    "5.31.11.10", // Prima directa
    "5.31.11.00", // Prima retenida
    "5.31.13.00", // Costo de siniestros
    "5.31.15.00", // Resultado de intermediación
    "5.31.10.00", // Margen de contribución
    "5.31.20.00", // Costos de administración
    "5.31.30.00", // Resultado de inversiones
    "5.31.40.00", // Resultado técnico de seguros
    "5.31.00.00", // Resultado del período
  ];
  const nombreCorto = { "5.31.00.00": "Resultado del período", "5.31.70.00": "Resultado antes de impuesto" };

  function renderEerr() {
    const ia = C.indexOf(state.a), ib = C.indexOf(state.b);
    const v = (cod, i) => cuenta[cod].valores[i];
    const pdA = v("5.31.11.10", ia), pdB = v("5.31.11.10", ib);

    const tarjeta = (cod, titulo) => {
      const a = v(cod, ia), b = v(cod, ib);
      const cls = (n) => (n < 0 ? "neg" : "");
      return `<div class="kpi"><div class="etq"><span>${titulo}</span></div>
        <div class="par">
          <div class="${cls(a)}"><i class="punto a"></i>${abreviar(a)} UF<small>${pct(a, pdA)} de PD</small></div>
          <div class="${cls(b)}"><i class="punto b"></i>${abreviar(b)} UF<small>${pct(b, pdB)} de PD</small></div>
        </div></div>`;
    };
    $("#kpisEerr").innerHTML =
      tarjeta("5.31.10.00", "Margen de contribución") +
      tarjeta("5.31.40.00", "Resultado técnico de seguros") +
      tarjeta("5.31.00.00", "Resultado del período");

    dibujarBarras($("#graficoEerr"),
      LINEAS_GRAFICO.map((cod) => ({ etiqueta: nombreCorto[cod] || cuenta[cod].nombre, a: v(cod, ia), b: v(cod, ib) })),
      { fmtTick: abreviar, fmtValor: (n) => uf(n) + " UF", conDiferencia: true });

    $("#tablaEerr thead").innerHTML = `<tr><th>Cuenta</th>
      <th>${esc(state.a)}<br><small>UF</small></th><th><small>% PD</small></th>
      <th>${esc(state.b)}<br><small>UF</small></th><th><small>% PD</small></th>
      <th>Diferencia A − B<br><small>UF</small></th></tr>`;
    $("#tablaEerr tbody").innerHTML = D.eerr
      .filter((c) => (state.verDetalle || c.nivel < 3) && (c.nivel === 0 || Math.abs(c.valores[ia]) >= 1 || Math.abs(c.valores[ib]) >= 1))
      .map((c) => {
        const a = c.valores[ia], b = c.valores[ib], d = a - b;
        return `<tr class="n${c.nivel}"><td class="cuenta">${esc(nombreCorto[c.codigo] || c.nombre)}</td>
          <td>${uf(a)}</td><td>${pct(a, pdA)}</td><td>${uf(b)}</td><td>${pct(b, pdB)}</td>
          <td class="${d >= 0 ? "pos" : "neg"}">${signo(d)}${fmt.format(Math.abs(d))}</td></tr>`;
      }).join("");
  }

  /* =================== Navegación y eventos =================== */
  function poblarSelectores() {
    const top = datosRanking();
    if (!state.a) state.a = top[0].nombre;
    if (!state.b || state.b === state.a) state.b = top.find((f) => f.nombre !== state.a).nombre;
    const opciones = [...C].sort((x, y) => x.localeCompare(y, "es")).map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    $("#selA").innerHTML = opciones;
    $("#selB").innerHTML = opciones;
    $("#selA").value = state.a;
    $("#selB").value = state.b;
  }

  function render() {
    PESTANAS.forEach((t) => {
      $("#tab-" + t).setAttribute("aria-selected", String(t === state.tab));
      $("#panel-" + t).hidden = t !== state.tab;
    });
    $("#selectores").hidden = state.tab === "ranking";
    $("#selA").value = state.a;
    $("#selB").value = state.b;
    leyendas();
    ocultarTip();
    if (state.tab === "ranking") renderRanking();
    if (state.tab === "comparador") renderComparador();
    if (state.tab === "eerr") renderEerr();
    escribirHash();
  }

  function enlazar() {
    document.querySelectorAll(".pestanas button").forEach((b) =>
      b.addEventListener("click", () => { state.tab = b.dataset.tab; render(); }));

    $("#selA").addEventListener("change", (e) => {
      if (e.target.value === state.b) state.b = state.a;
      state.a = e.target.value;
      render();
    });
    $("#selB").addEventListener("change", (e) => {
      if (e.target.value === state.a) state.a = state.b;
      state.b = e.target.value;
      render();
    });
    $("#swap").addEventListener("click", () => { [state.a, state.b] = [state.b, state.a]; render(); });

    $("#metrica").addEventListener("click", (e) => {
      const v = e.target.closest("button")?.dataset.v;
      if (v) { state.metrica = v; render(); }
    });
    $("#verTodos").addEventListener("change", (e) => { state.verTodos = e.target.checked; render(); });
    $("#verDetalle").addEventListener("change", (e) => { state.verDetalle = e.target.checked; render(); });

    $("#buscar").addEventListener("input", (e) => { state.busqueda = e.target.value; renderRanking(); });
    document.querySelectorAll("#tablaRanking th[data-orden]").forEach((th) =>
      th.addEventListener("click", () => {
        const campo = th.dataset.orden;
        const o = state.ordenRanking;
        o.dir = o.campo === campo ? -o.dir : (campo === "nombre" || campo === "rank" ? 1 : -1);
        o.campo = campo;
        renderRanking();
      }));
    $("#tablaRanking").addEventListener("click", (e) => {
      const c = e.target.closest(".btn-comparar")?.dataset.c;
      if (!c) return;
      if (c !== state.a) { state.b = state.a; state.a = c; }
      state.tab = "comparador";
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Redibuja los gráficos si cambia el ancho
    let t;
    new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => document.querySelectorAll(".grafico").forEach((g) => {
        if (g._ultimo && g.offsetParent && g._ancho !== g.clientWidth) {
          g._ancho = g.clientWidth;
          dibujarBarras(g, ...g._ultimo);
        }
      }), 120);
    }).observe(document.querySelector("main"));
    window.addEventListener("scroll", ocultarTip, { passive: true });
  }

  /* =================== Inicio =================== */
  $("#subtitulo").textContent = `Prima directa y estado de resultados por compañía · cifras en UF al ${D.fecha}`;
  $("#pie").textContent = `Fuente: ${D.fuente} (hojas "Gen. Prima Directa" y "Gen. EERR"). Cifras acumuladas al ${D.fecha}, en UF.`;
  leerHash();
  poblarSelectores();
  enlazar();
  render();
})();
