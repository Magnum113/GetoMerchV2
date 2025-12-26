/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Отключаем Turbopack для стабильности
  experimental: {
    turbo: false,
  },
}

export default nextConfig
