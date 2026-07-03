'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

/**
 * Карточка создания/редактирования товара.
 * Блоки: основная информация, цена, варианты (размер × цвет × остаток),
 * изображения, SEO, габариты/состав, действия.
 * Остатки существующих вариантов меняются ТОЛЬКО через adjust-stock
 * (журнал движений склада) — прямое редактирование числа отключено.
 */

interface VariantRow {
  id?: string;
  sku: string;
  color: string;
  colorHex: string;
  size: string;
  barcode: string;
  stockQuantity: number;
  reservedQuantity?: number;
  status: string;
}

interface ImageRow {
  id?: string;
  objectKey: string;
  url?: string;
  alt: string;
  isPrimary: boolean;
}

const GENDERS = [
  { value: 'UNISEX', label: 'Унисекс' },
  { value: 'MALE', label: 'Мужское' },
  { value: 'FEMALE', label: 'Женское' },
  { value: 'KIDS', label: 'Детское' },
];

const emptyVariant = (): VariantRow => ({
  sku: '',
  color: 'чёрный-винил',
  colorHex: '#0A0C12',
  size: 'M',
  barcode: '',
  stockQuantity: 0,
  status: 'ACTIVE',
});

function translitSlug(name: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
    щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return name
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const isNew = !productId;

  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    categoryId: '',
    brand: 'outpills',
    gender: 'UNISEX',
    collection: 'PROTOCOL 01',
    shortDescription: '',
    description: '',
    status: 'DRAFT',
    basePrice: '',
    salePrice: '',
    saleStartsAt: '',
    saleEndsAt: '',
    seoTitle: '',
    seoDescription: '',
    weightGrams: '',
    material: '',
    careNotes: '',
    countryOfOrigin: '',
  });
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()]);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api<any[]>('/categories').then(setCategories).catch(() => undefined);
    if (productId) {
      api<any>(`/admin/products/${productId}`).then((p) => {
        setForm({
          name: p.name,
          slug: p.slug,
          categoryId: p.categoryId,
          brand: p.brand ?? 'outpills',
          gender: p.gender ?? 'UNISEX',
          collection: p.collection ?? '',
          shortDescription: p.shortDescription ?? '',
          description: p.description ?? '',
          status: p.status,
          basePrice: String(p.basePrice / 100),
          salePrice: p.salePrice != null ? String(p.salePrice / 100) : '',
          saleStartsAt: p.saleStartsAt ? p.saleStartsAt.slice(0, 10) : '',
          saleEndsAt: p.saleEndsAt ? p.saleEndsAt.slice(0, 10) : '',
          seoTitle: p.seoTitle ?? '',
          seoDescription: p.seoDescription ?? '',
          weightGrams: p.weightGrams != null ? String(p.weightGrams) : '',
          material: p.material ?? '',
          careNotes: p.careNotes ?? '',
          countryOfOrigin: p.countryOfOrigin ?? '',
        });
        setVariants(
          p.variants.map((v: any) => ({
            id: v.id,
            sku: v.sku,
            color: v.color,
            colorHex: v.colorHex ?? '#0A0C12',
            size: v.size,
            barcode: v.barcode ?? '',
            stockQuantity: v.stockQuantity,
            reservedQuantity: v.reservedQuantity,
            status: v.status,
          })),
        );
        setImages(
          p.images.map((img: any) => ({
            id: img.id,
            objectKey: img.objectKey,
            alt: img.alt ?? '',
            isPrimary: img.isPrimary,
          })),
        );
      });
    }
  }, [productId]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Загрузка изображений: presigned URL → PUT напрямую в object storage */
  async function uploadFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    for (const file of Array.from(files)) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      try {
        const { objectKey, uploadUrl } = await api<{ objectKey: string; uploadUrl: string | null }>(
          '/admin/uploads/presign',
          { method: 'POST', body: JSON.stringify({ contentType: file.type, ext }) },
        );
        if (uploadUrl) {
          const res = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
          });
          if (!res.ok) throw new Error('upload failed');
        }
        setImages((imgs) => [
          ...imgs,
          { objectKey, alt: form.name, isPrimary: imgs.length === 0 },
        ]);
      } catch {
        setError(`Не удалось загрузить ${file.name} — проверь, что MinIO/S3 запущен`);
      }
    }
  }

  async function save(status?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || translitSlug(form.name),
        categoryId: form.categoryId,
        brand: form.brand || undefined,
        gender: form.gender,
        collection: form.collection || undefined,
        shortDescription: form.shortDescription || undefined,
        description: form.description || undefined,
        status: status ?? form.status,
        basePrice: Math.round(Number(form.basePrice) * 100),
        salePrice: form.salePrice ? Math.round(Number(form.salePrice) * 100) : undefined,
        saleStartsAt: form.saleStartsAt ? new Date(form.saleStartsAt).toISOString() : undefined,
        saleEndsAt: form.saleEndsAt ? new Date(form.saleEndsAt).toISOString() : undefined,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        weightGrams: form.weightGrams ? Number(form.weightGrams) : undefined,
        material: form.material || undefined,
        careNotes: form.careNotes || undefined,
        countryOfOrigin: form.countryOfOrigin || undefined,
        variants: variants
          .filter((v) => v.sku)
          .map((v) => ({
            id: v.id,
            sku: v.sku,
            color: v.color,
            colorHex: v.colorHex || undefined,
            size: v.size,
            barcode: v.barcode || undefined,
            stockQuantity: v.stockQuantity,
            status: v.status,
          })),
        images: images.map((img, i) => ({
          id: img.id,
          objectKey: img.objectKey,
          alt: img.alt || undefined,
          isPrimary: img.isPrimary,
          sortOrder: i,
        })),
      };

      const saved = isNew
        ? await api<any>('/admin/products', { method: 'POST', body: JSON.stringify(payload) })
        : await api<any>(`/admin/products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });

      setNotice(status === 'PUBLISHED' ? 'Опубликовано' : 'Сохранено');
      if (isNew) router.replace(`/admin/products/${saved.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
    } finally {
      setBusy(false);
    }
  }

  async function adjustStock(variant: VariantRow, delta: number) {
    if (!variant.id) return;
    const updated = await api<any>(`/admin/variants/${variant.id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify({ delta, comment: 'Корректировка из формы товара' }),
    });
    setVariants((vs) =>
      vs.map((v) =>
        v.id === variant.id
          ? { ...v, stockQuantity: updated.stockQuantity, reservedQuantity: updated.reservedQuantity }
          : v,
      ),
    );
  }

  async function deleteProduct() {
    if (!productId || !confirm('Удалить товар? Товар с продажами будет заархивирован.')) return;
    await api(`/admin/products/${productId}`, { method: 'DELETE' });
    router.replace('/admin/products');
  }

  return (
    <div className="space-y-10 max-w-4xl">
      {/* ── Действия ── */}
      <div className="flex flex-wrap gap-3 items-center sticky top-16 bg-ink/95 py-3 z-10 border-b border-cobalt/40">
        <h1 className="font-condensed uppercase text-2xl text-lavender mr-auto">
          {isNew ? 'Новый товар' : form.name || 'Товар'}
        </h1>
        <button type="button" className="btn-ghost !px-4 !py-2" disabled={busy} onClick={() => save('DRAFT')}>
          Черновик
        </button>
        <button type="button" className="btn-dose !px-4 !py-2" disabled={busy} onClick={() => save('PUBLISHED')}>
          Опубликовать
        </button>
        {!isNew && (
          <>
            <button type="button" className="btn-ghost !px-4 !py-2" disabled={busy} onClick={() => save('HIDDEN')}>
              Скрыть
            </button>
            <a href={`/product/${form.slug}`} target="_blank" className="btn-ghost !px-4 !py-2">
              Предпросмотр
            </a>
            <button
              type="button"
              className="font-mono text-xs text-steel hover:text-red-300 uppercase"
              onClick={deleteProduct}
            >
              Удалить
            </button>
          </>
        )}
      </div>

      {error && <p className="font-mono text-xs text-red-300">{error}</p>}
      {notice && <p className="font-mono text-xs text-ice">{notice}</p>}

      {/* ── Основная информация ── */}
      <section className="spec-box p-5 space-y-4">
        <p className="font-mono text-xs uppercase tracking-widest2 text-cobalt">01 · Основная информация</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label-rx">Название *</label>
            <input className="input-rx" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label-rx">
              Slug{' '}
              <button
                type="button"
                className="text-electric lowercase"
                onClick={() => set('slug', translitSlug(form.name))}
              >
                ← из названия
              </button>
            </label>
            <input className="input-rx" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
          </div>
          <div>
            <label className="label-rx">Категория *</label>
            <select
              className="input-rx"
              value={form.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
            >
              <option value="">— выбрать —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-rx">Бренд</label>
            <input className="input-rx" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
          </div>
          <div>
            <label className="label-rx">Пол</label>
            <select className="input-rx" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-rx">Коллекция / дроп</label>
            <input className="input-rx" value={form.collection} onChange={(e) => set('collection', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label-rx">Краткое описание</label>
            <input
              className="input-rx"
              value={form.shortDescription}
              onChange={(e) => set('shortDescription', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-rx">Полное описание</label>
            <textarea
              className="input-rx min-h-32"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Цена ── */}
      <section className="spec-box p-5 space-y-4">
        <p className="font-mono text-xs uppercase tracking-widest2 text-cobalt">02 · Цена (₽)</p>
        <div className="grid sm:grid-cols-4 gap-4">
          <div>
            <label className="label-rx">Базовая *</label>
            <input
              className="input-rx"
              type="number"
              min="0"
              value={form.basePrice}
              onChange={(e) => set('basePrice', e.target.value)}
            />
          </div>
          <div>
            <label className="label-rx">Со скидкой</label>
            <input
              className="input-rx"
              type="number"
              min="0"
              value={form.salePrice}
              onChange={(e) => set('salePrice', e.target.value)}
            />
          </div>
          <div>
            <label className="label-rx">Скидка с</label>
            <input
              className="input-rx"
              type="date"
              value={form.saleStartsAt}
              onChange={(e) => set('saleStartsAt', e.target.value)}
            />
          </div>
          <div>
            <label className="label-rx">Скидка до</label>
            <input
              className="input-rx"
              type="date"
              value={form.saleEndsAt}
              onChange={(e) => set('saleEndsAt', e.target.value)}
            />
          </div>
        </div>
        <p className="font-mono text-[10px] text-steel">Валюта: RUB. Хранится в копейках, вводится в рублях.</p>
      </section>

      {/* ── Варианты ── */}
      <section className="spec-box p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-widest2 text-cobalt">
            03 · Варианты (цвет × размер × остаток)
          </p>
          <button
            type="button"
            className="font-mono text-xs text-electric hover:text-neon uppercase"
            onClick={() => setVariants((vs) => [...vs, emptyVariant()])}
          >
            + вариант
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="text-steel uppercase text-left border-b border-cobalt/40">
                <th className="p-2">SKU *</th>
                <th className="p-2">Цвет</th>
                <th className="p-2">HEX</th>
                <th className="p-2">Размер</th>
                <th className="p-2">Штрихкод</th>
                <th className="p-2">Склад</th>
                <th className="p-2">Резерв</th>
                <th className="p-2">Доступно</th>
                <th className="p-2">Статус</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => {
                const available = v.stockQuantity - (v.reservedQuantity ?? 0);
                return (
                  <tr key={v.id ?? `new-${i}`} className="border-b border-cobalt/20">
                    <td className="p-1">
                      <input
                        className="input-rx !px-2 !py-1 !w-32"
                        value={v.sku}
                        onChange={(e) =>
                          setVariants((vs) => vs.map((x, xi) => (xi === i ? { ...x, sku: e.target.value } : x)))
                        }
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="input-rx !px-2 !py-1 !w-28"
                        value={v.color}
                        onChange={(e) =>
                          setVariants((vs) => vs.map((x, xi) => (xi === i ? { ...x, color: e.target.value } : x)))
                        }
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="color"
                        className="h-8 w-10 bg-void border border-cobalt/60"
                        value={v.colorHex}
                        onChange={(e) =>
                          setVariants((vs) => vs.map((x, xi) => (xi === i ? { ...x, colorHex: e.target.value } : x)))
                        }
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="input-rx !px-2 !py-1 !w-16"
                        value={v.size}
                        onChange={(e) =>
                          setVariants((vs) => vs.map((x, xi) => (xi === i ? { ...x, size: e.target.value } : x)))
                        }
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="input-rx !px-2 !py-1 !w-28"
                        value={v.barcode}
                        onChange={(e) =>
                          setVariants((vs) => vs.map((x, xi) => (xi === i ? { ...x, barcode: e.target.value } : x)))
                        }
                      />
                    </td>
                    <td className="p-1">
                      {v.id ? (
                        <span className="inline-flex items-center gap-1">
                          <button type="button" className="text-steel hover:text-neon px-1" onClick={() => adjustStock(v, -1)}>
                            −
                          </button>
                          <span className="text-lavender w-8 text-center">{v.stockQuantity}</span>
                          <button type="button" className="text-steel hover:text-neon px-1" onClick={() => adjustStock(v, 1)}>
                            +
                          </button>
                        </span>
                      ) : (
                        <input
                          className="input-rx !px-2 !py-1 !w-16"
                          type="number"
                          min="0"
                          value={v.stockQuantity}
                          onChange={(e) =>
                            setVariants((vs) =>
                              vs.map((x, xi) => (xi === i ? { ...x, stockQuantity: Number(e.target.value) } : x)),
                            )
                          }
                        />
                      )}
                    </td>
                    <td className="p-2 text-steel">{v.reservedQuantity ?? 0}</td>
                    <td className={`p-2 ${available <= 0 ? 'text-red-300' : 'text-ice'}`}>{available}</td>
                    <td className="p-1">
                      <select
                        className="input-rx !px-2 !py-1 !w-28"
                        value={v.status}
                        onChange={(e) =>
                          setVariants((vs) => vs.map((x, xi) => (xi === i ? { ...x, status: e.target.value } : x)))
                        }
                      >
                        <option value="ACTIVE">Активен</option>
                        <option value="OUT_OF_STOCK">Закончился</option>
                        <option value="HIDDEN">Скрыт</option>
                      </select>
                    </td>
                    <td className="p-1">
                      <button
                        type="button"
                        className="text-steel hover:text-red-300 px-2"
                        onClick={() => setVariants((vs) => vs.filter((_, xi) => xi !== i))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="font-mono text-[10px] text-steel">
          Доступно = склад − резерв. Остатки сохранённых вариантов меняются кнопками ± (журналируется в движениях склада).
        </p>
      </section>

      {/* ── Изображения ── */}
      <section className="spec-box p-5 space-y-4">
        <p className="font-mono text-xs uppercase tracking-widest2 text-cobalt">04 · Изображения</p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="font-mono text-xs text-steel"
          onChange={(e) => uploadFiles(e.target.files)}
        />
        {images.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-3">
            {images.map((img, i) => (
              <li key={img.objectKey} className="spec-box p-3 flex gap-3 items-start">
                <div className="h-16 w-14 bg-void flex items-center justify-center text-cobalt shrink-0 overflow-hidden font-mono text-[9px] break-all p-1">
                  {img.objectKey.split('/').pop()}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    className="input-rx !px-2 !py-1"
                    placeholder="alt-текст для SEO"
                    value={img.alt}
                    onChange={(e) =>
                      setImages((imgs) => imgs.map((x, xi) => (xi === i ? { ...x, alt: e.target.value } : x)))
                    }
                  />
                  <div className="flex gap-3 font-mono text-[10px]">
                    <label className="flex items-center gap-1 text-steel">
                      <input
                        type="radio"
                        name="primary"
                        checked={img.isPrimary}
                        onChange={() =>
                          setImages((imgs) => imgs.map((x, xi) => ({ ...x, isPrimary: xi === i })))
                        }
                      />
                      главное
                    </label>
                    <button
                      type="button"
                      className="text-steel hover:text-neon"
                      disabled={i === 0}
                      onClick={() =>
                        setImages((imgs) => {
                          const copy = [...imgs];
                          [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
                          return copy;
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="text-steel hover:text-red-300"
                      onClick={() => setImages((imgs) => imgs.filter((_, xi) => xi !== i))}
                    >
                      удалить
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── SEO ── */}
      <section className="spec-box p-5 space-y-4">
        <p className="font-mono text-xs uppercase tracking-widest2 text-cobalt">05 · SEO</p>
        <div>
          <label className="label-rx">SEO title</label>
          <input className="input-rx" value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
        </div>
        <div>
          <label className="label-rx">SEO description</label>
          <textarea
            className="input-rx"
            value={form.seoDescription}
            onChange={(e) => set('seoDescription', e.target.value)}
          />
        </div>
        {/* Предпросмотр сниппета */}
        <div className="bg-void p-3 border border-cobalt/40">
          <p className="text-electric text-sm truncate">{form.seoTitle || form.name || 'SEO title'}</p>
          <p className="text-steel text-xs truncate">outpills.example.com › product › {form.slug || 'slug'}</p>
          <p className="text-peri-light text-xs line-clamp-2">
            {form.seoDescription || form.shortDescription || 'SEO description появится здесь'}
          </p>
        </div>
      </section>

      {/* ── Габариты и состав ── */}
      <section className="spec-box p-5 space-y-4">
        <p className="font-mono text-xs uppercase tracking-widest2 text-cobalt">06 · Доставка и состав</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label-rx">Вес, г</label>
            <input
              className="input-rx"
              type="number"
              min="0"
              value={form.weightGrams}
              onChange={(e) => set('weightGrams', e.target.value)}
            />
          </div>
          <div>
            <label className="label-rx">Страна производства</label>
            <input
              className="input-rx"
              value={form.countryOfOrigin}
              onChange={(e) => set('countryOfOrigin', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-rx">Материал / состав ткани</label>
            <input className="input-rx" value={form.material} onChange={(e) => set('material', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label-rx">Уход</label>
            <input className="input-rx" value={form.careNotes} onChange={(e) => set('careNotes', e.target.value)} />
          </div>
        </div>
      </section>
    </div>
  );
}
