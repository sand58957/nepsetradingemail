package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/models"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
	"github.com/sandeep/nepsetradingemail/backend/pkg/validator"
)

type AuthHandler struct {
	db  *sqlx.DB
	cfg *config.Config
}

func NewAuthHandler(db *sqlx.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req models.LoginRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	errs := validator.ValidateLoginRequest(req.Email, req.Password)
	if errs.HasErrors() {
		return c.JSON(http.StatusBadRequest, errs)
	}

	var user models.User
	err := h.db.Get(&user, "SELECT * FROM app_users WHERE email = $1 AND is_active = true", req.Email)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.Unauthorized(c, "Invalid email or password")
		}
		return response.InternalError(c, "Failed to query user")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return response.Unauthorized(c, "Invalid email or password")
	}

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
	})
}

func (h *AuthHandler) Register(c echo.Context) error {
	var req models.RegisterRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	errs := validator.ValidateRegisterRequest(req.Email, req.Password, req.Name)
	if errs.HasErrors() {
		return c.JSON(http.StatusBadRequest, errs)
	}

	var exists bool
	err := h.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM app_users WHERE email = $1)", req.Email)
	if err != nil {
		return response.InternalError(c, "Failed to check existing user")
	}
	if exists {
		return response.BadRequest(c, "A user with this email already exists")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return response.InternalError(c, "Failed to hash password")
	}

	var user models.User
	err = h.db.QueryRowx(
		`INSERT INTO app_users (email, password_hash, name, role, is_active, created_at, updated_at)
		 VALUES ($1, $2, $3, 'admin', true, NOW(), NOW())
		 RETURNING id, email, password_hash, name, role, is_active, created_at, updated_at`,
		req.Email, string(hashedPassword), req.Name,
	).StructScan(&user)
	if err != nil {
		return response.InternalError(c, "Failed to create user")
	}

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
	})
}

func (h *AuthHandler) RefreshToken(c echo.Context) error {
	var req models.RefreshRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.RefreshToken == "" {
		return response.BadRequest(c, "Refresh token is required")
	}

	claims := &mw.JWTClaims{}
	token, err := jwt.ParseWithClaims(req.RefreshToken, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(h.cfg.JWTSecret), nil
	})

	if err != nil || !token.Valid {
		return response.Unauthorized(c, "Invalid or expired refresh token")
	}

	if claims.Type != "refresh" {
		return response.Unauthorized(c, "Invalid token type")
	}

	var user models.User
	err = h.db.Get(&user, "SELECT * FROM app_users WHERE id = $1 AND is_active = true", claims.UserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.Unauthorized(c, "User not found or inactive")
		}
		return response.InternalError(c, "Failed to query user")
	}

	accessToken, err := h.generateToken(user, "access", time.Duration(h.cfg.JWTExpiry)*time.Hour)
	if err != nil {
		return response.InternalError(c, "Failed to generate access token")
	}

	newRefreshToken, err := h.generateToken(user, "refresh", time.Duration(h.cfg.RefreshExpiry)*time.Hour)
	if err != nil {
		return response.InternalError(c, "Failed to generate refresh token")
	}

	return response.Success(c, models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		User:         user,
	})
}

func (h *AuthHandler) GetProfile(c echo.Context) error {
	userID := mw.GetUserID(c)

	var user models.User
	err := h.db.Get(&user, "SELECT * FROM app_users WHERE id = $1", userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "User not found")
		}
		return response.InternalError(c, "Failed to query user")
	}

	return response.Success(c, user)
}

func (h *AuthHandler) UpdateProfile(c echo.Context) error {
	userID := mw.GetUserID(c)

	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password,omitempty"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return response.InternalError(c, "Failed to hash password")
		}
		_, err = h.db.Exec(
			"UPDATE app_users SET name = $1, email = $2, password_hash = $3, updated_at = NOW() WHERE id = $4",
			req.Name, req.Email, string(hashedPassword), userID,
		)
		if err != nil {
			return response.InternalError(c, "Failed to update profile")
		}
	} else {
		_, err := h.db.Exec(
			"UPDATE app_users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3",
			req.Name, req.Email, userID,
		)
		if err != nil {
			return response.InternalError(c, "Failed to update profile")
		}
	}

	var user models.User
	err := h.db.Get(&user, "SELECT * FROM app_users WHERE id = $1", userID)
	if err != nil {
		return response.InternalError(c, "Failed to query updated user")
	}

	return response.Success(c, user)
}

func (h *AuthHandler) ListAPIKeys(c echo.Context) error {
	userID := mw.GetUserID(c)

	var keys []models.APIKey
	err := h.db.Select(&keys, "SELECT id, user_id, name, key_prefix, created_at FROM app_api_keys WHERE user_id = $1 ORDER BY created_at DESC", userID)
	if err != nil {
		return response.InternalError(c, "Failed to list API keys")
	}

	if keys == nil {
		keys = []models.APIKey{}
	}

	return response.Success(c, keys)
}

func (h *AuthHandler) CreateAPIKey(c echo.Context) error {
	userID := mw.GetUserID(c)

	var req struct {
		Name string `json:"name"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" {
		return response.BadRequest(c, "Name is required")
	}

	rawKey := generateRandomKey(32)
	prefix := rawKey[:8]

	hash, err := bcrypt.GenerateFromPassword([]byte(rawKey), bcrypt.DefaultCost)
	if err != nil {
		return response.InternalError(c, "Failed to hash API key")
	}

	var key models.APIKey
	err = h.db.QueryRowx(
		`INSERT INTO app_api_keys (user_id, name, key_hash, key_prefix, created_at)
		 VALUES ($1, $2, $3, $4, NOW())
		 RETURNING id, user_id, name, key_prefix, created_at`,
		userID, req.Name, string(hash), prefix,
	).StructScan(&key)
	if err != nil {
		return response.InternalError(c, "Failed to create API key")
	}

	return response.Created(c, map[string]interface{}{
		"key":    rawKey,
		"id":     key.ID,
		"name":   key.Name,
		"prefix": key.KeyPrefix,
	})
}

func (h *AuthHandler) DeleteAPIKey(c echo.Context) error {
	userID := mw.GetUserID(c)
	keyID := c.Param("id")

	result, err := h.db.Exec("DELETE FROM app_api_keys WHERE id = $1 AND user_id = $2", keyID, userID)
	if err != nil {
		return response.InternalError(c, "Failed to delete API key")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return response.NotFound(c, "API key not found")
	}

	return response.SuccessWithMessage(c, "API key deleted", nil)
}

func (h *AuthHandler) generateToken(user models.User, tokenType string, expiry time.Duration) (string, error) {
	claims := mw.JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		Type:   tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.cfg.JWTSecret))
}

func generateRandomKey(length int) string {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		panic("failed to generate random key: " + err.Error())
	}
	return hex.EncodeToString(b)
}
