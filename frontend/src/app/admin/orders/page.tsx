'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, formatPrice } from '@/lib/api';

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

export default function AdminOrdersPage() {
  const [data, setData] = useState<any | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) qs.set('status', status);
    if (q) qs.set('q', q);
    setData(await api(`/admin/orders?${qs}`));
  }, [status, q, page]);

  useEffect(() => {
    load().catch(() => setData({ items: [], total: 0, totalPages: 1 }));
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="font-condensed uppercase text-3xl text-lavender mr-auto">Заказы</h1>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Номер / email"
          className="input-rx !w-56"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="input-rx !w-48"
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {!data ? (
        <p className="font-mono text-sm text-steel">Загрузка…</p>
      ) : (
        <div className="spec-box overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-cobalt/40 text-steel uppercase tracking-widest2 text-left">
                <th className="p-3">Номер</th>
                <th className="p-3">Покупатель</th>
                <th className="p-3">Позиции</th>
                <th className="p-3">Сумма</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Оплата</th>
                <th className="p-3">Создан</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o: any) => (
                <tr key={o.id} className="border-b border-cobalt/20 hover:bg-void/60">
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.id}`} className="text-neon hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="p-3 text-peri-light">{o.email}</td>
                  <td className="p-3 text-steel">{o.items.length}</td>
                  <td className="p-3 text-neon">{formatPrice(o.total)}</td>
                  <td className="p-3 text-peri">{STATUS_LABELS[o.status] ?? o.status}</td>
                  <td className="p-3 text-steel">{o.payments?.[0]?.status ?? '—'}</td>
                  <td className="p-3 text-steel">{new Date(o.createdAt).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-steel">
                    Заказов нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex gap-2 mt-6 font-mono text-sm">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`spec-box px-3 py-1 ${p === page ? 'border-electric text-neon' : 'text-steel'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
