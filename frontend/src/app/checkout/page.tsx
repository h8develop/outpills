'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, formatPrice } from '@/lib/api';
import { CartView } from '@/lib/types';

interface DeliveryMethod {
  id: string;
  code: string;
  name: string;
  price: number;
}

/**
 * Checkout. idempotencyKey генерируется один раз на попытку оформления:
 * повторный сабмит (двойной клик, ретрай сети) не создаст второй заказ.
 */
export default function CheckoutPage() {
  const [cart, setCart] = useState<CartView | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<any[] | null>(null);

  const idempotencyKey = useMemo(
    () => `chk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  useEffect(() => {
    api<CartView>('/cart').then(setCart).catch(() => setError('Корзина недоступна'));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setUnavailable(null);
    try {
      const result = await api<{
        order: { number: string };
        payment: { confirmationUrl?: string; error?: string };
      }>('/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          email,
          customerName: name || undefined,
          phone: phone || undefined,
          shippingAddress: address || undefined,
          idempotencyKey,
        }),
      });

      if (result.payment?.confirmationUrl) {
        // Редирект на страницу оплаты (mock или реальный провайдер)
        window.location.href = result.payment.confirmationUrl;
      } else {
        window.location.href = `/orders/track?number=${result.order.number}&email=${encodeURIComponent(email)}`;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && (err.details as any)?.unavailable) {
        setUnavailable((err.details as any).unavailable);
      } else {
        setError(err instanceof ApiError ? err.message : 'Не удалось оформить заказ');
      }
      setBusy(false);
    }
  }

  if (!cart) {
    return <div className="mx-auto max-w-3xl px-4 py-20 font-mono text-sm text-steel">Загрузка…</div>;
  }
  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center space-y-6">
        <p className="font-mono text-sm text-steel">Корзина пуста — оформлять нечего.</p>
        <Link href="/catalog" className="btn-dose">
          В каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-condensed uppercase text-4xl text-lavender mb-2">Оформление</h1>
      <p className="font-mono text-xs text-steel uppercase tracking-widest2 mb-8">
        Бланк рецепта · заполните поля
      </p>

      {unavailable && (
        <div className="spec-box border-red-400/50 p-4 mb-6 space-y-2">
          <p className="font-mono text-xs text-red-300 uppercase tracking-widest2">
            Пока вы оформляли, часть товаров закончилась:
          </p>
          <ul className="font-mono text-xs text-red-200">
            {unavailable.map((u, i) => (
              <li key={i}>
                — {u.name} ({u.color}, {u.size}): доступно {u.available} шт.
              </li>
            ))}
          </ul>
          <Link href="/cart" className="font-mono text-xs text-neon underline">
            Вернуться в корзину и обновить количество
          </Link>
        </div>
      )}
      {error && <p className="mb-6 font-mono text-xs text-red-300">{error}</p>}

      <div className="grid md:grid-cols-5 gap-10">
        <form onSubmit={submit} className="md:col-span-3 space-y-5">
          <div>
            <label className="label-rx" htmlFor="email">
              Email *
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-rx"
              placeholder="subject@protocol.ru"
            />
          </div>
          <div>
            <label className="label-rx" htmlFor="name">
              Имя получателя
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-rx"
              placeholder="SUBJECT №…"
            />
          </div>
          <div>
            <label className="label-rx" htmlFor="phone">
              Телефон
            </label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-rx"
              placeholder="+7 …"
            />
          </div>
          <div>
            <label className="label-rx" htmlFor="address">
              Адрес доставки
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input-rx min-h-24"
              placeholder="Город, улица, дом, квартира / пункт выдачи"
            />
          </div>

          <button type="submit" className="btn-dose w-full" disabled={busy}>
            {busy ? 'Резервируем партию…' : 'Перейти к оплате'}
          </button>
          <p className="font-mono text-[10px] text-steel">
            Товары резервируются на 30 минут. Если оплата не пройдёт — резерв снимется автоматически.
          </p>
        </form>

        {/* Состав заказа */}
        <aside className="md:col-span-2">
          <div className="spec-box p-4 space-y-3">
            <p className="font-mono text-xs uppercase tracking-widest2 text-cobalt">Состав</p>
            <ul className="space-y-2">
              {cart.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 font-mono text-xs">
                  <span className="text-peri-light truncate">
                    {item.name} · {item.size} × {item.quantity}
                  </span>
                  <span className="text-neon whitespace-nowrap">{formatPrice(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-cobalt/40 pt-3 flex justify-between font-mono text-sm">
              <span className="text-steel uppercase tracking-widest2 text-xs">Итого</span>
              <span className="text-neon">{formatPrice(cart.subtotal)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
