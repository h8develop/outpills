import { CookieOptions } from 'express';

/**
 * Production cookie: Secure + HttpOnly + SameSite.
 * COOKIE_DOMAIN (например ".outpills.com") позволяет делить cookie
 * между поддоменами (site + api + admin).
 */
export function authCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'lax' : 'lax',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}
