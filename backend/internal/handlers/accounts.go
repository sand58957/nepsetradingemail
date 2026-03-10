package handlers

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/models"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type AccountHandler struct {
	db  *sqlx.DB
	cfg *config.Config
}

func NewAccountHandler(db *sqlx.DB, cfg *config.Config) *AccountHandler {
	return &AccountHandler{db: db, cfg: cfg}
}

// List returns all accounts the authenticated user belongs to
func (h *AccountHandler) List(c echo.Context) error {
	userID := mw.GetUserID(c)

	var accounts []models.AccountWithRole
	err := h.db.Select(&accounts, `
		SELECT a.*, am.role as member_role
		FROM app_accounts a
		JOIN app_account_members am ON am.account_id = a.id
		WHERE am.user_id = $1
		ORDER BY a.name ASC
	`, userID)
	if err != nil {
		return response.InternalError(c, "Failed to list accounts")
	}

	if accounts == nil {
		accounts = []models.AccountWithRole{}
	}

	return response.Success(c, accounts)
}

// Create creates a new account and makes the user the owner
func (h *AccountHandler) Create(c echo.Context) error {
	userID := mw.GetUserID(c)

	var req models.CreateAccountRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" {
		return response.BadRequest(c, "Account name is required")
	}

	tx, err := h.db.Beginx()
	if err != nil {
		return response.InternalError(c, "Failed to start transaction")
	}
	defer tx.Rollback()

	// Create the account
	var account models.Account
	err = tx.QueryRowx(
		`INSERT INTO app_accounts (name, plan, created_at, updated_at)
		 VALUES ($1, 'Free', NOW(), NOW())
		 RETURNING *`,
		req.Name,
	).StructScan(&account)
	if err != nil {
		return response.InternalError(c, "Failed to create account")
	}

	// Add user as owner
	_, err = tx.Exec(
		`INSERT INTO app_account_members (account_id, user_id, role, created_at)
		 VALUES ($1, $2, 'owner', NOW())`,
		account.ID, userID,
	)
	if err != nil {
		return response.InternalError(c, "Failed to add account member")
	}

	// Set as current account
	_, err = tx.Exec(
		`UPDATE app_users SET current_account_id = $1, updated_at = NOW() WHERE id = $2`,
		account.ID, userID,
	)
	if err != nil {
		return response.InternalError(c, "Failed to set current account")
	}

	if err := tx.Commit(); err != nil {
		return response.InternalError(c, "Failed to commit transaction")
	}

	// Re-fetch user for token generation
	var user models.User
	if err := h.db.Get(&user, "SELECT * FROM app_users WHERE id = $1", userID); err != nil {
		return response.InternalError(c, "Failed to fetch user")
	}

	// Generate new tokens with the new account
	accessToken, err := h.generateToken(user, "access", time.Duration(h.cfg.JWTExpiry)*time.Hour)
	if err != nil {
		return response.InternalError(c, "Failed to generate access token")
	}

	refreshToken, err := h.generateToken(user, "refresh", time.Duration(h.cfg.RefreshExpiry)*time.Hour)
	if err != nil {
		return response.InternalError(c, "Failed to generate refresh token")
	}

	return response.Created(c, models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
		Account:      &account,
	})
}

// Get returns a single account (user must be a member)
func (h *AccountHandler) Get(c echo.Context) error {
	userID := mw.GetUserID(c)
	accountID, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var account models.AccountWithRole
	err = h.db.Get(&account, `
		SELECT a.*, am.role as member_role
		FROM app_accounts a
		JOIN app_account_members am ON am.account_id = a.id
		WHERE a.id = $1 AND am.user_id = $2
	`, accountID, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Account not found")
		}
		return response.InternalError(c, "Failed to fetch account")
	}

	return response.Success(c, account)
}

// Update updates account details (name, logo, domain)
func (h *AccountHandler) Update(c echo.Context) error {
	userID := mw.GetUserID(c)
	accountID, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	// Verify user is owner or admin of the account
	var memberRole string
	err = h.db.Get(&memberRole, `
		SELECT role FROM app_account_members
		WHERE account_id = $1 AND user_id = $2
	`, accountID, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Account not found")
		}
		return response.InternalError(c, "Failed to verify membership")
	}

	if memberRole != "owner" && memberRole != "admin" {
		return response.Forbidden(c, "Only account owners and admins can update account settings")
	}

	var req models.UpdateAccountRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Build dynamic update
	setClauses := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argIdx := 1

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.LogoURL != nil {
		setClauses = append(setClauses, fmt.Sprintf("logo_url = $%d", argIdx))
		args = append(args, *req.LogoURL)
		argIdx++
	}
	if req.Domain != nil {
		setClauses = append(setClauses, fmt.Sprintf("domain = $%d", argIdx))
		args = append(args, *req.Domain)
		argIdx++
	}

	args = append(args, accountID)
	query := fmt.Sprintf("UPDATE app_accounts SET %s WHERE id = $%d",
		joinStrings(setClauses, ", "), argIdx)

	_, err = h.db.Exec(query, args...)
	if err != nil {
		return response.InternalError(c, "Failed to update account")
	}

	var account models.Account
	if err := h.db.Get(&account, "SELECT * FROM app_accounts WHERE id = $1", accountID); err != nil {
		return response.InternalError(c, "Failed to fetch updated account")
	}

	return response.Success(c, account)
}

