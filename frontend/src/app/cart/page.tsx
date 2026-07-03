'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, formatPrice } from '@/lib/api';
import { CartView } from '@/lib/types';

export default function CartPage() {
  const [cart, setCart] = useState<CartView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCart(await api<CartView>('/cart'));
    } catch {
      setError('Не удалось загрузить корзину');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeQty(itemId: string, quantity: number) {
    try {
      setError(null);
      setCart(await api<CartView>(`/cart/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка');
      load();
    }
  }

  async function removeItem(itemId: string) {
    setCart(await api<CartView>(`/cart/items/${itemId}`, { method: 'DELETE' }));
  }

  if (!cart) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 font-mono text-sm text-steel">Загрузка…</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-condensed uppercase text-4xl text-lavender mb-8">Корзина</h1>

      {cart.items.length === 0 ? (
        <div className="py-20 text-center space-y-6">
          <p className="font-mono text-sm text-steel">Рецепт пуст. Ничего не выписано.</p>
          <Link href="/catalog" className="btn-dose">
            В каталог
          </Link>
        </div>
      ) : (
        <>
          {cart.hasStockIssues && (
            <p className="spec-box border-red-400/50 p-3 mb-6 font-mono text-xs text-red-300">
              Часть позиций закончилась или доступна в меньшем количестве — они помечены ниже.
              Обновите количество перед оформлением.
            </p>
          )}
          {error && <p className="mb-4 font-mono text-xs text-red-300">{error}</p>}

          <ul className="divide-y divide-cobalt/40">
            {cart.items.map((item) => (
              <li key={item.id} className="py-5 flex gap-4">
                <div className="spec-box h-24 w-20 shrink-0 bg-void overflow-hidden">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-cobalt">✚</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <Link href={`/product/${item.slug}`} className="text-lavender hover:text-neon">
                    {item.name}
                  </Link>
                  <p className="font-mono text-xs text-steel mt-1">
                    {item.sku} · {item.color} · {item.size}
                  </p>
                  {item.stockIssue && (
                    <p className="font-mono text-xs text-red-300 mt-1">
                      Доступно только {item.available} шт.
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-3">
                    <div className="spec-box flex items-center font-mono text-sm">
                      <button
                        type="button"
                        className="px-3 py-1 text-steel hover:text-neon"
                        onClick={() => changeQty(item.id, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="px-2 text-lavender">{item.quantity}</span>
                      <button
                        type="button"
                        className="px-3 py-1 text-steel hover:text-neon"
                        onClick={() => changeQty(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="font-mono text-xs text-steel hover:text-red-300 uppercase tracking-widest2"
                    >
                      Убрать
                    </button>
                  </div>
                </div>

                <div className="font-mono text-sm text-neon whitespace-nowrap">
                  {formatPrice(item.lineTotal)}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 spec-box p-5 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest2 text-steel">Итого</span>
            <span className="font-mono text-xl text-neon">{formatPrice(cart.subtotal)}</span>
          </div>

          <div className="mt-6 flex gap-4">
            <Link
              href="/checkout"
              className={`btn-dose flex-1 text-center ${cart.hasStockIssues ? 'pointer-events-none opacity-40' : ''}`}
            >
              Оформить заказ
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
