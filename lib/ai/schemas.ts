import { z } from 'zod'

export const MAX_JOB_DESCRIPTION_LENGTH = 8000
export const MAX_RESUME_TEXT_LENGTH = 20000
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

export const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().optional(),
})

export const experienceSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1),
})

export const educationSchema = z.object({
  degree: z.string().min(1),
  school: z.string().min(1),
  graduationDate: z.string().optional(),
  details: z.string().optional(),
})

export const tailoredResumeSchema = z.object({
  contact: contactSchema,
  summary: z.string().min(1),
  skills: z.array(z.string().min(1)).min(1),
  experience: z.array(experienceSchema).min(1),
  education: z.array(educationSchema).min(1),
  certifications: z.array(z.string()).optional(),
})

export const keywordReportSchema = z.object({
  matchScore: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  suggestions: z.array(z.string()),
})

export const generationResultSchema = z.object({
  keywordReport: keywordReportSchema,
  tailoredResume: tailoredResumeSchema,
  coverLetter: z.string().min(1),
})

export type Contact = z.infer<typeof contactSchema>
export type Experience = z.infer<typeof experienceSchema>
export type Education = z.infer<typeof educationSchema>
export type TailoredResume = z.infer<typeof tailoredResumeSchema>
export type KeywordReport = z.infer<typeof keywordReportSchema>
export type GenerationResult = z.infer<typeof generationResultSchema>