// Switch switches the user's active account and returns new tokens
func (h *AccountHandler) Switch(c echo.Context) error {
	userID := mw.GetUserID(c)

	var req models.SwitchAccountRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.AccountID == 0 {
		return response.BadRequest(c, "Account ID is required")
	}

	// Verify user is a member of the target account
	var memberExists bool
	err := h.db.Get(&memberExists, `
		SELECT EXISTS(
			SELECT 1 FROM app_account_members
			WHERE account_id = $1 AND user_id = $2
		)
	`, req.AccountID, userID)
	if err != nil || !memberExists {
		return response.Forbidden(c, "You are not a member of this account")
	}

	// Update current_account_id
	_, err = h.db.Exec(
		`UPDATE app_users SET current_account_id = $1, updated_at = NOW() WHERE id = $2`,
		req.AccountID, userID,
	)
	if err != nil {
		return response.InternalError(c, "Failed to switch account")
	}

	// Re-fetch user
	var user models.User
	if err := h.db.Get(&user, "SELECT * FROM app_users WHERE id = $1", userID); err != nil {
		return response.InternalError(c, "Failed to fetch user")
	}

	// Load account
	var account models.Account
	if err := h.db.Get(&account, "SELECT * FROM app_accounts WHERE id = $1", req.AccountID); err != nil {
		return response.InternalError(c, "Failed to fetch account")
	}

	// Generate new tokens
	accessToken, err := h.generateToken(user, "access", time.Duration(h.cfg.JWTExpiry)*time.Hour)
	if err != nil {
		return response.InternalError(c, "Failed to generate access token")
	}

	refreshToken, err := h.generateToken(user, "refresh", time.Duration(h.cfg.RefreshExpiry)*time.Hour)
	if err != nil {
		return response.InternalError(c, "Failed to generate refresh token")
	}

	return response.Success(c, models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
		Account:      &account,
	})
}

// Delete deletes an account (only the owner can delete)
func (h *AccountHandler) Delete(c echo.Context) error {
	userID := mw.GetUserID(c)
	accountID, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	// Verify user is owner of the account
	var memberRole string
	err = h.db.Get(&memberRole, `
		SELECT role FROM app_account_members
		WHERE account_id = $1 AND user_id = $2
	`, accountID, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "Account not found")
		}
		return response.InternalError(c, "Failed to verify membership")
	}

	if memberRole != "owner" {
		return response.Forbidden(c, "Only the account owner can delete the account")
	}

	tx, err := h.db.Beginx()
	if err != nil {
		return response.InternalError(c, "Failed to start transaction")
	}
	defer tx.Rollback()

	// Clear current_account_id for any users pointing to this account
	_, err = tx.Exec(
		`UPDATE app_users SET current_account_id = NULL WHERE current_account_id = $1`,
		accountID,
	)
	if err != nil {
		return response.InternalError(c, "Failed to clear user references")
	}

	// Delete account (cascade will remove members)
	result, err := tx.Exec(`DELETE FROM app_accounts WHERE id = $1`, accountID)
	if err != nil {
		return response.InternalError(c, "Failed to delete account")
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Account not found")
	}

	// Set current_account_id to another account the user belongs to (if any)
	var nextAccountID *int
	err = tx.Get(&nextAccountID, `
		SELECT account_id FROM app_account_members
		WHERE user_id = $1 LIMIT 1
	`, userID)
	if err == nil && nextAccountID != nil {
		tx.Exec(`UPDATE app_users SET current_account_id = $1 WHERE id = $2`, *nextAccountID, userID)
	}

	if err := tx.Commit(); err != nil {
		return response.InternalError(c, "Failed to commit transaction")
	}

	return response.Success(c, map[string]interface{}{
		"message":         "Account deleted successfully",
		"next_account_id": nextAccountID,
	})
}

func (h *AccountHandler) generateToken(user models.User, tokenType string, expiry time.Duration) (string, error) {
	accountID := 0
	if user.CurrentAccountID != nil {
		accountID = *user.CurrentAccountID
	}

	claims := mw.JWTClaims{
		UserID:    user.ID,
		Email:     user.Email,
		Role:      user.Role,
		AccountID: accountID,
		Type:      tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.cfg.JWTSecret))
}
