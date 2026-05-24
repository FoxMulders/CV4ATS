import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'

const MIN_TEXT_LENGTH = 50

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt'] as const
type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number]

export class ResumeParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResumeParseError'
  }
}

function getExtension(filename: string): SupportedExtension | null {
  const lower = filename.toLowerCase()
  const ext = SUPPORTED_EXTENSIONS.find((candidate) => lower.endsWith(candidate))
  return ext ?? null
}

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
  const extension = getExtension(filename)

  if (!extension) {
    throw new ResumeParseError('Unsupported file type. Upload a PDF, DOCX, or TXT file.')
  }

  const buffer =
    'buffer' in file
      ? file.buffer
      : Buffer.from(await (file as File).arrayBuffer())

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

export function isSupportedResumeFile(filename: string): boolean {
  return getExtension(filename) !== null
}
