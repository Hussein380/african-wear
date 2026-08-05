import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    // Cache optimized images for up to 7 days
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  async headers() {
    return [
      {
        // Cache Cloudinary images aggressively in the browser
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400',
          },
        ],
      },
    ]
  },
  turbopack: {},
}

export default withPWA(nextConfig)
