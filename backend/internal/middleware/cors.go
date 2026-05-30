package middleware

import (
	"net/http"
	"os"
	"strings"

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

	// Allow localhost origins ONLY in non-production environments. Shipping these
	// to prod lets any locally-running page make credentialed cross-origin calls.
	// Opt in by setting ENV to "development"/"local"/"dev"; prod leaves it unset.
	env := strings.ToLower(os.Getenv("ENV"))
	if env == "development" || env == "local" || env == "dev" {
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
