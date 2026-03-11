package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

func CORSConfig(frontendURL string) echo.MiddlewareFunc {
	origins := []string{frontendURL}

	// Always allow localhost origins for local development against production API
	origins = append(origins, "http://localhost:3000", "http://localhost:3001")

	return echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins: origins,
		AllowMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowHeaders: []string{
			echo.HeaderOrigin,
			echo.HeaderContentType,
			echo.HeaderAccept,
			echo.HeaderAuthorization,
			echo.HeaderXRequestedWith,
			"X-CSRF-Token",
		},
		AllowCredentials: true,
		MaxAge:           86400,
	})
}
