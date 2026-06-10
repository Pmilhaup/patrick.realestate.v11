/* ═══════════════════════════════════════════════════════════════
   PATRICK MILHAUPT — BRAND SYSTEM   v3.4 "Dazzle Edition"
   liquid-bg.js   →   the signature "navy satin + gold inkwash" canvas

   A self-contained painterly WebGL background. Drop it on any dark page
   to get the exact living backdrop used on the North Shore story page.

   ── Usage ──────────────────────────────────────────────────────
     <!-- 1. three.js (once, before this file) -->
     <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.1/three.min.js"></script>
     <!-- 2. this module -->
     <script src="liquid-bg.js"></script>

   It injects a fixed full-bleed <canvas id="paint"> behind everything
   (and a soft vignette veil), then animates. If a #paint canvas already
   exists it reuses it — so it is a drop-in for pages that already had the
   inline shader (e.g. the story page) without changing their markup.

   ── Options (attributes on <body>) ─────────────────────────────
     data-liquid-palette="0.38"   gold-inkwash strength 0..1 (default 0.38)
     data-liquid-veil="off"       skip the vignette veil (page supplies its own)

   ── Hooks ──────────────────────────────────────────────────────
     window.__paintUniforms       live uniforms — orchestrate uScroll /
                                   uPaletteMix from a scroll timeline if desired.

   Falls back silently to the CSS --atmosphere background if three.js is
   missing or WebGL is unavailable, and renders a single still frame under
   prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  if (window.__liquidBgInit) return;
  window.__liquidBgInit = true;

  function init() {
    if (typeof THREE === 'undefined') {
      console.warn('[liquid-bg] three.js not found — falling back to CSS --atmosphere.');
      return;
    }

    var body = document.body;

    // Reuse an existing #paint canvas if the page already declared one;
    // otherwise create and insert one behind all content.
    var canvas = document.getElementById('paint');
    var created = false;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'paint';
      canvas.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;';
      body.insertBefore(canvas, body.firstChild);
      created = true;
    }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    } catch (e) {
      console.warn('[liquid-bg] WebGL unavailable — falling back to CSS --atmosphere.', e);
      if (created) canvas.remove();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Vignette veil — skip if the page supplies its own (.veil/.vignette)
    // or explicitly opts out.
    var wantVeil = body.getAttribute('data-liquid-veil') !== 'off'
      && !document.querySelector('.veil')
      && !document.querySelector('.vignette')
      && !document.querySelector('.liquid-veil');
    if (wantVeil) {
      var veil = document.createElement('div');
      veil.className = 'liquid-veil';
      veil.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;'
        + 'background:radial-gradient(ellipse 100% 90% at 50% 55%, transparent 35%, rgba(3,8,20,0.50) 100%);';
      body.insertBefore(veil, canvas.nextSibling);
    }

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    var paletteAttr = parseFloat(body.getAttribute('data-liquid-palette'));
    var uniforms = {
      uTime:       { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMouse:      { value: new THREE.Vector2(0.5, 0.5) },
      uPaletteMix: { value: isNaN(paletteAttr) ? 0.38 : paletteAttr },
      uScroll:     { value: 0.0 },
    };

    var vert = 'void main() { gl_Position = vec4(position, 1.0); }';

    var frag = [
      'precision highp float;',
      'uniform float uTime;',
      'uniform vec2  uResolution;',
      'uniform vec2  uMouse;',
      'uniform float uPaletteMix;',
      'uniform float uScroll;',
      'vec2 hash2(vec2 p) {',
      '  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));',
      '  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);',
      '}',
      'float noise(vec2 p) {',
      '  const float K1 = 0.366025404;',
      '  const float K2 = 0.211324865;',
      '  vec2 i = floor(p + (p.x + p.y) * K1);',
      '  vec2 a = p - i + (i.x + i.y) * K2;',
      '  float m = step(a.y, a.x);',
      '  vec2 o = vec2(m, 1.0 - m);',
      '  vec2 b = a - o + K2;',
      '  vec2 c = a - 1.0 + 2.0 * K2;',
      '  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);',
      '  vec3 n = h * h * h * h * vec3(',
      '    dot(a, hash2(i + 0.0)),',
      '    dot(b, hash2(i + o)),',
      '    dot(c, hash2(i + 1.0))',
      '  );',
      '  return dot(n, vec3(70.0));',
      '}',
      'float fbm(vec2 p) {',
      '  float v = 0.0;',
      '  float a = 0.5;',
      '  for (int i = 0; i < 5; i++) {',
      '    v += a * noise(p);',
      '    p *= 2.07;',
      '    a *= 0.5;',
      '  }',
      '  return v;',
      '}',
      'float pattern(vec2 p, float t) {',
      '  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, t * 0.8)));',
      '  vec2 r = vec2(',
      '    fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.7),',
      '    fbm(p + 3.0 * q + vec2(8.3, 2.8) + t * 0.6)',
      '  );',
      '  return fbm(p + 3.0 * r);',
      '}',
      'void main() {',
      '  vec2 res = uResolution;',
      '  vec2 p   = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);',
      '  p *= 1.6;',
      '  float t  = uTime * 0.05;',
      '  float f = pattern(p + vec2(uScroll * 0.6, 0.0), t);',
      '  float n = clamp(f * 0.5 + 0.5, 0.0, 1.0);',
      '  vec3 navy0 = vec3(0.020, 0.055, 0.150);',
      '  vec3 navy1 = vec3(0.040, 0.094, 0.220);',
      '  vec3 navy2 = vec3(0.067, 0.149, 0.314);',
      '  vec3 indigo = vec3(0.290, 0.290, 0.965);',
      '  vec3 goldBase = vec3(0.722, 0.525, 0.043);',
      '  vec3 goldLit  = vec3(0.941, 0.839, 0.541);',
      '  vec3 goldBright = vec3(1.000, 0.843, 0.000);',
      '  vec3 col = mix(navy0, navy1, smoothstep(0.0, 0.45, n));',
      '  col = mix(col, navy2, smoothstep(0.45, 0.65, n) * 0.75);',
      '  float goldMask = smoothstep(0.62, 0.92, n);',
      '  vec3 gold = mix(goldBase, goldLit, smoothstep(0.62, 0.95, n));',
      '  gold = mix(gold, goldBright, smoothstep(0.92, 1.0, n));',
      '  col = mix(col, gold, goldMask * mix(0.10, 0.55, uPaletteMix));',
      '  float indigoMask = smoothstep(0.72, 0.95, n);',
      '  col = mix(col, indigo, indigoMask * mix(0.18, 0.04, uPaletteMix));',
      '  vec2 mp = (uMouse - 0.5) * 2.0;',
      '  mp.x *= res.x / min(res.x, res.y);',
      '  mp.y *= res.y / min(res.x, res.y);',
      '  mp *= 1.6;',
      '  float d = length(p - mp);',
      '  float glow = exp(-d * 1.4) * 0.18;',
      '  col += glow * goldLit;',
      '  float brush = fbm(p * 6.5 + vec2(t * 0.3, 0.0));',
      '  col *= 0.86 + brush * 0.20;',
      '  float vig = smoothstep(1.65, 0.25, length(p));',
      '  col *= mix(0.40, 1.0, vig);',
      '  float grain = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.025;',
      '  col += grain;',
      '  col *= 0.92;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');

    var material = new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: vert, fragmentShader: frag });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    function resize() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(w, h);
    }
    resize();
    addEventListener('resize', resize);

    var targetMouse = { x: 0.5, y: 0.5 };
    addEventListener('mousemove', function (e) {
      targetMouse.x = e.clientX / window.innerWidth;
      targetMouse.y = 1.0 - e.clientY / window.innerHeight;
    });

    // Expose uniforms so a scroll timeline can drive uScroll / uPaletteMix.
    window.__paintUniforms = uniforms;

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      // One composed still frame — alive look, no motion.
      uniforms.uTime.value = 12.0;
      renderer.render(scene, camera);
      return;
    }

    var start = performance.now();
    (function tick() {
      uniforms.uTime.value = (performance.now() - start) / 1000;
      var m = uniforms.uMouse.value;
      m.x += (targetMouse.x - m.x) * 0.05;
      m.y += (targetMouse.y - m.y) * 0.05;
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
