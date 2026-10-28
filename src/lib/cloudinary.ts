// Cloudinary configuration helper
// We use direct REST API calls instead of the SDK to keep things simple

export const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
export const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

export function getCloudinaryUploadUrl() {
  return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
}

/**
 * Transforms a Cloudinary URL to deliver an optimized WebP/AVIF, resized thumbnail.
 * If the URL is not from Cloudinary or is invalid, it is returned unchanged.
 */
export function getOptimizedImageUrl(
  url: string | undefined | null,
  options: {
    width?: number
    height?: number
    crop?: 'fill' | 'limit' | 'fit' | 'thumb' | 'scale'
    quality?: 'auto' | 'auto:good' | 'auto:eco' | 'auto:low' | number
    format?: 'auto' | 'webp' | 'jpg' | 'png'
  } = {}
): string {
  if (!url || typeof url !== 'string') return ''
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url
  }

  const {
    width = 320,
    height,
    crop = 'fill',
    quality = 'auto',
    format = 'auto',
  } = options

  const parts = [`f_${format}`, `q_${quality}`]
  if (width) parts.push(`w_${width}`)
  if (height) parts.push(`h_${height}`)
  if (crop) parts.push(`c_${crop}`)

  const transformString = parts.join(',')

  // Prevent double application
  if (url.includes(`/image/upload/${transformString}/`)) {
    return url
  }

  // Matches /image/upload/ followed optionally by an existing transformation segment
  // (which does not start with v\d+ and does not contain a dot)
  const regex = /\/image\/upload\/(?:(?!v\d+)[a-zA-Z0-9_,:]+\/)?/
  return url.replace(regex, `/image/upload/${transformString}/`)
}

export async function deleteCloudinaryImage(publicId: string): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Generate signature for deletion
  const crypto = await import('crypto');
  const signature = crypto
    .createHash('sha1')
    .update(`public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
    .digest('hex');

  const formData = new FormData();
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', CLOUDINARY_API_KEY);
  formData.append('signature', signature);

  await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`, {
    method: 'POST',
    body: formData,
  });
}
