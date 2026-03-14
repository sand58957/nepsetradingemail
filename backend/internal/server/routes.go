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
	dashboardHandler := handlers.NewDashboardHandler(s.LM, s.DB)
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
	accountHandler := handlers.NewAccountHandler(s.DB, s.Config)

	api := s.Echo.Group("/api")

	// Health check
	api.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"status":  "ok",
			"service": "nepse-trading-email-backend",
		})
	})

	// Public auth routes (rate-limited: 5 requests/second, burst of 10)
	authLimiter := middleware.NewRateLimiter(5, 10)
	auth := api.Group("/auth")
	auth.Use(authLimiter.Middleware())
	auth.POST("/login", authHandler.Login)
	auth.POST("/register", authHandler.Register)
	auth.POST("/refresh", authHandler.RefreshToken)

	// Public form submission (rate-limited: 3 requests/second, burst of 5)
	formLimiter := middleware.NewRateLimiter(3, 5)
	formGroup := api.Group("")
	formGroup.Use(formLimiter.Middleware())
	formGroup.POST("/forms/:id/submit", formHandler.Submit)

	// Public webhook import endpoint (rate-limited: 10 requests/second, burst of 20)
	webhookLimiter := middleware.NewRateLimiter(10, 20)
	webhookGroup := api.Group("")
	webhookGroup.Use(webhookLimiter.Middleware())
	webhookGroup.POST("/webhooks/import/:secret", importHandler.WebhookImport)

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

	// Accounts (any authenticated user can manage their own accounts)
	accounts := protected.Group("/accounts")
	accounts.GET("", accountHandler.List)
	accounts.POST("", accountHandler.Create)
	accounts.POST("/switch", accountHandler.Switch)
	accounts.GET("/:id", accountHandler.Get)
	accounts.PUT("/:id", accountHandler.Update)
	accounts.DELETE("/:id", accountHandler.Delete)

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
	staff.Use(middleware.RequireRole("admin", "user", "subscriber"))

	// Subscribers management
	subscribers := staff.Group("/subscribers")
	subscribers.GET("", subscriberHandler.List)
	subscribers.GET("/:id", subscriberHandler.Get)
	subscribers.POST("", subscriberHandler.Create)
	subscribers.PUT("/:id", subscriberHandler.Update)
	subscribers.DELETE("/:id", subscriberHandler.Delete)
	subscribers.DELETE("", subscriberHandler.DeleteAll)
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
	// WhatsApp Marketing — all authenticated users (account-scoped)
	// ==============================================================
	waHandler := handlers.NewWhatsAppHandler(s.DB)

	// WhatsApp Settings
	wa := staff.Group("/whatsapp")
	wa.GET("/settings", waHandler.GetSettings)
	wa.PUT("/settings", waHandler.UpdateSettings)
	wa.POST("/settings/test", waHandler.TestConnection)

	// WhatsApp Contacts
	waContacts := wa.Group("/contacts")
	waContacts.GET("", waHandler.ListContacts)
	waContacts.GET("/:id", waHandler.GetContact)
	waContacts.POST("", waHandler.CreateContact)
	waContacts.PUT("/:id", waHandler.UpdateContact)
	waContacts.DELETE("/:id", waHandler.DeleteContact)
	waContacts.POST("/import", waHandler.ImportContacts)
	waContacts.GET("/export", waHandler.ExportContacts)
	waContacts.GET("/tags", waHandler.ListContactTags)
	waContacts.POST("/tags", waHandler.CreateContactTag)
	waContacts.DELETE("/tags/:tag", waHandler.DeleteContactTag)
	waContacts.GET("/stats", waHandler.GetContactStats)
	waContacts.GET("/fields", waHandler.GetContactFields)
	waContacts.GET("/cleanup", waHandler.CleanupContacts)

	// WhatsApp Templates
	waTemplates := wa.Group("/templates")
	waTemplates.GET("", waHandler.ListTemplates)
	waTemplates.GET("/:id", waHandler.GetTemplate)
	waTemplates.POST("", waHandler.CreateTemplate)
	waTemplates.DELETE("/:id", waHandler.DeleteTemplate)
	waTemplates.POST("/sync", waHandler.SyncTemplates)

	// WhatsApp Campaigns
	waCampaigns := wa.Group("/campaigns")
	waCampaigns.GET("", waHandler.ListCampaigns)
	waCampaigns.GET("/:id", waHandler.GetCampaign)
	waCampaigns.POST("", waHandler.CreateCampaign)
	waCampaigns.PUT("/:id", waHandler.UpdateCampaign)
	waCampaigns.DELETE("/:id", waHandler.DeleteCampaign)
	waCampaigns.POST("/:id/send", waHandler.SendCampaign)
	waCampaigns.POST("/:id/test", waHandler.TestCampaign)
	waCampaigns.POST("/:id/pause", waHandler.PauseCampaign)

	// WhatsApp Analytics
	waAnalytics := wa.Group("/analytics")
	waAnalytics.GET("/overview", waHandler.GetOverview)
	waAnalytics.GET("/campaigns/:id", waHandler.GetCampaignAnalytics)

	// WhatsApp Webhook — Public endpoint (no auth, verified by secret)
	waWebhookLimiter := middleware.NewRateLimiter(50, 100)
	waWebhookGroup := api.Group("")
	waWebhookGroup.Use(waWebhookLimiter.Middleware())
	waWebhookGroup.POST("/webhooks/whatsapp/:secret", waHandler.WebhookReceive)

	// ==============================================================
	// SMS Marketing — all authenticated users (account-scoped)
	// ==============================================================
	smsHandler := handlers.NewSMSHandler(s.DB)

	// SMS Settings
	sms := staff.Group("/sms")
	sms.GET("/settings", smsHandler.GetSettings)
	sms.PUT("/settings", smsHandler.UpdateSettings)
	sms.POST("/settings/test", smsHandler.TestConnection)

	// SMS Contacts
	smsContacts := sms.Group("/contacts")
	smsContacts.GET("", smsHandler.ListContacts)
	smsContacts.POST("", smsHandler.CreateContact)
	smsContacts.PUT("/:id", smsHandler.UpdateContact)
	smsContacts.DELETE("/:id", smsHandler.DeleteContact)
	smsContacts.POST("/import", smsHandler.ImportContacts)
	smsContacts.GET("/export", smsHandler.ExportContacts)
	smsContacts.GET("/tags", smsHandler.ListContactTags)
	smsContacts.POST("/tags", smsHandler.CreateContactTag)
	smsContacts.DELETE("/tags/:tag", smsHandler.DeleteContactTag)
	smsContacts.GET("/stats", smsHandler.GetContactStats)

	// SMS Credits
	sms.GET("/credits/balance", smsHandler.GetCreditBalance)

	// SMS Campaigns
	smsCampaigns := sms.Group("/campaigns")
	smsCampaigns.GET("", smsHandler.ListCampaigns)
	smsCampaigns.GET("/:id", smsHandler.GetCampaign)
	smsCampaigns.POST("", smsHandler.CreateCampaign)
	smsCampaigns.PUT("/:id", smsHandler.UpdateCampaign)
	smsCampaigns.DELETE("/:id", smsHandler.DeleteCampaign)
	smsCampaigns.POST("/:id/send", smsHandler.SendCampaign)
	smsCampaigns.POST("/:id/test", smsHandler.TestCampaign)
	smsCampaigns.POST("/:id/pause", smsHandler.PauseCampaign)
	smsCampaigns.POST("/:id/resume", smsHandler.ResumeCampaign)
	smsCampaigns.POST("/audience-count", smsHandler.GetAudienceCount)

	// SMS Analytics
	smsAnalytics := sms.Group("/analytics")
	smsAnalytics.GET("/overview", smsHandler.GetOverview)
	smsAnalytics.GET("/campaigns/:id", smsHandler.GetCampaignAnalytics)

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

	// Domains — per-account with auto-generated DKIM keys + SendGrid domain auth
	domainHandler := handlers.NewDomainHandler(s.DB, s.Config.SendGridAPIKey)
	domains := staff.Group("/domains")
	domains.GET("", domainHandler.List)
	domains.POST("", domainHandler.Create)
	domains.DELETE("/:id", domainHandler.Delete)
	domains.GET("/:id/dns-records", domainHandler.GetDnsRecords)
	domains.POST("/:id/verify", domainHandler.Verify)
	domains.PUT("/:id/sender", domainHandler.UpdateFromEmail)

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
