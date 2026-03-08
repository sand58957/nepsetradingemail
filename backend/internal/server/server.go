package server

import (
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	"github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/cache"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/listmonk"
)

type Server struct {
	Echo   *echo.Echo
	DB     *sqlx.DB
	Cache  *cache.RedisCache
	LM     *listmonk.Client
	Config *config.Config
}

func New(cfg *config.Config, db *sqlx.DB, redisCache *cache.RedisCache, lm *listmonk.Client) *Server {
	e := echo.New()
	e.HideBanner = true

	// Global middleware
	e.Use(echomw.Logger())
	e.Use(echomw.Recover())
	e.Use(echomw.RequestID())
	e.Use(middleware.CORSConfig(cfg.FrontendURL))

	e.Use(echomw.BodyLimit("25M"))

	e.Use(echomw.SecureWithConfig(echomw.SecureConfig{
		XSSProtection:         "1; mode=block",
		ContentTypeNosniff:    "nosniff",
		XFrameOptions:         "SAMEORIGIN",
		HSTSMaxAge:            31536000,
		ContentSecurityPolicy: "default-src 'self'",
	}))

	s := &Server{
		Echo:   e,
		DB:     db,
		Cache:  redisCache,
		LM:     lm,
		Config: cfg,
	}

	s.RegisterRoutes()

	return s
}
