/* Magic Library landing — ambient magic effects.
 * Drifting luminous dust over the hero, plus a soft cursor glow.
 * Fully optional: no canvas support, no JS, or prefers-reduced-motion → nothing
 * runs and the static design stands on its own. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  var canvas = document.querySelector(".magic-dust");
  var hero = document.querySelector(".hero");
  if (!canvas || !hero || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var particles = [];
  var width = 0;
  var height = 0;
  var running = true;

  // Gold + violet motes, matching the palette.
  var COLORS = ["255, 240, 200", "201, 162, 75", "184, 154, 240", "159, 122, 234"];

  function size() {
    var rect = hero.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeParticle(initial) {
    return {
      x: Math.random() * width,
      y: initial ? Math.random() * height : height + 10,
      r: 0.6 + Math.random() * 1.8,
      vy: 0.15 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.01 + Math.random() * 0.03,
      baseAlpha: 0.25 + Math.random() * 0.5,
    };
  }

  function seed() {
    var count = Math.min(90, Math.round((width * height) / 22000));
    particles = [];
    for (var i = 0; i < count; i++) particles.push(makeParticle(true));
  }

  function frame() {
    if (!running) return;
    ctx.clearRect(0, 0, width, height);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.y -= p.vy;
      p.x += p.vx;
      p.phase += p.twinkle;
      if (p.y < -10) {
        particles[i] = makeParticle(false);
        continue;
      }
      var alpha = p.baseAlpha * (0.55 + 0.45 * Math.sin(p.phase));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + p.color + ", " + alpha.toFixed(3) + ")";
      ctx.shadowBlur = 6;
      ctx.shadowColor = "rgba(" + p.color + ", " + (alpha * 0.8).toFixed(3) + ")";
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    requestAnimationFrame(frame);
  }

  function start() {
    size();
    seed();
    running = true;
    requestAnimationFrame(frame);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !running) {
          running = true;
          requestAnimationFrame(frame);
        } else if (!e.isIntersecting) {
          running = false;
        }
      });
    });
    io.observe(hero);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      size();
      seed();
    }, 200);
  });

  // Cursor-following aura over the hero (cheap: just moves CSS vars).
  hero.addEventListener("pointermove", function (e) {
    var rect = hero.getBoundingClientRect();
    hero.style.setProperty("--mx", (e.clientX - rect.left) + "px");
    hero.style.setProperty("--my", (e.clientY - rect.top) + "px");
    hero.classList.add("has-cursor");
  });
  hero.addEventListener("pointerleave", function () {
    hero.classList.remove("has-cursor");
  });

  start();
})();
