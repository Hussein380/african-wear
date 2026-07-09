import { NextResponse } from 'next/server'
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } from '@/lib/cloudinary'

// POST /api/upload — generate signed upload params for Cloudinary
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { folder } = body

    const timestamp = Math.floor(Date.now() / 1000)
    const uploadFolder = folder || 'mandera/general'

    // Generate signature
    const crypto = await import('crypto')
    const signatureString = `folder=${uploadFolder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`
    const signature = crypto
      .createHash('sha1')
      .update(signatureString)
      .digest('hex')

    return NextResponse.json({
      signature,
      timestamp,
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      folder: uploadFolder,
    })
  } catch (error) {
    console.error('Error generating upload signature:', error)
    return NextResponse.json({ error: 'Failed to generate upload signature' }, { status: 500 })
  }
}
