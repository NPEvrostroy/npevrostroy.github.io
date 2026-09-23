// Приём заявки с сайта → уведомление в Telegram.
// Работает на Netlify: netlify/functions/lead.mjs вызывает эти обработчики на пути /lead,
// там же команды для секретов. Формат обработчиков — как у Cloudflare Pages Functions.
//
//   TELEGRAM_BOT_TOKEN — токен бота от @BotFather
//   TELEGRAM_CHAT_ID   — куда слать. На демо — свой chat_id, при сдаче меняется на клиентский.
//   SITE_NAME          — подпись в заявке, чтобы не путать сайты (необязательно)
//
// Токен держать ТОЛЬКО в секретах хостинга. В папку сайта не класть.

const LIMITS = { name: 80, phone: 30, org: 120, object: 600 };

/**
 * Проверка входных данных. Вынесена отдельно, чтобы её можно было прогнать тестом.
 * @returns {{ok: true, lead: object} | {ok: false, error: string}}
 */
export function validate(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Пустой запрос' };

  // Honeypot: настоящий человек это поле не видит и не заполняет.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return { ok: false, error: 'spam' };
  }

  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  const name = str(body.name, LIMITS.name);
  const phone = str(body.phone, LIMITS.phone);

  if (name.length < 2) return { ok: false, error: 'Укажите имя' };

  // Достаточно, чтобы отсечь мусор, но не отсечь живого человека с непривычным форматом.
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return { ok: false, error: 'Проверьте номер телефона' };

  // Закон № 99-З: без согласия на обработку и на передачу через Telegram
  // заявку не принимаем. Проверяем и здесь — браузерную проверку легко обойти.
  if (body.consentData !== true || body.consentTransfer !== true) {
    return { ok: false, error: 'Нужны оба согласия на обработку данных' };
  }

  return {
    ok: true,
    lead: {
      name,
      phone,
      org: str(body.org, LIMITS.org),
      object: str(body.object, LIMITS.object),
      page: str(body.page, 300)
    }
  };
}

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

export function format(lead, siteName) {
  const lines = [
    `<b>Заявка на обмер${siteName ? ' — ' + esc(siteName) : ''}</b>`,
    ``,
    `<b>Имя:</b> ${esc(lead.name)}`,
    `<b>Телефон:</b> ${esc(lead.phone)}`
  ];
  if (lead.org) lines.push(`<b>Организация:</b> ${esc(lead.org)}`);
  if (lead.object) lines.push(`<b>Объект:</b> ${esc(lead.object)}`);
  // Отметка о согласиях — на случай вопросов о законности обработки.
  lines.push(``, `Согласия на обработку и трансграничную передачу данных получены.`);
  if (lead.page) lines.push(`<i>${esc(lead.page)}</i>`);
  return lines.join('\n');
}

// Копию сайта отдаёт GitHub Pages, а функция живёт на Netlify — оттуда запрос кросс-доменный.
const ALLOWED = ['https://nikita2000zezulin-blip.github.io'];
export const cors = (origin) =>
  ALLOWED.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};

const json = (data, status, origin) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) }
});

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Некорректный запрос' }, 400, origin);
  }

  const check = validate(body);

  // Спам-ботам отвечаем «ок», чтобы они не подбирали обход.
  if (!check.ok && check.error === 'spam') return json({ ok: true }, 200, origin);
  if (!check.ok) return json({ error: check.error }, 400, origin);

  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = env.TELEGRAM_CHAT_ID;

  if (!token || !chat) {
    console.error('lead: не заданы TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID');
    return json({ error: 'Форма пока не подключена' }, 500, origin);
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: format(check.lead, env.SITE_NAME),
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    if (!r.ok) {
      // Заявка дороже аккуратности: логируем ответ Telegram целиком, иначе потом не найдёшь причину.
      console.error('telegram error', r.status, await r.text(), 'lead:', check.lead);
      return json({ error: 'Заявка не отправилась' }, 502, origin);
    }
  } catch (err) {
    console.error('telegram fetch failed', err, 'lead:', check.lead);
    return json({ error: 'Заявка не отправилась' }, 502, origin);
  }

  return json({ ok: true }, 200, origin);
}

// Форму шлёт только POST. На GET отвечаем явно, чтобы в логах не гадать.
export const onRequestGet = () => json({ error: 'Method Not Allowed' }, 405);

// Предполётный запрос браузера перед кросс-доменным POST.
export const onRequestOptions = ({ request }) => new Response(null, {
  status: 204,
  headers: {
    ...cors(request.headers.get('Origin')),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
});
