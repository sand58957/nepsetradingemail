package models

import "time"

type Account struct {
	ID        int       `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	LogoURL   string    `json:"logo_url" db:"logo_url"`
	Plan      string    `json:"plan" db:"plan"`
	Domain    string    `json:"domain" db:"domain"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type AccountMember struct {
	ID        int       `json:"id" db:"id"`
	AccountID int       `json:"account_id" db:"account_id"`
	UserID    int       `json:"user_id" db:"user_id"`
	Role      string    `json:"role" db:"role"` // owner, admin, member
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// AccountWithRole combines account data with the user's role in that account
type AccountWithRole struct {
	Account
	MemberRole string `json:"member_role" db:"member_role"`
}

type CreateAccountRequest struct {
	Name string `json:"name"`
}

type UpdateAccountRequest struct {
	Name    *string `json:"name,omitempty"`
	LogoURL *string `json:"logo_url,omitempty"`
	Domain  *string `json:"domain,omitempty"`
}

type SwitchAccountRequest struct {
	AccountID int `json:"account_id"`
}
