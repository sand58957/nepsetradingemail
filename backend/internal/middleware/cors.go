package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

func CORSConfig(frontendURL string) echo.MiddlewareFunc {
	origins := []string{frontendURL}

	// Only allow localhost origins in development
	if strings.Contains(frontendURL, "localhost") || strings.Contains(frontendURL, "127.0.0.1") {
		origins = append(origins, "http://localhost:3000", "http://localhost:3001")
	}

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
