export interface ProfessionLandingConfig {
  slug: string
  title: string
  metaDescription: string
  hero: {
    eyebrow: string
    title: string
    description: string
  }
  sampleJobDescription: string
}

export const PROFESSION_LANDING_PAGES: ProfessionLandingConfig[] = [
  {
    slug: 'project-manager',
    title: 'Project Manager ATS Resume Builder',
    metaDescription:
      'Tailor your project manager resume to any job description. AI-powered ATS scanning, keyword optimization, and cover letter generation. Try free with a sample PM posting.',
    hero: {
      eyebrow: 'Project management resume tailoring',
      title: 'Tailor your project manager resume to beat the ATS',
      description:
        'Paste your resume alongside a sample project manager job description—or replace it with your target role. Get an ATS-optimized resume, cover letter, and compliance score in minutes.',
    },
    sampleJobDescription: `Job Title: Senior Project Manager — Technology Delivery

We are seeking an experienced Project Manager to lead cross-functional software delivery initiatives from discovery through release. You will partner with engineering, product, and business stakeholders to define scope, manage risk, and drive predictable outcomes in an Agile environment.

Responsibilities:
- Own end-to-end delivery for multiple concurrent technology programs
- Facilitate sprint planning, backlog refinement, and release coordination using Jira and Confluence
- Translate business objectives into actionable roadmaps with clear milestones and KPIs
- Identify bottlenecks, escalate blockers, and maintain stakeholder alignment
- Report on budget, timeline, and resource utilization to senior leadership

Requirements:
- 5+ years leading software or IT delivery projects
- Strong experience with Agile, Scrum, or Kanban methodologies
- Proficiency with Jira, Azure DevOps, or similar delivery tools
- Excellent stakeholder communication and risk management skills
- PMP or equivalent experience preferred`,
  },
  {
    slug: 'software-engineer',
    title: 'Software Engineer ATS Resume Builder',
    metaDescription:
      'Build an ATS-compliant software engineer resume tailored to any job posting. Scan keywords, optimize bullets, and generate a cover letter with context-aware AI. Start free.',
    hero: {
      eyebrow: 'Software engineering resume tailoring',
      title: 'Tailor your software engineer resume to beat the ATS',
      description:
        'Match your engineering experience to any posting with AI resume tailoring. A sample software engineer job description is pre-loaded—swap in your target role and generate instantly.',
    },
    sampleJobDescription: `Job Title: Full-Stack Software Engineer

Join our product team to design, build, and ship customer-facing web applications. You will work across the stack—from React front ends to API services and cloud infrastructure—within a collaborative Agile squad.

Responsibilities:
- Develop responsive web applications using React, TypeScript, and Next.js
- Design and implement RESTful APIs and secure data pipelines
- Write unit and integration tests; participate in code review and CI/CD workflows
- Collaborate with product and design to refine requirements and estimate sprint capacity
- Troubleshoot production issues and improve system reliability and performance

Requirements:
- 3+ years professional software development experience
- Strong proficiency in JavaScript/TypeScript, React, and modern web frameworks
- Experience with SQL databases, cloud platforms (AWS or Azure), and Git
- Familiarity with Agile delivery and test-driven development
- Bachelor's degree in Computer Science or equivalent practical experience`,
  },
  {
    slug: 'nursing',
    title: 'Nursing ATS Resume Builder',
    metaDescription:
      'Tailor your nursing resume to hospital and clinic job descriptions. ATS keyword scanning, compliant formatting, and cover letter generation. Preview free with a sample RN posting.',
    hero: {
      eyebrow: 'Nursing resume tailoring',
      title: 'Tailor your nursing resume to beat the ATS',
      description:
        'Align your clinical experience with any nursing job posting. A sample registered nurse description is ready to scan—replace it with your target role and optimize your resume for ATS filters.',
    },
    sampleJobDescription: `Job Title: Registered Nurse — Acute Care

Our acute care unit is hiring a compassionate Registered Nurse to deliver evidence-based patient care in a fast-paced hospital environment. You will collaborate with physicians, allied health professionals, and charge nurses to maintain safe, high-quality outcomes.

Responsibilities:
- Assess, plan, implement, and evaluate patient care per clinical protocols
- Administer medications and monitor vital signs, lab results, and treatment responses
- Document care accurately in the electronic health record (EHR)
- Coordinate handoffs and communicate with interdisciplinary care teams
- Support patient and family education on discharge planning and follow-up care

Requirements:
- Active RN license in good standing
- BLS certification; ACLS preferred
- 2+ years acute care or medical-surgical nursing experience
- Proficiency with Epic or similar EHR systems
- Strong clinical judgment, communication, and teamwork skills`,
  },
]

export const PROFESSION_SLUGS = PROFESSION_LANDING_PAGES.map((page) => page.slug)

export function getProfessionLanding(slug: string): ProfessionLandingConfig | undefined {
  return PROFESSION_LANDING_PAGES.find((page) => page.slug === slug)
}
