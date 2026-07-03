# outpills — интернет-магазин

> Y2K-бренд одежды: «аптека будущего, которой не существует».
> Снаружи передоз. Внутри — ясность.

Полнофункциональная основа интернет-магазина одежды: каталог, корзина,
checkout с атомарным резервированием остатков, платёжная абстракция
(mock → CloudPayments / Робокасса без переписывания), админка, Docker,
production-деплой на свой домен.

---

## Стек

| Слой | Технология | Почему |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind | зафиксировано в CLAUDE.md; SSR для SEO каталога, standalone-образ для Docker |
| Backend | NestJS 10 + Prisma | модульная структура (products/cart/orders/payments), типизированные миграции |
| БД | PostgreSQL 16 | транзакции и атомарные UPDATE для резервирования |
| Кеш | Redis 7 | кеш каталога; в scalable-проде — rate limit и сессии |
| Хранилище | MinIO (S3-совместимое) | изображения товаров вне контейнера; в проде — любой S3 + CDN |
| Reverse proxy | Caddy 2 | автоматический HTTPS (Let's Encrypt) одной строкой конфига |

## Архитектура сервисов

```
                    ┌─────────────┐
   HTTPS            │    Caddy    │  ← Let's Encrypt, security headers,
  ───────────────►  │ (reverse    │    body limit, health-based LB
                    │   proxy)    │
                    └──┬───────┬──┘
             example.com       api.example.com
                    │               │
              ┌─────▼────┐    ┌─────▼────┐     ┌──────────┐
              │   web    │    │   api    │────►│ Postgres │
              │ Next.js  │───►│  NestJS  │     └──────────┘
              └──────────┘    │ stateless│────►┌──────────┐
                              └────┬─────┘     │  Redis   │
                                   │           └──────────┘
                      media.example.com ◄──── MinIO / S3 (+CDN)
```

Backend **stateless**: сессий в памяти нет (JWT в httpOnly-cookie),
кеш и разделяемое состояние — в Redis/Postgres → реплики `api`
масштабируются горизонтально без доработок.

---

## Локальный запуск

Требования: Docker + Docker Compose, Node.js 20+ (для запуска вне Docker).

```bash
git clone https://github.com/h8develop/outpills.git && cd outpills
cp .env.example .env

# Вариант А: всё в Docker
docker compose up -d --build

# Вариант Б (быстрее для разработки): инфраструктура в Docker, код локально
docker compose up -d db redis minio minio-init
cd backend  && npm install && npm run prisma:migrate && npm run prisma:seed && npm run start:dev
cd frontend && npm install && npm run dev
```

Проверка:

| Что | Где |
|---|---|
| Магазин | http://localhost:3000 |
| API healthcheck | http://localhost:4000/health |
| Админка | http://localhost:3000/admin (`admin@outpills.local` / `outpills-admin-dev`) |
| MinIO-консоль | http://localhost:9001 |

> Postgres проброшен на **15432** (а не 5432), чтобы не конфликтовать
> с локальным Postgres на маке/линуксе.

### Миграции и seed

```bash
cd backend
npm run prisma:migrate   # dev: создать/применить миграции
npm run prisma:deploy    # prod: применить существующие миграции
npm run prisma:seed      # категории, доставка, админ, коллекция PROTOCOL 01
```

### Тест защиты от овер-селлинга

```bash
cd backend && npm run test:stock-race
# 30 конкурентных покупателей на 3 единицы товара →
# ровно 3 успешных резерва, 27 отказов
```

---

## Production-деплой (MVP: один VPS)

Подходит для старта и небольшого трафика. Для 40–80k одновременных
пользователей — см. «Масштабирование и высокая нагрузка» ниже.

### 1. Домен

1. Купи домен (для outpills: REG.RU — outpills.ru; outpills.com — REG.RU / Cloudflare / Porkbun).
2. Создай **A-записи** на IP сервера:

```
@      A  <IP сервера>     # example.com
www    A  <IP сервера>
api    A  <IP сервера>
media  A  <IP сервера>
```

### 2. Сервер

```bash
# Ubuntu 22.04+; установка Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

git clone https://github.com/h8develop/outpills.git && cd outpills
cp .env.production.example .env.production
nano .env.production        # заполнить ВСЕ значения; секреты: openssl rand -hex 32
```

Минимум к заполнению: `BASE_DOMAIN`, `FRONTEND_URL`, `API_URL`, `CORS_ORIGINS`,
`COOKIE_DOMAIN`, `ACME_EMAIL`, `POSTGRES_PASSWORD`, `DATABASE_URL`,
`JWT_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `STORAGE_*`.

### 3. Запуск

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Миграции
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Первичный seed (по желанию)
docker compose -f docker-compose.prod.yml exec api npx ts-node prisma/seed.ts
```

HTTPS Caddy получает **автоматически** (Let's Encrypt) — нужен только
проброшенный 80/443 порт и корректные A-записи.

### 4. Чеклист после деплоя

```bash
curl https://api.example.com/health          # {"status":"ok",...}
curl -I https://example.com                  # 200, HTTPS работает
curl -I https://www.example.com              # 308 → example.com
# CORS: из консоли браузера на example.com выполнить fetch к api.example.com
# Изображения: загрузить фото товара в админке → проверить URL media.example.com
# Checkout: собрать корзину → оформить → mock-оплата → заказ PAID
```

### Обновление приложения

```bash
cd outpills && git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

### Rollback

```bash
git log --oneline           # найти последний рабочий коммит
git checkout <commit>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# Откат миграций Prisma не делает автоматически: восстановление БД — из бэкапа
```

### Бэкапы

```bash
# БД: ежедневный pg_dump (добавь в cron сервера)
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U outpills outpills | gzip > deploy/backups/db-$(date +%F).sql.gz

# Изображения: rclone/mc-синк бакета в другое хранилище
docker run --rm --network outpills_default -v minio_backup:/backup minio/mc:latest \
  sh -c "mc alias set src http://minio:9000 KEY SECRET && mc mirror src/outpills-media /backup"
```

Хранить: 7 ежедневных + 4 недельных, минимум одна копия вне сервера.

### Логи

Все контейнеры пишут в json-file с ротацией (20 МБ × 5 файлов):

```bash
docker compose -f docker-compose.prod.yml logs -f api
```

---

## Env-переменные

| Переменная | Назначение |
|---|---|
| `NODE_ENV` / `APP_ENV` | режим приложения |
| `BASE_DOMAIN` | корневой домен (для Caddy) |
| `FRONTEND_URL` / `API_URL` / `ADMIN_URL` | публичные URL поверхностей |
| `CORS_ORIGINS` | список разрешённых origin через запятую |
| `COOKIE_DOMAIN` | домен cookie (`.example.com` — общий для поддоменов) |
| `DATABASE_URL` | Postgres + `connection_limit` (пул на реплику) |
| `REDIS_URL` | Redis (кеш; без него — деградация, не отказ) |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | подпись JWT |
| `SESSION_SECRET` | зарезервировано под серверные сессии |
| `STORAGE_TYPE/BUCKET/ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY` | S3-совместимое хранилище |
| `STORAGE_PUBLIC_URL` | база URL картинок — сюда ставится CDN |
| `PAYMENT_PROVIDER` | `mock` \| `cloudpayments` \| `robokassa` |
| `PAYMENT_SUCCESS_URL/FAIL_URL/RETURN_URL` | возврат пользователя после оплаты |
| `PAYMENT_WEBHOOK_SECRET` | подпись webhook-ов |
| `PAYMENT_IDEMPOTENCY_SECRET` | зарезервировано для ключей идемпотентности провайдера |
| `RESERVATION_TTL_MINUTES` | сколько минут держится резерв до оплаты |
| `RATE_LIMIT_WINDOW` / `RATE_LIMIT_MAX_REQUESTS` | глобальный rate limit |
| `RUN_WORKERS` | 1/0 — выполняет ли реплика фоновые задачи |
| `ACME_EMAIL` | email для Let's Encrypt |

Все секреты — только в `.env` / `.env.production` (в `.gitignore`).
В репозитории — только placeholder-ы.

---

## Как работает резервирование товаров

Остатки живут на **варианте** (размер × цвет): `stockQuantity`,
`reservedQuantity`; доступно = `stock − reserved`. Покупка при
`available <= 0` невозможна.

Checkout (`backend/src/orders/orders.service.ts`):

1. Корзина перечитывается из БД — количеству/ценам с фронта не верим.
2. Цены и скидки пересчитываются на backend.
3. В одной транзакции каждый товар резервируется **атомарным условным UPDATE**:

```sql
UPDATE product_variants
   SET "reservedQuantity" = "reservedQuantity" + :qty
 WHERE id = :id AND "stockQuantity" - "reservedQuantity" >= :qty
```

Postgres выполняет проверку и запись под блокировкой строки: из двух
конкурентных покупателей последней единицы пройдёт ровно один. Если
`rowCount = 0` — транзакция откатывается, пользователь получает 409 со
списком недоступных позиций.

4. Заказ создаётся в `PENDING_PAYMENT` с TTL резерва (30 мин).
5. Оплата прошла → резерв **списывается** (`stock − qty, reserved − qty`).
6. Оплата упала/отменена → резерв **освобождается**.
7. Оплата не завершена за TTL → cron-воркер переводит заказ в `EXPIRED`
   и снимает резерв (условный `updateMany` — безопасно при нескольких воркерах).

Каждое движение пишется в `stock_movements` (RESERVE/RELEASE/COMMIT/RESTOCK/ADJUST) — полный аудит склада.

Защита от дублей:

- **двойной заказ** — `idempotencyKey` у checkout: повторная отправка формы возвращает существующий заказ;
- **двойной webhook** — (1) журнал `webhook_events` c UNIQUE(provider, eventId), (2) терминальные статусы платежа не переигрываются. Повторный webhook не спишет товар дважды.

---

## Платежи: как подключить реального провайдера

Слой абстракции: `backend/src/payments/`.

- `providers/payment-provider.interface.ts` — контракт: `createPayment`, `verifyWebhookSignature`, `parseWebhook`, `fetchPaymentStatus`;
- `payments.service.ts` — бизнес-логика (статусы, идемпотентность, списание/возврат резервов) — **не знает** деталей провайдеров;
- `providers/mock.provider.ts` — рабочий эмулятор (HMAC-подпись webhook, страница оплаты на фронте);
- `providers/cloudpayments.provider.ts`, `providers/robokassa.provider.ts` — заготовки с пошаговым планом интеграции в комментариях.

Подключение CloudPayments (Робокасса — аналогично):

1. Заполни методы в `cloudpayments.provider.ts` (в файле расписано, какие: виджет/ссылка на оплату, проверка HMAC заголовка, маппинг статусов Pay/Fail/Cancel).
2. Добавь env: `CLOUDPAYMENTS_PUBLIC_ID`, `CLOUDPAYMENTS_API_SECRET`.
3. Поставь `PAYMENT_PROVIDER=cloudpayments`.
4. Укажи в ЛК провайдера webhook: `https://api.example.com/api/payments/webhook/cloudpayments`.

Checkout, orders и склад **не меняются вообще** — они работают через интерфейс.

---

## Изображения товаров

- Хранятся в S3-совместимом хранилище (dev — MinIO), **не в контейнере**.
- Загрузка из админки — по presigned URL напрямую в бакет (backend не является узким местом).
- `STORAGE_PUBLIC_URL` — точка подключения CDN: поставь сюда CDN-домен, и все URL картинок автоматически уйдут за CDN.
- alt-текст, выбор главного изображения, сортировка — в форме товара.
- Генерация thumbnail-ов — в списке фоновых задач (см. SCALING).

---

## Масштабирование и высокая нагрузка

### MVP-деплой vs scalable production

**Один VPS с Docker Compose (текущий prod-конфиг) НЕ рассчитан на
40 000–80 000 одновременных пользователей.** Это честное ограничение:
один сервер упирается в CPU/RAM/диск, одна нода Postgres — в соединения
и IOPS, и любой отказ сервера = полный даунтайм магазина.

MVP-конфиг подходит для: старта, первых дропов, сотен одновременных
пользователей. Дальше — горизонтальное масштабирование.

### Что уже заложено под масштабирование

- **Stateless backend**: JWT, без состояния в памяти процесса → реплики добавляются без доработок (`--scale api=3` уже работает на одном хосте);
- пул соединений на реплику ограничен через `DATABASE_URL`;
- rate limiting, body limit, request timeout;
- graceful shutdown (SIGTERM → дорабатываем запросы, закрываем пулы);
- healthcheck-и `/health`, `/health/live`, `/health/ready` — готовые liveness/readiness probes для k8s;
- кеш каталога в Redis с инвалидацией по записи;
- атомарные операции склада — корректны при любом числе реплик;
- идемпотентность checkout и webhook — безопасные ретраи;
- изображения в object storage, URL строятся от CDN-переменной;
- деградация: Redis умер → кеш выключился, магазин работает от БД; платёжка умерла → заказ остаётся `PENDING_PAYMENT` с TTL-резервом, пользователю понятная ошибка, оплату можно повторить.

### Целевая архитектура для 40–80k одновременных

| Компонент | Решение |
|---|---|
| Оркестрация | Kubernetes / managed-платформа (Yandex Managed k8s, VK Cloud, Timeweb Cloud Apps) |
| Backend | 5–15+ реплик `api`, HPA по CPU/RPS, PodDisruptionBudget |
| Frontend | 3–5+ реплик `web`; статика Next.js — на CDN |
| Балансировка | облачный L7 LB / ingress-nginx перед репликами |
| БД | **managed PostgreSQL** с failover-репликой; 1–2 read-реплики для каталога/отчётов; PgBouncer перед базой |
| Кеш | managed Redis (Sentinel/Cluster); сюда же rate limit (ThrottlerStorageRedis) и сессии |
| Изображения | managed S3 + **CDN** (Selectel/VK/Yandex CDN, для СНГ-аудитории) |
| Очереди | **BullMQ** поверх Redis (стек уже Node) — см. ниже |
| Логи | Loki/ELK, драйвер json-file уже структурирован |
| Метрики | Prometheus + Grafana, алерты в Telegram |
| Деплой | rolling update (k8s из коробки) или blue-green; zero-downtime за счёт readiness probe |

### Как масштабировать backend

1. Реплики: `--scale api=N` (compose) или `replicas: N` (k8s).
2. `RUN_WORKERS=1` только на одной реплике (или вынести воркер отдельным deployment), остальные — `RUN_WORKERS=0`.
3. Сумма `connection_limit` всех реплик < `max_connections` Postgres; при 10+ репликах — PgBouncer (transaction pooling).
4. Rate limit перевести на Redis-storage, чтобы лимиты были общими для всех реплик.

### Как масштабировать БД

- managed Postgres с автоматическим failover;
- read-реплики: чтение каталога и отчёты админки → реплика, запись и checkout → мастер (в Prisma — два клиента с разными URL);
- индексы уже стоят на всех горячих путях (`slug`, `sku`, `status+categoryId+createdAt`, `status+reservationExpiresAt`, `provider+externalId`);
- партиционирование `orders`/`stock_movements` по датам — при миллионах строк.

### Как подключить Redis / CDN / очередь

- **Redis**: `REDIS_URL` на managed-инстанс — всё. Кеш каталога уже работает; для rate limit добавить `ThrottlerStorageRedisService`.
- **CDN**: направь CDN на media-домен или бакет и поставь `STORAGE_PUBLIC_URL=https://cdn.example.com`. Все картинки уходят за CDN без изменений кода.
- **Очередь (BullMQ)**: `npm i bullmq`, очереди `emails`, `images`, `reservations`, `webhooks`. Первые кандидаты на вынос: email-уведомления, генерация thumbnail-ов, снятие просроченных резервов (сейчас — cron в процессе API, интерфейс InventoryService не меняется), ретраи webhook-ов, экспорт заказов, уведомления администратору.

### Что кешируется (и что нельзя)

| Данные | TTL | Инвалидация |
|---|---|---|
| Списки каталога | 60 с | по записи товара из админки (префикс `catalog:*`) |
| Карточка товара (без остатков) | 120 с | так же |
| Категории | 300 с | по записи категории |
| **Остатки** | не кешируются с карточкой | читаются свежими; финальная правда — атомарный UPDATE на checkout |
| **Цена заказа** | никогда | пересчёт на backend при каждом checkout |
| **Статус оплаты** | никогда | только БД/webhook |

### Нагрузочное тестирование (k6)

```bash
brew install k6   # или https://k6.io/docs/get-started/installation/

# 1. Браузинг: каталог, фильтры, карточки (плавно до 200 VU)
k6 run -e API_URL=http://localhost:4000/api load-testing/k6-browse.js

# 2. Полный checkout-flow с mock-оплатой
k6 run -e API_URL=http://localhost:4000/api load-testing/k6-checkout.js

# 3. ГОНКА: 120 покупателей за 3 единицы товара
k6 run -e API_URL=http://localhost:4000/api \
       -e RACE_VARIANT_ID=<uuid варианта с остатком 3> \
       load-testing/k6-last-item-race.js
# Успех: orders_created == остатку, остальным 409, ни одного 5xx

# 4. Админка под нагрузкой
k6 run -e API_URL=http://localhost:4000/api load-testing/k6-admin-orders.js
```

Быстрая проверка гонки без k6: `cd backend && npm run test:stock-race`.

### Метрики, которые смотреть перед ростом нагрузки

RPS · latency p95/p99 · error rate · CPU/RAM реплик · соединения к БД ·
slow queries · cache hit rate · queue lag · заказы/мин · ошибки checkout ·
ошибки платежей · просроченные резервы/мин · webhook-ошибки · отмены.

Пороговые сигналы: p99 > 1 c на каталоге → добавить реплику/проверить кеш;
соединения БД > 80% max → PgBouncer; ошибки checkout > 1% → смотреть
блокировки в `product_variants`.

---

## Частые проблемы запуска

| Симптом | Причина/решение |
|---|---|
| `P1010 denied` при миграции | локальный Postgres перехватывает порт — наш проброшен на **15432** |
| Порт 15432 занят | поменяй маппинг в `docker-compose.yml` |
| API: `Отсутствуют обязательные env` | скопируй `.env.example` → `.env` |
| Картинки не грузятся | не поднят MinIO: `docker compose up -d minio minio-init` |
| CORS-ошибка в браузере | добавь origin фронта в `CORS_ORIGINS` |
| 429 при тестах checkout | сработал rate limit (5/мин) — это защита, для стенда поднимите лимит |
| Caddy не выдаёт сертификат | проверь A-записи и доступность 80/443 снаружи |

---

## Структура репозитория

```
backend/            NestJS API
  prisma/           схема, миграции, seed
  src/
    auth/           JWT, guards (admin)
    products/       публичный каталог (+Redis-кеш)
    categories/
    cart/           корзина (гостевая по cookie-токену)
    inventory/      ЕДИНСТВЕННОЕ место изменения остатков (атомарные UPDATE)
    orders/         checkout, TTL-воркер резервов
    payments/       PaymentService + провайдеры (mock / заготовки CP, Robokassa)
    admin/          товары CRUD, заказы, покупатели, настройки
    storage/        S3/MinIO: presigned upload, публичные URL (CDN-ready)
    health/         /health, /health/live, /health/ready
frontend/           Next.js 14 + Tailwind (токены из бренд-бука)
  src/app/          витрина, каталог, товар, корзина, checkout, /admin
deploy/             Caddyfile (reverse proxy + HTTPS)
load-testing/       k6-сценарии (браузинг, checkout, гонка за последний товар)
docker-compose.yml       dev-окружение
docker-compose.prod.yml  production (MVP, один VPS)
.env.example             dev-конфиг (placeholder-ы)
.env.production.example  production-конфиг (placeholder-ы)
```
