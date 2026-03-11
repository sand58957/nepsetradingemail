package handlers

import (
	"encoding/json"
	"sync"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type AnalyticsHandler struct {
	lm *listmonk.Client
}

func NewAnalyticsHandler(lm *listmonk.Client) *AnalyticsHandler {
	return &AnalyticsHandler{lm: lm}
}

type AnalyticsOverview struct {
	Subscribers  SubscriberAnalytics  `json:"subscribers"`
	Campaigns    CampaignAnalytics    `json:"campaigns"`
	Lists        ListAnalytics        `json:"lists"`
	Performance  PerformanceAnalytics `json:"performance"`
}

type SubscriberAnalytics struct {
	Total       int `json:"total"`
	Active      int `json:"active"`
	Blocklisted int `json:"blocklisted"`
	Unsubscribed int `json:"unsubscribed"`
}

type CampaignAnalytics struct {
	Total    int               `json:"total"`
	Sent     int               `json:"sent"`
	Running  int               `json:"running"`
	Draft    int               `json:"draft"`
	Details  json.RawMessage   `json:"details,omitempty"`
}

type ListAnalytics struct {
	Total   int             `json:"total"`
	Details json.RawMessage `json:"details,omitempty"`
}

type PerformanceAnalytics struct {
	TotalSent    int     `json:"total_sent"`
	TotalOpens   int     `json:"total_opens"`
	TotalClicks  int     `json:"total_clicks"`
	AvgOpenRate  float64 `json:"avg_open_rate"`
	AvgClickRate float64 `json:"avg_click_rate"`
	BounceRate   float64 `json:"bounce_rate"`
}

func (h *AnalyticsHandler) GetOverview(c echo.Context) error {
	// Non-admin users get a fresh/clean analytics view
	if !isAdmin(c) {
		return response.Success(c, AnalyticsOverview{})
	}

	var (
		analytics AnalyticsOverview
		mu        sync.Mutex
		wg        sync.WaitGroup
	)

	// Fetch subscriber analytics
	wg.Add(1)
	go func() {
		defer wg.Done()

		// Total subscribers
		data, status, err := h.lm.Get("/subscribers", map[string]string{"page": "1", "per_page": "1"})
		if err == nil && status >= 200 && status < 300 {
			var result struct {
				Data struct {
					Total int `json:"total"`
				} `json:"data"`
			}
			if json.Unmarshal(data, &result) == nil {
				mu.Lock()
				analytics.Subscribers.Total = result.Data.Total
				mu.Unlock()
			}
		}

		// Active subscribers
		data, status, err = h.lm.Get("/subscribers", map[string]string{
			"page": "1", "per_page": "1",
			"query": "subscribers.status = 'enabled'",
		})
		if err == nil && status >= 200 && status < 300 {
			var result struct {
				Data struct {
					Total int `json:"total"`
				} `json:"data"`
			}
			if json.Unmarshal(data, &result) == nil {
				mu.Lock()
				analytics.Subscribers.Active = result.Data.Total
				mu.Unlock()
			}
		}

		// Blocklisted subscribers
		data, status, err = h.lm.Get("/subscribers", map[string]string{
			"page": "1", "per_page": "1",
			"query": "subscribers.status = 'blocklisted'",
		})
		if err == nil && status >= 200 && status < 300 {
			var result struct {
				Data struct {
					Total int `json:"total"`
				} `json:"data"`
			}
			if json.Unmarshal(data, &result) == nil {
				mu.Lock()
				analytics.Subscribers.Blocklisted = result.Data.Total
				mu.Unlock()
			}
		}

		// Unsubscribed
		data, status, err = h.lm.Get("/subscribers", map[string]string{
			"page": "1", "per_page": "1",
			"query": "subscribers.status = 'unsubscribed'",
		})
		if err == nil && status >= 200 && status < 300 {
			var result struct {
				Data struct {
					Total int `json:"total"`
				} `json:"data"`
			}
			if json.Unmarshal(data, &result) == nil {
				mu.Lock()
				analytics.Subscribers.Unsubscribed = result.Data.Total
				mu.Unlock()
			}
		}
	}()

	// Fetch campaign analytics
	wg.Add(1)
	go func() {
		defer wg.Done()

		data, status, err := h.lm.Get("/campaigns", map[string]string{"page": "1", "per_page": "1"})
		if err == nil && status >= 200 && status < 300 {
			var result struct {
				Data struct {
					Total int `json:"total"`
				} `json:"data"`
			}
			if json.Unmarshal(data, &result) == nil {
				mu.Lock()
				analytics.Campaigns.Total = result.Data.Total
				mu.Unlock()
			}
		}

		// Sent campaigns
		data, status, err = h.lm.Get("/campaigns", map[string]string{
			"page": "1", "per_page": "1", "status": "finished",
		})
		if err == nil && status >= 200 && status < 300 {
			var result struct {
				Data struct {
					Total int `json:"total"`
				} `json:"data"`
			}
			if json.Unmarshal(data, &result) == nil {
				mu.Lock()
				analytics.Campaigns.Sent = result.Data.Total
				mu.Unlock()
			}
		}

		// Running campaigns
		data, status, err = h.lm.Get("/campaigns", map[string]string{
			"page": "1", "per_page": "1", "status": "running",
		})
		if err == nil && status >= 200 && status < 300 {
			var result struct {
				Data struct {
					Total int `json:"total"`
				} `json:"data"`
			}
			if json.Unmarshal(data, &result) == nil {
				mu.Lock()
				analytics.Campaigns.Running = result.Data.Total
				mu.Unlock()
			}
		}

		// Draft campaigns
		data, status, err = h.lm.Get("/campaigns", map[string]string{
			"page": "1", "per_page": "1", "status": "draft",
		})
		if err == nil && status >= 200 && status < 300 {
			var result struct {
				Data struct {
					Total int `json:"total"`
				} `json:"data"`
			}
			if json.Unmarshal(data, &result) == nil {
				mu.Lock()
				analytics.Campaigns.Draft = result.Data.Total
				mu.Unlock()
			}
		}
	}()

	// Fetch list analytics
	wg.Add(1)
	go func() {
		defer wg.Done()
		data, status, err := h.lm.Get("/lists", map[string]string{"page": "1", "per_page": "100"})
		if err == nil && status >= 200 && status < 300 {
			var result struct {
				Data struct {
					Total   int             `json:"total"`
					Results json.RawMessage `json:"results"`
				} `json:"data"`
			}
			if json.Unmarshal(data, &result) == nil {
				mu.Lock()
				analytics.Lists.Total = result.Data.Total
				analytics.Lists.Details = result.Data.Results
				mu.Unlock()
			}
		}
	}()

	// Fetch performance metrics from finished campaigns
	wg.Add(1)
	go func() {
		defer wg.Done()
		data, status, err := h.lm.Get("/campaigns", map[string]string{
			"page": "1", "per_page": "100", "status": "finished",
		})
		if err == nil && status >= 200 && status < 300 {
			var result struct {
				Data struct {
					Results []struct {
						Views  int `json:"views"`
						Clicks int `json:"clicks"`
						Sent   int `json:"sent"`
						Bounces int `json:"bounces"`
					} `json:"results"`
				} `json:"data"`
			}
			if json.Unmarshal(data, &result) == nil {
				mu.Lock()
				for _, c := range result.Data.Results {
					analytics.Performance.TotalSent += c.Sent
					analytics.Performance.TotalOpens += c.Views
					analytics.Performance.TotalClicks += c.Clicks
				}
				if analytics.Performance.TotalSent > 0 {
					analytics.Performance.AvgOpenRate = float64(analytics.Performance.TotalOpens) / float64(analytics.Performance.TotalSent) * 100
					analytics.Performance.AvgClickRate = float64(analytics.Performance.TotalClicks) / float64(analytics.Performance.TotalSent) * 100
				}

				totalBounces := 0
				for _, c := range result.Data.Results {
					totalBounces += c.Bounces
				}
				if analytics.Performance.TotalSent > 0 {
					analytics.Performance.BounceRate = float64(totalBounces) / float64(analytics.Performance.TotalSent) * 100
				}
				mu.Unlock()
			}
		}
	}()

	wg.Wait()

	return response.Success(c, analytics)
}

func (h *AnalyticsHandler) GetCampaignAnalytics(c echo.Context) error {
	if !isAdmin(c) {
		return response.NotFound(c, "Campaign not found")
	}

	id, err := validateParamID(c, "id")
	if err != nil {
		return err
	}

	data, statusCode, err := h.lm.Get("/campaigns/"+id, nil)
	if err != nil {
		return response.InternalError(c, "Failed to fetch campaign analytics from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}

func (h *AnalyticsHandler) GetListAnalytics(c echo.Context) error {
	// Non-admin users get a fresh/clean view
	if !isAdmin(c) {
		return emptyListmonkList(c)
	}

	data, statusCode, err := h.lm.Get("/lists", map[string]string{
		"page":     "1",
		"per_page": "100",
	})
	if err != nil {
		return response.InternalError(c, "Failed to fetch list analytics from Listmonk")
	}

	return c.JSONBlob(statusCode, data)
}
