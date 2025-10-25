/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // Allow images without optimization for local files
  },
}

module.exports = nextConfig
