package handlers

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type DashboardHandler struct {
	lm *listmonk.Client
	db *sqlx.DB
}

func NewDashboardHandler(lm *listmonk.Client, db *sqlx.DB) *DashboardHandler {
	return &DashboardHandler{lm: lm, db: db}
}

type DashboardStats struct {
	TotalSubscribers  int             `json:"total_subscribers"`
	ActiveSubscribers int             `json:"active_subscribers"`
	TotalLists        int             `json:"total_lists"`
	TotalCampaigns    int             `json:"total_campaigns"`
	CampaignsSent     int             `json:"campaigns_sent"`
	OpenRate          float64         `json:"open_rate"`
	ClickRate         float64         `json:"click_rate"`
	RecentCampaigns   json.RawMessage `json:"recent_campaigns"`
	ListStats         json.RawMessage `json:"list_stats"`
	TotalDomains      int             `json:"total_domains"`
	VerifiedDomains   int             `json:"verified_domains"`
	SendingDomains    int             `json:"sending_domains"`
	SiteDomains       int             `json:"site_domains"`
}

func (h *DashboardHandler) GetStats(c echo.Context) error {
	var (
		stats DashboardStats
		mu    sync.Mutex
		wg    sync.WaitGroup
		errs  []string
	)

	userRole := middleware.GetUserRole(c)
	accountID := middleware.GetAccountID(c)

	// For admin role: show full global Listmonk stats (platform overview)
	// For user role: show fresh/clean per-account stats (no shared Listmonk data)
	if userRole == "admin" {
		// Fetch subscribers count
		wg.Add(1)
		go func() {
			defer wg.Done()
			data, statusCode, err := h.lm.Get("/subscribers", map[string]string{"page": "1", "per_page": "1"})
			if err != nil || statusCode < 200 || statusCode >= 300 {
				mu.Lock()
				errs = append(errs, "Failed to fetch subscribers")
				mu.Unlock()
				return
			}

			var result struct {
				Data struct {
					Total   int             `json:"total"`
					Results json.RawMessage `json:"results"`
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &result); err == nil {
				mu.Lock()
				stats.TotalSubscribers = result.Data.Total
				mu.Unlock()
			}
		}()

		// Fetch active subscribers
		wg.Add(1)
		go func() {
			defer wg.Done()
			data, statusCode, err := h.lm.Get("/subscribers", map[string]string{
				"page":     "1",
				"per_page": "1",
				"query":    "subscribers.status = 'enabled'",
			})
			if err != nil || statusCode < 200 || statusCode >= 300 {
				return
			}

			var result struct {
				Data struct {
					Total int `json:"total"`
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &result); err == nil {
				mu.Lock()
				stats.ActiveSubscribers = result.Data.Total
				mu.Unlock()
			}
		}()

		// Fetch lists
		wg.Add(1)
		go func() {
			defer wg.Done()
			data, statusCode, err := h.lm.Get("/lists", map[string]string{"page": "1", "per_page": "1"})
			if err != nil || statusCode < 200 || statusCode >= 300 {
				mu.Lock()
				errs = append(errs, "Failed to fetch lists")
				mu.Unlock()
				return
			}

			var result struct {
				Data struct {
					Total   int             `json:"total"`
					Results json.RawMessage `json:"results"`
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &result); err == nil {
				mu.Lock()
				stats.TotalLists = result.Data.Total
				stats.ListStats = result.Data.Results
				mu.Unlock()
			}

			// Also fetch full list stats
			listData, listStatus, listErr := h.lm.Get("/lists", map[string]string{"page": "1", "per_page": "100"})
			if listErr == nil && listStatus >= 200 && listStatus < 300 {
				var listResult struct {
					Data struct {
						Results json.RawMessage `json:"results"`
					} `json:"data"`
				}
				if err := json.Unmarshal(listData, &listResult); err == nil {
					mu.Lock()
					stats.ListStats = listResult.Data.Results
					mu.Unlock()
				}
			}
		}()

		// Fetch campaigns
		wg.Add(1)
		go func() {
			defer wg.Done()
			data, statusCode, err := h.lm.Get("/campaigns", map[string]string{"page": "1", "per_page": "5", "order_by": "created_at", "order": "DESC"})
			if err != nil || statusCode < 200 || statusCode >= 300 {
				mu.Lock()
				errs = append(errs, "Failed to fetch campaigns")
				mu.Unlock()
				return
			}

			var result struct {
				Data struct {
					Total   int             `json:"total"`
					Results json.RawMessage `json:"results"`
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &result); err == nil {
				mu.Lock()
				stats.TotalCampaigns = result.Data.Total
				stats.RecentCampaigns = result.Data.Results
				mu.Unlock()
			}
		}()

		// Fetch campaign stats for open/click rates
		wg.Add(1)
		go func() {
			defer wg.Done()
			data, statusCode, err := h.lm.Get("/campaigns", map[string]string{
				"page":     "1",
				"per_page": "100",
				"status":   "finished",
			})
			if err != nil || statusCode < 200 || statusCode >= 300 {
				return
			}

			var result struct {
				Data struct {
					Total   int `json:"total"`
					Results []struct {
						Views  int    `json:"views"`
						Clicks int    `json:"clicks"`
						Sent   int    `json:"sent"`
						ToSend int    `json:"to_send"`
						Status string `json:"status"`
					} `json:"results"`
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &result); err == nil {
				mu.Lock()
				stats.CampaignsSent = result.Data.Total
				totalSent := 0
				totalViews := 0
				totalClicks := 0
				for _, c := range result.Data.Results {
					totalSent += c.Sent
					totalViews += c.Views
					totalClicks += c.Clicks
				}
				if totalSent > 0 {
					stats.OpenRate = float64(totalViews) / float64(totalSent) * 100
					stats.ClickRate = float64(totalClicks) / float64(totalSent) * 100
				}
				mu.Unlock()
			}
		}()
	}
	// For non-admin users: stats stay at zero defaults (fresh/clean dashboard)
	// They only see their own account-scoped domain data below

	// Fetch account-scoped domain stats (for all roles with an account)
	if accountID > 0 && h.db != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			var domainStats struct {
				Total    int `db:"total"`
				Verified int `db:"verified"`
				Sending  int `db:"sending"`
				Site     int `db:"site"`
			}
			err := h.db.Get(&domainStats, `
				SELECT
					COUNT(*) as total,
					COUNT(*) FILTER (WHERE status = 'verified') as verified,
					COUNT(*) FILTER (WHERE type = 'sending') as sending,
					COUNT(*) FILTER (WHERE type = 'site') as site
				FROM app_domains WHERE account_id = $1
			`, accountID)
			if err == nil {
				mu.Lock()
				stats.TotalDomains = domainStats.Total
				stats.VerifiedDomains = domainStats.Verified
				stats.SendingDomains = domainStats.Sending
				stats.SiteDomains = domainStats.Site
				mu.Unlock()
			}
		}()
	}

	wg.Wait()

	if len(errs) > 0 {
		log.Printf("Dashboard stats warnings: %v", errs)
	}

	return response.Success(c, stats)
}
