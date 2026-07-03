import Link from 'next/link';
import { api } from '@/lib/api';
import { Paginated, Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';

export const revalidate = 60;

async function getFeatured(): Promise<Product[]> {
  try {
    const data = await api<Paginated<Product>>('/products?limit=8&sort=new');
    return data.items;
  } catch {
    return []; // API ещё поднимается — витрина не падает
  }
}

export default async function HomePage() {
  const products = await getFeatured();

  return (
    <div>
      {/* Hero: чёрный фон + CRT-скан (бренд-бук 4.7) */}
      <section className="crt-scan border-b border-cobalt/40 bg-void">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:py-36">
          <p className="font-mono text-xs text-steel uppercase tracking-widest2 mb-6">
            薬局 · RX 24/7 · ПАРТИЯ PROTOCOL 01
          </p>
          <h1 className="font-condensed uppercase leading-[0.95] text-6xl sm:text-8xl text-lavender">
            Снаружи <span className="text-electric">передоз</span>.
            <br />
            Внутри — ясность.
          </h1>
          <p className="mt-8 max-w-xl text-steel">
            Аптека будущего, которой не существует. Каждая вещь — препарат: у неё есть доза,
            партия, показания и побочный эффект.
          </p>
          <div className="mt-10 flex gap-4">
            <Link href="/catalog" className="btn-dose">
              Получить дозу
            </Link>
            <Link href="/orders/track" className="btn-ghost">
              Мой заказ
            </Link>
          </div>
        </div>
      </section>

      {/* Витрина */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-mono text-sm uppercase tracking-widest2 text-peri">
            Свежая партия
          </h2>
          <Link
            href="/catalog"
            className="font-mono text-xs uppercase tracking-widest2 text-steel hover:text-neon"
          >
            Весь каталог →
          </Link>
        </div>

        {products.length === 0 ? (
          <p className="font-mono text-sm text-steel">
            Партия в пути. API недоступен или каталог пуст — запусти seed: npm run prisma:seed
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
