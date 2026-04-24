-- Blog Auto-Publish System
-- Tables: blog_autopublish_settings, blog_autopublish_queue, blog_autopublish_logs

-- 1. Per-account auto-publish configuration
CREATE TABLE IF NOT EXISTS blog_autopublish_settings (
    id                  SERIAL PRIMARY KEY,
    account_id          INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    is_enabled          BOOLEAN NOT NULL DEFAULT false,
    posts_per_day       INT NOT NULL DEFAULT 1,
    preferred_hour      INT NOT NULL DEFAULT 9,
    default_author_id   INT REFERENCES blog_authors(id) ON DELETE SET NULL,
    default_category_id INT REFERENCES blog_categories(id) ON DELETE SET NULL,
    auto_publish        BOOLEAN NOT NULL DEFAULT false,
    target_word_count   INT NOT NULL DEFAULT 2000,
    target_seo_score    INT NOT NULL DEFAULT 95,
    content_tone        TEXT NOT NULL DEFAULT 'professional',
    target_audience     TEXT NOT NULL DEFAULT 'Nepal business owners and digital marketers',
    site_context        TEXT NOT NULL DEFAULT 'nepalfillings.com is a Nepal-based digital marketing platform for Email, SMS, WhatsApp, Telegram and Messenger marketing.',
    anthropic_api_key   TEXT NOT NULL DEFAULT '',
    anthropic_model     TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id)
);

-- 2. Topic/keyword queue for auto-publishing
CREATE TABLE IF NOT EXISTS blog_autopublish_queue (
    id                  SERIAL PRIMARY KEY,
    account_id          INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    topic               TEXT NOT NULL,
    primary_keyword     TEXT NOT NULL DEFAULT '',
    secondary_keywords  TEXT[] NOT NULL DEFAULT '{}',
    category_id         INT REFERENCES blog_categories(id) ON DELETE SET NULL,
    author_id           INT REFERENCES blog_authors(id) ON DELETE SET NULL,
    priority            INT NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    post_id             INT REFERENCES blog_posts(id) ON DELETE SET NULL,
    error_message       TEXT NOT NULL DEFAULT '',
    retry_count         INT NOT NULL DEFAULT 0,
    max_retries         INT NOT NULL DEFAULT 3,
    scheduled_for       TIMESTAMPTZ,
    processed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autopublish_queue_account ON blog_autopublish_queue(account_id);
CREATE INDEX IF NOT EXISTS idx_autopublish_queue_status ON blog_autopublish_queue(account_id, status);
CREATE INDEX IF NOT EXISTS idx_autopublish_queue_pending ON blog_autopublish_queue(status, priority DESC, created_at ASC)
    WHERE status = 'pending';

-- 3. Execution logs for audit
CREATE TABLE IF NOT EXISTS blog_autopublish_logs (
    id              SERIAL PRIMARY KEY,
    account_id      INT NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
    queue_id        INT REFERENCES blog_autopublish_queue(id) ON DELETE SET NULL,
    post_id         INT REFERENCES blog_posts(id) ON DELETE SET NULL,
    action          TEXT NOT NULL,
    status          TEXT NOT NULL,
    message         TEXT NOT NULL DEFAULT '',
    tokens_used     INT NOT NULL DEFAULT 0,
    duration_ms     INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autopublish_logs_account ON blog_autopublish_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_autopublish_logs_queue ON blog_autopublish_logs(queue_id);
