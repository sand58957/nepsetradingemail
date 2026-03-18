import { useMemo } from 'react'

export interface EEATCheck {
  id: string
  label: string
  passed: boolean
  points: number
  maxPoints: number
  category: 'experience' | 'expertise' | 'authority' | 'trust'
}

export interface EEATScoreResult {
  score: number
  checks: EEATCheck[]
  grade: string
  gradeColor: string
  breakdown: {
    experience: number
    expertise: number
    authority: number
    trust: number
  }
}

interface EEATInput {
  authorHasBio: boolean
  authorHasCredentials: boolean
  authorHasExpertise: boolean
  authorExpertiseMatchesTopic: boolean
  authorHasSocialLinks: boolean
  hasCitations: boolean
  citationCount: number
  hasEntityTags: boolean
  entityTagCount: number
  wordCount: number
  hasDataOrStats: boolean
  hasFAQs: boolean
  hasQuickAnswer: boolean
}

export function useEEATScore(input: EEATInput): EEATScoreResult {
  return useMemo(() => {
    const checks: EEATCheck[] = []

    // Experience (25 pts)
    checks.push({
      id: 'author-bio',
      label: 'Author has biography',
      passed: input.authorHasBio,
      points: input.authorHasBio ? 10 : 0,
      maxPoints: 10,
      category: 'experience'
    })
    checks.push({
      id: 'content-depth',
      label: `Content depth (${input.wordCount}+ words)`,
      passed: input.wordCount >= 1500,
      points: input.wordCount >= 1500 ? 15 : input.wordCount >= 1000 ? 8 : 0,
      maxPoints: 15,
      category: 'experience'
    })

    // Expertise (25 pts)
    checks.push({
      id: 'author-credentials',
      label: 'Author has credentials',
      passed: input.authorHasCredentials,
      points: input.authorHasCredentials ? 15 : 0,
      maxPoints: 15,
      category: 'expertise'
    })
    checks.push({
      id: 'topic-match',
      label: 'Author expertise matches topic',
      passed: input.authorExpertiseMatchesTopic,
      points: input.authorExpertiseMatchesTopic ? 10 : 0,
      maxPoints: 10,
      category: 'expertise'
    })

    // Authority (25 pts)
    checks.push({
      id: 'citations',
      label: `Source citations (${input.citationCount} sources)`,
      passed: input.citationCount >= 2,
      points: Math.min(15, input.citationCount * 5),
      maxPoints: 15,
      category: 'authority'
    })
    checks.push({
      id: 'entity-tags',
      label: `Entity tags (${input.entityTagCount} entities)`,
      passed: input.entityTagCount >= 2,
      points: Math.min(10, input.entityTagCount * 3),
      maxPoints: 10,
      category: 'authority'
    })

    // Trust (25 pts)
    checks.push({
      id: 'social-links',
      label: 'Author has social profiles',
      passed: input.authorHasSocialLinks,
      points: input.authorHasSocialLinks ? 8 : 0,
      maxPoints: 8,
      category: 'trust'
    })
    checks.push({
      id: 'data-stats',
      label: 'Contains data or statistics',
      passed: input.hasDataOrStats,
      points: input.hasDataOrStats ? 7 : 0,
      maxPoints: 7,
      category: 'trust'
    })
    checks.push({
      id: 'faq-section',
      label: 'FAQ section present',
      passed: input.hasFAQs,
      points: input.hasFAQs ? 5 : 0,
      maxPoints: 5,
      category: 'trust'
    })
    checks.push({
      id: 'quick-answer',
      label: 'Quick answer for AEO',
      passed: input.hasQuickAnswer,
      points: input.hasQuickAnswer ? 5 : 0,
      maxPoints: 5,
      category: 'trust'
    })

    const score = Math.min(100, checks.reduce((sum, c) => sum + c.points, 0))

    const breakdown = {
      experience: checks.filter(c => c.category === 'experience').reduce((s, c) => s + c.points, 0),
      expertise: checks.filter(c => c.category === 'expertise').reduce((s, c) => s + c.points, 0),
      authority: checks.filter(c => c.category === 'authority').reduce((s, c) => s + c.points, 0),
      trust: checks.filter(c => c.category === 'trust').reduce((s, c) => s + c.points, 0)
    }

    let grade: string
    let gradeColor: string
    if (score >= 80) { grade = 'Excellent'; gradeColor = '#4caf50' }
    else if (score >= 60) { grade = 'Good'; gradeColor = '#8bc34a' }
    else if (score >= 40) { grade = 'Fair'; gradeColor = '#ff9800' }
    else if (score >= 20) { grade = 'Needs Work'; gradeColor = '#f44336' }
    else { grade = 'Poor'; gradeColor = '#9e9e9e' }

    return { score, checks, grade, gradeColor, breakdown }
  }, [
    input.authorHasBio, input.authorHasCredentials, input.authorHasExpertise,
    input.authorExpertiseMatchesTopic, input.authorHasSocialLinks,
    input.hasCitations, input.citationCount, input.hasEntityTags, input.entityTagCount,
    input.wordCount, input.hasDataOrStats, input.hasFAQs, input.hasQuickAnswer
  ])
}
