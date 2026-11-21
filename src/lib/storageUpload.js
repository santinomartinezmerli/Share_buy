import { supabase } from './supabase'

const MB = 1024 * 1024

// Size limit and image types of each bucket. They are the same values the buckets are configured
// with (supabase/migrations/010_storage_policies.sql); here they let us explain the problem BEFORE
// uploading. The server stays the one that really enforces them.
export const UPLOAD_LIMITS = { avatars: 2 * MB, posts: 5 * MB, chat: 5 * MB }
export const ALLOWED_IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/gif']

const TYPE_EXTENSION = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' }
const GENERIC_MESSAGE = 'No pudimos subir la foto. Revisá tu conexión e intentá de nuevo.'

// An upload that failed. `message` is written for the person using the app, in Spanish, and is
// safe to show as it is. `cause` is the original error.
export class UploadError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'UploadError'
    this.cause = cause
  }
}

const formatMb = (bytes) => (bytes / MB).toFixed(1).replace('.0', '').replace('.', ',')

const tooBigMessage = (bucket, file) =>
  `"${file.name}" pesa ${formatMb(file.size)} MB y el máximo es ${formatMb(UPLOAD_LIMITS[bucket])} MB. ` +
  'Probá con una foto más liviana.'

const wrongTypeMessage = (file) =>
  `"${file.name}" no es una imagen compatible. Usá una foto JPG, PNG, WebP o GIF.`

// The problem a file has for this bucket, as a message, or null if it can be uploaded.
export function checkImage(bucket, file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return wrongTypeMessage(file)
  if (file.size > UPLOAD_LIMITS[bucket]) return tooBigMessage(bucket, file)
  return null
}

// Every file goes into a folder named with the user's id: <uid>/<time>-<random>.<ext>. The storage
// policy requires it, which is what stops anyone from writing into somebody else's folder.
export function storagePath(userId, file) {
  const fromName = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const ext = TYPE_EXTENSION[file.type] ?? (fromName || 'jpg')
  return `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
}

// Turn what Storage answered into a message for the user: too big (413), not an allowed type
// (415), not allowed to write there (403) or anything else (network, server).
export function describeUploadError(error, bucket, file) {
  const status = Number(error?.status ?? error?.statusCode)
  const text = String(error?.message ?? '').toLowerCase()
  if (status === 413 || /maximum allowed size|exceeded|too large|payload/.test(text)) {
    return tooBigMessage(bucket, file)
  }
  if (status === 415 || /mime type|not supported|invalid_mime/.test(text)) {
    return wrongTypeMessage(file)
  }
  if (status === 403 || /row-level security|unauthorized/.test(text)) {
    return 'No tenés permiso para subir esta foto. Cerrá sesión, volvé a entrar e intentá de nuevo.'
  }
  return GENERIC_MESSAGE
}

// Upload one image to a bucket, into the user's own folder, and return its public URL. It never
// replaces a file (every name is new). Throws an UploadError with a message ready to show: the
// file is checked first (type and size), so most problems are explained without a request.
export async function uploadImage(bucket, userId, file) {
  if (!userId) throw new UploadError('Tenés que iniciar sesión para subir fotos.')
  const problem = checkImage(bucket, file)
  if (problem) throw new UploadError(problem)

  const path = storagePath(userId, file)
  const { error } = await supabase.storage.from(bucket).upload(path, file)
  if (error) {
    console.error('Upload failed:', error)
    throw new UploadError(describeUploadError(error, bucket, file), error)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, path }
}
