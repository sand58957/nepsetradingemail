package anthropic

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// GeneratedPost is the structured output from Claude for a blog post.
type GeneratedPost struct {
	Title             string            `json:"title"`
	ContentHTML       string            `json:"content_html"`
	Excerpt           string            `json:"excerpt"`
	MetaTitle         string            `json:"meta_title"`
	MetaDescription   string            `json:"meta_description"`
	PrimaryKeyword    string            `json:"primary_keyword"`
	SecondaryKeywords []string          `json:"secondary_keywords"`
	QuickAnswer       string            `json:"quick_answer"`
	EntityTags        []EntityTag       `json:"entity_tags"`
	SourceCitations   []SourceCitation  `json:"source_citations"`
	TableOfContents   []TOCItem         `json:"table_of_contents"`
	KeyPoints         []string          `json:"key_points"`
	FAQs              []FAQ             `json:"faqs"`
	FeaturedImageAlt  string            `json:"featured_image_alt"`
	SchemaType        string            `json:"schema_type"`
	WordCount         int               `json:"word_count"`
	ReadingTimeMin    int               `json:"reading_time_min"`
	SEOScore          int               `json:"seo_score"`
	ReadabilityScore  int               `json:"readability_score"`
}

// FAQ is a question-answer pair.
type FAQ struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

// EntityTag identifies a named entity for GEO.
type EntityTag struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// SourceCitation is a reference source.
type SourceCitation struct {
	Title string `json:"title"`
	URL   string `json:"url"`
}

// TOCItem is a table of contents entry.
type TOCItem struct {
	Title string `json:"title"`
	Level int    `json:"level"`
}

// BlogGeneratorSettings configures the generation.
type BlogGeneratorSettings struct {
	TargetWordCount int
	TargetSEOScore  int
	ContentTone     string
	TargetAudience  string
	SiteContext     string
}

// GenerateBlogPost generates a full blog post with FAQs using Claude.
func GenerateBlogPost(ctx context.Context, client *Client, topic, primaryKeyword string, secondaryKeywords []string, settings BlogGeneratorSettings) (*GeneratedPost, int, error) {
	if settings.TargetWordCount == 0 {
		settings.TargetWordCount = 2000
	}
	if settings.TargetSEOScore == 0 {
		settings.TargetSEOScore = 95
	}
	if settings.ContentTone == "" {
		settings.ContentTone = "professional"
	}
	if settings.TargetAudience == "" {
		settings.TargetAudience = "Nepal business owners and digital marketers"
	}
	if settings.SiteContext == "" {
		settings.SiteContext = "nepalfillings.com is a Nepal-based digital marketing platform"
	}

	systemPrompt := buildSystemPrompt(settings)
	userPrompt := buildUserPrompt(topic, primaryKeyword, secondaryKeywords)

	resp, err := client.Generate(ctx, systemPrompt, userPrompt, 8192)
	if err != nil {
		return nil, 0, fmt.Errorf("claude API call failed: %w", err)
	}

	text := resp.GetTextContent()
	tokens := resp.TotalTokens()

	// Extract JSON from response (Claude may wrap in ```json blocks)
	jsonStr := extractJSON(text)
	if jsonStr == "" {
		return nil, tokens, fmt.Errorf("no valid JSON found in Claude response")
	}

	var post GeneratedPost
	if err := json.Unmarshal([]byte(jsonStr), &post); err != nil {
		return nil, tokens, fmt.Errorf("failed to parse generated post JSON: %w (response: %.200s)", err, jsonStr)
	}

	// Validate essential fields
	if post.Title == "" {
		return nil, tokens, fmt.Errorf("generated post has empty title")
	}
	if post.ContentHTML == "" {
		return nil, tokens, fmt.Errorf("generated post has empty content")
	}
	if len(post.FAQs) < 5 {
		return nil, tokens, fmt.Errorf("generated post has only %d FAQs (need 5+)", len(post.FAQs))
	}

	// Set defaults
	if post.SchemaType == "" {
		post.SchemaType = "Article"
	}
	if post.SEOScore == 0 {
		post.SEOScore = settings.TargetSEOScore
	}
	if post.ReadabilityScore == 0 {
		post.ReadabilityScore = 85
	}
	if post.WordCount == 0 {
		post.WordCount = countWords(post.ContentHTML)
	}
	if post.ReadingTimeMin == 0 {
		post.ReadingTimeMin = post.WordCount / 200
		if post.ReadingTimeMin < 1 {
			post.ReadingTimeMin = 1
		}
	}

	return &post, tokens, nil
}

