/* Логика сайта. Все тексты и настройки находятся в файле config.js */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const reduce = Fx.reduceMotion;
  const rand = Fx.rand;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------- Имя ---------- */
  document.querySelectorAll('[data-name]').forEach((el) => { el.textContent = CONFIG.name; });
  document.querySelectorAll('[data-name-gen]').forEach((el) => { el.textContent = CONFIG.nameGen; });
  document.title = 'Для ' + CONFIG.nameGen + ' 💌';

  /* ---------- Всплывающая подсказка ---------- */
  const toastEl = $('toast');
  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  /* ---------- Конверт ---------- */
  const envelope = $('envelope');
  const envScreen = $('envelope-screen');
  let opened = false;

  function openEnvelope() {
    if (opened) return;
    opened = true;
    envelope.classList.add('open');
    playMusic(false);
    setTimeout(() => {
      document.body.classList.remove('locked');
      envScreen.classList.add('hide');
      envScreen.setAttribute('aria-hidden', 'true');
      window.scrollTo(0, 0);
      startTyping();
    }, reduce ? 100 : 1700);
  }
  envelope.addEventListener('click', openEnvelope);
  envelope.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEnvelope(); }
  });

  /* ---------- Печатающийся текст ---------- */
  const typedEl = $('typed');
  let typingStarted = false;

  async function startTyping() {
    if (typingStarted) return;
    typingStarted = true;
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    for (const line of CONFIG.typingLines) {
      const p = document.createElement('p');
      const textNode = document.createTextNode('');
      p.append(textNode, cursor);
      typedEl.appendChild(p);
      if (reduce) { textNode.data = line; continue; }
      for (const ch of Array.from(line)) {
        textNode.data += ch;
        await sleep(',.!?…'.includes(ch) ? 260 : 42 + rand(0, 35));
      }
      await sleep(550);
    }
  }

  /* ---------- Счётчик дней ---------- */
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const ORDINALS = ['', 'первой', 'второй', 'третьей', 'четвёртой', 'пятой', 'шестой', 'седьмой', 'восьмой', 'девятой', 'десятой'];
  const DAY = 86400000;

  const [sy, sm, sd] = CONFIG.startDate.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  $('since-text').textContent = sd + ' ' + MONTHS[sm - 1] + ' ' + sy;

  function plural(n, forms) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  }

  function setCounter(idNum, idLbl, n, forms) {
    $(idNum).textContent = n;
    $(idLbl).textContent = plural(n, forms);
  }

  function updateCounter() {
    const now = new Date();
    const diff = Math.max(0, now - startDate);
    setCounter('c-days', 'l-days', Math.floor(diff / DAY), ['день', 'дня', 'дней']);
    setCounter('c-hours', 'l-hours', Math.floor(diff / 3600000) % 24, ['час', 'часа', 'часов']);
    setCounter('c-mins', 'l-mins', Math.floor(diff / 60000) % 60, ['минута', 'минуты', 'минут']);
    setCounter('c-secs', 'l-secs', Math.floor(diff / 1000) % 60, ['секунда', 'секунды', 'секунд']);
    updateAnniversary(now);
  }

  function updateAnniversary(now) {
    const text = $('anniv-text');
    const bar = $('anniv-bar');
    const isToday = now.getMonth() === sm - 1 && now.getDate() === sd && now.getFullYear() > sy;
    if (isToday) {
      text.innerHTML = 'Сегодня наша годовщина! 🎉💖';
      bar.style.width = '100%';
      return;
    }
    let year = Math.max(sy + 1, now.getFullYear());
    let next = new Date(year, sm - 1, sd);
    while (next <= now) { year++; next = new Date(year, sm - 1, sd); }
    const prev = new Date(year - 1, sm - 1, sd);
    const n = year - sy;
    const daysLeft = Math.round((Date.UTC(year, sm - 1, sd) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / DAY);
    const ord = ORDINALS[n] || (n + '-й');
    text.innerHTML = 'До нашей ' + ord + ' годовщины осталось <b>' + daysLeft + ' ' + plural(daysLeft, ['день', 'дня', 'дней']) + '</b> 💞';
    const pct = Math.min(100, Math.max(0, ((now - prev) / (next - prev)) * 100));
    bar.style.width = pct.toFixed(1) + '%';
  }

  updateCounter();
  setInterval(updateCounter, 1000);

  /* ---------- Музыка ---------- */
  const musicBtn = $('music-btn');
  let audio = null;
  let musicBroken = false;
  let fadeTimer = 0;
  let isOn = false;      // музыка должна играть (по нажатию кнопки)
  let curVol = 0;        // текущая громкость 0..1 (храним сами: на iPhone audio.volume не работает)
  let audioCtx = null;
  let gainNode = null;

  // На iPhone/iPad громкость элемента <audio> менять нельзя, поэтому там используем Web Audio (GainNode)
  function setupGain(a) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audioCtx = new Ctx();
      const src = audioCtx.createMediaElementSource(a);
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;
      src.connect(gainNode);
      gainNode.connect(audioCtx.destination);
    } catch (err) {
      audioCtx = null;
      gainNode = null;
    }
  }

  function setVol(v) {
    curVol = Math.max(0, Math.min(1, v));
    if (gainNode) gainNode.gain.value = curVol;
    else if (audio) audio.volume = curVol;
  }

  function getAudio() {
    if (audio) return audio;
    audio = new Audio(CONFIG.music);
    audio.loop = true;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    audio.addEventListener('error', () => { musicBroken = true; isOn = false; setPlaying(false); });
    // Проверяем, работает ли audio.volume (на iPhone значение не меняется)
    audio.volume = 0.5;
    if (Math.abs(audio.volume - 0.5) > 0.01) setupGain(audio);
    setVol(0);
    return audio;
  }

  function setPlaying(on) {
    musicBtn.classList.toggle('playing', on);
    musicBtn.setAttribute('aria-pressed', String(on));
    musicBtn.setAttribute('aria-label', on ? 'Выключить музыку' : 'Включить музыку');
    musicBtn.textContent = on ? '🎶' : '🎵';
  }

  // Плавное изменение громкости. Работает от нашей переменной curVol, а не от audio.volume
  function fadeTo(target, done) {
    clearInterval(fadeTimer);
    fadeTimer = setInterval(() => {
      const step = 0.03;
      if (Math.abs(curVol - target) <= step) {
        setVol(target);
        clearInterval(fadeTimer);
        if (done) done();
      } else {
        setVol(curVol + (curVol < target ? step : -step));
      }
    }, 60);
  }

  // showHint = false: без подсказки, если музыки нет (автозапуск при открытии конверта)
  function playMusic(showHint) {
    if (musicBroken) { if (showHint) toast('Музыка скоро будет 🎶'); return; }
    const a = getAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    isOn = true;
    setPlaying(true);
    const p = a.play();
    const onFail = () => {
      isOn = false;
      setPlaying(false);
      if (showHint || musicBroken) toast('Музыка скоро будет 🎶');
    };
    if (p && p.then) {
      p.then(() => { if (isOn) fadeTo(CONFIG.musicVolume); }).catch(onFail);
    } else {
      fadeTo(CONFIG.musicVolume);
    }
  }

  function pauseMusic() {
    isOn = false;
    setPlaying(false);
    if (!audio) return;
    fadeTo(0, () => { if (!isOn) audio.pause(); });
  }

  musicBtn.addEventListener('click', () => {
    if (isOn) pauseMusic();
    else playMusic(true);
  });

  /* ---------- Галерея ---------- */
  const grid = $('gallery-grid');
  const lb = $('lightbox');
  const lbMedia = $('lb-media');
  const lbCaption = $('lb-caption');
  let lbIndex = 0;

  function makePlaceholder() {
    const d = document.createElement('div');
    d.className = 'placeholder';
    d.innerHTML = '<span class="ph-heart">💗</span><span>Тут будет наше фото</span>';
    return d;
  }

  function makeMedia(photo) {
    if (!photo.src) return makePlaceholder();
    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = photo.caption || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => img.replaceWith(makePlaceholder()));
    return img;
  }

  CONFIG.photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'polaroid';
    btn.style.setProperty('--rot', ((i % 2 ? 1 : -1) * rand(1, 3.5)).toFixed(1) + 'deg');
    btn.setAttribute('aria-label', 'Открыть фото: ' + (photo.caption || (i + 1)));
    const frame = document.createElement('div');
    frame.className = 'photo-frame';
    frame.appendChild(makeMedia(photo));
    const cap = document.createElement('span');
    cap.className = 'caption';
    cap.textContent = photo.caption || '';
    btn.append(frame, cap);
    btn.addEventListener('click', () => openLightbox(i));
    grid.appendChild(btn);
  });

  function showLightbox(i) {
    const n = CONFIG.photos.length;
    lbIndex = (i + n) % n;
    const photo = CONFIG.photos[lbIndex];
    lbMedia.replaceChildren(makeMedia(photo));
    lbCaption.textContent = photo.caption || '';
  }

  function openLightbox(i) {
    if (!CONFIG.photos.length) return;
    showLightbox(i);
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    $('lb-close').focus();
  }

  function closeLightbox() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  }

  $('lb-close').addEventListener('click', closeLightbox);
  $('lb-prev').addEventListener('click', (e) => { e.stopPropagation(); showLightbox(lbIndex - 1); });
  $('lb-next').addEventListener('click', (e) => { e.stopPropagation(); showLightbox(lbIndex + 1); });
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb-figure')) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') showLightbox(lbIndex - 1);
    else if (e.key === 'ArrowRight') showLightbox(lbIndex + 1);
  });

  // Свайп в просмотре фото
  let touchX = null;
  lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) showLightbox(lbIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* ---------- 100 причин ---------- */
  const reasonCard = $('reason-card');
  const reasonBtn = $('reason-next');
  const reasonNum = $('reason-num');
  const reasonText = $('reason-text');
  const reasonSeen = $('reason-seen');
  const reasons = CONFIG.reasons;
  let pool = [];
  let seenCount = 0;
  let busy = false;

  function nextReasonIndex() {
    if (!pool.length) {
      pool = reasons.map((_, i) => i);
      seenCount = 0;
    }
    const k = Math.floor(Math.random() * pool.length);
    return pool.splice(k, 1)[0];
  }

  async function showReason() {
    if (busy || !reasons.length) return;
    busy = true;
    if (reasonCard.classList.contains('flipped')) {
      reasonCard.classList.remove('flipped');
      await sleep(reduce ? 0 : 400);
    }
    const i = nextReasonIndex();
    seenCount++;
    reasonNum.textContent = 'Причина ' + (i + 1) + ' из ' + reasons.length;
    reasonText.textContent = reasons[i];
    reasonCard.classList.add('flipped');
    reasonSeen.textContent = 'Открыто: ' + seenCount + ' из ' + reasons.length;
    reasonBtn.textContent = seenCount >= reasons.length ? 'Начать сначала 💕' : 'Ещё причина 💕';
    Fx.burstFromEl(reasonCard, 6);
    await sleep(reduce ? 0 : 500);
    busy = false;
  }

  reasonCard.addEventListener('click', showReason);
  reasonCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showReason(); }
  });
  reasonBtn.addEventListener('click', showReason);

  /* ---------- «Ты меня любишь?» ---------- */
  const zone = $('love-zone');
  const btnYes = $('btn-yes');
  const btnNo = $('btn-no');
  const yesResult = $('yes-result');
  let noCount = 0;
  let noX = 0;
  let noY = 0;
  let yesScale = 1;

  function dodge(e) {
    if (e && e.cancelable) e.preventDefault();
    noCount++;
    btnNo.textContent = CONFIG.noTexts[Math.min(noCount, CONFIG.noTexts.length - 1)];

    // Считаем безопасную область внутри экрана с учётом текущего смещения кнопки
    const r = btnNo.getBoundingClientRect();
    const baseLeft = r.left - noX;
    const baseTop = r.top - noY;
    const pad = 12;
    const minX = pad - baseLeft;
    const maxX = window.innerWidth - pad - r.width - baseLeft;
    const minY = pad - baseTop;
    const maxY = window.innerHeight - pad - r.height - baseTop;

    // Кнопка не должна закрывать «Да» и должна оставаться в зоне вопроса
    const z = zone.getBoundingClientRect();
    const zMinY = z.top - baseTop;
    const zMaxY = z.bottom - r.height - baseTop;
    const yLow = Math.max(minY, zMinY);
    const yHigh = Math.min(maxY, zMaxY);

    const y = yHigh > yLow ? rand(yLow, yHigh) : 0;
    const x = maxX > minX ? rand(minX, maxX) : 0;
    noX = x;
    noY = y;
    btnNo.style.transform = 'translate(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px)';

    yesScale = Math.min(yesScale + 0.12, 1.9);
    btnYes.style.fontSize = (1.1 * yesScale).toFixed(2) + 'rem';
    btnYes.style.padding = (14 * yesScale).toFixed(0) + 'px ' + (28 * yesScale).toFixed(0) + 'px';
  }

  btnNo.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') dodge(e); });
  btnNo.addEventListener('pointerdown', dodge);
  btnNo.addEventListener('click', (e) => e.preventDefault());
  btnNo.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') dodge(e); });

  btnYes.addEventListener('click', () => {
    btnNo.hidden = true;
    btnYes.disabled = true;
    btnYes.style.transform = 'scale(1.05)';
    yesResult.textContent = CONFIG.yesMessage;
    yesResult.hidden = false;
    const r = btnYes.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    Fx.burst(cx, cy, 40);
    setTimeout(() => Fx.burst(window.innerWidth / 2, window.innerHeight / 2, 40), 350);
    setTimeout(() => Fx.burst(window.innerWidth / 2, window.innerHeight / 3, 30), 700);
  });

  /* ---------- Финал ---------- */
  $('final-title').textContent = CONFIG.finalTitle;
  $('final-text').textContent = CONFIG.finalText;
  $('signature').textContent = CONFIG.signature;
  $('final-heart').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    Fx.burst(r.left + r.width / 2, r.top + r.height / 2, 36);
  });

  /* ---------- Плавное появление секций ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('visible');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('visible'));
  }
})();
