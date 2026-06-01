/* ═══════════════════════════════════════════════════════════════
   CORE JS — patrick.realestate
   Shared modules: navigation, reveal observer, constellation bg.
   Vanilla JS only. No frameworks, no build step.
   ═══════════════════════════════════════════════════════════════ */

/* ── NAVIGATION ── */
(function initNav() {
  var nav = document.getElementById('mainNav');
  var tog = document.getElementById('navTog');
  var links = document.getElementById('navLinks');
  if (!nav) return;

  // Scroll state
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        nav.classList.toggle('scrolled', window.scrollY > 80);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // Mobile toggle
  if (tog && links) {
    tog.addEventListener('click', function () {
      tog.classList.toggle('open');
      links.classList.toggle('open');
    });
  }

  // Mobile dropdown expand
  document.querySelectorAll('.nav-dd .dd-t').forEach(function (t) {
    t.addEventListener('click', function (e) {
      if (window.innerWidth <= 900) {
        e.preventDefault();
        t.closest('.nav-dd').classList.toggle('mob-open');
      }
    });
  });
})();


/* ── REVEAL OBSERVER ── */
(function initReveal() {
  var els = document.querySelectorAll('.rv, .rv-left, .rv-scale, .stagger, .divider-line');
  if (!els.length) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('vis');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  els.forEach(function (el) { observer.observe(el); });
})();


/* ── CONSTELLATION BACKGROUND ── */
(function initConstellation() {
  var c = document.getElementById('constellationCanvas');
  if (!c) return;
  var ctx = c.getContext('2d');
  var W, H, stars = [], shootingStars = [];
  var mouse = { x: -9999, y: -9999 };
  var STAR_COUNT = 120, CONNECT_DIST = 110, MOUSE_RADIUS = 180;

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    c.style.width = W + 'px';
    c.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initStars() {
    stars = [];
    for (var i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: Math.random() * 1.3 + 0.3,
        base: Math.random() * 0.35 + 0.12,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function spawnShoot() {
    if (shootingStars.length < 2 && Math.random() < 0.002) {
      shootingStars.push({
        x: Math.random() * W, y: Math.random() * H * 0.4,
        vx: 3 + Math.random() * 3, vy: 1.5 + Math.random() * 1.5,
        life: 1, trail: []
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var t = Date.now() * 0.001;

    // Subtle nebula glow
    var ng = ctx.createRadialGradient(W * 0.3, H * 0.3, 0, W * 0.3, H * 0.3, W * 0.5);
    ng.addColorStop(0, 'rgba(79,143,255,0.01)');
    ng.addColorStop(1, 'transparent');
    ctx.fillStyle = ng;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.x += s.vx;
      s.y += s.vy;
      if (s.x < -10) s.x = W + 10;
      if (s.x > W + 10) s.x = -10;
      if (s.y < -10) s.y = H + 10;
      if (s.y > H + 10) s.y = -10;

      // Mouse repel
      var dx = s.x - mouse.x, dy = s.y - mouse.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_RADIUS && dist > 0) {
        var f = (1 - dist / MOUSE_RADIUS) * 0.6;
        s.x += dx / dist * f;
        s.y += dy / dist * f;
      }

      var twinkle = s.base + Math.sin(t * 1.5 + s.phase) * 0.12;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,220,255,' + twinkle + ')';
      ctx.fill();

      // Connections
      for (var j = i + 1; j < stars.length; j++) {
        var dx2 = s.x - stars[j].x, dy2 = s.y - stars[j].y;
        var d = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (d < CONNECT_DIST) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(stars[j].x, stars[j].y);
          ctx.strokeStyle = 'rgba(79,143,255,' + (0.05 * (1 - d / CONNECT_DIST)) + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Shooting stars
    spawnShoot();
    shootingStars = shootingStars.filter(function (ss) {
      ss.trail.unshift({ x: ss.x, y: ss.y });
      if (ss.trail.length > 18) ss.trail.pop();
      ss.x += ss.vx;
      ss.y += ss.vy;
      ss.life -= 0.012;
      if (ss.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(ss.trail[0].x, ss.trail[0].y);
        for (var k = 1; k < ss.trail.length; k++) {
          ctx.lineTo(ss.trail[k].x, ss.trail[k].y);
        }
        ctx.strokeStyle = 'rgba(200,220,255,' + ss.life * 0.35 + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      return ss.life > 0;
    });

    requestAnimationFrame(draw);
  }

  resize();
  initStars();
  draw();

  window.addEventListener('resize', function () { resize(); initStars(); });
  window.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });
})();
