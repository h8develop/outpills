/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone — компактный prod-образ для Docker
  output: 'standalone',
  images: {
    // MVP: без оптимизатора Next (картинки раздаёт object storage / CDN).
    // При переходе на CDN с ресайзом — включить и настроить loader.
    unoptimized: true,
  },
};

export default nextConfig;
