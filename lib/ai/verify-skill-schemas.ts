import { z } from 'zod'

export const verifySkillResultSchema = z
  .object({
    status: z.enum(['Pass', 'Fail']),
    feedback: z.string().min(1),
    revisedBullet: z.string().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'Pass' && !value.revisedBullet?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pass responses must include a revisedBullet.',
        path: ['revisedBullet'],
      })
    }
    if (value.status === 'Fail' && value.revisedBullet?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fail responses must set revisedBullet to null.',
        path: ['revisedBullet'],
      })
    }
  })

export type VerifySkillResult = z.infer<typeof verifySkillResultSchema>

export const MAX_SKILL_EXPLANATION_LENGTH = 300
export const MAX_ORIGINAL_BULLET_LENGTH = 2000
export const MAX_SKILL_NAME_LENGTH = 120
