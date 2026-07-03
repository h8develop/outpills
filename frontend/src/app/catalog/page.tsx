import Link from 'next/link';
import { api } from '@/lib/api';
import { Category, Paginated, Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';

export const dynamic = 'force-dynamic';

interface SearchParams {
  category?: string;
  gender?: string;
  size?: string;
  sort?: string;
  q?: string;
  page?: string;
  inStock?: string;
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const SORTS = [
  { value: 'new', label: 'Новые' },
  { value: 'price_asc', label: 'Дешевле' },
  { value: 'price_desc', label: 'Дороже' },
];

function buildQuery(params: SearchParams, overrides: Partial<SearchParams>): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const qs = buildQuery(searchParams, {});
  let data: Paginated<Product> = { items: [], total: 0, page: 1, limit: 24, totalPages: 1 };
  let categories: Category[] = [];
  try {
    [data, categories] = await Promise.all([
      api<Paginated<Product>>(`/products${qs}${qs ? '&' : '?'}limit=24`),
      api<Category[]>('/categories'),
    ]);
  } catch {
    /* API недоступен — показываем пустой каталог */
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Хлебные крошки */}
      <nav className="font-mono text-xs text-steel uppercase tracking-widest2 mb-6">
        <Link href="/" className="hover:text-neon">
          outpills
        </Link>
        <span className="mx-2 text-cobalt">|</span>
        <span className="text-peri">Каталог</span>
        {searchParams.category && (
          <>
            <span className="mx-2 text-cobalt">|</span>
            <span className="text-peri">
              {categories.find((c) => c.slug === searchParams.category)?.name}
            </span>
          </>
        )}
      </nav>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Фильтры — «бланк назначения» */}
        <aside className="lg:w-56 shrink-0 space-y-8">
          <div>
            <p className="label-rx">Раздел</p>
            <ul className="space-y-1">
              <li>
                <Link
                  href={`/catalog${buildQuery(searchParams, { category: undefined, page: undefined })}`}
                  className={`font-mono text-sm ${!searchParams.category ? 'text-neon' : 'text-steel hover:text-neon'}`}
                >
                  Все
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/catalog${buildQuery(searchParams, { category: c.slug, page: undefined })}`}
                    className={`font-mono text-sm ${searchParams.category === c.slug ? 'text-neon' : 'text-steel hover:text-neon'}`}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-rx">Размер</p>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((s) => (
                <Link
                  key={s}
                  href={`/catalog${buildQuery(searchParams, { size: searchParams.size === s ? undefined : s, page: undefined })}`}
                  className={`spec-box px-3 py-1 font-mono text-xs ${
                    searchParams.size === s ? 'border-electric text-neon' : 'text-steel hover:text-neon'
                  }`}
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="label-rx">Наличие</p>
            <Link
              href={`/catalog${buildQuery(searchParams, { inStock: searchParams.inStock ? undefined : '1', page: undefined })}`}
              className={`font-mono text-sm ${searchParams.inStock ? 'text-neon' : 'text-steel hover:text-neon'}`}
            >
              {searchParams.inStock ? '✚ только в наличии' : 'только в наличии'}
            </Link>
          </div>

          <div>
            <p className="label-rx">Сортировка</p>
            <ul className="space-y-1">
              {SORTS.map((s) => (
                <li key={s.value}>
                  <Link
                    href={`/catalog${buildQuery(searchParams, { sort: s.value, page: undefined })}`}
                    className={`font-mono text-sm ${
                      (searchParams.sort ?? 'new') === s.value ? 'text-neon' : 'text-steel hover:text-neon'
                    }`}
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Сетка товаров */}
        <div className="flex-1">
          <p className="font-mono text-xs text-steel mb-4 uppercase tracking-widest2">
            Найдено средств: {data.total}
          </p>
          {data.items.length === 0 ? (
            <p className="font-mono text-sm text-steel py-20 text-center">
              По заданному рецепту ничего не найдено.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {data.items.map((p, i) => (
                <ProductCard key={p.id} product={p} index={(data.page - 1) * data.limit + i} />
              ))}
            </div>
          )}

          {/* Пагинация */}
          {data.totalPages > 1 && (
            <div className="flex gap-2 mt-10 justify-center font-mono text-sm">
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/catalog${buildQuery(searchParams, { page: String(p) })}`}
                  className={`spec-box px-3 py-1 ${
                    p === data.page ? 'border-electric text-neon' : 'text-steel hover:text-neon'
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
