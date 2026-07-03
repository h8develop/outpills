'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, formatPrice } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликован',
  HIDDEN: 'Скрыт',
  ARCHIVED: 'Архив',
};

export default function AdminProductsPage() {
  const [data, setData] = useState<any | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (q) qs.set('q', q);
    if (status) qs.set('status', status);
    setData(await api(`/admin/products?${qs}`));
  }, [q, status, page]);

  useEffect(() => {
    load().catch(() => setData({ items: [], total: 0, totalPages: 1 }));
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="font-condensed uppercase text-3xl text-lavender mr-auto">Товары</h1>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Поиск: название / SKU"
          className="input-rx !w-64"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="input-rx !w-44"
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <Link href="/admin/products/new" className="btn-dose">
          + Создать товар
        </Link>
      </div>

      {!data ? (
        <p className="font-mono text-sm text-steel">Загрузка…</p>
      ) : (
        <div className="spec-box overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-cobalt/40 text-steel uppercase tracking-widest2 text-left">
                <th className="p-3">Товар</th>
                <th className="p-3">Категория</th>
                <th className="p-3">Цена</th>
                <th className="p-3">Остаток (дост.)</th>
                <th className="p-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p: any) => (
                <tr key={p.id} className="border-b border-cobalt/20 hover:bg-void/60">
                  <td className="p-3">
                    <Link href={`/admin/products/${p.id}`} className="text-lavender hover:text-neon">
                      {p.name}
                    </Link>
                    <p className="text-steel mt-0.5">{p.variants?.[0]?.sku ?? '—'}</p>
                  </td>
                  <td className="p-3 text-steel">{p.category?.name}</td>
                  <td className="p-3 text-neon">{formatPrice(p.basePrice)}</td>
                  <td className={`p-3 ${p.totalAvailable <= 3 ? 'text-red-300' : 'text-peri'}`}>
                    {p.totalAvailable}
                  </td>
                  <td className="p-3 text-steel">{STATUS_LABELS[p.status] ?? p.status}</td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-steel">
                    Ничего не найдено
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
