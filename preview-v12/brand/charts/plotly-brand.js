/* ═══════════════════════════════════════════════════════════════
   PATRICK MILHAUPT — BRAND CHART SYSTEM   v1.0
   charts/plotly-brand.js   →   the canonical Plotly theme

   ONE chart look for the whole practice. Charts are ALWAYS rendered
   in the dark navy style — on web, in digital marketing, AND when
   embedded inside light / print materials. A data graphic is a
   "lit instrument panel" against navy theatre; it never inverts.

   Visual DNA (mirrors the Lake Forest reference):
   - Deep navy plotting field. Hairline grid. No chart junk.
   - SUPPLY series are translucent filled areas in brand navy/blue/
     teal — "shaded overlays of different data sets" stacked front
     to back, largest in back.
   - DEMAND series are bright signal LINES — pink + yellow — that
     ride a secondary right-hand axis.
   - Faint centered Sotheby's wordmark watermark behind the field.
   - Inter for labels, JetBrains Mono for every numeral.

   USAGE
   ─────
   <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
   <script src="charts/plotly-brand.js"></script>
   ...
   const C = window.BrandCharts;
   Plotly.newPlot(el,
     [ C.area('Homes For Sale', x, y, 'neutral'),
       C.area('New Listings',  x, y, 'blue'),
       C.area('Under Contract',x, y, 'teal'),
       C.line('Months Supply', x, y, 'yellow', { axis: 'right' }),
       C.line('Shows Per Listing', x, y, 'pink', { axis: 'right' }) ],
     C.layout({
       title: 'Lake Forest Housing Supply & Demand<br><sub>($1,195,000 or Greater)</sub>',
       y:  { title: '', range: [0, 250] },
       y2: { title: '', range: [0, 8] },
       watermark: { src: '../assets/logos/wordmark-white-xl.png' }
     }),
     C.config
   );
   ═══════════════════════════════════════════════════════════════ */

