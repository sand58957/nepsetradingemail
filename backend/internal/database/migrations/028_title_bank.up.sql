-- Title-bank publishing: the internal content-title database is the single source
-- of truth for auto-published posts. No external content source is consulted.

CREATE TABLE IF NOT EXISTS blog_pillars (
    id                  SERIAL PRIMARY KEY,
    pillar_number       INTEGER NOT NULL UNIQUE,
    title               TEXT    NOT NULL,
    slug                TEXT    NOT NULL UNIQUE,
    description         TEXT    NOT NULL DEFAULT '',
    primary_intent      TEXT    NOT NULL DEFAULT '',
    target_audience     TEXT    NOT NULL DEFAULT '',
    seo_note            TEXT    NOT NULL DEFAULT '',
    aeo_note            TEXT    NOT NULL DEFAULT '',
    geo_note            TEXT    NOT NULL DEFAULT '',
    aio_note            TEXT    NOT NULL DEFAULT '',
    primary_keyword     TEXT    NOT NULL DEFAULT '',
    secondary_keywords  TEXT[]  NOT NULL DEFAULT '{}',
    subtopics           TEXT[]  NOT NULL DEFAULT '{}',
    category_id         INTEGER REFERENCES blog_categories(id) ON DELETE SET NULL,
    flyer_filename      TEXT    NOT NULL DEFAULT '',
    flyer_url           TEXT    NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per internal blog title. status is the lifecycle the scheduler drives.
CREATE TABLE IF NOT EXISTS blog_title_bank (
    id              SERIAL PRIMARY KEY,
    pillar_id       INTEGER NOT NULL REFERENCES blog_pillars(id) ON DELETE CASCADE,
    title_number    INTEGER NOT NULL,
    title           TEXT    NOT NULL,
    title_key       TEXT    NOT NULL,
    content_type    TEXT    NOT NULL DEFAULT '',
    subject_entity  TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available','queued','generating','published','failed','skipped')),
    post_id         INTEGER REFERENCES blog_posts(id) ON DELETE SET NULL,
    post_slug       TEXT    NOT NULL DEFAULT '',
    attempts        INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT    NOT NULL DEFAULT '',
    locked_at       TIMESTAMPTZ,
    queued_at       TIMESTAMPTZ,
    generated_at    TIMESTAMPTZ,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pillar_id, title_number)
);

-- Exact-duplicate prevention at the database level: a normalised key, unique across
-- the whole bank, so the same title can never be seeded or published twice.
CREATE UNIQUE INDEX IF NOT EXISTS blog_title_bank_key_uniq ON blog_title_bank (title_key);
CREATE INDEX IF NOT EXISTS blog_title_bank_status_idx ON blog_title_bank (status, pillar_id, title_number);
CREATE INDEX IF NOT EXISTS blog_title_bank_post_idx   ON blog_title_bank (post_id);

CREATE TABLE IF NOT EXISTS blog_publish_log (
    id              SERIAL PRIMARY KEY,
    title_id        INTEGER REFERENCES blog_title_bank(id) ON DELETE SET NULL,
    title           TEXT    NOT NULL DEFAULT '',
    pillar_id       INTEGER REFERENCES blog_pillars(id) ON DELETE SET NULL,
    category_id     INTEGER REFERENCES blog_categories(id) ON DELETE SET NULL,
    author_id       INTEGER REFERENCES blog_authors(id) ON DELETE SET NULL,
    status          TEXT    NOT NULL DEFAULT '',
    scheduled_at    TIMESTAMPTZ,
    generated_at    TIMESTAMPTZ,
    published_at    TIMESTAMPTZ,
    post_id         INTEGER REFERENCES blog_posts(id) ON DELETE SET NULL,
    slug            TEXT    NOT NULL DEFAULT '',
    word_count      INTEGER NOT NULL DEFAULT 0,
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    indexnow_status TEXT    NOT NULL DEFAULT '',
    error_message   TEXT    NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS blog_publish_log_created_idx ON blog_publish_log (created_at DESC);

-- Singleton runtime row. account_id is the PK so settings stay per-account.
CREATE TABLE IF NOT EXISTS blog_title_bank_settings (
    account_id          INTEGER PRIMARY KEY,
    is_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
    interval_minutes    INTEGER NOT NULL DEFAULT 30 CHECK (interval_minutes >= 1),
    start_at            TIMESTAMPTZ,
    last_published_at   TIMESTAMPTZ,
    next_run_at         TIMESTAMPTZ,
    -- Rotation advances only on a successful publish (spec §19).
    last_author_id      INTEGER REFERENCES blog_authors(id) ON DELETE SET NULL,
    author_ids          INTEGER[] NOT NULL DEFAULT '{}',
    max_attempts        INTEGER NOT NULL DEFAULT 3,
    submit_to_indexnow  BOOLEAN NOT NULL DEFAULT FALSE,
    indexnow_key        TEXT    NOT NULL DEFAULT '',
    site_base_url       TEXT    NOT NULL DEFAULT 'https://nepalfillings.com',
    exhausted_notice    TEXT    NOT NULL DEFAULT '',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
