'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { PublicVariant } from '@/lib/types';

/**
 * Выбор цвета и размера + добавление в корзину.
 * UX магазина одежды: отсутствующие размеры видны, но недоступны;
 * при малом остатке — предупреждение «осталось N».
 */
export function VariantPicker({ variants }: { variants: PublicVariant[] }) {
  const router = useRouter();
  const colors = useMemo(
    () => [...new Map(variants.map((v) => [v.color, v.colorHex])).entries()],
    [variants],
  );
  const [color, setColor] = useState<string>(colors[0]?.[0] ?? '');
  const [size, setSize] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const sizesForColor = useMemo(
    () => variants.filter((v) => v.color === color),
    [variants, color],
  );
  const selected = sizesForColor.find((v) => v.size === size);

  async function addToCart() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      await api('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ variantId: selected.id, quantity: 1 }),
      });
      setMessage({ kind: 'ok', text: 'Добавлено. Доза в корзине.' });
      router.refresh();
    } catch (e) {
      const text =
        e instanceof ApiError ? e.message : 'Не удалось добавить — попробуйте ещё раз';
      setMessage({ kind: 'err', text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Цвет */}
      <div>
        <p className="label-rx">Цвет: {color}</p>
        <div className="flex gap-2">
          {colors.map(([c, hex]) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => {
                setColor(c);
                setSize(null);
              }}
              className={`h-8 w-8 border transition-colors ${
                color === c ? 'border-electric' : 'border-steel/50 hover:border-peri'
              }`}
              style={{ backgroundColor: hex ?? '#0A0C12' }}
            />
          ))}
        </div>
      </div>

      {/* Размер */}
      <div>
        <p className="label-rx">Размер</p>
        <div className="flex flex-wrap gap-2">
          {sizesForColor.map((v) => {
            const out = !v.inStock;
            return (
              <button
                key={v.id}
                type="button"
                disabled={out}
                onClick={() => setSize(v.size)}
                className={`spec-box px-4 py-2 font-mono text-sm transition-colors ${
                  out
                    ? 'text-cobalt line-through cursor-not-allowed'
                    : size === v.size
                      ? 'border-electric text-neon'
                      : 'text-steel hover:text-neon'
                }`}
              >
                {v.size}
              </button>
            );
          })}
        </div>
        {selected && selected.available !== undefined && selected.available <= 3 && selected.inStock && (
          <p className="mt-2 font-mono text-xs text-ice">
            Осталось {selected.available} шт. — партия на исходе
          </p>
        )}
      </div>

      <button type="button" className="btn-dose w-full sm:w-auto" disabled={!selected || busy} onClick={addToCart}>
        {busy ? 'Выписываем…' : selected ? 'Добавить в корзину' : 'Выберите размер'}
      </button>

      {message && (
        <p
          className={`font-mono text-xs ${message.kind === 'ok' ? 'text-ice' : 'text-red-400'}`}
          role="status"
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
