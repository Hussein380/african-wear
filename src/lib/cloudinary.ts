// Cloudinary configuration helper
// We use direct REST API calls instead of the SDK to keep things simple

export const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
export const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

export function getCloudinaryUploadUrl() {
  return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
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
