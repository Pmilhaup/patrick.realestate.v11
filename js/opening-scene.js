/* ════════════════════════════════════════════════════════════════════════
   OPENING SCENE — "neon-glow" brand intro (vanilla WebGL, no dependencies)
   Recreation of the basementstudio shader-lab composition:
     · animated domain-warped + vortex gradient field
     · 5-point navy / royal / gold palette, cinematic tonemap + vignette
     · two titles overlaid: Sotheby's International Realty · PATRICK MILHAUPT
   Full-screen, loops until the visitor clicks "Enter" or scrolls.
   Self-contained: injects its own DOM + CSS. Include once per page:
       <script src="js/opening-scene.js"></script>   (or ../js/… from /listings/)
   Fail-safe: CSS-gradient fallback if WebGL is unavailable; honors
   prefers-reduced-motion; a click/scroll/key/touch always lets the user in.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.__openingSceneInit) return;
  window.__openingSceneInit = true;

  var TITLE = window.OPENING_TITLE || "Sotheby's International Realty";
  var SUBTITLE = window.OPENING_SUBTITLE || "PATRICK MILHAUPT";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── inject CSS ──
  var css = document.createElement('style');
  css.textContent = [
    '#opening{position:fixed;inset:0;z-index:100000;overflow:hidden;background:#050E26;',
      'transition:opacity 1.1s cubic-bezier(.16,1,.3,1);cursor:pointer;}',
    '#opening.os-out{opacity:0;pointer-events:none;}',
    '#openingGl{position:absolute;inset:0;width:100%;height:100%;display:block;}',
    '#opening .os-fallback{position:absolute;inset:0;background:',
      'radial-gradient(60% 50% at 30% 30%,rgba(71,107,176,.5),transparent 70%),',
      'radial-gradient(55% 60% at 72% 78%,rgba(253,222,0,.18),transparent 70%),',
      'linear-gradient(140deg,#060425,#07186A 55%,#080D49);background-size:200% 200%;',
      'animation:osPan 12s ease-in-out infinite;}',
    '@keyframes osPan{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}',
    '#opening .os-titles{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;text-align:center;padding:0 6vw;pointer-events:none;}',
    '#opening .os-h1{font-family:"Cormorant Garamond","EB Garamond",Garamond,serif;font-weight:500;',
      'color:#fff;font-size:clamp(34px,7.4vw,104px);line-height:1;letter-spacing:-.03em;',
      'text-shadow:0 2px 40px rgba(8,16,50,.6),0 0 80px rgba(71,107,176,.35);opacity:0;',
      'transform:translateY(18px);transition:opacity 1.6s ease 0.5s,transform 1.6s cubic-bezier(.16,1,.3,1) 0.5s;}',
    '#opening .os-h2{margin-top:clamp(14px,2.2vh,26px);font-family:"Inter","Helvetica Neue",Arial,sans-serif;',
      'font-weight:700;color:#f3e7c6;font-size:clamp(13px,2vw,30px);letter-spacing:.16em;',
      'text-shadow:0 2px 30px rgba(8,16,50,.7);opacity:0;transform:translateY(14px);',
      'transition:opacity 1.4s ease 1.0s,transform 1.4s cubic-bezier(.16,1,.3,1) 1.0s;}',
    '#opening .os-rule{width:0;height:1px;margin:clamp(18px,3vh,30px) auto 0;',
      'background:linear-gradient(90deg,transparent,#F0D68A,transparent);opacity:0;',
      'transition:width 1.6s cubic-bezier(.16,1,.3,1) 1.3s,opacity 1.2s ease 1.3s;}',
    '#opening.os-ready .os-h1,#opening.os-ready .os-h2{opacity:1;transform:none;}',
    '#opening.os-ready .os-rule{width:min(220px,40vw);opacity:.8;}',
    '#opening .os-enter{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);z-index:3;',
      'display:flex;flex-direction:column;align-items:center;gap:9px;pointer-events:auto;cursor:pointer;',
      'font-family:"Inter",Arial,sans-serif;font-size:11px;letter-spacing:.28em;text-transform:uppercase;',
      'color:rgba(255,255,255,.82);opacity:0;transition:opacity 1s ease 1.8s;background:none;border:0;}',
    '#opening.os-ready .os-enter{opacity:1;}',
    '#opening .os-enter:hover{color:#fff;}',
    '#opening .os-chev{width:14px;height:14px;border-right:1px solid currentColor;border-bottom:1px solid currentColor;',
      'transform:rotate(45deg);animation:osBob 2s ease-in-out infinite;}',
    '@keyframes osBob{0%,100%{transform:rotate(45deg) translate(0,0)}50%{transform:rotate(45deg) translate(3px,3px)}}',
    'html.os-lock,body.os-lock{overflow:hidden!important;height:100%;}',
    '@media (prefers-reduced-motion:reduce){#opening .os-fallback{animation:none}#opening .os-chev{animation:none}}'
  ].join('');
  document.head.appendChild(css);

  // ── inject DOM ──
  var ov = document.createElement('div');
  ov.id = 'opening';
  ov.innerHTML =
    '<canvas id="openingGl"></canvas>' +
    '<div class="os-titles"><div class="os-h1"></div><div class="os-rule"></div><div class="os-h2"></div></div>' +
    '<button class="os-enter" type="button" aria-label="Enter the site">Enter<span class="os-chev"></span></button>';
  ov.querySelector('.os-h1').textContent = TITLE;
  ov.querySelector('.os-h2').textContent = SUBTITLE;
  function mount(){ document.body.insertBefore(ov, document.body.firstChild); document.documentElement.classList.add('os-lock'); document.body.classList.add('os-lock'); requestAnimationFrame(function(){ ov.classList.add('os-ready'); }); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  // ── dismissal ──
  var dismissed = false;
  function enter(){
    if (dismissed) return; dismissed = true;
    ov.classList.add('os-out');
    document.documentElement.classList.remove('os-lock'); document.body.classList.remove('os-lock');
    setTimeout(function(){ if (ov.parentNode) ov.remove(); if (raf) cancelAnimationFrame(raf); }, 1200);
  }
  ['click','wheel','touchstart','keydown'].forEach(function(ev){
    window.addEventListener(ev, function(e){ if (ev==='keydown' && !/Enter| |Escape|ArrowDown|PageDown/.test(e.key)) return; enter(); }, { passive:true, once:false });
  });

  // ── WebGL ──
  var raf = null;
  var canvas = ov.querySelector('#openingGl');
  var gl = null;
  try { gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); } catch (e) {}
  if (!gl || reduce) {
    var fb = document.createElement('div'); fb.className = 'os-fallback'; ov.insertBefore(fb, canvas); canvas.style.display='none';
    return;
  }

  var vsrc = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fsrc = [
    'precision highp float;',
    'uniform vec2 uRes; uniform float uTime;',
    // ── simplex noise (Ashima) ──
    'vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}',
    'vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}',
    'vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}',
    'float snoise(vec2 v){const vec4 C=vec4(0.211324865,0.366025403,-0.577350269,0.024390243);',
    ' vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);',
    ' vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);',
    ' vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);',
    ' vec3 pp=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));',
    ' vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;',
    ' vec3 x=2.*fract(pp*C.www)-1.;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;',
    ' m*=1.79284291-0.85373472*(a0*a0+h*h);',
    ' vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;',
    ' return 130.*dot(m,g);}',
    'float fbm(vec2 p){float s=0.,a=0.5;for(int i=0;i<5;i++){s+=a*snoise(p);p*=2.03;a*=0.5;}return s;}',
    // ── ACES tonemap ──
    'vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.);}',
    'void main(){',
    ' vec2 uv=(gl_FragCoord.xy-0.5*uRes)/min(uRes.x,uRes.y);',
    ' float t=uTime*0.103;',                  // motionSpeed ~1.03
    // vortex swirl (vortexAmount 0.83)
    ' float r=length(uv); float ang=0.83*(0.9-r);',
    ' float cs=cos(ang),sn=sin(ang); uv=mat2(cs,-sn,sn,cs)*uv;',
    // domain warp (scale 6, 3 iters, decay .26, bias .14)
    ' vec2 q=uv*1.6;',
    ' vec2 w=q*6.0; float dec=1.0;',
    ' for(int i=0;i<3;i++){ vec2 n=vec2(fbm(w+vec2(0.0,t)),fbm(w+vec2(5.2,1.3)-t*0.8)); w+=(n*0.26*dec+0.14); dec*=0.6; }',
    ' float f=fbm(w*0.5+t*0.16);',            // motionAmount .16
    ' float field=f*0.5+0.5;',
    // palette points (centered coords): royal, gold, deepblue, near-black, indigo
    ' vec3 cRoyal=vec3(0.278,0.420,0.690);',
    ' vec3 cGold =vec3(0.992,0.871,0.000);',
    ' vec3 cDeep =vec3(0.027,0.094,0.416);',
    ' vec3 cInk  =vec3(0.024,0.016,0.145);',
    ' vec3 cIndigo=vec3(0.031,0.051,0.286);',
    ' vec2 P1=vec2(0.05,0.0),P2=vec2(-0.29,0.69)+0.12*vec2(snoise(vec2(t,1.0)),snoise(vec2(t,3.0)));',
    ' vec2 P3=vec2(0.01,0.55),P5=vec2(-0.5,0.45);',
    // dark base gradient
    ' vec3 col=mix(cInk,cIndigo,smoothstep(-0.9,0.9,uv.y));',
    ' col=mix(col,cDeep,0.5*field);',
    // royal glow
    ' float gR=exp(-1.31*dot(uv-P1,uv-P1)*1.4)*(0.6+0.7*field);',
    ' col+=cRoyal*gR*0.9;',
    // indigo wash
    ' col+=cIndigo*exp(-1.31*dot(uv-P5,uv-P5))*0.5;',
    // gold neon (the pop) — flows with the field
    ' float gG=exp(-1.31*dot(uv-P2,uv-P2)*1.7)*(0.35+0.9*field);',
    ' col+=cGold*gG*1.0;',
    // deep-blue lower glow
    ' col+=cDeep*exp(-1.31*dot(uv-P3,uv-P3)*1.2)*(0.4+0.5*(1.0-field));',
    // glow lift (threshold .55)
    ' float lum=dot(col,vec3(0.299,0.587,0.114)); col+=max(lum-0.55,0.0)*col*0.8;',
    ' col=aces(col*1.05);',
    // vignette (strength .43 radius .57)
    ' float vig=smoothstep(1.15,0.57,r); col*=mix(1.0,0.57,(1.0-vig)*0.43*2.0);',
    ' gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  function sh(type, src){ var s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ console.warn('[opening] shader', gl.getShaderInfoLog(s)); return null; } return s; }
  var vs=sh(gl.VERTEX_SHADER,vsrc), fs=sh(gl.FRAGMENT_SHADER,fsrc);
  if(!vs||!fs){ var fb2=document.createElement('div'); fb2.className='os-fallback'; ov.insertBefore(fb2,canvas); canvas.style.display='none'; return; }
  var prog=gl.createProgram(); gl.attachShader(prog,vs); gl.attachShader(prog,fs); gl.linkProgram(prog); gl.useProgram(prog);
  var buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  var loc=gl.getAttribLocation(prog,'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  var uRes=gl.getUniformLocation(prog,'uRes'), uTime=gl.getUniformLocation(prog,'uTime');
  var dpr=Math.min(window.devicePixelRatio||1,1.75);
  function resize(){ var w=Math.floor(innerWidth*dpr),h=Math.floor(innerHeight*dpr); canvas.width=w; canvas.height=h; gl.viewport(0,0,w,h); gl.uniform2f(uRes,w,h); }
  window.addEventListener('resize',resize); resize();
  var start=performance.now();
  (function loop(){ if(dismissed && !ov.parentNode) return; gl.uniform1f(uTime,(performance.now()-start)/1000); gl.drawArrays(gl.TRIANGLES,0,3); raf=requestAnimationFrame(loop); })();
})();
