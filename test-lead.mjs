// Проверка валидации заявок. Запуск: node test-lead.mjs
// Если форма начнёт пропускать мусор или резать живых людей — падает здесь, а не у клиента.

import assert from 'assert';
import { validate, format, cors } from './functions/lead.js';

const base = { name: 'Андрей', phone: '+375 29 123-45-67', consentData: true, consentTransfer: true };

// ─── пропускаем нормальное ───
const ok = validate({ ...base, org: 'ГУО «Ясли-сад № 5»', object: 'Два кабинета' });
assert.strictEqual(ok.ok, true);
assert.strictEqual(ok.lead.org, 'ГУО «Ясли-сад № 5»');

assert.strictEqual(validate({ ...base, name: 'Ян', phone: '80291234567' }).ok, true, 'формат без плюса — живой человек');
assert.strictEqual(validate({ ...base, name: '  Ирина  ' }).lead.name, 'Ирина', 'пробелы срезаются');
assert.strictEqual(validate(base).lead.org, '', 'необязательные поля могут отсутствовать');

// ─── режем мусор ───
assert.strictEqual(validate({ ...base, name: 'А' }).ok, false, 'имя из одной буквы');
assert.strictEqual(validate({ ...base, phone: '123' }).ok, false, 'слишком короткий номер');
assert.strictEqual(validate({ ...base, phone: '1'.repeat(40) }).ok, false, 'слишком длинный номер');
assert.strictEqual(validate({ ...base, phone: undefined }).ok, false, 'нет телефона');
assert.strictEqual(validate(null).ok, false, 'пустое тело');

// ─── без обоих согласий заявку не принимаем (Закон № 99-З) ───
assert.strictEqual(validate({ ...base, consentData: false }).ok, false, 'нет согласия на обработку');
assert.strictEqual(validate({ ...base, consentTransfer: undefined }).ok, false, 'нет согласия на передачу');
assert.strictEqual(validate({ ...base, consentData: 'true' }).ok, false, 'строка вместо true — не согласие');

// ─── honeypot ───
const spam = validate({ ...base, website: 'http://spam' });
assert.strictEqual(spam.ok, false);
assert.strictEqual(spam.error, 'spam');

// ─── длинные поля обрезаются, а не роняют функцию ───
const long = validate({ ...base, object: 'я'.repeat(5000), org: 'о'.repeat(500) });
assert.strictEqual(long.ok, true);
assert.strictEqual(long.lead.object.length, 600);
assert.strictEqual(long.lead.org.length, 120);

// ─── HTML в полях не ломает разметку сообщения ───
const msg = format(validate({ ...base, name: '<b>x</b>', object: 'a & b' }).lead, 'НП-ЕвроСтрой');
assert.ok(!msg.includes('<b>x</b>'), 'теги из пользовательского ввода должны экранироваться');
assert.ok(msg.includes('&lt;b&gt;x&lt;/b&gt;'));
assert.ok(msg.includes('a &amp; b'));
assert.ok(msg.includes('Согласия'), 'в заявке остаётся отметка о согласиях');

// ─── CORS: копию на GitHub Pages пускаем, чужие сайты — нет ───
assert.ok(cors('https://nikita2000zezulin-blip.github.io')['Access-Control-Allow-Origin']);
assert.ok(!cors('https://evil.example')['Access-Control-Allow-Origin'], 'чужой домен не пускаем');
assert.ok(!cors(null)['Access-Control-Allow-Origin'], 'запрос без Origin (curl, свой домен)');

console.log('OK — все проверки заявки прошли');
