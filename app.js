/* ============================================================================
   Заявка, липкая панель звонка, согласие на cookie и Яндекс.Метрика.
   Без библиотек и сборки: файл кладётся рядом с index.html и работает.
   ========================================================================== */

(function () {
  'use strict';

  // Номер счётчика Метрики. Пока 0 — баннер cookie не показывается и Метрика
  // не грузится: спрашивать согласие на то, чего нет, незачем.
  var METRIKA_ID = 0;
  var CONSENT_KEY = 'npes_cookie';
  var PHONE = '+375 29 899-85-02';
  // Полный адрес: копия сайта на GitHub Pages своего обработчика не имеет.
  // Меняется вместе с доменом, адрес разрешён в connect-src в index.html.
  var LEAD_URL = 'https://np-evrostroy.netlify.app/lead';

  /* ── МЕТРИКА ────────────────────────────────────────────────────────────
     Грузится только после согласия на аналитические cookie. Google Analytics
     не ставим: Google не обслуживает рекламодателей из Беларуси, а Метрика
     ещё и кормит данными Директ.
     ──────────────────────────────────────────────────────────────────── */
  function initMetrika() {
    if (!METRIKA_ID || window.ym) return;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(METRIKA_ID, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }

  // Цель = событие, по которому в Директе считается конверсия.
  function goal(name) {
    if (window.ym && METRIKA_ID) window.ym(METRIKA_ID, 'reachGoal', name);
  }

  // localStorage бывает недоступен (приватный режим старых Safari) — тогда
  // просто спрашиваем при каждом визите.
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  function initCookies() {
    if (!METRIKA_ID) return;
    var banner = document.getElementById('cookie-banner');
    var reopen = document.getElementById('cookie-settings');
    if (!banner) return;

    var saved = store(CONSENT_KEY);
    if (saved === 'all') initMetrika();
    if (!saved) banner.hidden = false;

    banner.addEventListener('click', function (e) {
      var value = e.target.getAttribute('data-consent');
      if (!value) return;
      store(CONSENT_KEY, value);
      banner.hidden = true;
      if (value === 'all') initMetrika();
    });

    // Ссылка в подвале — чтобы согласие можно было отозвать так же легко, как дать.
    if (reopen) {
      reopen.hidden = false;
      reopen.addEventListener('click', function () { banner.hidden = false; });
    }
  }

  /* ── ЗАЯВКА ─────────────────────────────────────────────────────────── */
  function initForm() {
    var form = document.getElementById('lead-form');
    if (!form) return;
    var f = form.elements;
    var btn = form.querySelector('button[type=submit]');
    var status = document.getElementById('form-status');
    var label = btn.textContent;

    function say(state, msg) {
      status.setAttribute('data-state', state);
      status.textContent = msg;
    }

    function fail(field, msg) {
      field.setAttribute('aria-invalid', 'true');
      say('error', msg);
      field.focus();
    }

    // Ошибка снимается, как только человек начал исправлять поле.
    form.addEventListener('input', function (e) { e.target.removeAttribute('aria-invalid'); });
    form.addEventListener('change', function (e) { e.target.removeAttribute('aria-invalid'); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (f.name.value.trim().length < 2) return fail(f.name, 'Напишите, как к вам обращаться.');
      if (f.phone.value.replace(/\D/g, '').length < 7) return fail(f.phone, 'Проверьте номер телефона — перезвоним на него.');
      if (!f.consentData.checked) return fail(f.consentData, 'Отметьте согласие на обработку данных — без него заявку отправить нельзя.');
      if (!f.consentTransfer.checked) return fail(f.consentTransfer, 'Отметьте согласие на передачу данных через Telegram или позвоните нам: ' + PHONE + '.');

      var data = {
        name: f.name.value,
        phone: f.phone.value,
        org: f.org.value,
        object: f.object.value,
        website: f.website.value,
        consentData: true,
        consentTransfer: true,
        page: location.href
      };

      status.removeAttribute('data-state');
      status.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Отправляем…';

      fetch(LEAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, body: j }; });
        })
        .then(function (res) {
          if (!res.ok) throw new Error(res.body.error || 'Заявка не отправилась');
          form.reset();
          say('ok', 'Заявка отправлена. Перезвоним, чтобы договориться о выезде.');
          goal('lead');
        })
        .catch(function (err) {
          var msg = err instanceof TypeError ? 'Нет связи с сервером' : err.message;
          say('error', msg + '. Позвоните нам: ' + PHONE + '.');
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = label;
        });
    });
  }

  /* ── МЕЛОЧИ ─────────────────────────────────────────────────────────── */

  // Звонок — такая же конверсия, как заявка: считаем клики по номеру.
  function initPhoneGoal() {
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a[href^="tel:"]')) goal('phone');
    });
  }

  // Липкая панель звонка нужна только тогда, когда не видно ни кнопок первого
  // экрана, ни формы. Иначе она дублирует их вплотную и закрывает кнопку отправки.
  function initCallbar() {
    var bar = document.querySelector('.callbar');
    var zones = document.querySelectorAll('.hero__cta, #zayavka');
    if (!bar || !zones.length) return;
    if (!('IntersectionObserver' in window)) { bar.setAttribute('data-show', 'true'); return; }
    var inView = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) inView.add(e.target); else inView.delete(e.target); });
      bar.setAttribute('data-show', String(inView.size === 0));
    });
    zones.forEach(function (z) { io.observe(z); });
  }

  function initYear() {
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  }

  function boot() {
    initCookies();
    initForm();
    initPhoneGoal();
    initCallbar();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
