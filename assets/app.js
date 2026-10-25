/* Comparador de Primas — lógica de la página */
(() => {
  const $ = (s) => document.querySelector(s);
  const fmt = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const TOP_N = 12;
  const UMBRAL = 1; // UF: se ignoran ramos con montos residuales
  const ABREV_SECCION = {
    "Individuales": "Ind.",
    "Colectivos Tradicionales": "Col.",
    "Bancaseguros y Retail": "Banca/Retail",
    "Previsionales": "Prev.",
  };

  let DATA = null;
    const state = { mercado: "generales", a: null, b: null, seccion: "todas", metrica: "uf", verTodos: false };

  const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const abreviar = (n) => {
    const x = Math.abs(n);
    if (x >= 1e6) return fmt1.format(n / 1e6) + " M";
    if (x >= 1e3) return fmt.format(n / 1e3) + " mil";
    return fmt.format(n);
  };
  const fmtValor = (n) => (state.metrica === "pct" ? fmt1.format(n) + " %" : fmt.format(n) + " UF");

  /* ---------- Estado en la URL (para compartir comparaciones) ---------- */
  function leerHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get("m") && DATA.mercados[p.get("m")]) state.mercado = p.get("m");
    state.a = p.get("a");
    state.b = p.get("b");
    if (p.get("s")) state.seccion = p.get("s");
    if (p.get("v") === "pct") state.metrica = "pct";
  }
  function escribirHash() {
    const p = new URLSearchParams({ m: state.mercado, a: state.a, b: state.b });
    if (state.seccion !== "todas") p.set("s", state.seccion);
    if (state.metrica === "pct") p.set("v", "pct");
    history.replaceState(null, "", "#" + p.toString());
  }

  /* ---------- Datos ---------- */
  const mercado = () => DATA.mercados[state.mercado];
  const ramosFiltrados = () =>
    mercado().ramos.filter((r) => state.seccion === "todas" || r.seccion === state.seccion);

  function totalesPorCompania() {
    const m = mercado();
    const ramos = ramosFiltrados();
    return m.companias.map((_, i) => ramos.reduce((s, r) => s + r.valores[i], 0));
  }

  /* ---------- Controles ---------- */
  function poblarCompanias() {
    const m = mercado();
    const tot = totalesPorCompania();
    const orden = m.companias.map((c, i) => ({ c, t: tot[i] })).sort((x, y) => y.t - x.t);
    if (!m.companias.includes(state.a)) state.a = orden[0].c;
    if (!m.companias.includes(state.b) || state.b === state.a) state.b = orden.find((o) => o.c !== state.a).c;

    const opciones = [...m.companias].sort((x, y) => x.localeCompare(y, "es"))
      .map((c) => `<option value="${c}">${c}</option>`).join("");
    $("#selA").innerHTML = opciones;
    $("#selB").innerHTML = opciones;
    $("#selA").value = state.a;
    $("#selB").value = state.b;
  }

  function poblarSecciones() {
    const secciones = [...new Set(mercado().ramos.map((r) => r.seccion).filter(Boolean))];
    $("#campoSeccion").hidden = secciones.length === 0;
    if (!secciones.includes(state.seccion)) state.seccion = "todas";
    $("#selSeccion").innerHTML =
      `<option value="todas">Todas</option>` + secciones.map((s) => `<option value="${s}">${s}</option>`).join("");
    $("#selSeccion").value = state.seccion;
  }

  function marcarBotones() {
    document.querySelectorAll("#mercado button").forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.v === state.mercado)));
    document.querySelectorAll("#metrica button").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.v === state.metrica)));
  }

  /* ---------- Render ---------- */
  function calcular() {
    const m = mercado();
    const ia = m.companias.indexOf(state.a);
    const ib = m.companias.indexOf(state.b);
    const tot = totalesPorCompania();
    const totMercado = tot.reduce((s, v) => s + v, 0);
    const ranking = [...tot].map((t, i) => ({ t, i })).sort((x, y) => y.t - x.t);
    const rank = (i) => ranking.findIndex((r) => r.i === i) + 1;

    let filas = ramosFiltrados()
      .map((r) => ({
        nombre: r.nombre,
        seccion: r.seccion,
        etiqueta: state.seccion === "todas" && r.seccion ? `${r.nombre} (${ABREV_SECCION[r.seccion] || r.seccion})` : r.nombre,
        a: r.valores[ia],
        b: r.valores[ib],
        mercado: r.mercado,
      }))
      .filter((f) => Math.abs(f.a) >= UMBRAL || Math.abs(f.b) >= UMBRAL);

    return {
      filas, totA: tot[ia], totB: tot[ib], totMercado,
      rankA: rank(ia), rankB: rank(ib), nComp: m.companias.length,
    };
  }

  function renderKPIs(c) {
    const partA = (c.totA / c.totMercado) * 100;
    const partB = (c.totB / c.totMercado) * 100;
    const ratio = c.totB ? (c.totA / c.totB - 1) * 100 : null;
    const diff = c.totA - c.totB;
    const comparacion = ratio === null
      ? "B no registra prima"
      : `${state.a} es ${fmt1.format(Math.abs(ratio))} % ${ratio >= 0 ? "mayor" : "menor"} que ${state.b}`;

    $("#kpis").innerHTML = `
      <div class="kpi">
        <div class="etq"><i class="punto a"></i><span>${state.a}</span></div>
        <div class="valor">${abreviar(c.totA)} UF</div>
        <div class="det">${fmt1.format(partA)} % del mercado · #${c.rankA} de ${c.nComp}</div>
      </div>
      <div class="kpi">
        <div class="etq"><i class="punto b"></i><span>${state.b}</span></div>
        <div class="valor">${abreviar(c.totB)} UF</div>
        <div class="det">${fmt1.format(partB)} % del mercado · #${c.rankB} de ${c.nComp}</div>
      </div>
      <div class="kpi">
        <div class="etq"><span>Diferencia (A − B)</span></div>
        <div class="valor ${diff >= 0 ? "pos" : "neg"}">${diff >= 0 ? "+" : "−"}${abreviar(Math.abs(diff))} UF</div>
        <div class="det">${comparacion}</div>
      </div>`;
  }

  function filasParaGrafico(c) {
    const conv = (f) => state.metrica === "pct"
      ? { ...f, a: c.totA ? (f.a / c.totA) * 100 : 0, b: c.totB ? (f.b / c.totB) * 100 : 0 }
      : f;
    let filas = c.filas.map(conv).sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b));
    if (!state.verTodos && filas.length > TOP_N + 1) {
      const resto = filas.slice(TOP_N);
      filas = filas.slice(0, TOP_N);
      filas.push({
        etiqueta: `Otros ramos (${resto.length})`,
        a: resto.reduce((s, f) => s + f.a, 0),
        b: resto.reduce((s, f) => s + f.b, 0),
      });
    }
    return filas;
  }

  function ticksBonitos(min, max, n = 5) {
    const rango = max - min || 1;
    const paso0 = rango / n;
    const mag = Math.pow(10, Math.floor(Math.log10(paso0)));
    const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= paso0);
    const t = [];
    const fin = Math.ceil(max / paso) * paso;
    for (let v = Math.floor(min / paso) * paso; v <= fin + paso * 0.001; v += paso) t.push(+v.toFixed(10));
    return t;
  }

  let ultimoCalculo = null;
  function renderGrafico(c) {
    ultimoCalculo = c;
    const filas = filasParaGrafico(c);
    const cont = $("#contGrafico");
    const W = cont.clientWidth || 800;
    const movil = W < 560;
    const ROW = 44, BAR = 14, GAP = 2, TOP = 8, BOTTOM = 28;
    const labelW = movil ? 0 : Math.min(260, W * 0.34);
    const rowH = movil ? ROW + 18 : ROW;
    const plotX = labelW + 8, plotW = W - plotX - 12;
    const H = TOP + filas.length * rowH + BOTTOM;

    $("#tituloGrafico").textContent = state.metrica === "pct"
      ? "Composición de la cartera por ramo (% de la prima de cada compañía)"
      : "Prima directa por ramo (UF)";
    $("#leyenda").innerHTML = `
      <span><i class="punto a"></i>${esc(state.a)}</span>
      <span><i class="punto b"></i>${esc(state.b)}</span>`;

    const vals = filas.flatMap((f) => [f.a, f.b]);
    const ticks = ticksBonitos(Math.min(0, ...vals), Math.max(...vals, 1));
    const x0 = ticks[0], x1 = ticks[ticks.length - 1];
    const sx = (v) => plotX + ((v - x0) / (x1 - x0)) * plotW;
    const fmtTick = (v) => (state.metrica === "pct" ? fmt.format(v) + " %" : abreviar(v));
    const corta = (l, n) => (l.length > n ? l.slice(0, n - 1) + "…" : l);

    // Barra con extremo redondeado (4px) anclada a la línea base
    const barra = (v, y, cls) => {
      const a = sx(Math.min(0, v)), b = sx(Math.max(0, v));
      const w = Math.max(b - a, v === 0 ? 0 : 1.5);
      const r = Math.min(4, w / 2, BAR / 2);
      if (v >= 0) {
        return `<path class="${cls}" d="M${a},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${BAR - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - r} Z"/>`;
      }
      return `<path class="${cls}" d="M${b},${y} h-${w - r} a${r},${r} 0 0 0 -${r},${r} v${BAR - 2 * r} a${r},${r} 0 0 0 ${r},${r} h${w - r} Z"/>`;
    };

    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras: ${esc(state.a)} versus ${esc(state.b)} por ramo">`;
    for (const t of ticks) {
      svg += `<line class="grid" x1="${sx(t)}" x2="${sx(t)}" y1="${TOP}" y2="${H - BOTTOM}"/>`;
      svg += `<text class="tick" x="${sx(t)}" y="${H - 8}" text-anchor="middle">${fmtTick(t)}</text>`;
    }
    filas.forEach((f, i) => {
      const y = TOP + i * rowH;
      const yb = y + (movil ? 18 : (ROW - 2 * BAR - GAP) / 2);
      svg += `<g class="fila" data-i="${i}">`;
      svg += `<rect class="hit" x="0" y="${y}" width="${W}" height="${rowH}"/>`;
      svg += movil
        ? `<text class="lbl" x="${plotX}" y="${y + 13}">${esc(corta(f.etiqueta, 48))}</text>`
        : `<text class="lbl" x="${labelW}" y="${y + rowH / 2 + 4}" text-anchor="end">${esc(corta(f.etiqueta, 36))}</text>`;
      svg += barra(f.a, yb, "serie-a") + barra(f.b, yb + BAR + GAP, "serie-b");
      svg += `</g>`;
    });
    svg += `<line class="base" x1="${sx(0)}" x2="${sx(0)}" y1="${TOP}" y2="${H - BOTTOM}"/></svg>`;
    cont.innerHTML = svg + `<div class="tooltip" hidden></div>`;

    // Tooltip por fila
    const tip = cont.querySelector(".tooltip");
    cont.querySelectorAll(".fila").forEach((g) => {
      g.addEventListener("mousemove", (e) => {
        const f = filas[+g.dataset.i];
        const d = f.a - f.b;
        tip.innerHTML = `<strong>${esc(f.etiqueta)}</strong>
          <div><i class="punto a"></i>${esc(state.a)}: ${fmtValor(f.a)}</div>
          <div><i class="punto b"></i>${esc(state.b)}: ${fmtValor(f.b)}</div>` +
          (state.metrica === "uf" ? `<div class="tdif">Diferencia: ${d >= 0 ? "+" : "−"}${fmt.format(Math.abs(d))} UF</div>` : "");
        tip.hidden = false;
        const rc = cont.getBoundingClientRect();
        let left = e.clientX - rc.left + 14;
        if (left + tip.offsetWidth > rc.width) left = e.clientX - rc.left - tip.offsetWidth - 14;
        tip.style.left = Math.max(0, left) + "px";
        tip.style.top = (e.clientY - rc.top + 12) + "px";
        g.classList.add("activa");
      });
      g.addEventListener("mouseleave", () => { tip.hidden = true; g.classList.remove("activa"); });
    });
  }

  function renderTabla(c) {
    const pct = (v, t) => (t ? fmt1.format((v / t) * 100) + " %" : "–");
    $("#tabla thead").innerHTML = `<tr>
      <th>Ramo</th>
      <th>${state.a}<br><small>UF</small></th><th><small>% cartera</small></th>
      <th>${state.b}<br><small>UF</small></th><th><small>% cartera</small></th>
      <th>Diferencia A − B<br><small>UF</small></th></tr>`;

    const filas = [...c.filas].sort((x, y) => (y.a + y.b) - (x.a + x.b));
    // Agrupa por sección cuando corresponde (Vida)
    let html = "";
    const grupos = state.seccion === "todas" && filas.some((f) => f.seccion)
      ? [...new Set(mercado().ramos.map((r) => r.seccion))]
      : [null];
    for (const g of grupos) {
      const sub = g === null ? filas : filas.filter((f) => f.seccion === g);
      if (!sub.length) continue;
      if (g) html += `<tr class="seccion-fila"><td colspan="6">${g}</td></tr>`;
      for (const f of sub) {
        const d = f.a - f.b;
        html += `<tr><td>${f.nombre}</td>
          <td>${fmt.format(f.a)}</td><td>${pct(f.a, c.totA)}</td>
          <td>${fmt.format(f.b)}</td><td>${pct(f.b, c.totB)}</td>
          <td class="${d >= 0 ? "pos" : "neg"}">${d >= 0 ? "+" : "−"}${fmt.format(Math.abs(d))}</td></tr>`;
      }
    }
    const dt = c.totA - c.totB;
    html += `<tr class="total"><td>Total</td>
      <td>${fmt.format(c.totA)}</td><td>100 %</td>
      <td>${fmt.format(c.totB)}</td><td>100 %</td>
      <td class="${dt >= 0 ? "pos" : "neg"}">${dt >= 0 ? "+" : "−"}${fmt.format(Math.abs(dt))}</td></tr>`;
    $("#tabla tbody").innerHTML = html;
  }

  function render() {
    marcarBotones();
    const c = calcular();
    renderKPIs(c);
    renderGrafico(c);
    renderTabla(c);
    escribirHash();
  }

  /* ---------- Eventos ---------- */
  function enlazar() {
    $("#mercado").addEventListener("click", (e) => {
      const v = e.target.closest("button")?.dataset.v;
      if (!v || v === state.mercado) return;
      state.mercado = v;
      state.seccion = "todas";
      poblarSecciones();
      poblarCompanias();
      render();
    });
    $("#metrica").addEventListener("click", (e) => {
      const v = e.target.closest("button")?.dataset.v;
      if (!v) return;
      state.metrica = v;
      render();
    });
    $("#selA").addEventListener("change", (e) => {
      if (e.target.value === state.b) state.b = state.a;
      state.a = e.target.value;
      $("#selB").value = state.b;
      render();
    });
    $("#selB").addEventListener("change", (e) => {
      if (e.target.value === state.a) state.a = state.b;
      state.b = e.target.value;
      $("#selA").value = state.a;
      render();
    });
    $("#swap").addEventListener("click", () => {
      [state.a, state.b] = [state.b, state.a];
      $("#selA").value = state.a;
      $("#selB").value = state.b;
      render();
    });
    $("#selSeccion").addEventListener("change", (e) => {
      state.seccion = e.target.value;
      render();
    });
    $("#verTodos").addEventListener("change", (e) => {
      state.verTodos = e.target.checked;
      render();
    });
    let tRes, anchoPrevio = 0;
    new ResizeObserver(() => {
      const w = $("#contGrafico").clientWidth;
      if (w === anchoPrevio) return;
      anchoPrevio = w;
      clearTimeout(tRes);
      tRes = setTimeout(() => ultimoCalculo && renderGrafico(ultimoCalculo), 120);
    }).observe($("#contGrafico"));
  }

  /* ---------- Inicio ---------- */
  fetch("data/primas.json")
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then((d) => {
      DATA = d;
      $("#subtitulo").textContent = `Prima directa por compañía y ramo · cifras en UF al ${d.fecha}`;
      $("#pie").textContent =
        `Fuente: ${d.fuente} (hojas "Gen. Prima Directa" y "Vida Prima Directa"). ` +
        `Cifras acumuladas al ${d.fecha}, expresadas en UF.`;
      leerHash();
      poblarSecciones();
      poblarCompanias();
      enlazar();
      render();
    })
    .catch((err) => {
      $("#kpis").innerHTML = `<div class="kpi">No se pudieron cargar los datos (${err.message}). ` +
        `Si abriste el archivo directamente, usa un servidor local: <code>python -m http.server</code>.</div>`;
    });
})();
