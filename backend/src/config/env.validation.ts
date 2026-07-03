/**
 * Валидация окружения на старте — приложение падает сразу,
 * а не на первом запросе, если конфигурация неполная.
 */
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];

const REQUIRED_IN_PRODUCTION = [
  'REDIS_URL',
  'CORS_ORIGINS',
  'FRONTEND_URL',
  'API_URL',
  'COOKIE_DOMAIN',
  'PAYMENT_WEBHOOK_SECRET',
];

export function validateEnv(config: Record<string, unknown>) {
  const missing = REQUIRED.filter((key) => !config[key]);

  if (config.NODE_ENV === 'production' || config.APP_ENV === 'production') {
    missing.push(...REQUIRED_IN_PRODUCTION.filter((key) => !config[key]));

    // Дефолтные секреты в проде недопустимы
    for (const key of ['JWT_SECRET', 'PAYMENT_WEBHOOK_SECRET']) {
      const val = String(config[key] || '');
      if (val && (val.includes('change_me') || val.length < 16)) {
        throw new Error(`${key}: в production нужен реальный секрет (>=16 символов, не placeholder)`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Отсутствуют обязательные env-переменные: ${missing.join(', ')}`);
  }
  return config;
}