(function () {

  /* ─── TOKENS ─────────────────────────────────────────────────── */
  const TOKEN = {
    paper:    '#071229',   /* page behind the plot — deepest navy */
    plot:     '#0A1838',   /* the plotting field */
    grid:     'rgba(255,255,255,0.055)',
    gridStrong:'rgba(255,255,255,0.09)',
    zero:     'rgba(255,255,255,0.14)',
    axis:     'rgba(255,255,255,0.14)',
    tick:     '#9FB0CC',   /* tick labels */
    title:    '#FFFFFF',
    legend:   '#C8D3E4',
    fontSans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontMono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  };

  /* SERIES PALETTE
     Fills are brand-toned (navy / royal-blue / teal). Lines are the
     two bright SIGNAL colors kept from the reference — pink + yellow —
     reserved exclusively for demand / ratio series.                  */
  const SERIES = {
    neutral: { line: 'rgba(168,180,205,0.65)', fill: 'rgba(120,134,173,0.26)' }, /* Homes For Sale */
    blue:    { line: 'rgba(79,143,255,0.95)',  fill: 'rgba(47,107,255,0.34)'  }, /* New Listings   */
    teal:    { line: 'rgba(45,212,191,0.95)',  fill: 'rgba(45,212,191,0.28)'  }, /* Under Contract */
    indigo:  { line: 'rgba(139,139,250,0.95)', fill: 'rgba(74,74,246,0.26)'   }, /* alt supply     */
    gold:    { line: 'rgba(240,214,138,0.95)', fill: 'rgba(184,134,11,0.22)'  }, /* hero highlight */
    /* bright signal LINES (no fill) — demand */
    pink:    { line: '#FF2E74', fill: 'rgba(255,46,116,0.10)' },                 /* Shows Per Listing */
    yellow:  { line: '#FFE24D', fill: 'rgba(255,226,77,0.10)'  },                /* Months Supply     */
  };

  /* ─── TRACE BUILDERS ─────────────────────────────────────────── */

  /* A translucent SUPPLY area, filled to zero. Stack largest first. */
  function area(name, x, y, tone, opts) {
    opts = opts || {};
    const c = SERIES[tone] || SERIES.neutral;
    return Object.assign({
      type: 'scatter', mode: 'lines', name: name,
      x: x, y: y,
      fill: 'tozeroy', fillcolor: c.fill,
      line: { color: c.line, width: opts.width || 1.25, shape: opts.shape || 'spline', smoothing: 0.6 },
      yaxis: opts.axis === 'right' ? 'y2' : 'y',
      hovertemplate: '%{fullData.name}: <b>%{y}</b><extra></extra>',
    }, opts.trace || {});
  }

  /* A bright DEMAND line, no fill. Rides the right axis by default.  */
  function line(name, x, y, tone, opts) {
    opts = opts || {};
    const c = SERIES[tone] || SERIES.pink;
    return Object.assign({
      type: 'scatter', mode: 'lines', name: name,
      x: x, y: y,
      line: { color: c.line, width: opts.width || 3, shape: opts.shape || 'spline', smoothing: 0.5 },
      yaxis: opts.axis === 'left' ? 'y' : 'y2',
      hovertemplate: '%{fullData.name}: <b>%{y}</b><extra></extra>',
    }, opts.trace || {});
  }

  /* Vertical bars (e.g. lead-time, single-axis comparisons).         */
  function bars(name, x, y, tone, opts) {
    opts = opts || {};
    const c = SERIES[tone] || SERIES.blue;
    return Object.assign({
      type: 'bar', name: name, x: x, y: y,
      marker: {
        color: c.fill, line: { color: c.line, width: 1 },
      },
      yaxis: opts.axis === 'right' ? 'y2' : 'y',
      hovertemplate: '%{fullData.name}: <b>%{y}</b><extra></extra>',
    }, opts.trace || {});
  }

  /* ─── WATERMARK ──────────────────────────────────────────────── */
  /* Faint centered wordmark behind the plotting field. Pass a src
     (white wordmark PNG). Returns a layout.images[] entry.           */
  function watermark(o) {
    o = o || {};
    if (!o.src) return null;
    return {
      source: o.src,
      xref: 'paper', yref: 'paper',
      x: 0.5, y: 0.5, sizex: o.sizex || 0.62, sizey: o.sizey || 0.62,
      xanchor: 'center', yanchor: 'middle',
      sizing: 'contain', opacity: o.opacity != null ? o.opacity : 0.05,
      layer: 'below',
    };
  }

  /* ─── AXIS FACTORY ───────────────────────────────────────────── */
  function axis(spec, isRight) {
    spec = spec || {};
    return {
      title: spec.title != null ? { text: spec.title, font: { family: TOKEN.fontSans, size: 12, color: TOKEN.tick } } : undefined,
      range: spec.range,
      showgrid: spec.showgrid != null ? spec.showgrid : !isRight,
      gridcolor: TOKEN.grid, gridwidth: 1,
      zeroline: true, zerolinecolor: TOKEN.zero, zerolinewidth: 1,
      showline: false,
      tickfont: { family: TOKEN.fontMono, size: 11, color: TOKEN.tick },
      tickcolor: TOKEN.axis, ticklen: 4,
      tickformat: spec.tickformat,
      dtick: spec.dtick,
      overlaying: isRight ? 'y' : undefined,
      side: isRight ? 'right' : 'left',
      anchor: isRight ? 'x' : undefined,
      automargin: true,
    };
  }

  /* ─── LAYOUT ─────────────────────────────────────────────────── */
  function layout(o) {
    o = o || {};
    const images = [];
    const wm = watermark(o.watermark);
    if (wm) images.push(wm);

    const L = {
      paper_bgcolor: TOKEN.paper,
      plot_bgcolor:  TOKEN.plot,
      font: { family: TOKEN.fontSans, color: TOKEN.tick, size: 12 },
      title: o.title ? {
        text: o.title,
        font: { family: TOKEN.fontSans, size: 20, color: TOKEN.title, weight: 700 },
        x: 0.5, xanchor: 'center', y: 0.95, yanchor: 'top',
      } : undefined,
      margin: Object.assign({ l: 56, r: 56, t: o.title ? 84 : 28, b: 64 }, o.margin || {}),
      xaxis: {
        showgrid: true, gridcolor: TOKEN.grid, gridwidth: 1,
        zeroline: false, showline: false,
        tickfont: { family: TOKEN.fontSans, size: 11, color: TOKEN.tick },
        tickcolor: TOKEN.axis, ticklen: 4,
        type: o.x && o.x.type ? o.x.type : undefined,
        dtick: o.x && o.x.dtick, tickformat: o.x && o.x.tickformat,
        range: o.x && o.x.range,
        automargin: true,
      },
      yaxis:  axis(o.y, false),
      images: images,
      hovermode: 'x unified',
      hoverlabel: {
        bgcolor: 'rgba(7,18,41,0.94)', bordercolor: 'rgba(240,214,138,0.30)',
        font: { family: TOKEN.fontMono, size: 12, color: '#fff' },
      },
      legend: {
        orientation: 'h', x: 0.5, xanchor: 'center', y: -0.14, yanchor: 'top',
        font: { family: TOKEN.fontSans, size: 12, color: TOKEN.legend },
        bgcolor: 'rgba(0,0,0,0)',
        itemsizing: 'constant',
      },
      showlegend: o.showlegend !== false,
      barmode: o.barmode,
      bargap: o.bargap,
    };
    if (o.y2) L.yaxis2 = axis(o.y2, true);
    return Object.assign(L, o.layout || {});
  }

  /* ─── CONFIG ─────────────────────────────────────────────────── */
  const config = {
    displayModeBar: false,
    responsive: true,
    scrollZoom: false,
    doubleClick: false,
  };

  /* ─── PUBLIC API ─────────────────────────────────────────────── */
  window.BrandCharts = {
    TOKEN, SERIES,
    area, line, bars, watermark, axis, layout, config,
    /* convenience one-shot */
    draw: function (el, traces, opts) {
      return Plotly.newPlot(el, traces, layout(opts), config);
    },
  };
})();
