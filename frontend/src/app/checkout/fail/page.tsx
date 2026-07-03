import Link from 'next/link';

export default function CheckoutFailPage({ searchParams }: { searchParams: { order?: string } }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center space-y-6">
      <p className="font-mono text-5xl text-steel select-none">✕</p>
      <h1 className="font-condensed uppercase text-4xl text-lavender">Оплата не прошла</h1>
      <p className="font-mono text-sm text-steel">
        {searchParams.order ? (
          <>
            Платёж по заказу <span className="text-neon">{searchParams.order}</span> отклонён.
          </>
        ) : (
          'Платёж отклонён.'
        )}{' '}
        Резерв товара снят — позиции снова доступны в каталоге.
      </p>
      <p className="font-mono text-xs text-steel">
        Можно собрать корзину заново или повторить оплату из статуса заказа.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/orders/track" className="btn-ghost">
          Статус заказа
        </Link>
        <Link href="/cart" className="btn-dose">
          В корзину
        </Link>
      </div>
    </div>
  );
}
