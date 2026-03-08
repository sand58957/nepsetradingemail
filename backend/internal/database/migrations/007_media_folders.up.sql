-- Media Folders: user-created organizational folders
CREATE TABLE IF NOT EXISTS app_media_folders (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    user_id     INT REFERENCES app_users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_media_folders_user_id ON app_media_folders(user_id);

-- Media Folder Items: maps Listmonk media IDs into local folders
CREATE TABLE IF NOT EXISTS app_media_folder_items (
    id          SERIAL PRIMARY KEY,
    folder_id   INT NOT NULL REFERENCES app_media_folders(id) ON DELETE CASCADE,
    media_id    INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(folder_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_app_media_folder_items_folder_id ON app_media_folder_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_app_media_folder_items_media_id ON app_media_folder_items(media_id);
