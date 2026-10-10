(function () {
  'use strict';
  window.__mainLoaded = true;

  var doc = document.documentElement;
  var body = document.body;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var desktop = window.matchMedia('(min-width: 1024px)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Zeit, bis das Intro den Blick freigibt (0, wenn es übersprungen wird)
  var introMs = parseFloat(getComputedStyle(doc).getPropertyValue('--intro')) || 0;

  /* ---------- Intro ---------- */
  var intro = document.getElementById('intro');
  if (intro) {
    // Antippen überspringt das Intro
    intro.addEventListener('click', function () { doc.classList.add('no-intro'); });
    intro.addEventListener('animationend', function (e) {
      if (e.animationName === 'intro-out') intro.remove();
    });
  }

  /* ---------- Mobiles Menü ---------- */
  var burger = document.querySelector('.burger');
  var menu = document.getElementById('menu');

  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    body.classList.toggle('menu-open', open);
  }

  if (burger && menu) {
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        setMenu(false);
        burger.focus();
      }
    });
    desktop.addEventListener('change', function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------- Scroll-Fortschritt im Header ---------- */
  var progress = document.querySelector('.progress');
  if (progress) {
    var progressQueued = false;
    var updateProgress = function () {
      var max = doc.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(window.scrollY / max, 1) : 0) + ')';
      progressQueued = false;
    };
    window.addEventListener('scroll', function () {
      if (!progressQueued) { progressQueued = true; requestAnimationFrame(updateProgress); }
    }, { passive: true });
    updateProgress();
  }

  /* ---------- Spielbare Klaviatur ---------- */
  var keys = document.querySelector('.keys');
  if (keys) {
    var audio = null;
    var master = null;
    var whiteSteps = [0, 2, 4, 5, 7, 9, 11];
    var hasBlack = [0, 1, 3, 4, 5];

    var buildKeys = function () {
      var width = keys.clientWidth;
      var count = Math.max(10, Math.round(width / (width < 600 ? 28 : 40)));
      if (count === keys._count) return;
      keys._count = count;
      keys.textContent = '';
      keys.classList.add('keys--live');
      keys.style.setProperty('--count', count);
      // mittleres C ungefähr in die Mitte legen
      var base = Math.max(36, 60 - 12 * Math.round(count / 14));
      var i, el;
      for (i = 0; i < count; i++) {
        el = document.createElement('span');
        el.className = 'key';
        el.dataset.note = base + 12 * Math.floor(i / 7) + whiteSteps[i % 7];
        keys.appendChild(el);
      }
      for (i = 0; i < count - 1; i++) {
        if (hasBlack.indexOf(i % 7) === -1) continue;
        el = document.createElement('span');
        el.className = 'bkey';
        el.style.setProperty('--n', i);
        el.dataset.note = base + 12 * Math.floor(i / 7) + whiteSteps[i % 7] + 1;
        keys.appendChild(el);
      }
    };

    // kleiner E-Piano-Klang: drei Teiltöne, schneller Anschlag, langes Ausklingen
    var playNote = function (midi) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audio) {
        audio = new Ctx();
        master = audio.createGain();
        master.gain.value = 0.5;
        master.connect(audio.destination);
      }
      if (audio.state === 'suspended') audio.resume();

      var now = audio.currentTime;
      var freq = 440 * Math.pow(2, (midi - 69) / 12);
      var env = audio.createGain();
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.3, now + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
      var tone = audio.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.setValueAtTime(Math.min(freq * 7, 9000), now);
      tone.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.6, 320), now + 1.2);
      tone.connect(env);
      env.connect(master);

      [[1, 'triangle', 1], [2, 'sine', 0.32], [3, 'sine', 0.1]].forEach(function (p) {
        var osc = audio.createOscillator();
        var gain = audio.createGain();
        osc.type = p[1];
        osc.frequency.value = freq * p[0];
        gain.gain.value = p[2];
        osc.connect(gain);
        gain.connect(tone);
        osc.start(now);
        osc.stop(now + 1.75);
      });
    };

    var hit = function (el, withSound) {
      el.classList.add('is-down');
      clearTimeout(el._up);
      el._up = setTimeout(function () { el.classList.remove('is-down'); }, 190);
      if (withSound) playNote(Number(el.dataset.note));
    };

    var lastPointer = 'mouse';
    keys.addEventListener('pointerdown', function (e) {
      lastPointer = e.pointerType;
      var key = e.target.closest('[data-note]');
      // Touch spielt erst beim Tippen (click), damit Scrollen keine Töne auslöst
      if (!key || e.pointerType === 'touch') return;
      e.preventDefault();
      hit(key, true);
    });
    keys.addEventListener('pointerover', function (e) {
      if (e.pointerType === 'touch' || e.buttons !== 1) return;
      var key = e.target.closest('[data-note]');
      if (key) hit(key, true);
    });
    keys.addEventListener('click', function (e) {
      if (lastPointer !== 'touch') return;
      var key = e.target.closest('[data-note]');
      if (key) hit(key, true);
    });

    buildKeys();
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(buildKeys, 200);
    });

    // stummer Lauf über die Tasten als Hinweis, dass sie reagieren
    if (!reduced) {
      setTimeout(function () {
        var whites = keys.querySelectorAll('.key');
        whites.forEach(function (key, i) {
          setTimeout(function () { hit(key, false); }, i * (760 / whites.length));
        });
      }, introMs + 1000);
    }
  }

  /* ---------- Desktop: Hero-Bild folgt leicht der Maus, Zähler läuft hoch ---------- */
  var hero = document.querySelector('.hero');
  var visual = document.querySelector('.hero__visual');
  if (hero && visual && finePointer && !reduced) {
    hero.addEventListener('pointermove', function (e) {
      if (!desktop.matches) return;
      var r = visual.getBoundingClientRect();
      var x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      var y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      visual.style.setProperty('--ty', (x * 9).toFixed(2) + 'deg');
      visual.style.setProperty('--tx', (-y * 9).toFixed(2) + 'deg');
    });
    hero.addEventListener('pointerleave', function () {
      visual.style.setProperty('--ty', '0deg');
      visual.style.setProperty('--tx', '0deg');
    });
  }

  var counter = document.querySelector('[data-count]');
  if (counter && desktop.matches && !reduced) {
    var target = Number(counter.dataset.count);
    counter.textContent = '0+';
    setTimeout(function () {
      var start = performance.now();
      var tick = function (now) {
        var p = Math.min((now - start) / 1200, 1);
        counter.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + '+';
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, introMs + 1000);
  }

  /* ---------- Leistungskarten: Lichtfleck unter der Maus ---------- */
  if (finePointer) {
    document.querySelectorAll('.service').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', e.clientX - r.left + 'px');
        card.style.setProperty('--my', e.clientY - r.top + 'px');
      });
    });
  }

  /* ---------- Galerie: Fortschritt beim Wischen ---------- */
  var gallery = document.querySelector('.gallery');
  var galleryThumb = document.querySelector('.gallery__bar i');
  if (gallery && galleryThumb) {
    var updateGallery = function () {
      var max = gallery.scrollWidth - gallery.clientWidth;
      if (max <= 0) return;
      var share = gallery.clientWidth / gallery.scrollWidth;
      galleryThumb.style.width = share * 100 + '%';
      galleryThumb.style.transform = 'translateX(' + (gallery.scrollLeft / max) * (1 / share - 1) * 100 + '%)';
    };
    gallery.addEventListener('scroll', function () { requestAnimationFrame(updateGallery); }, { passive: true });
    window.addEventListener('resize', updateGallery);
    updateGallery();
  }

  /* ---------- FAQ: weiches Auf- und Zuklappen ---------- */
  if (!reduced && 'animate' in Element.prototype) {
    document.querySelectorAll('.faq__item').forEach(function (item) {
      var summary = item.querySelector('summary');
      var running = null;
      summary.addEventListener('click', function (e) {
        e.preventDefault();
        var closing = item.open && !item.classList.contains('is-closing');
        var from = item.offsetHeight;
        if (running) running.cancel();
        if (closing) {
          item.classList.add('is-closing');
        } else {
          item.classList.remove('is-closing');
          item.open = true;
        }
        var to = closing ? summary.offsetHeight + (item.offsetHeight - item.clientHeight) : item.offsetHeight;
        running = item.animate({ height: [from + 'px', to + 'px'] }, { duration: 340, easing: 'cubic-bezier(.2, .7, .2, 1)' });
        running.onfinish = function () {
          if (closing) {
            item.open = false;
            item.classList.remove('is-closing');
          }
          running = null;
        };
      });
    });
  }

  /* ---------- Leistung aus Karte ins Formular übernehmen ---------- */
  var form = document.getElementById('anfrage-form');
  document.querySelectorAll('[data-service]').forEach(function (link) {
    link.addEventListener('click', function () {
      var radio = form && form.querySelector('input[name="leistung"][value="' + link.dataset.service + '"]');
      if (radio) radio.checked = true;
    });
  });

  /* ---------- Formular (Vorschau: kein Versand) ---------- */
  if (form) {
    var error = form.querySelector('.form__error');
    var success = form.querySelector('.form__success');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstInvalid = null;
      form.querySelectorAll('input, select, textarea').forEach(function (el) {
        var ok = el.checkValidity();
        el.setAttribute('aria-invalid', String(!ok));
        if (!ok && !firstInvalid) firstInvalid = el;
      });
      error.hidden = !firstInvalid;
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }
      form.classList.add('is-sent');
      success.hidden = false;
      form.scrollIntoView({ block: 'center' });
    });

    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true' && e.target.checkValidity()) {
        e.target.setAttribute('aria-invalid', 'false');
      }
    });
  }

  /* ---------- Mobile Aktionsleiste ---------- */
  var bar = document.getElementById('cta-bar');
  var heroCta = document.getElementById('hero-cta');
  var contact = document.getElementById('anfrage');

  if (bar && heroCta && contact && 'IntersectionObserver' in window) {
    var heroCtaVisible = true;
    var contactVisible = false;
    var typing = false;

    var updateBar = function () {
      bar.classList.toggle('is-visible', !heroCtaVisible && !contactVisible && !typing);
    };
    new IntersectionObserver(function (entries) {
      heroCtaVisible = entries[0].isIntersecting;
      updateBar();
    }).observe(heroCta);
    new IntersectionObserver(function (entries) {
      contactVisible = entries[0].isIntersecting;
      updateBar();
    }, { rootMargin: '0px 0px -25% 0px' }).observe(contact);

    // Leiste ausblenden, solange die Tastatur offen ist
    document.addEventListener('focusin', function (e) {
      typing = !!e.target.closest('input, textarea, select');
      updateBar();
    });
    document.addEventListener('focusout', function () {
      typing = false;
      updateBar();
    });
  }

  /* ---------- Einblenden beim Scrollen ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      var shown = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.style.setProperty('--d', Math.min(shown++, 5) * 70 + 'ms');
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    doc.classList.add('reveal-all');
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
