/* ════════════════════════════════════════════════════════════════════
   GOLD-DUST LOCKUP  —  v12 signature hero motion
   The Sotheby's wordmark + "Patrick Milhaupt" lockup assembles from a
   storm of gold dust, holds, then sharpens into the crisp real lockup.
   Pure 2D canvas (robust everywhere). Honors prefers-reduced-motion.

   Usage:
     DustLockup.mount({
       canvas, drawTarget(ctx,w,h,scale), onSettled(){}, density, reduce
     })
   drawTarget() must paint the lockup (wordmark image + name text) in
   WHITE/opaque onto the sampling context; the engine reads its pixels as
   particle homes and tints them with the brand gold ramp.
   ════════════════════════════════════════════════════════════════════ */
(function (global) {
  const GOLD = [        // champagne → 14k → bright, sampled per particle
    [255, 244, 208], [240, 214, 138], [212, 167, 96], [184, 134, 11], [255, 215, 0]
  ];
  const pick = a => a[(Math.random() * a.length) | 0];
  const EASE = t => 1 - Math.pow(1 - t, 3);            // ease-out cubic (no bounce)

  function sprite() {                                  // one reusable glow dot
    const s = 16, c = document.createElement('canvas'); c.width = c.height = s;
    const x = c.getContext('2d'), g = x.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,240,200,0.9)');
    g.addColorStop(1, 'rgba(255,215,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(s/2, s/2, s/2, 0, 7); x.fill();
    return c;
  }

  function mount(opts) {
    const { canvas, drawTarget, onSettled } = opts;
    const reduce = opts.reduce ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(devicePixelRatio || 1, 2);
    const dot = sprite();
    let W, H, parts = [], raf, t0, settled = false, mouse = { x: -9999, y: -9999 };
    const density = opts.density || 1;

    function build() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      // 1) paint the lockup into an offscreen buffer at display size
      const buf = document.createElement('canvas'); buf.width = W; buf.height = H;
      const bx = buf.getContext('2d');
      drawTarget(bx, W, H);
      const data = bx.getImageData(0, 0, W, H).data;

      // 2) sample opaque pixels → particle homes
      const small = W < 760;
      const step = Math.max(3, Math.round((small ? 5 : 4) / density));   // px between samples
      const homes = [];
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          const a = data[(y * W + x) * 4 + 3];
          if (a > 130) homes.push([x + (Math.random()*step - step/2), y + (Math.random()*step - step/2)]);
        }
      }
      // budget
      const MAX = small ? 2600 : 5200;
      while (homes.length > MAX) homes.splice((Math.random()*homes.length)|0, 1);

      // 3) spawn particles scattered, with L→R stagger so it sweeps into place
      parts = homes.map(h => {
        const ang = Math.random() * Math.PI * 2, rad = Math.max(W, H) * (0.35 + Math.random()*0.6);
        const col = pick(GOLD);
        return {
          hx: h[0], hy: h[1],
          x: W/2 + Math.cos(ang)*rad, y: H/2 + Math.sin(ang)*rad,
          delay: (h[0] / W) * 0.55 + Math.random()*0.25,   // left forms first
          dur: 1.15 + Math.random()*0.7,
          size: 1.3 + Math.random()*2.2,
          r: col[0], g: col[1], b: col[2],
          ph: Math.random()*Math.PI*2
        };
      });
      if (reduce) { parts.forEach(p => { p.x = p.hx; p.y = p.hy; }); }
    }

    function frame(now) {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      let allHome = true;
      const shimmer = (Math.sin(t * 0.9) * 0.5 + 0.5);          // 0..1 sweep
      for (const p of parts) {
        let life = (t - p.delay) / p.dur;
        if (life < 0) { allHome = false; }
        if (life < 1) allHome = false;
        const e = life <= 0 ? 0 : life >= 1 ? 1 : EASE(life);
        // position
        let px = p.x + (p.hx - p.x) * e;
        let py = p.y + (p.hy - p.y) * e;
        if (e >= 1 && !reduce) {                                  // settled: drift + cursor repel
          px += Math.sin(t * 1.3 + p.ph) * 0.7;
          py += Math.cos(t * 1.1 + p.ph) * 0.7;
          const dx = px - mouse.x, dy = py - mouse.y, d2 = dx*dx + dy*dy;
          if (d2 < 9000) { const f = (9000 - d2) / 9000 * 14; const d = Math.sqrt(d2)||1; px += dx/d*f; py += dy/d*f; }
        }
        // brightness: arrival flash + slow shimmer band near particle x
        const band = 1 - Math.min(1, Math.abs(p.hx / W - shimmer) * 3.5);
        const bright = (e < 1 ? 0.5 + e*0.6 : 0.85) + band * 0.5;
        const s = p.size * (e < 1 ? (0.7 + e*0.6) : 1) * 2.4;
        ctx.globalAlpha = Math.min(1, (e < 0.05 ? e*8 : 1) * bright) * (settled ? settledAlpha : 1);
        // tint the white sprite by drawing then a color veil is costly; use shadow-free tint:
        ctx.drawImage(dot, px - s/2, py - s/2, s, s);
      }
      // a faint colored wash so the dust reads gold, not white
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.5; ctx.fillStyle = 'rgba(214,167,96,1)'; ctx.fillRect(0,0,W,H);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

      if (allHome && !settled) { settled = true; settleAt = t; onSettled && onSettled(); }
      if (settled) settledAlpha = Math.max(0.16, 1 - (t - settleAt) / 1.4);  // fade dust to ambient
      raf = requestAnimationFrame(frame);
    }

    let settleAt = 0, settledAlpha = 1;
    build();
    if (reduce) {                       // static: draw target once, signal settled
      onSettled && onSettled();
      // render a soft dust still
      t0 = performance.now(); requestAnimationFrame(frame);
      setTimeout(() => cancelAnimationFrame(raf), 1200);
      return { destroy(){ cancelAnimationFrame(raf); } };
    }
    addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    }, { passive: true });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { settled=false; settledAlpha=1; build(); t0 = performance.now(); }, 220); });
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
    return { destroy(){ cancelAnimationFrame(raf); } };
  }

  global.DustLockup = { mount };
})(window);
