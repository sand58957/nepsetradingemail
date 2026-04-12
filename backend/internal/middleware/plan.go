package middleware

import (
	"encoding/json"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// PlanLimits represents the limits for a specific plan
type PlanLimits struct {
	MaxSubscribers int      `json:"max_subscribers"`
	MonthlyEmails  int      `json:"monthly_emails"`
	UserSeats      int      `json:"user_seats"`
	Features       []string `json:"features"`
}

// RequirePlanFeature checks if the account's plan includes the required feature channel
func RequirePlanFeature(db *sqlx.DB, feature string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			accountID := GetAccountID(c)
			if accountID == 0 {
				return response.Unauthorized(c, "No account context")
			}

			// Get the account's plan
			var plan string
			err := db.Get(&plan, "SELECT plan FROM app_accounts WHERE id = $1", accountID)
			if err != nil {
				return response.InternalError(c, "Failed to check account plan")
			}

			// Get plan limits from settings
			var limitsJSON json.RawMessage
			err = db.Get(&limitsJSON, "SELECT value FROM app_account_settings WHERE key = 'plan_limits'")
			if err != nil {
				// If no limits configured, allow access
				return next(c)
			}

			var allLimits map[string]PlanLimits
			if err := json.Unmarshal(limitsJSON, &allLimits); err != nil {
				return next(c)
			}

			limits, exists := allLimits[plan]
			if !exists {
				// Unknown plan - allow for Free as default
				limits = allLimits["Free"]
			}

			// Check if the feature is allowed in this plan
			featureAllowed := false
			for _, f := range limits.Features {
				if f == feature {
					featureAllowed = true
					break
				}
			}

			if !featureAllowed {
				return response.Forbidden(c, "Your current plan ("+plan+") does not include "+feature+" marketing. Please upgrade your plan.")
			}

			// Store plan limits in context for downstream use
			c.Set("plan", plan)
			c.Set("plan_limits", limits)

			return next(c)
		}
	}
}

// CheckSubscriberLimit validates subscriber count against plan limit
func CheckSubscriberLimit(db *sqlx.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			accountID := GetAccountID(c)
			if accountID == 0 {
				return next(c)
			}

			var plan string
			err := db.Get(&plan, "SELECT plan FROM app_accounts WHERE id = $1", accountID)
			if err != nil {
				return next(c)
			}

			var limitsJSON json.RawMessage
			err = db.Get(&limitsJSON, "SELECT value FROM app_account_settings WHERE key = 'plan_limits'")
			if err != nil {
				return next(c)
			}

			var allLimits map[string]PlanLimits
			if err := json.Unmarshal(limitsJSON, &allLimits); err != nil {
				return next(c)
			}

			limits, exists := allLimits[plan]
			if !exists {
				limits = allLimits["Free"]
			}

			// -1 means unlimited
			if limits.MaxSubscribers == -1 {
				return next(c)
			}

			// Check current subscriber count
			var subscriberCount int
			db.Get(&subscriberCount, "SELECT COUNT(*) FROM subscribers WHERE account_id = $1", accountID)

			if subscriberCount >= limits.MaxSubscribers {
				return response.Forbidden(c, "You have reached the subscriber limit ("+
					string(rune(limits.MaxSubscribers))+") for your "+plan+" plan. Please upgrade to add more subscribers.")
			}

			return next(c)
		}
	}
}
