import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-32 text-center space-y-6">
      <p className="font-mono text-6xl text-cobalt select-none">404</p>
      <h1 className="font-condensed uppercase text-3xl text-lavender">Препарат не найден</h1>
      <p className="font-mono text-xs text-steel">
        Такой позиции нет в реестре. Возможно, партия снята с производства.
      </p>
      <Link href="/catalog" className="btn-dose">
        В каталог
      </Link>
    </div>
  );
}
