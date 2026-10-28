/* Эффекты: звёздное небо, плавающие сердечки, взрыв сердечек */
const Fx = (function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.innerWidth < 600;
  const rand = (a, b) => Math.random() * (b - a) + a;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const HEARTS = ['❤️', '💖', '💕', '💗', '💘', '💝'];

  /* ---------- Звёзды ---------- */
  function initStars() {
    const canvas = document.getElementById('stars');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, stars = [], shoot = null, nextShoot = 3000, raf = 0, timer = 0;

    function build() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(isMobile() ? 90 : 220, Math.round((w * h) / 6500));
      stars = [];
      for (let i = 0; i < count; i++) {
        stars.push({ x: rand(0, w), y: rand(0, h), r: rand(0.3, 1.4), p: rand(0, 6.28), s: rand(0.6, 2) });
      }
    }

    function drawShoot(t) {
      if (!shoot && t > nextShoot) {
        shoot = { x: rand(w * 0.3, w), y: rand(0, h * 0.35), vx: -rand(6, 9), vy: rand(3, 5), life: 0 };
      }
      if (!shoot) return;
      const tx = shoot.x - shoot.vx * 10;
      const ty = shoot.y - shoot.vy * 10;
      const g = ctx.createLinearGradient(shoot.x, shoot.y, tx, ty);
      g.addColorStop(0, 'rgba(255,255,255,.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(shoot.x, shoot.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      shoot.x += shoot.vx;
      shoot.y += shoot.vy;
      shoot.life++;
      if (shoot.life > 60 || shoot.x < -100 || shoot.y > h + 100) {
        shoot = null;
        nextShoot = t + rand(4000, 9000);
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        ctx.globalAlpha = reduceMotion ? 0.7 : 0.35 + 0.65 * (Math.sin(t * 0.001 * s.s + s.p) * 0.5 + 0.5);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduceMotion) drawShoot(t);
    }

    function frame(t) {
      draw(t);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (reduceMotion) { draw(0); return; }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }

    build();
    start();

    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // На телефоне при прокрутке меняется высота (адресная строка) — игнорируем мелкие изменения
        if (window.innerWidth !== w || Math.abs(window.innerHeight - h) > 200) {
          build();
          if (reduceMotion) draw(0);
        }
      }, 200);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else start();
    });
  }

  /* ---------- Плавающие сердечки ---------- */
  function spawnHeart() {
    if (document.hidden) return;
    const layer = document.getElementById('hearts');
    if (!layer || layer.childElementCount > (isMobile() ? 14 : 26)) return;
    const el = document.createElement('span');
    el.className = 'float-heart';
    el.textContent = pick(HEARTS);
    el.style.left = rand(2, 96).toFixed(1) + '%';
    el.style.fontSize = rand(14, 34).toFixed(0) + 'px';
    el.style.setProperty('--dur', rand(8, 15).toFixed(1) + 's');
    el.style.setProperty('--sway', rand(-40, 40).toFixed(0) + 'px');
    el.style.setProperty('--op', rand(0.35, 0.85).toFixed(2));
    el.addEventListener('animationend', () => el.remove());
    layer.appendChild(el);
  }

  function initHearts() {
    if (reduceMotion) return;
    setInterval(spawnHeart, isMobile() ? 900 : 600);
  }

  /* ---------- Взрыв сердечек ---------- */
  function burst(x, y, count) {
    const layer = document.getElementById('bursts');
    if (!layer) return;
    const max = isMobile() ? 140 : 220;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      const angle = rand(0, Math.PI * 2);
      const dist = rand(60, max);
      el.className = 'burst-heart';
      el.textContent = pick(HEARTS);
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.fontSize = rand(16, 32).toFixed(0) + 'px';
      el.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(0) + 'px');
      el.style.setProperty('--dy', (Math.sin(angle) * dist - 30).toFixed(0) + 'px');
      el.style.setProperty('--rot', rand(-60, 60).toFixed(0) + 'deg');
      el.addEventListener('animationend', () => el.remove());
      layer.appendChild(el);
    }
  }

  function burstFromEl(el, count) {
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, count);
  }

  initStars();
  initHearts();

  return { reduceMotion, isMobile, rand, pick, burst, burstFromEl };
})();
