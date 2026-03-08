package handlers

import (
	"database/sql"
	"strconv"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/models"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type MediaFolderHandler struct {
	db *sqlx.DB
	lm *listmonk.Client
}

func NewMediaFolderHandler(db *sqlx.DB, lm *listmonk.Client) *MediaFolderHandler {
	return &MediaFolderHandler{db: db, lm: lm}
}

// List returns all media folders with item counts.
func (h *MediaFolderHandler) List(c echo.Context) error {
	var folders []models.MediaFolderWithCount
	err := h.db.Select(&folders, `
		SELECT f.id, f.name, f.user_id, f.created_at, f.updated_at,
		       COALESCE(COUNT(fi.id), 0) AS item_count
		FROM app_media_folders f
		LEFT JOIN app_media_folder_items fi ON f.id = fi.folder_id
		GROUP BY f.id
		ORDER BY f.name
	`)
	if err != nil {
		return response.InternalError(c, "Failed to fetch media folders")
	}

	if folders == nil {
		folders = []models.MediaFolderWithCount{}
	}

	return response.Success(c, folders)
}

// Create creates a new media folder.
func (h *MediaFolderHandler) Create(c echo.Context) error {
	var req models.CreateMediaFolderRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" {
		return response.BadRequest(c, "Folder name is required")
	}

	// Get user_id from JWT context using middleware helper
	userID := middleware.GetUserID(c)
	if userID == 0 {
		return response.BadRequest(c, "Invalid user context")
	}

	var folder models.MediaFolder
	err := h.db.QueryRowx(
		`INSERT INTO app_media_folders (name, user_id) VALUES ($1, $2) RETURNING *`,
		req.Name, userID,
	).StructScan(&folder)
	if err != nil {
		return response.InternalError(c, "Failed to create folder")
	}

	return response.Success(c, folder)
}

// Update renames a media folder.
func (h *MediaFolderHandler) Update(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid folder ID")
	}

	var req models.UpdateMediaFolderRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" {
		return response.BadRequest(c, "Folder name is required")
	}

	var folder models.MediaFolder
	err = h.db.QueryRowx(
		`UPDATE app_media_folders SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
		req.Name, id,
	).StructScan(&folder)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Folder not found")
		}
		return response.InternalError(c, "Failed to update folder")
	}

	return response.Success(c, folder)
}

// Delete deletes a media folder (cascade deletes folder items).
func (h *MediaFolderHandler) Delete(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid folder ID")
	}

	result, err := h.db.Exec(`DELETE FROM app_media_folders WHERE id = $1`, id)
	if err != nil {
		return response.InternalError(c, "Failed to delete folder")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return response.NotFound(c, "Folder not found")
	}

	return response.Success(c, map[string]string{"message": "Folder deleted successfully"})
}

// ListItems returns media IDs in a folder.
func (h *MediaFolderHandler) ListItems(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid folder ID")
	}

	var mediaIDs []int
	err = h.db.Select(&mediaIDs, `SELECT media_id FROM app_media_folder_items WHERE folder_id = $1`, id)
	if err != nil {
		return response.InternalError(c, "Failed to fetch folder items")
	}

	if mediaIDs == nil {
		mediaIDs = []int{}
	}

	return response.Success(c, mediaIDs)
}

// AddItems assigns media items to a folder.
func (h *MediaFolderHandler) AddItems(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid folder ID")
	}

	var req models.AssignMediaToFolderRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if len(req.MediaIDs) == 0 {
		return response.BadRequest(c, "At least one media ID is required")
	}

	for _, mediaID := range req.MediaIDs {
		_, err := h.db.Exec(
			`INSERT INTO app_media_folder_items (folder_id, media_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			id, mediaID,
		)
		if err != nil {
			return response.InternalError(c, "Failed to add items to folder")
		}
	}

	return response.Success(c, map[string]string{"message": "Items added to folder"})
}

// RemoveItem removes a media item from a folder.
func (h *MediaFolderHandler) RemoveItem(c echo.Context) error {
	folderID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid folder ID")
	}

	mediaID, err := strconv.Atoi(c.Param("media_id"))
	if err != nil {
		return response.BadRequest(c, "Invalid media ID")
	}

	_, err = h.db.Exec(
		`DELETE FROM app_media_folder_items WHERE folder_id = $1 AND media_id = $2`,
		folderID, mediaID,
	)
	if err != nil {
		return response.InternalError(c, "Failed to remove item from folder")
	}

	return response.Success(c, map[string]string{"message": "Item removed from folder"})
}
