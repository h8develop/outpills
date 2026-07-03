/**
 * k6: ГОНКА ЗА ПОСЛЕДНИЙ ТОВАР.
 * 120 виртуальных пользователей одновременно пытаются купить товар,
 * которого осталось RACE_STOCK штук (по умолчанию 3).
 *
 * КРИТЕРИЙ УСПЕХА: заказов создано ровно RACE_STOCK, остальные получили
 * 409 с понятной ошибкой. Ни одного отрицательного остатка.
 *
 * Подготовка стенда (создать товар с ограниченным остатком):
 *   RACE_SLUG=tank-ribana — любой товар; выставь остаток варианта = 3
 *   через админку или SQL, затем:
 *
 * Запуск:
 *   k6 run -e API_URL=http://localhost:4000/api \
 *          -e RACE_VARIANT_ID=<uuid варианта> \
 *          load-testing/k6-last-item-race.js
 *
 * После прогона сверь в БД:
 *   SELECT "stockQuantity","reservedQuantity" FROM product_variants WHERE id='<uuid>';
 *   SELECT count(*) FROM orders WHERE status IN ('PENDING_PAYMENT','PAID');
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const API = __ENV.API_URL || 'http://localhost:4000/api';
const VARIANT_ID = __ENV.RACE_VARIANT_ID;

const created = new Counter('orders_created');
const rejected = new Counter('orders_rejected_out_of_stock');

export const options = {
  scenarios: {
    race: {
      executor: 'per-vu-iterations',
      vus: 120, // 120 одновременных покупателей
      iterations: 1,
      maxDuration: '2m',
    },
  },
};

export default function () {
  if (!VARIANT_ID) {
    throw new Error('Передай -e RACE_VARIANT_ID=<uuid варианта с малым остатком>');
  }
  const jar = http.cookieJar();

  let res = http.post(
    `${API}/cart/items`,
    JSON.stringify({ variantId: VARIANT_ID, quantity: 1 }),
    { headers: { 'Content-Type': 'application/json' }, jar },
  );
  // Часть VU отвалится уже здесь (корзина проверяет остаток) — это ок
  if (res.status !== 200 && res.status !== 201) {
    rejected.add(1);
    return;
  }

  res = http.post(
    `${API}/orders/checkout`,
    JSON.stringify({
      email: `race-${__VU}@test.local`,
      shippingAddress: 'Race test',
      idempotencyKey: `race-${__VU}-${Date.now()}`,
    }),
    { headers: { 'Content-Type': 'application/json' }, jar },
  );

  if (res.status === 201) created.add(1);
  if (res.status === 409) rejected.add(1);

  check(res, {
    'создан ИЛИ отказ по остатку (не 5xx!)': (r) => r.status === 201 || r.status === 409,
  });
}
