/**
 * k6: полный checkout-flow — корзина → заказ → mock-оплата.
 * Запуск: k6 run -e API_URL=http://localhost:4000/api load-testing/k6-checkout.js
 *
 * ВНИМАНИЕ: создаёт реальные заказы в БД стенда. Гонять только на
 * тестовом окружении. Rate limit checkout (5/мин с IP) на стенде
 * нужно поднять или тестировать с разных агентов.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL || 'http://localhost:4000/api';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  const jar = http.cookieJar();

  // 1. Выбираем товар в наличии
  let res = http.get(`${API}/products?limit=24&inStock=1`);
  const items = res.json('items') || [];
  if (items.length === 0) return;
  const slug = items[Math.floor(Math.random() * items.length)].slug;

  res = http.get(`${API}/products/${slug}`);
  const variants = (res.json('variants') || []).filter((v) => v.inStock);
  if (variants.length === 0) return;
  const variant = variants[Math.floor(Math.random() * variants.length)];

  // 2. Корзина
  res = http.post(
    `${API}/cart/items`,
    JSON.stringify({ variantId: variant.id, quantity: 1 }),
    { headers: { 'Content-Type': 'application/json' }, jar },
  );
  check(res, { 'в корзину 201/200': (r) => r.status === 200 || r.status === 201 });

  // 3. Checkout с идемпотентным ключом
  res = http.post(
    `${API}/orders/checkout`,
    JSON.stringify({
      email: `load-${__VU}-${__ITER}@test.local`,
      shippingAddress: 'Load test',
      idempotencyKey: `k6-${__VU}-${__ITER}-${Date.now()}`,
    }),
    { headers: { 'Content-Type': 'application/json' }, jar },
  );
  // 201 — создан; 409 — товар кончился (валидный исход под нагрузкой)
  check(res, { 'checkout 201|409': (r) => r.status === 201 || r.status === 409 });

  if (res.status === 201) {
    const url = res.json('payment.confirmationUrl') || '';
    const match = /payment=([^&]+)/.exec(url);
    if (match) {
      // 4. Mock-оплата (каждый третий «отказывается» платить)
      const outcome = __ITER % 3 === 0 ? 'fail' : 'success';
      res = http.post(
        `${API}/payments/mock/simulate`,
        JSON.stringify({ externalId: match[1], outcome }),
        { headers: { 'Content-Type': 'application/json' } },
      );
      check(res, { 'webhook ok': (r) => r.status === 201 || r.status === 200 });
    }
  }

  sleep(Math.random() * 3 + 1);
}
