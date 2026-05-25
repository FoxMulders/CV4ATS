import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'

import {
  getExtension,
  MIN_TEXT_LENGTH,
  validateResumeFileBytes,
} from '@/lib/resume/file-signature'
import { ResumeParseError } from '@/lib/resume/parse-errors'

export { ResumeParseError } from '@/lib/resume/parse-errors'
export {
  detectFileSignature,
  getExtension,
  isSupportedResumeFile,
  validateFileSignature,
  validateResumeFileBytes,
} from '@/lib/resume/file-signature'
export type { SupportedExtension } from '@/lib/resume/file-signature'

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\s+\n/g, '\n').trim()
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  return normalizeText(text)
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return normalizeText(result.value)
}

function parseTxt(buffer: Buffer): string {
  return normalizeText(buffer.toString('utf-8'))
}

export async function parseResumeFile(
  file: File | { name: string; buffer: Buffer }
): Promise<string> {
  const filename = file.name
  const buffer =
    'buffer' in file ? file.buffer : Buffer.from(await (file as File).arrayBuffer())

  try {
    await validateResumeFileBytes(buffer, filename)
  } catch (error) {
    throw new ResumeParseError(
      error instanceof Error ? error.message : 'Invalid resume file.'
    )
  }

  const extension = getExtension(filename)!

  let text: string

  switch (extension) {
    case '.pdf':
      text = await parsePdf(buffer)
      break
    case '.docx':
      text = await parseDocx(buffer)
      break
    case '.txt':
      text = parseTxt(buffer)
      break
  }

  if (text.length < MIN_TEXT_LENGTH) {
    throw new ResumeParseError(
      'Could not extract enough text from this file. Upload a text-based PDF or paste your resume instead.'
    )
  }

  return text
}
