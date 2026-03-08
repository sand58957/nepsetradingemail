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
	subscriberHandler := handlers.NewSubscriberHandler(s.LM, s.DB)
	campaignHandler := handlers.NewCampaignHandler(s.LM)
	listHandler := handlers.NewListHandler(s.LM)
	templateHandler := handlers.NewTemplateHandler(s.LM)
	mediaHandler := handlers.NewMediaHandler(s.LM)
	settingsHandler := handlers.NewSettingsHandler(s.LM)
	automationHandler := handlers.NewAutomationHandler(s.DB)
	formHandler := handlers.NewFormHandler(s.DB, s.LM)
	importHandler := handlers.NewImportHandler(s.DB, s.LM)
	analyticsHandler := handlers.NewAnalyticsHandler(s.LM)
	accountSettingsHandler := handlers.NewAccountSettingsHandler(s.DB, s.LM)
	mediaFolderHandler := handlers.NewMediaFolderHandler(s.DB, s.LM)

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

	// Public webhook import endpoint
	api.POST("/webhooks/import/:secret", importHandler.WebhookImport)

	// ==============================================================
	// Public routes (no auth required)
	// ==============================================================
	api.GET("/campaigns/archive", campaignHandler.ListArchive)
	api.GET("/campaigns/archive/:id", campaignHandler.GetArchive)

	// ==============================================================
	// Protected routes — all authenticated users (admin, user, subscriber)
	// ==============================================================
	protected := api.Group("")
	protected.Use(middleware.JWTAuth(s.Config.JWTSecret))

	// Dashboard
	protected.GET("/dashboard/stats", dashboardHandler.GetStats)

	// Profile (any authenticated user)
	protected.GET("/profile", authHandler.GetProfile)
	protected.PUT("/profile", authHandler.UpdateProfile)

	// Subscriber self-service (any authenticated user can manage their own subscriptions)
	subscriber := protected.Group("/subscriber")
	subscriber.GET("/subscriptions", subscriberHandler.MySubscriptions)
	subscriber.PUT("/subscriptions", subscriberHandler.UpdateSubscriptions)
	subscriber.GET("/preferences", subscriberHandler.MyPreferences)
	subscriber.PUT("/preferences", subscriberHandler.UpdatePreferences)

	// ==============================================================
	// Staff routes — admin + user roles (email marketing features)
	// ==============================================================
	staff := api.Group("")
	staff.Use(middleware.JWTAuth(s.Config.JWTSecret))
	staff.Use(middleware.RequireRole("admin", "user"))

	// Subscribers management
	subscribers := staff.Group("/subscribers")
	subscribers.GET("", subscriberHandler.List)
	subscribers.GET("/:id", subscriberHandler.Get)
	subscribers.POST("", subscriberHandler.Create)
	subscribers.PUT("/:id", subscriberHandler.Update)
	subscribers.DELETE("/:id", subscriberHandler.Delete)
	subscribers.PUT("/blocklist", subscriberHandler.Blocklist)
	subscribers.PUT("/lists", subscriberHandler.ManageLists)
	subscribers.GET("/export", subscriberHandler.Export)

	// Import management
	imports := staff.Group("/import")
	imports.POST("/csv", importHandler.ImportCSV)
	imports.GET("/status", importHandler.GetImportStatus)
	imports.GET("/logs", importHandler.GetImportLogs)
	imports.DELETE("/cancel", importHandler.CancelImport)
	imports.POST("/json", importHandler.ImportJSON)
	imports.GET("/history", importHandler.ListHistory)
	imports.GET("/history/:id", importHandler.GetHistory)
	imports.DELETE("/history/:id", importHandler.DeleteHistory)
	imports.PUT("/history", importHandler.UpdateImportHistory)
	imports.GET("/analytics", importHandler.GetAnalytics)
	imports.GET("/webhooks", importHandler.ListWebhooks)
	imports.POST("/webhooks", importHandler.CreateWebhook)
	imports.PUT("/webhooks/:id", importHandler.UpdateWebhook)
	imports.DELETE("/webhooks/:id", importHandler.DeleteWebhook)
	imports.GET("/suppression", importHandler.ListSuppressed)
	imports.POST("/suppression", importHandler.AddSuppressed)
	imports.DELETE("/suppression/:id", importHandler.RemoveSuppressed)

	// Campaigns
	campaigns := staff.Group("/campaigns")
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
	lists := staff.Group("/lists")
	lists.GET("", listHandler.List)
	lists.GET("/:id", listHandler.Get)
	lists.POST("", listHandler.Create)
	lists.PUT("/:id", listHandler.Update)
	lists.DELETE("/:id", listHandler.Delete)

	// Templates
	templates := staff.Group("/templates")
	templates.GET("", templateHandler.List)
	templates.GET("/:id", templateHandler.Get)
	templates.POST("", templateHandler.Create)
	templates.PUT("/:id", templateHandler.Update)
	templates.DELETE("/:id", templateHandler.Delete)
	templates.GET("/:id/preview", templateHandler.Preview)
	templates.PUT("/:id/default", templateHandler.SetDefault)

	// Media
	media := staff.Group("/media")
	media.GET("", mediaHandler.List)
	media.GET("/:id", mediaHandler.Get)
	media.POST("", mediaHandler.Upload)
	media.POST("/upload-from-url", mediaHandler.UploadFromURL)
	media.DELETE("/:id", mediaHandler.Delete)

	// Media Folders
	mediaFolders := staff.Group("/media-folders")
	mediaFolders.GET("", mediaFolderHandler.List)
	mediaFolders.POST("", mediaFolderHandler.Create)
	mediaFolders.PUT("/:id", mediaFolderHandler.Update)
	mediaFolders.DELETE("/:id", mediaFolderHandler.Delete)
	mediaFolders.GET("/:id/items", mediaFolderHandler.ListItems)
	mediaFolders.POST("/:id/items", mediaFolderHandler.AddItems)
	mediaFolders.DELETE("/:id/items/:media_id", mediaFolderHandler.RemoveItem)

	// Analytics
	analytics := staff.Group("/analytics")
	analytics.GET("/overview", analyticsHandler.GetOverview)
	analytics.GET("/campaigns/:id", analyticsHandler.GetCampaignAnalytics)
	analytics.GET("/lists", analyticsHandler.GetListAnalytics)

	// ==============================================================
	// Admin-only routes — full platform control
	// ==============================================================
	admin := api.Group("")
	admin.Use(middleware.JWTAuth(s.Config.JWTSecret))
	admin.Use(middleware.RequireRole("admin"))

	// User Management
	users := admin.Group("/users")
	users.GET("", authHandler.ListUsers)
	users.GET("/:id", authHandler.GetUser)
	users.POST("", authHandler.CreateUser)
	users.PUT("/:id", authHandler.UpdateUser)
	users.DELETE("/:id", authHandler.DeleteUser)
	users.PUT("/:id/role", authHandler.UpdateUserRole)

	// API Keys
	admin.GET("/keys", authHandler.ListAPIKeys)
	admin.POST("/keys", authHandler.CreateAPIKey)
	admin.DELETE("/keys/:id", authHandler.DeleteAPIKey)

	// Settings (Listmonk proxy)
	settings := admin.Group("/settings")
	settings.GET("", settingsHandler.Get)
	settings.PUT("", settingsHandler.Update)
	settings.POST("/smtp/test", settingsHandler.TestSMTP)
	settings.GET("/logs", settingsHandler.GetLogs)

	// Account Settings (platform-level settings in our DB)
	accountSettings := admin.Group("/account-settings")
	accountSettings.GET("", accountSettingsHandler.GetAll)
	accountSettings.GET("/:key", accountSettingsHandler.GetByKey)
	accountSettings.PUT("/:key", accountSettingsHandler.UpdateByKey)
	accountSettings.POST("/logo", accountSettingsHandler.UploadLogo)

	// Automations
	automations := admin.Group("/automations")
	automations.GET("", automationHandler.List)
	automations.GET("/:id", automationHandler.Get)
	automations.POST("", automationHandler.Create)
	automations.PUT("/:id", automationHandler.Update)
	automations.DELETE("/:id", automationHandler.Delete)
	automations.PUT("/:id/toggle", automationHandler.ToggleStatus)
	automations.GET("/:id/logs", automationHandler.GetLogs)

	// Forms
	forms := admin.Group("/forms")
	forms.GET("", formHandler.List)
	forms.GET("/:id", formHandler.Get)
	forms.POST("", formHandler.Create)
	forms.PUT("/:id", formHandler.Update)
	forms.DELETE("/:id", formHandler.Delete)

	// 404 handler
	s.Echo.RouteNotFound("/*", func(c echo.Context) error {
		return response.NotFound(c, "Route not found")
	})
}
