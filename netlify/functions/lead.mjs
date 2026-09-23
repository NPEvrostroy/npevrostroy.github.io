// Приём заявки на Netlify — та же логика, что для Cloudflare в functions/lead.js.
// Секреты задаются так, потом нужен передеплой — функция видит их только с нового деплоя:
//   npx netlify-cli env:set TELEGRAM_BOT_TOKEN <токен>
//   npx netlify-cli env:set TELEGRAM_CHAT_ID <id>
import { onRequestPost, onRequestGet, onRequestOptions } from '../../functions/lead.js';

export default (request) =>
  request.method === 'POST' ? onRequestPost({ request, env: process.env })
    : request.method === 'OPTIONS' ? onRequestOptions({ request })
      : onRequestGet();

export const config = { path: '/lead' };
