'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ user: { role: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.user.role !== 'ADMIN') {
        setError('У этого аккаунта нет прав администратора');
        setBusy(false);
        return;
      }
      router.replace('/admin/products');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка входа');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-24">
      <form onSubmit={submit} className="spec-box p-8 bg-void space-y-5">
        <p className="font-mono text-xs uppercase tracking-widest2 text-cobalt text-center">
          Доступ к протоколу
        </p>
        <div>
          <label className="label-rx">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-rx"
          />
        </div>
        <div>
          <label className="label-rx">Пароль</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-rx"
          />
        </div>
        {error && <p className="font-mono text-xs text-red-300">{error}</p>}
        <button type="submit" className="btn-dose w-full" disabled={busy}>
          {busy ? 'Проверяем…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
