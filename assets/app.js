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

  const DATOS = window.DATOS;
  if (!DATOS || !DATOS.periodos) {
    document.querySelector("main").innerHTML =
      '<p class="tarjeta">No se encontraron los datos. Revisa que la carpeta <code>data</code> esté junto a <code>index.html</code>.</p>';
    return;
  }
  const TOP_N = 12;
  const PESTANAS = ["ranking", "comparador", "eerr", "evolucion"];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  // Período activo: D = datos del período, C = compañías, cuenta = EERR por código
  let D, C, cuenta;
  function usarPeriodo(fecha) {
    D = DATOS.periodos.find((p) => p.fecha === fecha) || DATOS.periodos[0];
    C = D.companias;
    cuenta = Object.fromEntries(D.eerr.map((c) => [c.codigo, c]));
    state.periodo = D.fecha;
    if (!C.includes(state.a)) state.a = null;
    if (!C.includes(state.b)) state.b = null;
    if (!C.includes(state.comp)) state.comp = null;
  }
  // "30.06.2026" -> "ene–jun 2026"
  const rangoPeriodo = (fecha) => {
    const [, m, a] = fecha.split(".");
    return `ene–${MESES[+m - 1]} ${a}`;
  };
  const etiquetaPeriodo = (fecha) => {
    const [d, m, a] = fecha.split(".");
    return `${d} ${MESES[+m - 1]} ${a} (acumulado ${rangoPeriodo(fecha)})`;
  };

  const state = {
    tab: "ranking", a: null, b: null, periodo: null,
    comp: null, periodoComp: null, metricaEvo: "part", verTodosEvo: false,
    metrica: "uf", verTodos: false, verDetalle: false,
    ordenRanking: { campo: "rank", dir: 1 }, busqueda: "",
  };

  /* =================== URL (pestaña y compañías) =================== */
  function leerHash() {
    const [tab, q] = location.hash.slice(1).split("?");
    if (PESTANAS.includes(tab)) state.tab = tab;
    const p = new URLSearchParams(q || "");
    usarPeriodo(p.get("p"));
    if (C.includes(p.get("a"))) state.a = p.get("a");
    if (C.includes(p.get("b"))) state.b = p.get("b");
    if (C.includes(p.get("c"))) state.comp = p.get("c");
    if (DATOS.periodos.some((x) => x.fecha === p.get("q"))) state.periodoComp = p.get("q");
  }
  function escribirHash() {
    const q = new URLSearchParams({ p: state.periodo });
    if (state.tab === "comparador" || state.tab === "eerr") { q.set("a", state.a); q.set("b", state.b); }
    if (state.tab === "evolucion") { q.set("c", state.comp); q.set("q", state.periodoComp); }
    history.replaceState(null, "", "#" + state.tab + "?" + q);
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

  function dibujarBarras(cont, filas, opciones) {
    cont._ultimo = [filas, opciones];
    const { fmtTick, fmtValor, conDiferencia, fmtDif } = opciones;
    const nA = opciones.nombreA || state.a, nB = opciones.nombreB || state.b;
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

    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras: ${esc(nA)} versus ${esc(nB)}">`;
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
          <div><i class="punto a"></i>${esc(nA)}: ${fmtValor(f.a)}</div>
          <div><i class="punto b"></i>${esc(nB)}: ${fmtValor(f.b)}</div>` +
          (fmtDif ? `<div class="tdif">Diferencia: ${fmtDif(d)}</div>` :
            conDiferencia ? `<div class="tdif">Diferencia: ${signo(d)}${fmt.format(Math.abs(d))} UF</div>` : ""));
        g.classList.add("activa");
      });
      g.addEventListener("mouseleave", () => { ocultarTip(); g.classList.remove("activa"); });
    });
  }

  function leyendas() {
    document.querySelectorAll(".leyenda:not([data-propia])").forEach((el) => {
      el.innerHTML = `<span><i class="punto a"></i>${esc(state.a)}</span><span><i class="punto b"></i>${esc(state.b)}</span>`;
    });
  }

  /* =================== 1. Ranking =================== */
  function datosRanking(P = D) {
    const total = P.prima.mercado;
    const filas = P.companias.map((n, i) => ({ nombre: n, prima: P.prima.totales[i] }))
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

  /* =================== 4. Evolución entre períodos =================== */
  // Compara la misma compañía en dos períodos usando proporciones (participación de mercado,
  // % de cartera, % de la prima directa), porque los montos acumulados de períodos con distinta
  // cantidad de meses no son comparables.
  const corto = (fecha) => { const [, m, a] = fecha.split("."); return `${MESES[+m - 1]} ${a}`; };
  const pp = (n) => (Math.abs(n) < 0.05 ? "0,0 pp" : `${signo(n)}${fmt1.format(Math.abs(n))} pp`);
  const ppCls = (n) => (Math.abs(n) < 0.05 ? "" : n > 0 ? "pos" : "neg");
  const LINEAS_RATIO = [
    ["5.31.11.00", "Prima retenida (retención)"],
    ["5.31.13.00", "Costo de siniestros"],
    ["5.31.15.00", "Resultado de intermediación"],
    ["5.31.16.00", "Gastos por reaseguro no proporcional"],
    ["5.31.10.00", "Margen de contribución"],
    ["5.31.20.00", "Costos de administración"],
    ["5.31.30.00", "Resultado de inversiones"],
    ["5.31.40.00", "Resultado técnico de seguros"],
    ["5.31.00.00", "Resultado del período"],
  ];

  function renderEvolucion() {
    // P1 = período más reciente, P2 = el anterior (la variación siempre va de P2 a P1)
    let P1 = D, P2 = DATOS.periodos.find((x) => x.fecha === state.periodoComp);
    const clave = (f) => f.split(".").reverse().join("");
    if (P2 && clave(P2.fecha) > clave(P1.fecha)) [P1, P2] = [P2, P1];
    const nombre = state.comp;
    const n1 = corto(P1.fecha), n2 = P2 ? corto(P2.fecha) : "";
    $("#leyendaEvo").innerHTML = `<span><i class="punto a"></i>${esc(n1)}</span><span><i class="punto b"></i>${esc(n2)}</span>`;

    const i1 = P1.companias.indexOf(nombre), i2 = P2 ? P2.companias.indexOf(nombre) : -1;
    if (!P2 || i2 < 0) {
      $("#kpisEvo").innerHTML = `<div class="kpi">${esc(nombre)} no aparece en el informe de ${esc(n2 || "comparación")}.</div>`;
      ["#graficoEvo", "#tablaEvo thead", "#tablaEvo tbody", "#tablaRatios thead", "#tablaRatios tbody"].forEach((s) => ($(s).innerHTML = ""));
      return;
    }

    // KPIs
    const r1 = datosRanking(P1).find((f) => f.nombre === nombre);
    const r2 = datosRanking(P2).find((f) => f.nombre === nombre);
    const ratio = (P, i, cod) => {
      const c = Object.fromEntries(P.eerr.map((x) => [x.codigo, x]));
      const pd = c["5.31.11.10"].valores[i];
      return pd ? (c[cod].valores[i] / pd) * 100 : null;
    };
    const m1 = ratio(P1, i1, "5.31.00.00"), m2 = ratio(P2, i2, "5.31.00.00");
    const dPart = (r1.part - r2.part) * 100, dRank = r2.rank - r1.rank;
    const tarjeta = (titulo, v1, v2, det) => `
      <div class="kpi"><div class="etq"><span>${titulo}</span></div>
        <div class="par">
          <div><i class="punto a"></i>${v1}<small>${esc(n1)}</small></div>
          <div><i class="punto b"></i>${v2}<small>${esc(n2)}</small></div>
        </div>
        <div class="det">${det}</div></div>`;
    $("#kpisEvo").innerHTML =
      tarjeta("Participación de mercado", fmt1.format(r1.part * 100) + " %", fmt1.format(r2.part * 100) + " %",
        `<span class="${ppCls(dPart)}">${pp(dPart)}</span> desde ${esc(n2)}`) +
      tarjeta("Posición en el ranking", `#${r1.rank} de ${P1.companias.length}`, `#${r2.rank} de ${P2.companias.length}`,
        dRank === 0 ? "Mantiene su posición" :
          `<span class="${dRank > 0 ? "pos" : "neg"}">${dRank > 0 ? "Sube" : "Baja"} ${Math.abs(dRank)} ${Math.abs(dRank) === 1 ? "puesto" : "puestos"}</span>`) +
      tarjeta("Resultado del período / prima directa",
        m1 === null ? "–" : fmt1.format(m1) + " %", m2 === null ? "–" : fmt1.format(m2) + " %",
        m1 === null || m2 === null ? "" : `<span class="${ppCls(m1 - m2)}">${pp(m1 - m2)}</span>`);

    // Ramos: participación de mercado y % de cartera en cada período
    const tot1 = P1.prima.totales[i1], tot2 = P2.prima.totales[i2];
    const ramos2 = Object.fromEntries(P2.prima.ramos.map((r) => [r.nombre, r]));
    const filas = P1.prima.ramos.map((r) => {
      const q = ramos2[r.nombre] || { valores: [], mercado: 0 };
      const v1 = r.valores[i1], v2 = q.valores[i2] || 0;
      return {
        etiqueta: r.nombre, v1, v2,
        part1: r.mercado ? (v1 / r.mercado) * 100 : 0, part2: q.mercado ? (v2 / q.mercado) * 100 : 0,
        cart1: tot1 ? (v1 / tot1) * 100 : 0, cart2: tot2 ? (v2 / tot2) * 100 : 0,
      };
    }).filter((f) => Math.abs(f.v1) >= 1 || Math.abs(f.v2) >= 1);

    const esPart = state.metricaEvo === "part";
    document.querySelectorAll("#metricaEvo button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === state.metricaEvo)));
    $("#tituloEvo").textContent = esPart
      ? `Participación de mercado de ${nombre} en cada ramo`
      : `Composición de la cartera de ${nombre} (% de su prima)`;
    // Orden: ramos más importantes para la compañía primero (según su % de cartera)
    let barras = [...filas].sort((x, y) => Math.max(y.cart1, y.cart2) - Math.max(x.cart1, x.cart2))
      .map((f) => ({ etiqueta: f.etiqueta, a: esPart ? f.part1 : f.cart1, b: esPart ? f.part2 : f.cart2 }));
    if (!state.verTodosEvo) barras = barras.slice(0, TOP_N);
    dibujarBarras($("#graficoEvo"), barras, {
      nombreA: n1, nombreB: n2,
      fmtTick: (v) => fmt.format(v) + " %",
      fmtValor: (v) => fmt1.format(v) + " %",
      fmtDif: pp,
    });
    $("#notaEvo").textContent = esPart
      ? "Participación = prima de la compañía en el ramo ÷ prima del mercado en ese ramo."
      : "Cada barra muestra qué porcentaje de la prima total de la compañía viene de ese ramo.";

    $("#tablaEvo thead").innerHTML = `<tr><th>Ramo</th>
      <th>Part. mercado<br><small>${esc(n1)}</small></th><th><br><small>${esc(n2)}</small></th><th>Var.<br><small>pp</small></th>
      <th>% cartera<br><small>${esc(n1)}</small></th><th><br><small>${esc(n2)}</small></th><th>Var.<br><small>pp</small></th></tr>`;
    $("#tablaEvo tbody").innerHTML = [...filas].sort((x, y) => Math.max(y.cart1, y.cart2) - Math.max(x.cart1, x.cart2)).map((f) => `
      <tr><td class="cuenta">${esc(f.etiqueta)}</td>
        <td>${fmt1.format(f.part1)} %</td><td>${fmt1.format(f.part2)} %</td><td class="${ppCls(f.part1 - f.part2)}">${pp(f.part1 - f.part2)}</td>
        <td>${fmt1.format(f.cart1)} %</td><td>${fmt1.format(f.cart2)} %</td><td class="${ppCls(f.cart1 - f.cart2)}">${pp(f.cart1 - f.cart2)}</td></tr>`).join("") +
      `<tr class="total"><td>Total</td><td>${fmt1.format(r1.part * 100)} %</td><td>${fmt1.format(r2.part * 100)} %</td>
        <td class="${ppCls(dPart)}">${pp(dPart)}</td><td>100 %</td><td>100 %</td><td></td></tr>`;

    // Indicadores del estado de resultados como % de la prima directa
    $("#tablaRatios thead").innerHTML = `<tr><th>Línea (% de la prima directa)</th>
      <th>${esc(n1)}</th><th>${esc(n2)}</th><th>Var.<br><small>pp</small></th></tr>`;
    $("#tablaRatios tbody").innerHTML = LINEAS_RATIO.map(([cod, etq]) => {
      const a = ratio(P1, i1, cod), b = ratio(P2, i2, cod);
      const d = a === null || b === null ? null : a - b;
      const fila = cod === "5.31.00.00" ? ' class="total"' : "";
      return `<tr${fila}><td class="cuenta">${etq}</td>
        <td>${a === null ? "–" : fmt1.format(a) + " %"}</td><td>${b === null ? "–" : fmt1.format(b) + " %"}</td>
        <td class="${d === null ? "" : ppCls(d)}">${d === null ? "–" : pp(d)}</td></tr>`;
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
    // Pestaña Evolución: una compañía y un período de comparación
    if (!state.comp) state.comp = state.a;
    $("#selComp").innerHTML = opciones;
    $("#selComp").value = state.comp;
    const otros = DATOS.periodos.filter((x) => x.fecha !== state.periodo);
    if (!otros.some((x) => x.fecha === state.periodoComp)) state.periodoComp = otros[0]?.fecha || null;
    $("#selPeriodoComp").innerHTML = otros.map((x) => `<option value="${esc(x.fecha)}">${esc(etiquetaPeriodo(x.fecha))}</option>`).join("");
    $("#selPeriodoComp").value = state.periodoComp;
    $("#tab-evolucion").hidden = otros.length === 0;
  }

  function render() {
    $("#subtitulo").textContent = `Prima directa y estado de resultados por compañía · cifras en UF, acumuladas ${rangoPeriodo(D.fecha)}`;
    $("#pie").textContent = `Fuente: ${D.fuente} (hojas "Gen. Prima Directa" y "Gen. EERR"). Cifras acumuladas al ${D.fecha}, en UF.`;
    PESTANAS.forEach((t) => {
      $("#tab-" + t).setAttribute("aria-selected", String(t === state.tab));
      $("#panel-" + t).hidden = t !== state.tab;
    });
    $("#selectores").hidden = state.tab === "ranking" || state.tab === "evolucion";
    $("#selA").value = state.a;
    $("#selB").value = state.b;
    leyendas();
    ocultarTip();
    if (state.tab === "ranking") renderRanking();
    if (state.tab === "comparador") renderComparador();
    if (state.tab === "eerr") renderEerr();
    if (state.tab === "evolucion") renderEvolucion();
    escribirHash();
  }

  function enlazar() {
    $("#selPeriodo").addEventListener("change", (e) => {
      usarPeriodo(e.target.value);
      poblarSelectores();
      render();
    });
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
    $("#selComp").addEventListener("change", (e) => { state.comp = e.target.value; render(); });
    $("#selPeriodoComp").addEventListener("change", (e) => { state.periodoComp = e.target.value; render(); });
    $("#metricaEvo").addEventListener("click", (e) => {
      const v = e.target.closest("button")?.dataset.v;
      if (v) { state.metricaEvo = v; render(); }
    });
    $("#swap").addEventListener("click", () => { [state.a, state.b] = [state.b, state.a]; render(); });

    $("#metrica").addEventListener("click", (e) => {
      const v = e.target.closest("button")?.dataset.v;
      if (v) { state.metrica = v; render(); }
    });
    $("#verTodos").addEventListener("change", (e) => { state.verTodos = e.target.checked; render(); });
    $("#verTodosEvo").addEventListener("change", (e) => { state.verTodosEvo = e.target.checked; render(); });
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
  leerHash();
  $("#selPeriodo").innerHTML = DATOS.periodos
    .map((p) => `<option value="${esc(p.fecha)}">${esc(etiquetaPeriodo(p.fecha))}</option>`).join("");
  $("#selPeriodo").value = state.periodo;
  poblarSelectores();
  enlazar();
  render();
})();
