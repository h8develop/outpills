import Link from 'next/link';
import { Product } from '@/lib/types';
import { formatPrice } from '@/lib/api';

/**
 * Карточка-«препарат» (бренд-бук 4.7): рамка-бокс, моноширинный индекс,
 * бейджи в языке дозировок. SOLD OUT = «доза исчерпана».
 */
export function ProductCard({ product, index }: { product: Product; index: number }) {
  const image = product.images[0];
  const soldOut =
    product.variants.length > 0 && product.variants.every((v) => v.status === 'OUT_OF_STOCK');
  const isNew =
    Date.now() - new Date(product.createdAt).getTime() < 1000 * 60 * 60 * 24 * 30;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="spec-box group flex flex-col bg-void/40 hover:border-electric transition-colors"
    >
      {/* Изображение или плейсхолдер-«блистер» */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-b from-void to-ink">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.alt ?? product.name}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <span className="font-mono text-cobalt text-4xl select-none">✚</span>
          </div>
        )}

        {/* Бейджи */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {soldOut && (
            <span className="bg-void/90 text-steel font-mono text-[10px] uppercase tracking-widest2 px-2 py-1">
              Доза исчерпана
            </span>
          )}
          {!soldOut && product.saleActive && (
            <span className="bg-navy text-neon font-mono text-[10px] uppercase tracking-widest2 px-2 py-1">
              Доза снижена
            </span>
          )}
          {!soldOut && isNew && (
            <span className="bg-electric text-void font-mono text-[10px] uppercase tracking-widest2 px-2 py-1">
              Новая партия
            </span>
          )}
        </div>
      </div>

      {/* Этикетка */}
      <div className="p-4 flex flex-col gap-2 border-t border-cobalt/40">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[10px] text-steel uppercase tracking-widest2">
            SPEC №{String(index + 1).padStart(3, '0')}
          </span>
          {product.collection && (
            <span className="font-mono text-[10px] text-cobalt uppercase">{product.collection}</span>
          )}
        </div>
        <h3 className="text-sm text-lavender leading-snug">{product.name}</h3>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-neon">{formatPrice(product.effectivePrice)}</span>
          {product.saleActive && (
            <span className="font-mono text-xs text-steel line-through">
              {formatPrice(product.basePrice)}
            </span>
          )}
        </div>
        {/* Свотчи цветов из вариантов */}
        <div className="flex gap-1.5 mt-1">
          {[...new Map(product.variants.map((v) => [v.color, v.colorHex])).entries()]
            .slice(0, 4)
            .map(([color, hex]) => (
              <span
                key={color}
                title={color}
                className="h-3 w-3 border border-steel/50"
                style={{ backgroundColor: hex ?? '#0A0C12' }}
              />
            ))}
        </div>
      </div>
    </Link>
  );
}
