'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiError, formatPrice } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Ждёт оплаты',
  PAID: 'Оплачен',
  PAYMENT_FAILED: 'Оплата не прошла',
  CANCELLED: 'Отменён',
  EXPIRED: 'Истёк',
  PROCESSING: 'В обработке',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  RETURNED: 'Возврат',
};

const NEXT_ACTIONS: Record<string, string[]> = {
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  PENDING_PAYMENT: ['CANCELLED'],
  PAYMENT_FAILED: ['CANCELLED'],
};

export default function AdminOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setOrder(await api(`/admin/orders/${id}`));
  }, [id]);

  useEffect(() => {
    load().catch(() => setError('Заказ не найден'));
  }, [load]);

  async function changeStatus(status: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) return <p className="font-mono text-sm text-red-300">{error}</p>;
  if (!order) return <p className="font-mono text-sm text-steel">Загрузка…</p>;

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-condensed uppercase text-3xl text-lavender mr-auto">{order.number}</h1>
        <span className="font-mono text-xs uppercase tracking-widest2 text-neon">
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
        {(NEXT_ACTIONS[order.status] ?? []).map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => changeStatus(s)}
            className="btn-ghost !px-4 !py-2"
          >
            → {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {error && <p className="font-mono text-xs text-red-300">{error}</p>}

      <div className="grid md:grid-cols-2 gap-6">
        <section className="spec-box p-5 space-y-2">
          <p className="font-mono text-xs uppercase tracking-widest2 text-cobalt">Покупатель</p>
          <p className="font-mono text-sm text-peri-light">{order.customerName ?? '—'}</p>
          <p className="font-mono text-xs text-steel">{order.email}</p>
          <p className="font-mono text-xs text-steel">{order.phone ?? ''}</p>
          <p className="font-mono text-xs text-steel mt-3">
            Адрес: {order.shippingAddress ?? '—'}
          </p>
          <p className="font-mono text-xs text-steel">
            Доставка: {order.deliveryMethod?.name ?? '—'}
          </p>
        </section>

        <section className="spec-box p-5 space-y-2">
          <p className="font-mono text-xs uppercase tracking-widest2 text-cobalt">Платежи</p>
          {order.payments.length === 0 && <p className="font-mono text-xs text-steel">Нет платежей</p>}
          {order.payments.map((p: any) => (
            <div key={p.id} className="font-mono text-xs flex justify-between gap-2">
              <span className="text-steel truncate">
                {p.provider} · {p.externalId ?? p.id}
              </span>
              <span className="text-peri">{p.status}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="spec-box p-5">
        <p className="font-mono text-xs uppercase tracking-widest2 text-cobalt mb-3">Состав</p>
        <ul className="divide-y divide-cobalt/30">
          {order.items.map((item: any) => (
            <li key={item.id} className="py-2 flex justify-between gap-3 font-mono text-xs">
              <span className="text-peri-light">
                {item.productName} · {item.sku} · {item.color} · {item.size} × {item.quantity}
              </span>
              <span className="text-neon">{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-mono text-sm border-t border-cobalt/40 pt-3 mt-3">
          <span className="text-steel uppercase text-xs tracking-widest2">
            Итого (доставка {formatPrice(order.deliveryPrice)}, скидка {formatPrice(order.discount)})
          </span>
          <span className="text-neon">{formatPrice(order.total)}</span>
        </div>
      </section>

      <section className="spec-box p-5">
        <p className="font-mono text-xs uppercase tracking-widest2 text-cobalt mb-3">История статусов</p>
        {order.statusHistory.map((h: any) => (
          <p key={h.id} className="font-mono text-[11px] text-steel">
            {new Date(h.createdAt).toLocaleString('ru-RU')} — {h.from ? `${STATUS_LABELS[h.from] ?? h.from} → ` : ''}
            <span className="text-peri">{STATUS_LABELS[h.to] ?? h.to}</span>
            {h.comment ? ` · ${h.comment}` : ''}
          </p>
        ))}
      </section>
    </div>
  );
}
