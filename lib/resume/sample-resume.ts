import type { TailoredResume } from '@/lib/ai/schemas'

export const sampleResume: TailoredResume = {
  contact: {
    name: 'Jane Doe',
    email: 'jane.doe@email.com',
    phone: '(555) 123-4567',
    location: 'Austin, TX',
    linkedin: '',
  },
  summary:
    'Results-driven software engineer with 5+ years building web applications using React, TypeScript, and Node.js.',
  skills: ['React', 'TypeScript', 'Node.js', 'Next.js', 'PostgreSQL', 'REST APIs'],
  experience: [
    {
      title: 'Senior Software Engineer',
      company: 'Tech Corp',
      location: 'Austin, TX',
      startDate: 'Jan 2021',
      endDate: 'Present',
      bullets: [
        'Led development of customer-facing dashboard serving 50K+ monthly users.',
        'Reduced page load times by 40% through performance optimizations.',
        'Mentored 3 junior engineers on React best practices.',
      ],
    },
    {
      title: 'Software Engineer',
      company: 'Startup Inc',
      location: '',
      startDate: 'Jun 2018',
      endDate: 'Dec 2020',
      bullets: [
        'Built REST APIs and React frontends for B2B SaaS product.',
        'Implemented CI/CD pipeline reducing deployment time by 60%.',
      ],
    },
  ],
  education: [
    {
      degree: 'B.S. Computer Science',
      school: 'University of Texas',
      graduationDate: '2018',
      details: '',
    },
  ],
  certifications: [],
  projects: [],
}
