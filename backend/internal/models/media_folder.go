package models

import "time"

type MediaFolder struct {
	ID        int       `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	UserID    int       `json:"user_id" db:"user_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type MediaFolderWithCount struct {
	MediaFolder
	ItemCount int `json:"item_count" db:"item_count"`
}

type CreateMediaFolderRequest struct {
	Name string `json:"name"`
}

type UpdateMediaFolderRequest struct {
	Name string `json:"name"`
}

type AssignMediaToFolderRequest struct {
	MediaIDs []int `json:"media_ids"`
}

type ImportFromURLRequest struct {
	URL string `json:"url"`
}
