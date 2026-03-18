package models

import (
	"encoding/json"
	"time"
)

type User struct {
	ID               int             `json:"id" db:"id"`
	Email            string          `json:"email" db:"email"`
	PasswordHash     string          `json:"-" db:"password_hash"`
	Name             string          `json:"name" db:"name"`
	Role             string          `json:"role" db:"role"`
	IsActive         bool            `json:"is_active" db:"is_active"`
	CurrentAccountID *int            `json:"current_account_id,omitempty" db:"current_account_id"`
	Preferences      json.RawMessage `json:"preferences,omitempty" db:"preferences"`
	Phone            *string         `json:"phone,omitempty" db:"phone"`
	GoogleID         *string         `json:"google_id,omitempty" db:"google_id"`
	AuthProvider     string          `json:"auth_provider" db:"auth_provider"`
	CreatedAt        time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at" db:"updated_at"`
}

type APIKey struct {
	ID        int       `json:"id" db:"id"`
	UserID    int       `json:"user_id" db:"user_id"`
	Name      string    `json:"name" db:"name"`
	KeyHash   string    `json:"-" db:"key_hash"`
	KeyPrefix string    `json:"key_prefix" db:"key_prefix"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type AuthResponse struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	User         User     `json:"user"`
	Account      *Account `json:"account,omitempty"`
}

type TokenClaims struct {
	UserID    int    `json:"user_id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	AccountID int    `json:"account_id,omitempty"`
	Type      string `json:"type"` // "access" or "refresh"
}

// Admin user management request types

type CreateUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
	Role     string `json:"role"` // "admin", "user", or "subscriber"
}

type UpdateUserRequest struct {
	Name     string `json:"name,omitempty"`
	Email    string `json:"email,omitempty"`
	IsActive *bool  `json:"is_active,omitempty"`
	Password string `json:"password,omitempty"`
}

type UpdateRoleRequest struct {
	Role string `json:"role"`
}

type OTPSendRequest struct {
	Phone   string `json:"phone" validate:"required"`
	Channel string `json:"channel" validate:"required,oneof=sms whatsapp"`
}

type OTPVerifyRequest struct {
	Phone   string `json:"phone" validate:"required"`
	Code    string `json:"code" validate:"required,len=6"`
	Channel string `json:"channel" validate:"required,oneof=sms whatsapp"`
}

type GoogleAuthRequest struct {
	IDToken string `json:"id_token" validate:"required"`
}

type PasswordResetRequest struct {
	Identifier string `json:"identifier" validate:"required"`
	Channel    string `json:"channel" validate:"required,oneof=email sms whatsapp"`
}

type PasswordResetVerify struct {
	Identifier  string `json:"identifier" validate:"required"`
	Channel     string `json:"channel" validate:"required,oneof=email sms whatsapp"`
	Code        string `json:"code" validate:"required,len=6"`
	NewPassword string `json:"new_password" validate:"required,min=5"`
}
