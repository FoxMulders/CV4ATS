import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'

import type { TailoredResume } from '@/lib/ai/schemas'

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    border: {
      bottom: { color: '000000', space: 1, style: 'single', size: 6 },
    },
  })
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 60 },
  })
}

function contactLine(resume: TailoredResume): Paragraph {
  const parts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
  ].filter(Boolean)

  return new Paragraph({
    children: [
      new TextRun({ text: resume.contact.name, bold: true, size: 32 }),
      ...(parts.length
        ? [
            new TextRun({ text: '\n' + parts.join(' | '), size: 22 }),
          ]
        : []),
    ],
    spacing: { after: 200 },
  })
}

export async function buildResumeDocx(resume: TailoredResume): Promise<Buffer> {
  const children: Paragraph[] = [contactLine(resume)]

  children.push(sectionHeading('PROFESSIONAL SUMMARY'))
  children.push(new Paragraph({ text: resume.summary, spacing: { after: 120 } }))

  children.push(sectionHeading('SKILLS'))
  children.push(
    new Paragraph({ text: resume.skills.join(' • '), spacing: { after: 120 } })
  )

  children.push(sectionHeading('WORK EXPERIENCE'))
  for (const job of resume.experience) {
    const locationPart = job.location ? ` | ${job.location}` : ''
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: job.title, bold: true }),
          new TextRun({ text: ` — ${job.company}${locationPart}` }),
        ],
        spacing: { before: 120, after: 40 },
      })
    )
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${job.startDate} – ${job.endDate}`, italics: true })],
        spacing: { after: 60 },
      })
    )
    for (const bullet of job.bullets) {
      children.push(bulletParagraph(bullet))
    }
  }

  if (resume.projects?.length) {
    children.push(sectionHeading('PERSONAL AI PROJECTS'))
    for (const job of resume.projects) {
      const locationPart = job.location ? ` | ${job.location}` : ''
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: job.title, bold: true }),
            new TextRun({ text: ` — ${job.company}${locationPart}` }),
          ],
          spacing: { before: 120, after: 40 },
        })
      )
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${job.startDate} – ${job.endDate}`, italics: true })],
          spacing: { after: 60 },
        })
      )
      for (const bullet of job.bullets) {
        children.push(bulletParagraph(bullet))
      }
    }
  }

  children.push(sectionHeading('EDUCATION'))
  for (const edu of resume.education) {
    const datePart = edu.graduationDate ? ` — ${edu.graduationDate}` : ''
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: edu.degree, bold: true }),
          new TextRun({ text: `, ${edu.school}${datePart}` }),
        ],
        spacing: { after: edu.details ? 40 : 80 },
      })
    )
    if (edu.details) {
      children.push(new Paragraph({ text: edu.details, spacing: { after: 80 } }))
    }
  }

  if (resume.certifications?.length) {
    children.push(sectionHeading('CERTIFICATIONS'))
    for (const cert of resume.certifications) {
      children.push(new Paragraph({ text: cert, spacing: { after: 60 } }))
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  })

  return Buffer.from(await Packer.toBuffer(doc))
}

export async function buildCoverLetterDocx(coverLetter: string): Promise<Buffer> {
  const paragraphs = coverLetter.split(/\n\n+/).map(
    (block) =>
      new Paragraph({
        text: block.trim(),
        alignment: AlignmentType.LEFT,
        spacing: { after: 200 },
      })
  )

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: paragraphs,
      },
    ],
  })

  return Buffer.from(await Packer.toBuffer(doc))
}
