'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

/**
 * Каркас админки: проверяет роль ADMIN через /auth/me (JWT в httpOnly-cookie).
 * Без прав — редирект на /admin/login.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const isLogin = pathname === '/admin/login';

  useEffect(() => {
    if (isLogin) {
      setChecked(true);
      return;
    }
    api<{ role: string }>('/auth/me')
      .then((me) => {
        if (me.role !== 'ADMIN') router.replace('/admin/login');
        else setChecked(true);
      })
      .catch(() => router.replace('/admin/login'));
  }, [isLogin, pathname, router]);

  if (!checked) {
    return <div className="p-10 font-mono text-sm text-steel">Проверка допуска…</div>;
  }

  if (isLogin) return <>{children}</>;

  const nav = [
    { href: '/admin/products', label: 'Товары' },
    { href: '/admin/orders', label: 'Заказы' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between mb-8 border-b border-cobalt/40 pb-4">
        <p className="font-mono text-sm tracking-widest2 text-lavender">
          outpills <span className="text-cobalt">|</span>{' '}
          <span className="text-steel uppercase text-xs">панель управления</span>
        </p>
        <nav className="flex gap-5 font-mono text-xs uppercase tracking-widest2">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={pathname.startsWith(n.href) ? 'text-neon' : 'text-steel hover:text-neon'}
            >
              {n.label}
            </Link>
          ))}
          <button
            type="button"
            className="text-steel hover:text-red-300"
            onClick={async () => {
              await api('/auth/logout', { method: 'POST' });
              router.replace('/admin/login');
            }}
          >
            Выход
          </button>
        </nav>
      </div>
      {children}
    </div>
  );
}
