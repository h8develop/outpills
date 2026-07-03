/**
 * k6: админка — список заказов под нагрузкой (пагинация, фильтры).
 * Запуск:
 *   k6 run -e API_URL=http://localhost:4000/api \
 *          -e ADMIN_EMAIL=admin@outpills.local -e ADMIN_PASSWORD=... \
 *          load-testing/k6-admin-orders.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL || 'http://localhost:4000/api';

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: { http_req_duration: ['p(95)<600'] },
};

export function setup() {
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({
      email: __ENV.ADMIN_EMAIL || 'admin@outpills.local',
      password: __ENV.ADMIN_PASSWORD || 'outpills-admin-dev',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return { token: res.json('accessToken') };
}

export default function (data) {
  const params = { headers: { Authorization: `Bearer ${data.token}` } };

  let res = http.get(`${API}/admin/orders?page=1&limit=20`, params);
  check(res, { 'заказы 200': (r) => r.status === 200 });

  res = http.get(`${API}/admin/orders?status=PAID&limit=20`, params);
  check(res, { 'фильтр по статусу 200': (r) => r.status === 200 });

  res = http.get(`${API}/admin/products?limit=20`, params);
  check(res, { 'товары 200': (r) => r.status === 200 });

  sleep(1);
}
