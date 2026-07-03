/**
 * k6: браузинг витрины — главная, каталог, фильтры, карточка товара.
 * Запуск: k6 run -e API_URL=http://localhost:4000/api load-testing/k6-browse.js
 * Профиль: плавный рост до 200 VU (поменяй под свой стенд).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL || 'http://localhost:4000/api';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Каталог
  let res = http.get(`${API}/products?limit=24`);
  check(res, { 'каталог 200': (r) => r.status === 200 });

  // Фильтрация
  res = http.get(`${API}/products?limit=24&size=M&sort=price_asc&inStock=1`);
  check(res, { 'фильтры 200': (r) => r.status === 200 });

  // Карточка товара
  const items = res.json('items');
  if (items && items.length > 0) {
    const slug = items[Math.floor(Math.random() * items.length)].slug;
    res = http.get(`${API}/products/${slug}`);
    check(res, { 'карточка 200': (r) => r.status === 200 });
  }

  // Категории (кешируются в Redis)
  res = http.get(`${API}/categories`);
  check(res, { 'категории 200': (r) => r.status === 200 });

  sleep(Math.random() * 2 + 0.5);
}
