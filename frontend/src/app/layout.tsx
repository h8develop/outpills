import type { Metadata } from 'next';
import { Archivo, Saira_Condensed, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

// Шрифтовая система бренд-бука (4.3): Archivo — наборный,
// Saira Condensed — «вывеска», IBM Plex Mono — инструкции и номера.
const archivo = Archivo({ subsets: ['latin', 'latin-ext'], variable: '--font-archivo' });
const saira = Saira_Condensed({
  weight: ['600', '700'],
  subsets: ['latin'],
  variable: '--font-saira',
});
const plexMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin', 'cyrillic'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: 'outpills — снаружи передоз, внутри ясность',
  description:
    'Y2K-бренд одежды: аптека будущего, которой не существует. Каждая вещь — препарат: доза, партия, показания, побочный эффект.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${archivo.variable} ${saira.variable} ${plexMono.variable}`}>
      <body className="min-h-screen flex flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
