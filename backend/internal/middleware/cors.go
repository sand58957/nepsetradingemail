package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

func CORSConfig(frontendURL string) echo.MiddlewareFunc {
	origins := []string{frontendURL}

	// Also allow the www variant of the frontend URL
	if len(frontendURL) > 8 && frontendURL[:8] == "https://" {
		host := frontendURL[8:]
		if len(host) > 4 && host[:4] == "www." {
			// frontendURL is www → also allow non-www
			origins = append(origins, "https://"+host[4:])
		} else {
			// frontendURL is non-www → also allow www
			origins = append(origins, "https://www."+host)
		}
	}

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