func buildSystemPrompt(settings BlogGeneratorSettings) string {
	return fmt.Sprintf(`You are an expert SEO content writer specializing in Nepal's digital market. You write for %s.

Your task is to generate a complete, publication-ready blog post as a JSON object.

REQUIREMENTS:
- Word count: %d+ words of rich, detailed HTML content
- Tone: %s
- Target audience: %s
- Content must be factual, specific to Nepal, with real data points
- SEO score must be %d+/100

SEO RULES (Critical):
- Primary keyword MUST appear in: title, first paragraph, at least 3 H2 headings, meta title, meta description
- Keyword density: 1.5-2.5%% of total words
- Meta title: 50-60 characters, primary keyword near the start
- Meta description: 140-155 characters, compelling, includes primary keyword
- Include 6-8 H2 headings and 3-5 H3 subheadings in content_html
- Quick answer: 40-60 words, direct answer suitable for Google featured snippet

AEO RULES:
- Generate exactly 10 FAQs with detailed answers (50-100 words each)
- FAQs must cover common questions about the topic in Nepal context
- Quick answer must directly answer "What is [topic]?" concisely

GEO RULES:
- Include 3-5 entity tags (Nepal as Country, cities, organizations, platforms)
- Include 2-3 source citations with real/plausible URLs
- Reference Nepal-specific data: NPR pricing, local platforms (eSewa, Khalti, Sparrow SMS), NTA regulations

AIO RULES:
- Content must be well-structured HTML that AI crawlers can parse
- Include specific data points, statistics, and comparisons
- Use clear H2/H3 hierarchy for AI content extraction

CONTENT HTML FORMAT:
- Use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <a> tags
- NO <h1> tag (title is separate)
- Include internal links to /blog/ pages where relevant
- Include bold keywords with <strong> tags

OUTPUT: Return ONLY valid JSON (no markdown fences, no explanation) matching this exact schema:
{
  "title": "string",
  "content_html": "string (full HTML article body)",
  "excerpt": "string (2-3 sentence summary, 150-200 chars)",
  "meta_title": "string (50-60 chars)",
  "meta_description": "string (140-155 chars)",
  "primary_keyword": "string",
  "secondary_keywords": ["string", "string", "string", "string"],
  "quick_answer": "string (40-60 words)",
  "entity_tags": [{"name": "string", "type": "string"}],
  "source_citations": [{"title": "string", "url": "string"}],
  "table_of_contents": [{"title": "string", "level": 2}],
  "key_points": ["string", "string", "string"],
  "faqs": [{"question": "string", "answer": "string"}],
  "featured_image_alt": "string",
  "schema_type": "Article",
  "word_count": 0,
  "reading_time_min": 0,
  "seo_score": 95,
  "readability_score": 85
}`, settings.SiteContext, settings.TargetWordCount, settings.ContentTone, settings.TargetAudience, settings.TargetSEOScore)
}

func buildUserPrompt(topic, primaryKeyword string, secondaryKeywords []string) string {
	skw := "none specified"
	if len(secondaryKeywords) > 0 {
		skw = strings.Join(secondaryKeywords, ", ")
	}
	if primaryKeyword == "" {
		primaryKeyword = topic
	}

	return fmt.Sprintf(`Write a comprehensive blog post about:

TOPIC: %s
PRIMARY KEYWORD: %s
SECONDARY KEYWORDS: %s

Generate the complete blog post as JSON. Remember:
- 10 detailed FAQs about this topic in Nepal context
- Nepal-specific data, examples, pricing in NPR
- Real business scenarios from Kathmandu, Pokhara, Biratnagar
- Reference local platforms: eSewa, Khalti, Sparrow SMS, Nepal Telecom, Ncell
- Optimize for 95+ SEO score
- Return ONLY the JSON object, nothing else`, topic, primaryKeyword, skw)
}

// extractJSON finds and extracts JSON from Claude's response.
func extractJSON(text string) string {
	text = strings.TrimSpace(text)

	// If wrapped in ```json ... ``` or ``` ... ```
	if idx := strings.Index(text, "```json"); idx >= 0 {
		start := idx + 7
		end := strings.Index(text[start:], "```")
		if end > 0 {
			return strings.TrimSpace(text[start : start+end])
		}
	}
	if idx := strings.Index(text, "```"); idx >= 0 {
		start := idx + 3
		// Skip optional language identifier on same line
		if nl := strings.Index(text[start:], "\n"); nl >= 0 {
			start += nl + 1
		}
		end := strings.Index(text[start:], "```")
		if end > 0 {
			return strings.TrimSpace(text[start : start+end])
		}
	}

	// If it starts with { and ends with }, assume raw JSON
	if strings.HasPrefix(text, "{") {
		return text
	}

	// Try to find JSON object in the text
	start := strings.Index(text, "{")
	if start >= 0 {
		end := strings.LastIndex(text, "}")
		if end > start {
			return text[start : end+1]
		}
	}

	return ""
}

// countWords counts words in HTML content.
func countWords(html string) int {
	// Strip HTML tags
	var inTag bool
	var text strings.Builder
	for _, r := range html {
		if r == '<' {
			inTag = true
			text.WriteRune(' ')
			continue
		}
		if r == '>' {
			inTag = false
			continue
		}
		if !inTag {
			text.WriteRune(r)
		}
	}
	words := strings.Fields(text.String())
	return len(words)
}
