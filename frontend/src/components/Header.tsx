import Link from 'next/link';

/**
 * Шапка: вордмарк V1 «этикетка» (строчный, моноширинный, риска под ним) —
 * по бренд-буку V1 живёт именно в шапке сайта.
 */
export function Header() {
  return (
    <header className="border-b border-cobalt/40 bg-void/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="flex flex-col leading-none group">
          <span className="font-mono text-lg tracking-widest2 text-lavender group-hover:text-neon transition-colors">
            outpills
          </span>
          <span className="block h-px w-full bg-cobalt mt-1" aria-hidden />
        </Link>

        <nav className="flex items-center gap-6 font-mono text-xs uppercase tracking-widest2">
          <Link href="/catalog" className="text-steel hover:text-neon transition-colors">
            Каталог
          </Link>
          <Link href="/orders/track" className="text-steel hover:text-neon transition-colors hidden sm:block">
            Заказ
          </Link>
          <Link href="/cart" className="text-peri hover:text-neon transition-colors">
            Корзина
          </Link>
        </nav>
      </div>
    </header>
  );
}
