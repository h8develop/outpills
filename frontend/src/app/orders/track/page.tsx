'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError, formatPrice } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Ожидает оплаты',
  PAID: 'Оплачен',
  PAYMENT_FAILED: 'Оплата не прошла',
  CANCELLED: 'Отменён',
  EXPIRED: 'Истёк (не оплачен вовремя)',
  PROCESSING: 'В обработке',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  RETURNED: 'Возврат',
};

function TrackInner() {
  const params = useSearchParams();
  const [number, setNumber] = useState(params.get('number') ?? '');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [order, setOrder] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(async (num: string, mail: string) => {
    setBusy(true);
    setError(null);
    try {
      setOrder(await api(`/orders/${encodeURIComponent(num)}?email=${encodeURIComponent(mail)}`));
    } catch (e) {
      setOrder(null);
      setError(e instanceof ApiError && e.status === 404 ? 'Заказ не найден — проверьте номер и email' : 'Ошибка запроса');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (params.get('number') && params.get('email')) {
      lookup(params.get('number')!, params.get('email')!);
    }
  }, [params, lookup]);

  async function retryPayment() {
    setBusy(true);
    try {
      const payment = await api<{ confirmationUrl?: string }>(
        `/orders/${encodeURIComponent(number)}/retry-payment`,
        { method: 'POST', body: JSON.stringify({ email }) },
      );
      if (payment.confirmationUrl) window.location.href = payment.confirmationUrl;
    } catch {
      setError('Не удалось создать платёж — попробуйте позже');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-condensed uppercase text-4xl text-lavender mb-2">Мой заказ</h1>
      <p className="font-mono text-xs text-steel uppercase tracking-widest2 mb-8">
        Введите номер партии и email из заказа
      </p>

      <form
        className="flex flex-col sm:flex-row gap-3 mb-10"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(number, email);
        }}
      >
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value.trim())}
          placeholder="OP-…"
          required
          className="input-rx sm:flex-1"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          placeholder="email из заказа"
          required
          className="input-rx sm:flex-1"
        />
        <button type="submit" className="btn-dose" disabled={busy}>
          {busy ? '…' : 'Найти'}
        </button>
      </form>

      {error && <p className="font-mono text-xs text-red-300">{error}</p>}

      {order && (
        <div className="spec-box p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg text-neon">{order.number}</span>
            <span className="font-mono text-xs uppercase tracking-widest2 text-peri">
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>

          <ul className="divide-y divide-cobalt/40">
            {order.items.map((item: any) => (
              <li key={item.id} className="py-3 flex justify-between gap-3 font-mono text-xs">
                <span className="text-peri-light">
                  {item.productName} · {item.color} · {item.size} × {item.quantity}
                </span>
                <span className="text-neon">{formatPrice(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>

          <div className="flex justify-between font-mono text-sm border-t border-cobalt/40 pt-4">
            <span className="text-steel uppercase text-xs tracking-widest2">Итого</span>
            <span className="text-neon">{formatPrice(order.total)}</span>
          </div>

          {order.status === 'PENDING_PAYMENT' && (
            <button type="button" onClick={retryPayment} disabled={busy} className="btn-dose w-full">
              Оплатить
            </button>
          )}

          {/* История статусов */}
          {order.statusHistory?.length > 0 && (
            <div className="space-y-1">
              <p className="label-rx">Протокол</p>
              {order.statusHistory.map((h: any) => (
                <p key={h.id} className="font-mono text-[10px] text-steel">
                  {new Date(h.createdAt).toLocaleString('ru-RU')} — {STATUS_LABELS[h.to] ?? h.to}
                  {h.comment ? ` · ${h.comment}` : ''}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense>
      <TrackInner />
    </Suspense>
  );
}
