import type { Config } from 'tailwindcss';

/**
 * Дизайн-токены — из бренд-бука outpills (этап 5 «Цветовые палитры»).
 * Базовая палитра «Аптека» + акценты campaign-палитры для интерактива.
 * Правило бренда: ни одного тёплого тона.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0C12', // чёрный-винил: фон сайта
        void: '#050608', // чёрный-ноль: глубокие подложки
        lavender: '#E6E6F8', // лаванда-блик: главный «белый»
        peri: '#A7ACC8', // перивинкл: цвет бренда
        'peri-light': '#C6CBE1',
        steel: '#7A83A1', // вторичный текст
        cobalt: '#3C4F76', // акценты, рамки, «чернила печатей»
        navy: '#051655', // глубина
        electric: '#8FA3E8', // кнопки/ссылки (campaign)
        neon: '#C7D2FF', // hover — «неон аптеки ночью»
        ice: '#AFE0F5', // редкий акцент
        gloss: '#F7F8FC', // стерильный белый
      },
      fontFamily: {
        sans: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
        condensed: ['var(--font-saira)', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
      letterSpacing: {
        widest2: '0.2em',
      },
    },
  },
  plugins: [],
};

export default config;
