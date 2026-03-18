export interface BlogAuthor {
  id: number
  account_id: number
  name: string
  slug: string
  email: string
  bio: string
  avatar_url: string
  expertise: string[]
  credentials: string
  social_links: Record<string, string>
  eeat_score: number
  is_active: boolean
  post_count?: number
  created_at: string
  updated_at: string
}

export interface BlogCategory {
  id: number
  account_id: number
  name: string
  slug: string
  description: string
  parent_id: number | null
  sort_order: number
  post_count?: number
  created_at: string
  updated_at: string
}

export interface BlogTag {
  id: number
  account_id: number
  name: string
  slug: string
  post_count?: number
  created_at: string
}

export interface BlogPost {
  id: number
  account_id: number
  author_id: number | null
  category_id: number | null
  title: string
  slug: string
  content: any
  content_html: string
  excerpt: string
  featured_image_url: string
  featured_image_alt: string
  status: 'draft' | 'published' | 'scheduled' | 'archived'
  // SEO
  meta_title: string
  meta_description: string
  canonical_url: string
  primary_keyword: string
  secondary_keywords: string[]
  // AEO
  quick_answer: string
  schema_type: string
  schema_json: any
  // GEO
  entity_tags: any[]
  source_citations: any[]
  // Structure
  table_of_contents: any[]
  key_points: any[]
  // Scoring
  seo_score: number
  readability_score: number
  word_count: number
  reading_time_min: number
  // Publishing
  published_at: string | null
  scheduled_at: string | null
  view_count: number
  created_by: number | null
  created_at: string
  updated_at: string
  // Joined
  author_name?: string
  category_name?: string
}

export interface BlogPostFAQ {
  id: number
  post_id: number
  question: string
  answer: string
  sort_order: number
  created_at: string
}

export interface BlogSettings {
  id: number
  account_id: number
  blog_title: string
  blog_description: string
  posts_per_page: number
  robots_txt: string
  custom_head_tags: string
  default_og_image: string
  sitemap_enabled: boolean
  created_at: string
  updated_at: string
}

export interface BlogDashboardStats {
  stats: {
    total_posts: number
    published_posts: number
    draft_posts: number
    total_views: number
    total_authors: number
    total_categories: number
    avg_seo_score: number
  }
  recent_posts: BlogPost[]
}

export interface BlogPostDetail {
  post: BlogPost
  tags: BlogTag[]
  faqs: BlogPostFAQ[]
  author?: BlogAuthor
}

export interface CreatePostRequest {
  title: string
  content?: any
  content_html?: string
  excerpt?: string
  featured_image_url?: string
  featured_image_alt?: string
  author_id?: number | null
  category_id?: number | null
  status?: string
  meta_title?: string
  meta_description?: string
  canonical_url?: string
  primary_keyword?: string
  secondary_keywords?: string[]
  quick_answer?: string
  schema_type?: string
  entity_tags?: any[]
  source_citations?: any[]
  table_of_contents?: any[]
  key_points?: any[]
  seo_score?: number
  readability_score?: number
  word_count?: number
  reading_time_min?: number
  tag_ids?: number[]
}
