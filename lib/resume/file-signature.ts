export const MIN_TEXT_LENGTH = 50

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt'] as const
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number]

export function getExtension(filename: string): SupportedExtension | null {
  const lower = filename.toLowerCase()
  const ext = SUPPORTED_EXTENSIONS.find((candidate) => lower.endsWith(candidate))
  return ext ?? null
}

function isPdf(buffer: Uint8Array): boolean {
  return buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
}

function isZip(buffer: Uint8Array): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04
}

function isPlainText(buffer: Uint8Array): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192))
  for (const byte of sample) {
    if (byte === 0) return false
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample)
    return true
  } catch {
    return false
  }
}

export function detectFileSignature(buffer: Uint8Array): SupportedExtension | null {
  if (isPdf(buffer)) return '.pdf'
  if (isZip(buffer)) return '.docx'
  if (isPlainText(buffer)) return '.txt'
  return null
}

export function validateFileSignature(buffer: Uint8Array, extension: SupportedExtension): void {
  const detected = detectFileSignature(buffer)

  if (extension === '.txt') {
    if (!isPlainText(buffer)) {
      throw new Error('File content is not valid plain text.')
    }
    if (detected === '.pdf' || detected === '.docx') {
      throw new Error('File content does not match a TXT file.')
    }
    return
  }

  if (extension === '.pdf') {
    if (!isPdf(buffer)) {
      throw new Error('File content does not match a PDF.')
    }
    return
  }

  if (extension === '.docx') {
    if (!isZip(buffer)) {
      throw new Error('File content does not match a DOCX document.')
    }
  }
}

export function isSupportedResumeFile(filename: string): boolean {
  return getExtension(filename) !== null
}

export function validateResumeFileBytes(buffer: Uint8Array, filename: string): SupportedExtension {
  const extension = getExtension(filename)
  if (!extension) {
    throw new Error('Unsupported file type. Upload a PDF, DOCX, or TXT file.')
  }

  try {
    validateFileSignature(buffer, extension)
  } catch {
    throw new Error(
      'File content does not match its extension. Upload a genuine PDF, DOCX, or TXT file.'
    )
  }

  const detected = detectFileSignature(buffer)
  if (detected && detected !== extension && extension !== '.txt') {
    throw new Error(
      'File content does not match its extension. Upload a genuine PDF, DOCX, or TXT file.'
    )
  }

  return extension
}
