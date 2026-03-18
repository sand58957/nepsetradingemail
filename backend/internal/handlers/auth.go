package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"regexp"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/models"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/aakashsms"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/gupshup"
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

	// Load current account if set
	var account *models.Account
	if user.CurrentAccountID != nil {
		var acc models.Account
		if err := h.db.Get(&acc, "SELECT * FROM app_accounts WHERE id = $1", *user.CurrentAccountID); err == nil {
			account = &acc
		}
	}

	return response.Success(c, models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
		Account:      account,
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

	user, account, err := h.createUserWithAccount(req.Email, string(hashedPassword), req.Name, "email", nil, nil)
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
		Account:      &account,
	})
}

// createUserWithAccount creates a new user and a default account in a single transaction.
// It returns the user, account, and any error.
func (h *AuthHandler) createUserWithAccount(email, passwordHash, name, authProvider string, phone *string, googleID *string) (models.User, models.Account, error) {
	tx, err := h.db.Beginx()
	if err != nil {
		return models.User{}, models.Account{}, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	var user models.User
	err = tx.QueryRowx(
		`INSERT INTO app_users (email, password_hash, name, role, is_active, auth_provider, phone, google_id, created_at, updated_at)
		 VALUES ($1, $2, $3, 'user', true, $4, $5, $6, NOW(), NOW())
		 RETURNING *`,
		email, passwordHash, name, authProvider, phone, googleID,
	).StructScan(&user)
	if err != nil {
		return models.User{}, models.Account{}, fmt.Errorf("failed to create user: %w", err)
	}

	// Auto-create a default account for the new user
	accountName := name + "'s Account"
	if name == "" {
		accountName = email + "'s Account"
	}

	var account models.Account
	err = tx.QueryRowx(
		`INSERT INTO app_accounts (name, plan, created_at, updated_at)
		 VALUES ($1, 'Free', NOW(), NOW())
		 RETURNING *`,
		accountName,
	).StructScan(&account)
	if err != nil {
		return models.User{}, models.Account{}, fmt.Errorf("failed to create account: %w", err)
	}

	// Add user as owner of the account
	_, err = tx.Exec(
		`INSERT INTO app_account_members (account_id, user_id, role, created_at)
		 VALUES ($1, $2, 'owner', NOW())`,
		account.ID, user.ID,
	)
	if err != nil {
		return models.User{}, models.Account{}, fmt.Errorf("failed to add account member: %w", err)
	}

	// Set as current account
	_, err = tx.Exec(
		`UPDATE app_users SET current_account_id = $1, updated_at = NOW() WHERE id = $2`,
		account.ID, user.ID,
	)
	if err != nil {
		return models.User{}, models.Account{}, fmt.Errorf("failed to set current account: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return models.User{}, models.Account{}, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Re-fetch user to get updated current_account_id
	if err := h.db.Get(&user, "SELECT * FROM app_users WHERE id = $1", user.ID); err != nil {
		return models.User{}, models.Account{}, fmt.Errorf("failed to fetch updated user: %w", err)
	}

	return user, account, nil
}

// generateTokens generates access and refresh tokens for a user and returns an AuthResponse.
func (h *AuthHandler) generateTokens(user models.User) (*models.AuthResponse, error) {
	accessToken, err := h.generateToken(user, "access", time.Duration(h.cfg.JWTExpiry)*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := h.generateToken(user, "refresh", time.Duration(h.cfg.RefreshExpiry)*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Load current account if set
	var account *models.Account
	if user.CurrentAccountID != nil {
		var acc models.Account
		if err := h.db.Get(&acc, "SELECT * FROM app_accounts WHERE id = $1", *user.CurrentAccountID); err == nil {
			account = &acc
		}
	}

	return &models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
		Account:      account,
	}, nil
}

// nepalPhoneRegex validates Nepal phone numbers: 10 digits starting with 9
var nepalPhoneRegex = regexp.MustCompile(`^9\d{9}$`)

// generateOTPCode generates a cryptographically random 6-digit OTP code.
func generateOTPCode() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func (h *AuthHandler) SendOTP(c echo.Context) error {
	var req models.OTPSendRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Phone == "" {
		return response.BadRequest(c, "Phone number is required")
	}
	if req.Channel != "sms" && req.Channel != "whatsapp" {
		return response.BadRequest(c, "Channel must be sms or whatsapp")
	}

	// Validate Nepal phone number: 10 digits starting with 9
	if !nepalPhoneRegex.MatchString(req.Phone) {
		return response.BadRequest(c, "Invalid Nepal phone number. Must be 10 digits starting with 9")
	}

	// Check rate limit
	var rateLimitCount int
	err := h.db.Get(&rateLimitCount,
		`SELECT request_count FROM otp_rate_limits
		 WHERE phone = $1 AND window_start > NOW() - INTERVAL '10 minutes'`,
		req.Phone,
	)
	if err != nil && err != sql.ErrNoRows {
		return response.InternalError(c, "Failed to check rate limit")
	}
	if rateLimitCount >= 3 {
		return response.Error(c, http.StatusTooManyRequests, "Too many OTP requests. Please try again in 10 minutes")
	}

	// Upsert rate limit counter
	_, err = h.db.Exec(
		`INSERT INTO otp_rate_limits (phone, request_count, window_start)
		 VALUES ($1, 1, NOW())
		 ON CONFLICT (phone) DO UPDATE SET
		   request_count = CASE
		     WHEN otp_rate_limits.window_start > NOW() - INTERVAL '10 minutes'
		     THEN otp_rate_limits.request_count + 1
		     ELSE 1
		   END,
		   window_start = CASE
		     WHEN otp_rate_limits.window_start > NOW() - INTERVAL '10 minutes'
		     THEN otp_rate_limits.window_start
		     ELSE NOW()
		   END`,
		req.Phone,
	)
	if err != nil {
		return response.InternalError(c, "Failed to update rate limit")
	}

	// Generate 6-digit OTP code
	code, err := generateOTPCode()
	if err != nil {
		return response.InternalError(c, "Failed to generate OTP code")
	}

	// Delete previous unverified OTPs for this phone+channel
	_, err = h.db.Exec(
		`DELETE FROM otp_codes WHERE phone = $1 AND channel = $2 AND is_verified = false`,
		req.Phone, req.Channel,
	)
	if err != nil {
		return response.InternalError(c, "Failed to clean up old OTPs")
	}

	// Insert new OTP
	_, err = h.db.Exec(
		`INSERT INTO otp_codes (phone, channel, code, expires_at, is_verified, attempts, created_at)
		 VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes', false, 0, NOW())`,
		req.Phone, req.Channel, code,
	)
	if err != nil {
		return response.InternalError(c, "Failed to create OTP")
	}

	// Send OTP via the selected channel
	otpMessage := fmt.Sprintf("Your Nepal Fillings verification code is: %s. Valid for 5 minutes.", code)

	if req.Channel == "sms" {
		if h.cfg.AakashOTPToken == "" {
			return response.InternalError(c, "SMS OTP service is not configured")
		}
		smsClient := aakashsms.NewClient(h.cfg.AakashOTPToken)
		_, err = smsClient.SendSMS(req.Phone, otpMessage)
		if err != nil {
			return response.InternalError(c, "Failed to send OTP via SMS")
		}
	} else {
		// WhatsApp via Gupshup
		if h.cfg.GupshupOTPKey == "" {
			return response.InternalError(c, "WhatsApp OTP service is not configured")
		}
		waClient := gupshup.NewClient(h.cfg.GupshupOTPKey, h.cfg.GupshupOTPAppName, h.cfg.GupshupOTPSourcePhone)
		_, err = waClient.SendTextMessage(req.Phone, otpMessage)
		if err != nil {
			return response.InternalError(c, "Failed to send OTP via WhatsApp")
		}
	}

	return response.SuccessWithMessage(c, "OTP sent successfully", map[string]interface{}{
		"phone":   req.Phone,
		"channel": req.Channel,
	})
}

func (h *AuthHandler) VerifyOTP(c echo.Context) error {
	var req models.OTPVerifyRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Phone == "" || req.Code == "" || req.Channel == "" {
		return response.BadRequest(c, "Phone, code, and channel are required")
	}
	if len(req.Code) != 6 {
		return response.BadRequest(c, "OTP code must be 6 digits")
	}
	if req.Channel != "sms" && req.Channel != "whatsapp" {
		return response.BadRequest(c, "Channel must be sms or whatsapp")
	}

	// Query for a matching valid OTP
	var otpID int
	err := h.db.Get(&otpID,
		`SELECT id FROM otp_codes
		 WHERE phone = $1 AND channel = $2 AND code = $3
		   AND is_verified = false AND expires_at > NOW() AND attempts < 5`,
		req.Phone, req.Channel, req.Code,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			// Increment attempts on the most recent OTP for this phone+channel
			h.db.Exec(
				`UPDATE otp_codes SET attempts = attempts + 1
				 WHERE id = (
				   SELECT id FROM otp_codes
				   WHERE phone = $1 AND channel = $2 AND is_verified = false
				   ORDER BY created_at DESC LIMIT 1
				 )`,
				req.Phone, req.Channel,
			)
			return response.Unauthorized(c, "Invalid or expired OTP code")
		}
		return response.InternalError(c, "Failed to verify OTP")
	}

	// Mark OTP as verified
	_, err = h.db.Exec(`UPDATE otp_codes SET is_verified = true WHERE id = $1`, otpID)
	if err != nil {
		return response.InternalError(c, "Failed to mark OTP as verified")
	}

	// Look up user by phone
	var user models.User
	err = h.db.Get(&user, `SELECT * FROM app_users WHERE phone = $1 AND is_active = true`, req.Phone)
	if err != nil && err != sql.ErrNoRows {
		return response.InternalError(c, "Failed to query user")
	}

	if err == sql.ErrNoRows {
		// Create a new user with phone as identifier
		phone := req.Phone
		email := fmt.Sprintf("%s@phone.local", req.Phone)
		name := "User " + req.Phone[len(req.Phone)-4:]

		newUser, account, createErr := h.createUserWithAccount(email, "", name, "phone", &phone, nil)
		if createErr != nil {
			return response.InternalError(c, "Failed to create user")
		}

		authResp, err := h.generateTokens(newUser)
		if err != nil {
			return response.InternalError(c, "Failed to generate tokens")
		}
		authResp.Account = &account

		return response.Created(c, authResp)
	}

	// Existing user — generate tokens
	authResp, err := h.generateTokens(user)
	if err != nil {
		return response.InternalError(c, "Failed to generate tokens")
	}

	return response.Success(c, authResp)
}

func (h *AuthHandler) GoogleAuth(c echo.Context) error {
	var req models.GoogleAuthRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.IDToken == "" {
		return response.BadRequest(c, "ID token is required")
	}

	// Verify Google ID token via Google's tokeninfo endpoint
	tokenInfoURL := fmt.Sprintf("https://oauth2.googleapis.com/tokeninfo?id_token=%s", req.IDToken)
	httpResp, err := http.Get(tokenInfoURL)
	if err != nil {
		return response.InternalError(c, "Failed to verify Google token")
	}
	defer httpResp.Body.Close()

	body, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return response.InternalError(c, "Failed to read Google token response")
	}

	if httpResp.StatusCode != http.StatusOK {
		return response.Unauthorized(c, "Invalid Google ID token")
	}

	var tokenInfo struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified string `json:"email_verified"`
		Name          string `json:"name"`
		Aud           string `json:"aud"`
	}
	if err := json.Unmarshal(body, &tokenInfo); err != nil {
		return response.InternalError(c, "Failed to parse Google token info")
	}

	// Validate the audience matches our Google Client ID
	if h.cfg.GoogleClientID != "" && tokenInfo.Aud != h.cfg.GoogleClientID {
		return response.Unauthorized(c, "Google token audience mismatch")
	}

	if tokenInfo.Email == "" || tokenInfo.Sub == "" {
		return response.BadRequest(c, "Google token missing required fields")
	}

	// Look up user by google_id first
	var user models.User
	err = h.db.Get(&user, `SELECT * FROM app_users WHERE google_id = $1 AND is_active = true`, tokenInfo.Sub)
	if err != nil && err != sql.ErrNoRows {
		return response.InternalError(c, "Failed to query user")
	}

	if err == sql.ErrNoRows {
		// Try by email
		err = h.db.Get(&user, `SELECT * FROM app_users WHERE email = $1 AND is_active = true`, tokenInfo.Email)
		if err != nil && err != sql.ErrNoRows {
			return response.InternalError(c, "Failed to query user")
		}

		if err == sql.ErrNoRows {
			// Create new user
			googleID := tokenInfo.Sub
			newUser, account, createErr := h.createUserWithAccount(tokenInfo.Email, "", tokenInfo.Name, "google", nil, &googleID)
			if createErr != nil {
				return response.InternalError(c, "Failed to create user")
			}

			authResp, err := h.generateTokens(newUser)
			if err != nil {
				return response.InternalError(c, "Failed to generate tokens")
			}
			authResp.Account = &account

			return response.Created(c, authResp)
		}

		// Existing user found by email — update google_id
		_, err = h.db.Exec(
			`UPDATE app_users SET google_id = $1, auth_provider = 'google', updated_at = NOW() WHERE id = $2`,
			tokenInfo.Sub, user.ID,
		)
		if err != nil {
			return response.InternalError(c, "Failed to update user Google ID")
		}

		// Re-fetch user with updated google_id
		if err := h.db.Get(&user, "SELECT * FROM app_users WHERE id = $1", user.ID); err != nil {
			return response.InternalError(c, "Failed to fetch updated user")
		}
	}

	// Generate tokens for existing user
	authResp, err := h.generateTokens(user)
	if err != nil {
		return response.InternalError(c, "Failed to generate tokens")
	}

	return response.Success(c, authResp)
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

	// Load current account if set
	var account *models.Account
	if user.CurrentAccountID != nil {
		var acc models.Account
		if err := h.db.Get(&acc, "SELECT * FROM app_accounts WHERE id = $1", *user.CurrentAccountID); err == nil {
			account = &acc
		}
	}

	return response.Success(c, models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		User:         user,
		Account:      account,
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
		Name            string `json:"name"`
		Email           string `json:"email"`
		Password        string `json:"password,omitempty"`
		CurrentPassword string `json:"current_password,omitempty"`
	}
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Validate name
	if !validator.IsNotEmpty(req.Name) {
		return response.BadRequest(c, "Name is required")
	}
	if !validator.MaxLength(req.Name, 200) {
		return response.BadRequest(c, "Name must be at most 200 characters")
	}

	// Validate email format
	if !validator.IsValidEmail(req.Email) {
		return response.BadRequest(c, "A valid email address is required")
	}

	// Fetch current user for email uniqueness check and password verification
	var currentUser models.User
	if err := h.db.Get(&currentUser, "SELECT id, email, password_hash FROM app_users WHERE id = $1", userID); err != nil {
		return response.InternalError(c, "Failed to query user")
	}

	// Check email uniqueness if changed
	if req.Email != currentUser.Email {
		var count int
		if err := h.db.Get(&count, "SELECT COUNT(*) FROM app_users WHERE email = $1 AND id != $2", req.Email, userID); err != nil {
			return response.InternalError(c, "Failed to check email uniqueness")
		}
		if count > 0 {
			return response.BadRequest(c, "Email address is already in use")
		}
	}

	if req.Password != "" {
		// Require current password for password changes
		if req.CurrentPassword == "" {
			return response.BadRequest(c, "Current password is required to change password")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(currentUser.PasswordHash), []byte(req.CurrentPassword)); err != nil {
			return response.BadRequest(c, "Current password is incorrect")
		}
		if !validator.MinLength(req.Password, 8) {
			return response.BadRequest(c, "New password must be at least 8 characters")
		}
		if !validator.MaxLength(req.Password, 72) {
			return response.BadRequest(c, "New password must be at most 72 characters")
		}

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

	rawKey, err := generateRandomKey(32)
	if err != nil {
		return response.InternalError(c, "Failed to generate API key")
	}
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
	keyID, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

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

func generateRandomKey(length int) (string, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random key: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// ============================================================
// User Management (Admin only)
// ============================================================

func isValidRole(role string) bool {
	return role == "admin" || role == "user" || role == "subscriber"
}

func (h *AuthHandler) ListUsers(c echo.Context) error {
	roleFilter := c.QueryParam("role")
	query := c.QueryParam("query")

	var users []models.User
	var err error

	baseQuery := "SELECT id, email, name, role, is_active, preferences, created_at, updated_at FROM app_users"
	var conditions []string
	var args []interface{}
	argIdx := 1

	if roleFilter != "" && isValidRole(roleFilter) {
		conditions = append(conditions, fmt.Sprintf("role = $%d", argIdx))
		args = append(args, roleFilter)
		argIdx++
	}

	if query != "" {
		conditions = append(conditions, fmt.Sprintf("(name ILIKE $%d OR email ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+query+"%")
		argIdx++
	}

	if len(conditions) > 0 {
		baseQuery += " WHERE "
		for i, cond := range conditions {
			if i > 0 {
				baseQuery += " AND "
			}
			baseQuery += cond
		}
	}

	baseQuery += " ORDER BY created_at DESC"

	err = h.db.Select(&users, baseQuery, args...)
	if err != nil {
		return response.InternalError(c, "Failed to list users")
	}

	if users == nil {
		users = []models.User{}
	}

	return response.Success(c, users)
}

func (h *AuthHandler) GetUser(c echo.Context) error {
	userID, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	var user models.User
	err = h.db.Get(&user, "SELECT id, email, name, role, is_active, preferences, created_at, updated_at FROM app_users WHERE id = $1", userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return response.NotFound(c, "User not found")
		}
		return response.InternalError(c, "Failed to query user")
	}

	return response.Success(c, user)
}

func (h *AuthHandler) CreateUser(c echo.Context) error {
	var req models.CreateUserRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Email == "" || req.Password == "" || req.Name == "" {
		return response.BadRequest(c, "Email, password, and name are required")
	}

	if !validator.MinLength(req.Password, 8) {
		return response.BadRequest(c, "Password must be at least 8 characters")
	}
	if !validator.MaxLength(req.Password, 72) {
		return response.BadRequest(c, "Password must be at most 72 characters")
	}

	if !isValidRole(req.Role) {
		return response.BadRequest(c, "Role must be admin, user, or subscriber")
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
		 VALUES ($1, $2, $3, $4, true, NOW(), NOW())
		 RETURNING id, email, name, role, is_active, preferences, created_at, updated_at`,
		req.Email, string(hashedPassword), req.Name, req.Role,
	).StructScan(&user)
	if err != nil {
		return response.InternalError(c, "Failed to create user")
	}

	return response.Created(c, user)
}

func (h *AuthHandler) UpdateUser(c echo.Context) error {
	userID, err := validateParamID(c, "id")
	if err != nil {
		return err
	}
	currentUserID := mw.GetUserID(c)

	var req models.UpdateUserRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Prevent admin from deactivating themselves
	if req.IsActive != nil && !*req.IsActive && fmt.Sprintf("%d", currentUserID) == userID {
		return response.BadRequest(c, "You cannot deactivate your own account")
	}

	// Build dynamic update query
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.Name != "" {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, req.Name)
		argIdx++
	}

	if req.Email != "" {
		setClauses = append(setClauses, fmt.Sprintf("email = $%d", argIdx))
		args = append(args, req.Email)
		argIdx++
	}

	if req.IsActive != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *req.IsActive)
		argIdx++
	}

	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return response.InternalError(c, "Failed to hash password")
		}
		setClauses = append(setClauses, fmt.Sprintf("password_hash = $%d", argIdx))
		args = append(args, string(hashedPassword))
		argIdx++
	}

	if len(setClauses) == 0 {
		return response.BadRequest(c, "No fields to update")
	}

	setClauses = append(setClauses, "updated_at = NOW()")
	args = append(args, userID)

	query := fmt.Sprintf("UPDATE app_users SET %s WHERE id = $%d",
		joinStrings(setClauses, ", "), argIdx)

	result, err := h.db.Exec(query, args...)
	if err != nil {
		return response.InternalError(c, "Failed to update user")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return response.NotFound(c, "User not found")
	}

	var user models.User
	err = h.db.Get(&user, "SELECT id, email, name, role, is_active, preferences, created_at, updated_at FROM app_users WHERE id = $1", userID)
	if err != nil {
		return response.InternalError(c, "Failed to query updated user")
	}

	return response.Success(c, user)
}

func (h *AuthHandler) DeleteUser(c echo.Context) error {
	userID, err := validateParamID(c, "id")
	if err != nil {
		return err
	}
	currentUserID := mw.GetUserID(c)

	// Prevent self-deletion
	if fmt.Sprintf("%d", currentUserID) == userID {
		return response.BadRequest(c, "Cannot delete your own account")
	}

	result, err := h.db.Exec("DELETE FROM app_users WHERE id = $1", userID)
	if err != nil {
		return response.InternalError(c, "Failed to delete user")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return response.NotFound(c, "User not found")
	}

	return response.SuccessWithMessage(c, "User deleted", nil)
}

func (h *AuthHandler) UpdateUserRole(c echo.Context) error {
	userID, err := validateParamID(c, "id")
	if err != nil {
		return err
	}
	currentUserID := mw.GetUserID(c)

	// Prevent changing own role
	if fmt.Sprintf("%d", currentUserID) == userID {
		return response.BadRequest(c, "Cannot change your own role")
	}

	var req models.UpdateRoleRequest
	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if !isValidRole(req.Role) {
		return response.BadRequest(c, "Role must be admin, user, or subscriber")
	}

	result, err := h.db.Exec("UPDATE app_users SET role = $1, updated_at = NOW() WHERE id = $2", req.Role, userID)
	if err != nil {
		return response.InternalError(c, "Failed to update user role")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return response.NotFound(c, "User not found")
	}

	var user models.User
	err = h.db.Get(&user, "SELECT id, email, name, role, is_active, preferences, created_at, updated_at FROM app_users WHERE id = $1", userID)
	if err != nil {
		return response.InternalError(c, "Failed to query updated user")
	}

	return response.Success(c, user)
}

func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
