-- Blog CMS Module with SEO/AEO/GEO optimization
-- Tables: blog_authors, blog_categories, blog_tags, blog_posts, blog_post_tags, blog_post_faqs, blog_settings

-- 1. Blog Authors (with EEAT fields)
CREATE TABLE IF NOT EXISTS blog_authors (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    email           TEXT NOT NULL DEFAULT '',
    bio             TEXT NOT NULL DEFAULT '',
    avatar_url      TEXT NOT NULL DEFAULT '',
    expertise       TEXT[] NOT NULL DEFAULT '{}',
    credentials     TEXT NOT NULL DEFAULT '',
    social_links    JSONB NOT NULL DEFAULT '{}',
    eeat_score      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_blog_authors_account ON blog_authors(account_id);

-- 2. Blog Categories (hierarchical)
CREATE TABLE IF NOT EXISTS blog_categories (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    parent_id       INT REFERENCES blog_categories(id) ON DELETE SET NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_blog_categories_account ON blog_categories(account_id);

-- 3. Blog Tags
CREATE TABLE IF NOT EXISTS blog_tags (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_blog_tags_account ON blog_tags(account_id);

-- 4. Blog Posts (main content with SEO/AEO/GEO fields)
CREATE TABLE IF NOT EXISTS blog_posts (
    id                  SERIAL PRIMARY KEY,
    account_id          INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    author_id           INT REFERENCES blog_authors(id) ON DELETE SET NULL,
    category_id         INT REFERENCES blog_categories(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    slug                TEXT NOT NULL,
    content             JSONB NOT NULL DEFAULT '{}',
    content_html        TEXT NOT NULL DEFAULT '',
    excerpt             TEXT NOT NULL DEFAULT '',
    featured_image_url  TEXT NOT NULL DEFAULT '',
    featured_image_alt  TEXT NOT NULL DEFAULT '',
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
    -- SEO fields
    meta_title          TEXT NOT NULL DEFAULT '',
    meta_description    TEXT NOT NULL DEFAULT '',
    canonical_url       TEXT NOT NULL DEFAULT '',
    primary_keyword     TEXT NOT NULL DEFAULT '',
    secondary_keywords  TEXT[] NOT NULL DEFAULT '{}',
    -- AEO fields
    quick_answer        TEXT NOT NULL DEFAULT '',
    schema_type         TEXT NOT NULL DEFAULT 'Article',
    schema_json         JSONB NOT NULL DEFAULT '{}',
    -- GEO fields
    entity_tags         JSONB NOT NULL DEFAULT '[]',
    source_citations    JSONB NOT NULL DEFAULT '[]',
    -- Content structure
    table_of_contents   JSONB NOT NULL DEFAULT '[]',
    key_points          JSONB NOT NULL DEFAULT '[]',
    -- Scoring
    seo_score           INT NOT NULL DEFAULT 0,
    readability_score   INT NOT NULL DEFAULT 0,
    word_count          INT NOT NULL DEFAULT 0,
    reading_time_min    INT NOT NULL DEFAULT 0,
    -- Publishing
    published_at        TIMESTAMPTZ,
    scheduled_at        TIMESTAMPTZ,
    -- Tracking
    view_count          INT NOT NULL DEFAULT 0,
    created_by          INT REFERENCES app_users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_account ON blog_posts(account_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(account_id, status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(account_id, slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(account_id, status, published_at DESC);

-- 5. Blog Post Tags (junction)
CREATE TABLE IF NOT EXISTS blog_post_tags (
    id          SERIAL PRIMARY KEY,
    post_id     INT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id      INT NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
    UNIQUE(post_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_blog_post_tags_post ON blog_post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag ON blog_post_tags(tag_id);

-- 6. Blog Post FAQs (for AEO/schema)
CREATE TABLE IF NOT EXISTS blog_post_faqs (
    id          SERIAL PRIMARY KEY,
    post_id     INT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_post_faqs_post ON blog_post_faqs(post_id);

-- 7. Blog Settings (per-account)
CREATE TABLE IF NOT EXISTS blog_settings (
    id                  SERIAL PRIMARY KEY,
    account_id          INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    blog_title          TEXT NOT NULL DEFAULT 'Blog',
    blog_description    TEXT NOT NULL DEFAULT '',
    posts_per_page      INT NOT NULL DEFAULT 10,
    robots_txt          TEXT NOT NULL DEFAULT 'User-agent: *\nAllow: /blog/\nDisallow: /en/\nSitemap: /api/public/blog/sitemap.xml',
    custom_head_tags    TEXT NOT NULL DEFAULT '',
    default_og_image    TEXT NOT NULL DEFAULT '',
    sitemap_enabled     BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id)
);
