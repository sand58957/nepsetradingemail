package server

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/handlers"
	"github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

func (s *Server) RegisterRoutes() {
	// Initialize handlers
	authHandler := handlers.NewAuthHandler(s.DB, s.Config)
	dashboardHandler := handlers.NewDashboardHandler(s.LM)
	subscriberHandler := handlers.NewSubscriberHandler(s.LM)
	campaignHandler := handlers.NewCampaignHandler(s.LM)
	listHandler := handlers.NewListHandler(s.LM)
	templateHandler := handlers.NewTemplateHandler(s.LM)
	mediaHandler := handlers.NewMediaHandler(s.LM)
	settingsHandler := handlers.NewSettingsHandler(s.LM)
	automationHandler := handlers.NewAutomationHandler(s.DB)
	formHandler := handlers.NewFormHandler(s.DB, s.LM)
	analyticsHandler := handlers.NewAnalyticsHandler(s.LM)

	api := s.Echo.Group("/api")

	// Health check
	api.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"status":  "ok",
			"service": "nepse-trading-email-backend",
		})
	})

	// Public auth routes
	auth := api.Group("/auth")
	auth.POST("/login", authHandler.Login)
	auth.POST("/register", authHandler.Register)
	auth.POST("/refresh", authHandler.RefreshToken)

	// Public form submission
	api.POST("/forms/:id/submit", formHandler.Submit)

	// Protected routes
	protected := api.Group("")
	protected.Use(middleware.JWTAuth(s.Config.JWTSecret))

	// Dashboard
	protected.GET("/dashboard/stats", dashboardHandler.GetStats)

	// Profile
	protected.GET("/profile", authHandler.GetProfile)
	protected.PUT("/profile", authHandler.UpdateProfile)

	// API Keys
	protected.GET("/keys", authHandler.ListAPIKeys)
	protected.POST("/keys", authHandler.CreateAPIKey)
	protected.DELETE("/keys/:id", authHandler.DeleteAPIKey)

	// Subscribers
	subscribers := protected.Group("/subscribers")
	subscribers.GET("", subscriberHandler.List)
	subscribers.GET("/:id", subscriberHandler.Get)
	subscribers.POST("", subscriberHandler.Create)
	subscribers.PUT("/:id", subscriberHandler.Update)
	subscribers.DELETE("/:id", subscriberHandler.Delete)
	subscribers.PUT("/blocklist", subscriberHandler.Blocklist)
	subscribers.PUT("/lists", subscriberHandler.ManageLists)
	subscribers.GET("/export", subscriberHandler.Export)
	subscribers.POST("/import", subscriberHandler.Import)

	// Campaigns
	campaigns := protected.Group("/campaigns")
	campaigns.GET("", campaignHandler.List)
	campaigns.GET("/running/stats", campaignHandler.GetRunning)
	campaigns.GET("/:id", campaignHandler.Get)
	campaigns.POST("", campaignHandler.Create)
	campaigns.PUT("/:id", campaignHandler.Update)
	campaigns.DELETE("/:id", campaignHandler.Delete)
	campaigns.PUT("/:id/status", campaignHandler.UpdateStatus)
	campaigns.POST("/:id/test", campaignHandler.Test)
	campaigns.GET("/:id/preview", campaignHandler.Preview)
	campaigns.GET("/:id/stats", campaignHandler.GetStats)

	// Lists
	lists := protected.Group("/lists")
	lists.GET("", listHandler.List)
	lists.GET("/:id", listHandler.Get)
	lists.POST("", listHandler.Create)
	lists.PUT("/:id", listHandler.Update)
	lists.DELETE("/:id", listHandler.Delete)

	// Templates
	templates := protected.Group("/templates")
	templates.GET("", templateHandler.List)
	templates.GET("/:id", templateHandler.Get)
	templates.POST("", templateHandler.Create)
	templates.PUT("/:id", templateHandler.Update)
	templates.DELETE("/:id", templateHandler.Delete)
	templates.GET("/:id/preview", templateHandler.Preview)
	templates.PUT("/:id/default", templateHandler.SetDefault)

	// Media
	media := protected.Group("/media")
	media.GET("", mediaHandler.List)
	media.GET("/:id", mediaHandler.Get)
	media.POST("", mediaHandler.Upload)
	media.DELETE("/:id", mediaHandler.Delete)

	// Settings
	settings := protected.Group("/settings")
	settings.GET("", settingsHandler.Get)
	settings.PUT("", settingsHandler.Update)
	settings.POST("/smtp/test", settingsHandler.TestSMTP)
	settings.GET("/logs", settingsHandler.GetLogs)

	// Automations
	automations := protected.Group("/automations")
	automations.GET("", automationHandler.List)
	automations.GET("/:id", automationHandler.Get)
	automations.POST("", automationHandler.Create)
	automations.PUT("/:id", automationHandler.Update)
	automations.DELETE("/:id", automationHandler.Delete)
	automations.PUT("/:id/toggle", automationHandler.ToggleStatus)
	automations.GET("/:id/logs", automationHandler.GetLogs)

	// Forms
	forms := protected.Group("/forms")
	forms.GET("", formHandler.List)
	forms.GET("/:id", formHandler.Get)
	forms.POST("", formHandler.Create)
	forms.PUT("/:id", formHandler.Update)
	forms.DELETE("/:id", formHandler.Delete)

	// Analytics
	analytics := protected.Group("/analytics")
	analytics.GET("/overview", analyticsHandler.GetOverview)
	analytics.GET("/campaigns/:id", analyticsHandler.GetCampaignAnalytics)
	analytics.GET("/lists", analyticsHandler.GetListAnalytics)

	// 404 handler
	s.Echo.RouteNotFound("/*", func(c echo.Context) error {
		return response.NotFound(c, "Route not found")
	})
}
