import { useMemo } from 'react'

export interface SEOCheck {
  id: string
  label: string
  passed: boolean
  points: number
  maxPoints: number
  suggestion?: string
}

export interface SEOScoreResult {
  score: number
  checks: SEOCheck[]
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  gradeColor: string
}

interface SEOInput {
  title: string
  contentText: string
  metaTitle: string
  metaDescription: string
  primaryKeyword: string
  headings: string[]
  hasInternalLinks: boolean
  hasExternalLinks: boolean
  hasImages: boolean
  imagesHaveAlt: boolean
  wordCount: number
  quickAnswer: string
  hasFAQs: boolean
}

export function useSEOScore(input: SEOInput): SEOScoreResult {
  return useMemo(() => {
    const checks: SEOCheck[] = []
    const kw = input.primaryKeyword.toLowerCase().trim()

    // 1. Keyword in title (10 pts)
    const titleHasKeyword = kw && input.title.toLowerCase().includes(kw)
    checks.push({
      id: 'keyword-title',
      label: 'Primary keyword in title',
      passed: !!titleHasKeyword,
      points: titleHasKeyword ? 10 : 0,
      maxPoints: 10,
      suggestion: titleHasKeyword ? undefined : 'Add your primary keyword to the post title'
    })

    // 2. Keyword in first 100 words (10 pts)
    const first100 = input.contentText.split(/\s+/).slice(0, 100).join(' ').toLowerCase()
    const kwInFirst100 = kw && first100.includes(kw)
    checks.push({
      id: 'keyword-intro',
      label: 'Keyword in first 100 words',
      passed: !!kwInFirst100,
      points: kwInFirst100 ? 10 : 0,
      maxPoints: 10,
      suggestion: kwInFirst100 ? undefined : 'Include your primary keyword in the introduction'
    })

    // 3. Keyword density 1-3% (15 pts)
    let densityOk = false
    if (kw && input.wordCount > 0) {
      const kwRegex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const matches = input.contentText.match(kwRegex)
      const count = matches ? matches.length : 0
      const density = (count / input.wordCount) * 100
      densityOk = density >= 0.5 && density <= 3.5
    }
    checks.push({
      id: 'keyword-density',
      label: 'Keyword density (0.5-3.5%)',
      passed: densityOk,
      points: densityOk ? 15 : 0,
      maxPoints: 15,
      suggestion: densityOk ? undefined : 'Adjust keyword frequency to 0.5-3.5% of total words'
    })

    // 4. Meta title length 50-60 chars (10 pts)
    const mtLen = input.metaTitle.length
    const metaTitleOk = mtLen >= 30 && mtLen <= 65
    checks.push({
      id: 'meta-title',
      label: `Meta title length (${mtLen}/60)`,
      passed: metaTitleOk,
      points: metaTitleOk ? 10 : 0,
      maxPoints: 10,
      suggestion: metaTitleOk ? undefined : 'Keep meta title between 30-65 characters'
    })

    // 5. Meta description 120-155 chars (10 pts)
    const mdLen = input.metaDescription.length
    const metaDescOk = mdLen >= 80 && mdLen <= 160
    checks.push({
      id: 'meta-desc',
      label: `Meta description length (${mdLen}/155)`,
      passed: metaDescOk,
      points: metaDescOk ? 10 : 0,
      maxPoints: 10,
      suggestion: metaDescOk ? undefined : 'Keep meta description between 80-160 characters'
    })

    // 6. Has H2 headings (10 pts)
    const hasH2 = input.headings.length >= 2
    checks.push({
      id: 'headings',
      label: `Heading structure (${input.headings.length} headings)`,
      passed: hasH2,
      points: hasH2 ? 10 : 0,
      maxPoints: 10,
      suggestion: hasH2 ? undefined : 'Add at least 2 subheadings (H2) to structure content'
    })

    // 7. Content length > 1000 words (15 pts)
    const lengthOk = input.wordCount >= 1000
    checks.push({
      id: 'content-length',
      label: `Content length (${input.wordCount} words)`,
      passed: lengthOk,
      points: lengthOk ? 15 : 0,
      maxPoints: 15,
      suggestion: lengthOk ? undefined : 'Write at least 1000 words for better SEO ranking'
    })

    // 8. Has internal/external links (10 pts)
    const hasLinks = input.hasInternalLinks || input.hasExternalLinks
    checks.push({
      id: 'links',
      label: 'Internal or external links',
      passed: hasLinks,
      points: hasLinks ? 10 : 0,
      maxPoints: 10,
      suggestion: hasLinks ? undefined : 'Add internal links to related content or external citations'
    })

    // 9. Images with alt tags (10 pts)
    const imgOk = !input.hasImages || input.imagesHaveAlt
    checks.push({
      id: 'image-alt',
      label: 'Images have alt text',
      passed: imgOk && input.hasImages,
      points: imgOk && input.hasImages ? 10 : 0,
      maxPoints: 10,
      suggestion: imgOk && input.hasImages ? undefined : 'Add descriptive alt text to all images'
    })

    // BONUS: Quick Answer for AEO (+5 pts counted in total but doesn't exceed 100)
    const hasQuickAnswer = input.quickAnswer.length > 30
    checks.push({
      id: 'quick-answer',
      label: 'Quick answer for AEO',
      passed: hasQuickAnswer,
      points: hasQuickAnswer ? 5 : 0,
      maxPoints: 5,
      suggestion: hasQuickAnswer ? undefined : 'Add a 2-3 sentence quick answer for featured snippets'
    })

    // BONUS: FAQ section (+5 pts)
    checks.push({
      id: 'faqs',
      label: 'FAQ section present',
      passed: input.hasFAQs,
      points: input.hasFAQs ? 5 : 0,
      maxPoints: 5,
      suggestion: input.hasFAQs ? undefined : 'Add FAQ section for Answer Engine Optimization'
    })

    const score = Math.min(100, checks.reduce((sum, c) => sum + c.points, 0))

    let grade: 'A' | 'B' | 'C' | 'D' | 'F'
    let gradeColor: string
    if (score >= 80) { grade = 'A'; gradeColor = '#4caf50' }
    else if (score >= 60) { grade = 'B'; gradeColor = '#8bc34a' }
    else if (score >= 40) { grade = 'C'; gradeColor = '#ff9800' }
    else if (score >= 20) { grade = 'D'; gradeColor = '#f44336' }
    else { grade = 'F'; gradeColor = '#9e9e9e' }

    return { score, checks, grade, gradeColor }
  }, [
    input.title, input.contentText, input.metaTitle, input.metaDescription,
    input.primaryKeyword, input.headings, input.hasInternalLinks, input.hasExternalLinks,
    input.hasImages, input.imagesHaveAlt, input.wordCount, input.quickAnswer, input.hasFAQs
  ])
}
