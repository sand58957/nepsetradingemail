import type { MediaItem } from '@/types/email'

/**
 * Image file extensions — used as fallback when content_type is unreliable.
 * Listmonk often returns "application/octet-stream" for all uploads.
 */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico']

/**
 * Determines whether a MediaItem is an image.
 *
 * Checks (in order of reliability):
 *  1. content_type starts with "image/" (if Listmonk reports it correctly)
 *  2. thumb_url is present (Listmonk generates thumbnails for images)
 *  3. meta has width/height (Listmonk extracts dimensions for images)
 *  4. filename extension matches a known image format
 */
export function isImageFile(media: MediaItem): boolean {
  // 1. Explicit image content type
  if (media.content_type && media.content_type.startsWith('image/')) {
    return true
  }

  // 2. Has a thumbnail → Listmonk only generates thumbs for images
  if (media.thumb_url) {
    return true
  }

  // 3. Has image meta dimensions
  if (media.meta && (media.meta.width || media.meta.height)) {
    return true
  }

  // 4. Filename extension
  const filename = media.filename?.toLowerCase() || ''

  return IMAGE_EXTENSIONS.some(ext => filename.endsWith(ext))
}
