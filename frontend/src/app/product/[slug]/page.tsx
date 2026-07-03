import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api, formatPrice } from '@/lib/api';
import { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { VariantPicker } from './VariantPicker';

export const dynamic = 'force-dynamic';

async function getProduct(slug: string): Promise<Product | null> {
  try {
    return await api<Product>(`/products/${slug}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return {};
  return {
    title: (product as any).seoTitle || `${product.name} — outpills`,
    description: (product as any).seoDescription || product.shortDescription || undefined,
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  let similar: Product[] = [];
  try {
    similar = await api<Product[]>(`/products/${params.slug}/similar`);
  } catch {
    /* не критично */
  }

  const primary = product.images[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Хлебные крошки */}
      <nav className="font-mono text-xs text-steel uppercase tracking-widest2 mb-8">
        <Link href="/" className="hover:text-neon">
          outpills
        </Link>
        <span className="mx-2 text-cobalt">|</span>
        <Link href="/catalog" className="hover:text-neon">
          Каталог
        </Link>
        {product.category && (
          <>
            <span className="mx-2 text-cobalt">|</span>
            <Link href={`/catalog?category=${product.category.slug}`} className="hover:text-neon">
              {product.category.name}
            </Link>
          </>
        )}
        <span className="mx-2 text-cobalt">|</span>
        <span className="text-peri">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-12">
        {/* Галерея */}
        <div className="space-y-3">
          <div className="spec-box aspect-[3/4] bg-void overflow-hidden">
            {primary ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primary.url}
                alt={primary.alt ?? product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center gap-3">
                <span className="font-mono text-cobalt text-6xl select-none">✚</span>
                <span className="font-mono text-xs text-steel uppercase tracking-widest2">
                  Фото партии в проявке
                </span>
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {product.images.slice(1).map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  src={img.url}
                  alt={img.alt ?? product.name}
                  loading="lazy"
                  className="spec-box aspect-square object-cover"
                />
              ))}
            </div>
          )}
        </div>

        {/* Этикетка препарата */}
        <div>
          <p className="font-mono text-xs text-steel uppercase tracking-widest2 mb-2">
            {product.collection ?? 'PROTOCOL 01'} · {product.brand}
          </p>
          <h1 className="font-condensed uppercase text-4xl sm:text-5xl text-lavender leading-none">
            {product.name}
          </h1>

          <div className="mt-6 flex items-center gap-4">
            <span className="font-mono text-2xl text-neon">{formatPrice(product.effectivePrice)}</span>
            {product.saleActive && (
              <>
                <span className="font-mono text-base text-steel line-through">
                  {formatPrice(product.basePrice)}
                </span>
                <span className="bg-navy text-neon font-mono text-[10px] uppercase tracking-widest2 px-2 py-1">
                  Доза снижена
                </span>
              </>
            )}
          </div>

          {product.shortDescription && (
            <p className="mt-6 text-peri-light">{product.shortDescription}</p>
          )}

          {/* Выбор цвет/размер + корзина (client component) */}
          <VariantPicker variants={product.variants} />

          {/* Состав и уход — «инструкция мелким шрифтом» */}
          <div className="mt-10 spec-box p-4 space-y-2 font-mono text-xs text-steel">
            <p className="uppercase tracking-widest2 text-cobalt">Инструкция по применению</p>
            {product.material && <p>Состав: {product.material}</p>}
            <p>Показания: постоянный передоз контентом, скоростью, чужими жизнями.</p>
            <p>Дозировка: носить ежедневно. Совместимо с другими средствами линейки.</p>
            <p>Побочные эффекты: ясность, лёгкое чувство превосходства.</p>
          </div>

          {product.description && (
            <div className="mt-6 text-sm text-peri-light leading-relaxed whitespace-pre-line">
              {product.description}
            </div>
          )}
        </div>
      </div>

      {/* Похожие */}
      {similar.length > 0 && (
        <section className="mt-20">
          <h2 className="font-mono text-sm uppercase tracking-widest2 text-peri mb-6">
            Совместимые препараты
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {similar.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
