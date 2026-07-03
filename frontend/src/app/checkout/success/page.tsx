import Link from 'next/link';

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center space-y-6">
      <p className="font-mono text-5xl text-electric select-none">✚</p>
      <h1 className="font-condensed uppercase text-4xl text-lavender">Оплата прошла</h1>
      {searchParams.order && (
        <p className="font-mono text-sm text-steel">
          Заказ <span className="text-neon">{searchParams.order}</span> оплачен. Партия
          зарезервирована за вами и уходит в обработку.
        </p>
      )}
      <p className="font-mono text-xs text-steel">
        Чек и статус придут на email. Побочные эффекты: ясность.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/orders/track" className="btn-ghost">
          Статус заказа
        </Link>
        <Link href="/catalog" className="btn-dose">
          В каталог
        </Link>
      </div>
    </div>
  );
}
