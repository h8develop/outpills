'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, formatPrice } from '@/lib/api';

/**
 * Эмулятор страницы оплаты (mock-провайдер).
 * Повторяет флоу реального эквайринга: «оплатить» / «отказ» → webhook
 * в backend → редирект на success/fail. При подключении CloudPayments
 * или Робокассы эта страница не используется — пользователь уходит
 * на страницу провайдера.
 */
function MockPayInner() {
  const params = useSearchParams();
  const router = useRouter();
  const externalId = params.get('payment') ?? '';
  const orderNumber = params.get('order') ?? '';
  const amount = Number(params.get('amount') ?? 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function simulate(outcome: 'success' | 'fail') {
    setBusy(outcome);
    setError(null);
    try {
      await api('/payments/mock/simulate', {
        method: 'POST',
        body: JSON.stringify({ externalId, outcome }),
      });
      router.push(outcome === 'success' ? `/checkout/success?order=${orderNumber}` : `/checkout/fail?order=${orderNumber}`);
    } catch {
      setError('Не удалось обработать платёж — попробуйте ещё раз');
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <div className="spec-box p-8 bg-void space-y-6">
        <div className="text-center space-y-2">
          <p className="font-mono text-[10px] text-cobalt uppercase tracking-widest2">
            MOCK PAYMENT GATEWAY · ТЕСТОВЫЙ РЕЖИМ
          </p>
          <h1 className="font-condensed uppercase text-3xl text-lavender">Оплата</h1>
          <p className="font-mono text-xs text-steel">Заказ {orderNumber}</p>
          <p className="font-mono text-2xl text-neon">{formatPrice(amount)}</p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            className="btn-dose w-full"
            disabled={busy !== null}
            onClick={() => simulate('success')}
          >
            {busy === 'success' ? 'Проводим…' : 'Оплатить (успех)'}
          </button>
          <button
            type="button"
            className="btn-ghost w-full"
            disabled={busy !== null}
            onClick={() => simulate('fail')}
          >
            {busy === 'fail' ? 'Отклоняем…' : 'Эмулировать отказ'}
          </button>
        </div>

        {error && <p className="font-mono text-xs text-red-300 text-center">{error}</p>}

        <p className="font-mono text-[10px] text-steel text-center">
          Реальные деньги не списываются. Это заглушка до подключения CloudPayments / Робокассы.
        </p>
      </div>
    </div>
  );
}

export default function MockPayPage() {
  return (
    <Suspense>
      <MockPayInner />
    </Suspense>
  );
}
