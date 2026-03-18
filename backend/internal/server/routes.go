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
	templateHandler := handlers.NewTemplateHandler(s.LM, s.Config)
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
	templates.POST("/upload-media", templateHandler.UploadMedia)
	templates.GET("/sendgrid", templateHandler.ListSendGridTemplates)
	templates.POST("/sendgrid/import", templateHandler.ImportSendGridTemplates)
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

	// WhatsApp Contact Groups
	waGroups := wa.Group("/groups")
	waGroups.GET("", waHandler.ListGroups)
	waGroups.GET("/:id", waHandler.GetGroup)
	waGroups.POST("", waHandler.CreateGroup)
	waGroups.PUT("/:id", waHandler.UpdateGroup)
	waGroups.DELETE("/:id", waHandler.DeleteGroup)
	waGroups.GET("/:id/members", waHandler.ListGroupMembers)
	waGroups.POST("/:id/members", waHandler.AddGroupMembers)
	waGroups.DELETE("/:id/members", waHandler.RemoveGroupMembers)

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

	// SMS Contact Groups
	smsGroups := sms.Group("/groups")
	smsGroups.GET("", smsHandler.ListGroups)
	smsGroups.GET("/:id", smsHandler.GetGroup)
	smsGroups.POST("", smsHandler.CreateGroup)
	smsGroups.PUT("/:id", smsHandler.UpdateGroup)
	smsGroups.DELETE("/:id", smsHandler.DeleteGroup)
	smsGroups.GET("/:id/members", smsHandler.ListGroupMembers)
	smsGroups.POST("/:id/members", smsHandler.AddGroupMembers)
	smsGroups.DELETE("/:id/members", smsHandler.RemoveGroupMembers)

	// SMS Analytics
	smsAnalytics := sms.Group("/analytics")
	smsAnalytics.GET("/overview", smsHandler.GetOverview)
	smsAnalytics.GET("/campaigns/:id", smsHandler.GetCampaignAnalytics)

	// ==============================================================
	// Telegram Marketing — all authenticated users (account-scoped)
	// ==============================================================
	tgHandler := handlers.NewTelegramHandler(s.DB, s.Config)

	// Telegram Settings
	tg := staff.Group("/telegram")
	tg.GET("/settings", tgHandler.GetSettings)
	tg.PUT("/settings", tgHandler.UpdateSettings)
	tg.POST("/settings/test", tgHandler.TestConnection)
	tg.POST("/settings/qr", tgHandler.UploadQR)
	tg.DELETE("/settings/qr", tgHandler.DeleteQR)

	// Telegram Contacts
	tgContacts := tg.Group("/contacts")
	tgContacts.GET("", tgHandler.ListContacts)
	tgContacts.GET("/:id", tgHandler.GetContact)
	tgContacts.POST("", tgHandler.CreateContact)
	tgContacts.PUT("/:id", tgHandler.UpdateContact)
	tgContacts.DELETE("/:id", tgHandler.DeleteContact)
	tgContacts.GET("/:id/groups", tgHandler.GetContactGroups)
	tgContacts.POST("/import", tgHandler.ImportContacts)
	tgContacts.GET("/export", tgHandler.ExportContacts)
	tgContacts.GET("/tags", tgHandler.ListContactTags)
	tgContacts.POST("/tags", tgHandler.CreateContactTag)
	tgContacts.DELETE("/tags/:tag", tgHandler.DeleteContactTag)
	tgContacts.GET("/stats", tgHandler.GetContactStats)

	// Telegram Campaigns
	tgCampaigns := tg.Group("/campaigns")
	tgCampaigns.GET("", tgHandler.ListCampaigns)
	tgCampaigns.GET("/:id", tgHandler.GetCampaign)
	tgCampaigns.POST("", tgHandler.CreateCampaign)
	tgCampaigns.PUT("/:id", tgHandler.UpdateCampaign)
	tgCampaigns.DELETE("/:id", tgHandler.DeleteCampaign)
	tgCampaigns.POST("/:id/send", tgHandler.SendCampaign)
	tgCampaigns.POST("/:id/test", tgHandler.TestCampaign)
	tgCampaigns.POST("/:id/pause", tgHandler.PauseCampaign)
	tgCampaigns.POST("/:id/resume", tgHandler.ResumeCampaign)
	tgCampaigns.POST("/audience-count", tgHandler.GetAudienceCount)

	// Telegram Contact Groups
	tgGroups := tg.Group("/groups")
	tgGroups.GET("", tgHandler.ListGroups)
	tgGroups.GET("/:id", tgHandler.GetGroup)
	tgGroups.POST("", tgHandler.CreateGroup)
	tgGroups.PUT("/:id", tgHandler.UpdateGroup)
	tgGroups.DELETE("/:id", tgHandler.DeleteGroup)
	tgGroups.GET("/:id/members", tgHandler.ListGroupMembers)
	tgGroups.POST("/:id/members", tgHandler.AddGroupMembers)
	tgGroups.DELETE("/:id/members", tgHandler.RemoveGroupMembers)

	// Telegram Analytics
	tgAnalytics := tg.Group("/analytics")
	tgAnalytics.GET("/overview", tgHandler.GetOverview)
	tgAnalytics.GET("/campaigns/:id", tgHandler.GetCampaignAnalytics)

	// Telegram Webhook — Public endpoint (no auth, verified by secret)
	tgWebhookLimiter := middleware.NewRateLimiter(50, 100)
	tgWebhookGroup := api.Group("")
	tgWebhookGroup.Use(tgWebhookLimiter.Middleware())
	tgWebhookGroup.POST("/webhooks/telegram/:secret", tgHandler.WebhookReceive)

	// ==============================================================
	// Messenger Marketing — all authenticated users (account-scoped)
	// ==============================================================
	msgHandler := handlers.NewMessengerHandler(s.DB, s.Config)

	// Messenger Settings
	msg := staff.Group("/messenger")
	msg.GET("/settings", msgHandler.GetSettings)
	msg.PUT("/settings", msgHandler.UpdateSettings)
	msg.POST("/settings/test", msgHandler.TestConnection)
	msg.POST("/settings/qr", msgHandler.UploadQR)
	msg.DELETE("/settings/qr", msgHandler.DeleteQR)
	msg.POST("/settings/generate-keyword", msgHandler.GenerateKeyword)

	// Messenger Contacts
	msgContacts := msg.Group("/contacts")
	msgContacts.GET("", msgHandler.ListContacts)
	msgContacts.POST("", msgHandler.CreateContact)
	msgContacts.PUT("/:id", msgHandler.UpdateContact)
	msgContacts.DELETE("/:id", msgHandler.DeleteContact)
	msgContacts.POST("/import", msgHandler.ImportContacts)
	msgContacts.GET("/export", msgHandler.ExportContacts)
	msgContacts.GET("/tags", msgHandler.ListContactTags)
	msgContacts.POST("/tags", msgHandler.CreateContactTag)
	msgContacts.DELETE("/tags/:tag", msgHandler.DeleteContactTag)
	msgContacts.GET("/stats", msgHandler.GetContactStats)

	// Messenger Campaigns
	msgCampaigns := msg.Group("/campaigns")
	msgCampaigns.GET("", msgHandler.ListCampaigns)
	msgCampaigns.GET("/:id", msgHandler.GetCampaign)
	msgCampaigns.POST("", msgHandler.CreateCampaign)
	msgCampaigns.PUT("/:id", msgHandler.UpdateCampaign)
	msgCampaigns.DELETE("/:id", msgHandler.DeleteCampaign)
	msgCampaigns.POST("/:id/send", msgHandler.SendCampaign)
	msgCampaigns.POST("/:id/test", msgHandler.TestCampaign)
	msgCampaigns.POST("/:id/pause", msgHandler.PauseCampaign)
	msgCampaigns.POST("/:id/resume", msgHandler.ResumeCampaign)
	msgCampaigns.POST("/audience-count", msgHandler.GetAudienceCount)

	// Messenger Contact Groups
	msgGroups := msg.Group("/groups")
	msgGroups.GET("", msgHandler.ListGroups)
	msgGroups.GET("/:id", msgHandler.GetGroup)
	msgGroups.POST("", msgHandler.CreateGroup)
	msgGroups.PUT("/:id", msgHandler.UpdateGroup)
	msgGroups.DELETE("/:id", msgHandler.DeleteGroup)
	msgGroups.GET("/:id/members", msgHandler.ListGroupMembers)
	msgGroups.POST("/:id/members", msgHandler.AddGroupMembers)
	msgGroups.DELETE("/:id/members", msgHandler.RemoveGroupMembers)

	// Messenger Analytics
	msgAnalytics := msg.Group("/analytics")
	msgAnalytics.GET("/overview", msgHandler.GetOverview)
	msgAnalytics.GET("/campaigns/:id", msgHandler.GetCampaignAnalytics)

	// Messenger Webhook — Public endpoints (no auth, verified by signature/token)
	msgWebhookLimiter := middleware.NewRateLimiter(50, 100)
	msgWebhookGroup := api.Group("/webhooks/messenger")
	msgWebhookGroup.Use(msgWebhookLimiter.Middleware())
	msgWebhookGroup.GET("/:account_id", msgHandler.WebhookVerify)
	msgWebhookGroup.POST("/:account_id", msgHandler.WebhookReceive)

	// ==============================================================
	// Blog CMS
	// ==============================================================
	blogHandler := handlers.NewBlogHandler(s.DB, s.Config)

	blog := staff.Group("/blog")

	// Blog Posts
	blogPosts := blog.Group("/posts")
	blogPosts.GET("", blogHandler.ListPosts)
	blogPosts.GET("/:id", blogHandler.GetPost)
	blogPosts.POST("", blogHandler.CreatePost)
	blogPosts.PUT("/:id", blogHandler.UpdatePost)
	blogPosts.DELETE("/:id", blogHandler.DeletePost)
	blogPosts.POST("/:id/publish", blogHandler.PublishPost)
	blogPosts.POST("/:id/unpublish", blogHandler.UnpublishPost)

	// Blog Post FAQs
	blogPosts.GET("/:id/faqs", blogHandler.ListPostFAQs)
	blogPosts.POST("/:id/faqs", blogHandler.CreatePostFAQ)
	blogPosts.PUT("/:id/faqs/:faq_id", blogHandler.UpdatePostFAQ)
	blogPosts.DELETE("/:id/faqs/:faq_id", blogHandler.DeletePostFAQ)

	// Blog Categories
	blogCats := blog.Group("/categories")
	blogCats.GET("", blogHandler.ListCategories)
	blogCats.POST("", blogHandler.CreateCategory)
	blogCats.PUT("/:id", blogHandler.UpdateCategory)
	blogCats.DELETE("/:id", blogHandler.DeleteCategory)

	// Blog Tags
	blogTags := blog.Group("/tags")
	blogTags.GET("", blogHandler.ListTags)
	blogTags.POST("", blogHandler.CreateTag)
	blogTags.DELETE("/:id", blogHandler.DeleteTag)

	// Blog Authors
	blogAuthors := blog.Group("/authors")
	blogAuthors.GET("", blogHandler.ListAuthors)
	blogAuthors.GET("/:id", blogHandler.GetAuthor)
	blogAuthors.POST("", blogHandler.CreateAuthor)
	blogAuthors.PUT("/:id", blogHandler.UpdateAuthor)
	blogAuthors.DELETE("/:id", blogHandler.DeleteAuthor)

	// Blog Settings
	blog.GET("/settings", blogHandler.GetBlogSettings)
	blog.PUT("/settings", blogHandler.UpdateBlogSettings)

	// Blog Dashboard Stats
	blog.GET("/stats", blogHandler.GetDashboardStats)

	// Public Blog Endpoints (no auth)
	publicBlog := api.Group("/public/blog")
	publicBlog.GET("/posts", blogHandler.PublicListPosts)
	publicBlog.GET("/posts/:slug", blogHandler.PublicGetPost)
	publicBlog.GET("/categories/:slug", blogHandler.PublicListByCategory)
	publicBlog.GET("/authors/:slug", blogHandler.PublicListByAuthor)
	publicBlog.GET("/tags/:slug", blogHandler.PublicListByTag)
	publicBlog.GET("/sitemap.xml", blogHandler.PublicGetSitemap)
	publicBlog.GET("/robots.txt", blogHandler.PublicGetRobotsTxt)

	// ==============================================================
	// API Key Management — authenticated users manage their own keys
	// ==============================================================
	apiKeyHandler := handlers.NewAPIKeyHandler(s.DB)
	apiKeys := staff.Group("/api-keys")
	apiKeys.GET("", apiKeyHandler.ListKeys)
	apiKeys.POST("", apiKeyHandler.CreateKey)
	apiKeys.PUT("/:id", apiKeyHandler.UpdateKey)
	apiKeys.PUT("/:id/toggle", apiKeyHandler.ToggleKey)
	apiKeys.DELETE("/:id", apiKeyHandler.DeleteKey)

	// API Credits — authenticated users view their own credits
	creditHandler := handlers.NewCreditHandler(s.DB)
	apiCredits := staff.Group("/api-credits")
	apiCredits.GET("", creditHandler.GetMyCredits)
	apiCredits.GET("/transactions", creditHandler.GetMyTransactions)

	// ==============================================================
	// Public API — SMS (API key auth, separate from JWT)
	// ==============================================================
	publicSMSHandler := handlers.NewPublicSMSHandler(s.DB)
	publicSMSLimiter := middleware.NewRateLimiter(30, 60)
	publicSMS := api.Group("/v1/sms")
	publicSMS.Use(publicSMSLimiter.Middleware())
	publicSMS.Use(middleware.APIKeyAuth(s.DB, "sms"))
	publicSMS.POST("/send", publicSMSHandler.Send)
	publicSMS.POST("/send/bulk", publicSMSHandler.SendBulk)
	publicSMS.GET("/messages", publicSMSHandler.ListMessages)
	publicSMS.GET("/messages/:id", publicSMSHandler.GetMessage)
	publicSMS.GET("/balance", publicSMSHandler.GetBalance)
	publicSMS.GET("/status", publicSMSHandler.GetStatus)

	// ==============================================================
	// Public API — WhatsApp (API key auth, separate from JWT)
	// ==============================================================
	publicWAHandler := handlers.NewPublicWhatsAppHandler(s.DB)
	publicWALimiter := middleware.NewRateLimiter(30, 60)
	publicWA := api.Group("/v1/whatsapp")
	publicWA.Use(publicWALimiter.Middleware())
	publicWA.Use(middleware.APIKeyAuth(s.DB, "whatsapp"))
	publicWA.POST("/send", publicWAHandler.Send)
	publicWA.POST("/send/bulk", publicWAHandler.SendBulk)
	publicWA.GET("/messages", publicWAHandler.ListMessages)
	publicWA.GET("/messages/:id", publicWAHandler.GetMessage)
	publicWA.GET("/balance", publicWAHandler.GetBalance)
	publicWA.GET("/status", publicWAHandler.GetStatus)
	publicWA.GET("/templates", publicWAHandler.ListTemplates)

	// ==============================================================
	// Public API — Email (API key auth, separate from JWT)
	// ==============================================================
	publicEmailHandler := handlers.NewPublicEmailHandler(s.DB, s.Config.SendGridAPIKey)
	publicEmailLimiter := middleware.NewRateLimiter(30, 60)
	publicEmail := api.Group("/v1/email")
	publicEmail.Use(publicEmailLimiter.Middleware())
	publicEmail.Use(middleware.APIKeyAuth(s.DB, "email"))
	publicEmail.POST("/send", publicEmailHandler.Send)
	publicEmail.POST("/send/bulk", publicEmailHandler.SendBulk)
	publicEmail.GET("/messages", publicEmailHandler.ListMessages)
	publicEmail.GET("/messages/:id", publicEmailHandler.GetMessage)
	publicEmail.GET("/balance", publicEmailHandler.GetBalance)
	publicEmail.GET("/status", publicEmailHandler.GetStatus)
	publicEmail.GET("/domains", publicEmailHandler.ListDomains)

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

	// API Keys (legacy)
	admin.GET("/keys", authHandler.ListAPIKeys)
	admin.POST("/keys", authHandler.CreateAPIKey)
	admin.DELETE("/keys/:id", authHandler.DeleteAPIKey)

	// Admin Credit Management
	adminCredits := admin.Group("/admin-credits")
	adminCredits.GET("", creditHandler.AdminListCredits)
	adminCredits.GET("/transactions", creditHandler.AdminListTransactions)
	adminCredits.GET("/messages", creditHandler.AdminListAPIMessages)
	adminCredits.GET("/:account_id", creditHandler.AdminGetAccountCredits)
	adminCredits.POST("/:account_id/adjust", creditHandler.AdminAdjustCredits)
	adminCredits.POST("/:account_id/toggle-api", creditHandler.AdminToggleAPI)

	// Settings (Listmonk proxy)
	settings := admin.Group("/settings")
	settings.GET("", settingsHandler.Get)
	settings.PUT("", settingsHandler.Update)
	settings.POST("/smtp/test", settingsHandler.TestSMTP)
	settings.GET("/logs", settingsHandler.GetLogs)

	// Account Settings (platform-level settings in our DB) — accessible to all staff
	accountSettings := staff.Group("/account-settings")
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
