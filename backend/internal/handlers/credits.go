package handlers

import (
	"fmt"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	mw "github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// CreditHandler manages API credits for channels.
type CreditHandler struct {
	db *sqlx.DB
}

func NewCreditHandler(db *sqlx.DB) *CreditHandler {
	return &CreditHandler{db: db}
}

type CreditBalance struct {
	ID        int       `json:"id" db:"id"`
	AccountID int       `json:"account_id" db:"account_id"`
	Channel   string    `json:"channel" db:"channel"`
	Balance   float64   `json:"balance" db:"balance"`
	Reserved  float64   `json:"reserved" db:"reserved"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreditTransaction struct {
	ID           int       `json:"id" db:"id"`
	AccountID    int       `json:"account_id" db:"account_id"`
	Channel      string    `json:"channel" db:"channel"`
	Type         string    `json:"type" db:"type"`
	Amount       float64   `json:"amount" db:"amount"`
	BalanceAfter float64   `json:"balance_after" db:"balance_after"`
	MessageID    *int      `json:"message_id" db:"message_id"`
	Description  *string   `json:"description" db:"description"`
	AdminUserID  *int      `json:"admin_user_id" db:"admin_user_id"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// ============================================================
// User-facing: View own credits
// ============================================================

// GetMyCredits returns credit balances for the current account.
func (h *CreditHandler) GetMyCredits(c echo.Context) error {
	accountID := mw.GetAccountID(c)

	var credits []CreditBalance
	h.db.Select(&credits, "SELECT * FROM api_credits WHERE account_id = $1 ORDER BY channel", accountID)

	if credits == nil {
		credits = []CreditBalance{}
	}

	return response.Success(c, credits)
}

// GetMyTransactions returns credit transaction history for the current account.
func (h *CreditHandler) GetMyTransactions(c echo.Context) error {
	accountID := mw.GetAccountID(c)
	channel := c.QueryParam("channel")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage := 25
	offset := (page - 1) * perPage

	var total int
	var txns []CreditTransaction

	if channel != "" {
		h.db.Get(&total, "SELECT COUNT(*) FROM api_credit_transactions WHERE account_id = $1 AND channel = $2", accountID, channel)
		h.db.Select(&txns, "SELECT * FROM api_credit_transactions WHERE account_id = $1 AND channel = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4", accountID, channel, perPage, offset)
	} else {
		h.db.Get(&total, "SELECT COUNT(*) FROM api_credit_transactions WHERE account_id = $1", accountID)
		h.db.Select(&txns, "SELECT * FROM api_credit_transactions WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3", accountID, perPage, offset)
	}

	if txns == nil {
		txns = []CreditTransaction{}
	}

	return response.Paginated(c, txns, total, page, perPage)
}

// ============================================================
// Admin: Manage credits for any account
// ============================================================

// AdminListCredits returns credit balances for all accounts.
func (h *CreditHandler) AdminListCredits(c echo.Context) error {
	var results []struct {
		AccountID   int     `json:"account_id" db:"account_id"`
		AccountName string  `json:"account_name" db:"account_name"`
		Channel     string  `json:"channel" db:"channel"`
		Balance     float64 `json:"balance" db:"balance"`
		Reserved    float64 `json:"reserved" db:"reserved"`
	}

	h.db.Select(&results, `
		SELECT ac.account_id, a.name as account_name, ac.channel, ac.balance, ac.reserved
		FROM api_credits ac
		JOIN app_accounts a ON a.id = ac.account_id
		ORDER BY a.name, ac.channel
	`)

	if results == nil {
		results = make([]struct {
			AccountID   int     `json:"account_id" db:"account_id"`
			AccountName string  `json:"account_name" db:"account_name"`
			Channel     string  `json:"channel" db:"channel"`
			Balance     float64 `json:"balance" db:"balance"`
			Reserved    float64 `json:"reserved" db:"reserved"`
		}, 0)
	}

	return response.Success(c, results)
}

// AdminGetAccountCredits returns credit balances for a specific account.
func (h *CreditHandler) AdminGetAccountCredits(c echo.Context) error {
	accountID, _ := strconv.Atoi(c.Param("account_id"))

	var credits []CreditBalance
	h.db.Select(&credits, "SELECT * FROM api_credits WHERE account_id = $1 ORDER BY channel", accountID)

	if credits == nil {
		credits = []CreditBalance{}
	}

	// Get account info
	var accountName string
	h.db.Get(&accountName, "SELECT name FROM app_accounts WHERE id = $1", accountID)

	return response.Success(c, map[string]interface{}{
		"account_id":   accountID,
		"account_name": accountName,
		"credits":      credits,
	})
}

// AdminAdjustCredits adds or deducts credits for an account's channel.
func (h *CreditHandler) AdminAdjustCredits(c echo.Context) error {
	accountID, _ := strconv.Atoi(c.Param("account_id"))
	adminUserID := mw.GetUserID(c)

	var req struct {
		Channel     string  `json:"channel"`
		Amount      float64 `json:"amount"`
		Description string  `json:"description"`
	}

	if err := c.Bind(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Channel != "sms" && req.Channel != "whatsapp" && req.Channel != "email" && req.Channel != "telegram" && req.Channel != "messenger" {
		return response.BadRequest(c, "Channel must be one of: sms, whatsapp, email, telegram, messenger")
	}

	if req.Amount == 0 {
		return response.BadRequest(c, "Amount cannot be zero")
	}

	if req.Description == "" {
		return response.BadRequest(c, "Description is required for audit trail")
	}

	// Ensure credit row exists
	h.db.Exec(`
		INSERT INTO api_credits (account_id, channel, balance, reserved)
		VALUES ($1, $2, 0, 0)
		ON CONFLICT (account_id, channel) DO NOTHING
	`, accountID, req.Channel)

	// Check if deduction would make balance negative
	if req.Amount < 0 {
		var currentBalance float64
		h.db.Get(&currentBalance, "SELECT balance FROM api_credits WHERE account_id = $1 AND channel = $2", accountID, req.Channel)
		if currentBalance+req.Amount < 0 {
			return response.BadRequest(c, fmt.Sprintf("Insufficient balance. Current: %.2f, Trying to deduct: %.2f", currentBalance, -req.Amount))
		}
	}

	// Update balance atomically
	var newBalance float64
	err := h.db.QueryRow(`
		UPDATE api_credits SET balance = balance + $3, updated_at = NOW()
		WHERE account_id = $1 AND channel = $2
		RETURNING balance
	`, accountID, req.Channel, req.Amount).Scan(&newBalance)

	if err != nil {
		return response.InternalError(c, "Failed to adjust credits")
	}

	// Log the transaction
	txType := "admin_adjust"
	if req.Amount > 0 {
		txType = "purchase"
	}

	h.db.Exec(`
		INSERT INTO api_credit_transactions (account_id, channel, type, amount, balance_after, description, admin_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, accountID, req.Channel, txType, req.Amount, newBalance, req.Description, adminUserID)

	return response.Success(c, map[string]interface{}{
		"account_id":  accountID,
		"channel":     req.Channel,
		"amount":      req.Amount,
		"new_balance": newBalance,
		"description": req.Description,
	})
}

// AdminListTransactions returns all credit transactions across all accounts.
func (h *CreditHandler) AdminListTransactions(c echo.Context) error {
	channel := c.QueryParam("channel")
	accountIDStr := c.QueryParam("account_id")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage := 50
	offset := (page - 1) * perPage

	query := "SELECT * FROM api_credit_transactions WHERE 1=1"
	countQuery := "SELECT COUNT(*) FROM api_credit_transactions WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if channel != "" {
		query += fmt.Sprintf(" AND channel = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND channel = $%d", argIdx)
		args = append(args, channel)
		argIdx++
	}

	if accountIDStr != "" {
		accID, _ := strconv.Atoi(accountIDStr)
		query += fmt.Sprintf(" AND account_id = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND account_id = $%d", argIdx)
		args = append(args, accID)
		argIdx++
	}

	var total int
	h.db.Get(&total, countQuery, args...)

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, perPage, offset)

	var txns []CreditTransaction
	h.db.Select(&txns, query, args...)

	if txns == nil {
		txns = []CreditTransaction{}
	}

	return response.Paginated(c, txns, total, page, perPage)
}

// AdminToggleAPI enables or disables API access for an account.
func (h *CreditHandler) AdminToggleAPI(c echo.Context) error {
	accountID, _ := strconv.Atoi(c.Param("account_id"))

	result, err := h.db.Exec("UPDATE app_accounts SET api_enabled = NOT api_enabled WHERE id = $1", accountID)
	if err != nil {
		return response.InternalError(c, "Failed to toggle API access")
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return response.NotFound(c, "Account not found")
	}

	var enabled bool
	h.db.Get(&enabled, "SELECT api_enabled FROM app_accounts WHERE id = $1", accountID)

	return response.Success(c, map[string]interface{}{
		"account_id":  accountID,
		"api_enabled": enabled,
	})
}

// AdminListAPIMessages returns API messages across all accounts.
func (h *CreditHandler) AdminListAPIMessages(c echo.Context) error {
	channel := c.QueryParam("channel")
	accountIDStr := c.QueryParam("account_id")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage := 50
	offset := (page - 1) * perPage

	query := `SELECT m.*, a.name as account_name FROM api_messages m
		JOIN app_accounts a ON a.id = m.account_id WHERE 1=1`
	countQuery := "SELECT COUNT(*) FROM api_messages WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if channel != "" {
		query += fmt.Sprintf(" AND m.channel = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND channel = $%d", argIdx)
		args = append(args, channel)
		argIdx++
	}

	if accountIDStr != "" {
		accID, _ := strconv.Atoi(accountIDStr)
		query += fmt.Sprintf(" AND m.account_id = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND account_id = $%d", argIdx)
		args = append(args, accID)
		argIdx++
	}

	var total int
	h.db.Get(&total, countQuery, args...)

	query += fmt.Sprintf(" ORDER BY m.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, perPage, offset)

	var messages []map[string]interface{}
	rows, err := h.db.Queryx(query, args...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			row := make(map[string]interface{})
			rows.MapScan(row)
			messages = append(messages, row)
		}
	}

	if messages == nil {
		messages = []map[string]interface{}{}
	}

	return response.Paginated(c, messages, total, page, perPage)
}

// ============================================================
// Helpers: Credit reservation for public API handlers
// ============================================================

// ReserveCredit atomically deducts credits. Returns new balance or error.
func ReserveCredit(db *sqlx.DB, accountID int, channel string, amount float64) (float64, error) {
	var newBalance float64
	err := db.QueryRow(`
		UPDATE api_credits SET balance = balance - $3, reserved = reserved + $3, updated_at = NOW()
		WHERE account_id = $1 AND channel = $2 AND balance >= $3
		RETURNING balance
	`, accountID, channel, amount).Scan(&newBalance)

	if err != nil {
		return 0, fmt.Errorf("insufficient %s credits", channel)
	}

	return newBalance, nil
}

// ConfirmCredit removes the reserved amount after successful send.
func ConfirmCredit(db *sqlx.DB, accountID int, channel string, amount float64, messageID int) {
	db.Exec(`UPDATE api_credits SET reserved = reserved - $3, updated_at = NOW()
		WHERE account_id = $1 AND channel = $2`, accountID, channel, amount)

	// Get current balance for transaction log
	var balance float64
	db.Get(&balance, "SELECT balance FROM api_credits WHERE account_id = $1 AND channel = $2", accountID, channel)

	db.Exec(`INSERT INTO api_credit_transactions (account_id, channel, type, amount, balance_after, message_id)
		VALUES ($1, $2, 'deduct', $3, $4, $5)`, accountID, channel, -amount, balance, messageID)
}

// RefundCredit returns reserved credits on send failure.
func RefundCredit(db *sqlx.DB, accountID int, channel string, amount float64) {
	db.Exec(`UPDATE api_credits SET balance = balance + $3, reserved = reserved - $3, updated_at = NOW()
		WHERE account_id = $1 AND channel = $2`, accountID, channel, amount)
}

// GetCreditBalance returns the current balance for a channel. Returns 0 if not found.
func GetCreditBalance(db *sqlx.DB, accountID int, channel string) float64 {
	var balance float64
	db.Get(&balance, "SELECT COALESCE(balance, 0) FROM api_credits WHERE account_id = $1 AND channel = $2", accountID, channel)
	return balance
}

// ============================================================
// Helpers for public API: check channel settings
// ============================================================

func CheckSMSConfigured(db *sqlx.DB, accountID int) error {
	var count int
	db.Get(&count, "SELECT COUNT(*) FROM sms_settings WHERE account_id = $1 AND auth_token != ''", accountID)
	if count == 0 {
		return fmt.Errorf("SMS not configured. Set up Aakash SMS credentials in your dashboard first.")
	}
	return nil
}

func CheckWhatsAppConfigured(db *sqlx.DB, accountID int) error {
	var count int
	db.Get(&count, "SELECT COUNT(*) FROM wa_settings WHERE account_id = $1 AND gupshup_api_key != ''", accountID)
	if count == 0 {
		return fmt.Errorf("WhatsApp not configured. Set up Gupshup credentials in your dashboard first.")
	}
	return nil
}

func CheckEmailConfigured(db *sqlx.DB, accountID int) error {
	var count int
	db.Get(&count, "SELECT COUNT(*) FROM app_domains WHERE account_id = $1 AND type = 'sending' AND status = 'verified'", accountID)
	if count == 0 {
		return fmt.Errorf("Email not configured. Verify a sending domain in your dashboard first.")
	}
	return nil
}
