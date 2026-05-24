import React from 'react'
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'

import type { TailoredResume } from '@/lib/ai/schemas'

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
    color: '#111111',
  },
  name: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  contact: {
    fontSize: 9,
    marginBottom: 16,
    color: '#333333',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 6,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    textTransform: 'uppercase',
  },
  paragraph: {
    marginBottom: 8,
  },
  jobHeader: {
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    marginBottom: 2,
  },
  jobMeta: {
    fontSize: 9,
    marginBottom: 4,
    color: '#333333',
  },
  bullet: {
    marginLeft: 12,
    marginBottom: 3,
  },
})

function ResumeDocument({ resume }: { resume: TailoredResume }) {
  const contactParts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
  ].filter(Boolean)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{resume.contact.name}</Text>
        {contactParts.length > 0 && (
          <Text style={styles.contact}>{contactParts.join(' | ')}</Text>
        )}

        <Text style={styles.sectionTitle}>Professional Summary</Text>
        <Text style={styles.paragraph}>{resume.summary}</Text>

        <Text style={styles.sectionTitle}>Skills</Text>
        <Text style={styles.paragraph}>{resume.skills.join(' • ')}</Text>

        <Text style={styles.sectionTitle}>Work Experience</Text>
        {resume.experience.map((job, index) => (
          <View key={`${job.company}-${index}`}>
            <Text style={styles.jobHeader}>
              {job.title} — {job.company}
              {job.location ? ` | ${job.location}` : ''}
            </Text>
            <Text style={styles.jobMeta}>
              {job.startDate} – {job.endDate}
            </Text>
            {job.bullets.map((bullet, bulletIndex) => (
              <Text key={bulletIndex} style={styles.bullet}>
                • {bullet}
              </Text>
            ))}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Education</Text>
        {resume.education.map((edu, index) => (
          <View key={`${edu.school}-${index}`}>
            <Text style={styles.jobHeader}>
              {edu.degree}, {edu.school}
              {edu.graduationDate ? ` — ${edu.graduationDate}` : ''}
            </Text>
            {edu.details ? <Text style={styles.paragraph}>{edu.details}</Text> : null}
          </View>
        ))}

        {resume.certifications?.length ? (
          <>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {resume.certifications.map((cert, index) => (
              <Text key={index} style={styles.paragraph}>
                {cert}
              </Text>
            ))}
          </>
        ) : null}
      </Page>
    </Document>
  )
}

export async function buildResumePdf(resume: TailoredResume): Promise<Buffer> {
  const instance = pdf(<ResumeDocument resume={resume} />)
  const blob = await instance.toBlob()
  const arrayBuffer = await blob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function buildCoverLetterPdf(coverLetter: string): Promise<Buffer> {
  const paragraphs = coverLetter.split(/\n\n+/).filter(Boolean)

  const doc = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {paragraphs.map((paragraph, index) => (
          <Text key={index} style={styles.paragraph}>
            {paragraph.trim()}
          </Text>
        ))}
      </Page>
    </Document>
  )

  const instance = pdf(doc)
  const blob = await instance.toBlob()
  const arrayBuffer = await blob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
