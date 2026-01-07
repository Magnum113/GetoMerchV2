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
    // turbo: false, // Removed as it's not supported in Next.js 16
  },
}

export default nextConfig
