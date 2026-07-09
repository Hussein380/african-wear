'use client'

import { useState, useRef, useCallback } from 'react'

interface UploadedImage {
  url: string
  publicId: string
}

interface ImageUploaderProps {
  images: UploadedImage[]
  onImagesChange: (images: UploadedImage[]) => void
  multiple?: boolean
  folder?: string
}

export default function ImageUploader({ images, onImagesChange, multiple = false, folder = 'mandera/general' }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const uploadToCloudinary = useCallback(async (file: File): Promise<UploadedImage | null> => {
    try {
      // Get signed params from our API
      const signRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      })
      const signData = await signRes.json()

      // Upload directly to Cloudinary
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', signData.apiKey)
      formData.append('timestamp', signData.timestamp.toString())
      formData.append('signature', signData.signature)
      formData.append('folder', signData.folder)

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
        { method: 'POST', body: formData }
      )

      const uploadData = await uploadRes.json()

      if (uploadData.secure_url) {
        return {
          url: uploadData.secure_url,
          publicId: uploadData.public_id,
        }
      }
      return null
    } catch (error) {
      console.error('Upload failed:', error)
      return null
    }
  }, [folder])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)

    const fileArray = Array.from(files)
    const totalFiles = fileArray.length
    const newImages: UploadedImage[] = []

    for (let i = 0; i < fileArray.length; i++) {
      const result = await uploadToCloudinary(fileArray[i])
      if (result) {
        newImages.push(result)
      }
      setUploadProgress(Math.round(((i + 1) / totalFiles) * 100))
    }

    if (multiple) {
      onImagesChange([...images, ...newImages])
    } else {
      onImagesChange(newImages.slice(0, 1))
    }

    setIsUploading(false)
    setUploadProgress(0)
  }, [images, multiple, onImagesChange, uploadToCloudinary])

  const removeImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    onImagesChange(newImages)
  }, [images, onImagesChange])

  return (
    <div>
      <div className="image-uploader" onClick={() => fileInputRef.current?.click()}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <div className="image-uploader__icon">📷</div>
        <p className="image-uploader__text">
          <strong>Click to upload</strong> from gallery
        </p>
        <p className="image-uploader__text" style={{ marginTop: '4px', fontSize: '12px' }}>
          or
        </p>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          style={{ marginTop: '8px' }}
          onClick={(e) => {
            e.stopPropagation()
            cameraInputRef.current?.click()
          }}
        >
          📸 Take Photo
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
      </div>

      {isUploading && (
        <div className="upload-progress">
          <div className="upload-progress__bar" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      {images.length > 0 && (
        <div className="image-uploader__preview-grid">
          {images.map((img, index) => (
            <div key={img.publicId || index} className="image-uploader__preview-item">
              <img src={img.url} alt={`Upload ${index + 1}`} />
              <button
                type="button"
                className="image-uploader__preview-remove"
                onClick={() => removeImage(index)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
