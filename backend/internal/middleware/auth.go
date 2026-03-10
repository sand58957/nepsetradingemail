package middleware

import (
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

type JWTClaims struct {
	UserID    int    `json:"user_id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	AccountID int    `json:"account_id,omitempty"`
	Type      string `json:"type"`
	jwt.RegisteredClaims
}

func JWTAuth(jwtSecret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return response.Unauthorized(c, "Missing authorization header")
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				return response.Unauthorized(c, "Invalid authorization header format")
			}

			tokenStr := parts[1]

			claims := &JWTClaims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(jwtSecret), nil
			})

			if err != nil || !token.Valid {
				return response.Error(c, http.StatusUnauthorized, "Invalid or expired token")
			}

			if claims.Type != "access" {
				return response.Unauthorized(c, "Invalid token type")
			}

			c.Set("user_id", claims.UserID)
			c.Set("user_email", claims.Email)
			c.Set("user_role", claims.Role)
			c.Set("account_id", claims.AccountID)

			return next(c)
		}
	}
}

// RequireRole returns middleware that checks if the authenticated user
// has one of the allowed roles. Must be used AFTER JWTAuth middleware.
func RequireRole(allowedRoles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			userRole := GetUserRole(c)
			for _, role := range allowedRoles {
				if userRole == role {
					return next(c)
				}
			}
			return response.Forbidden(c, "You do not have permission to access this resource")
		}
	}
}

func GetUserID(c echo.Context) int {
	id, ok := c.Get("user_id").(int)
	if !ok {
		return 0
	}
	return id
}

func GetUserEmail(c echo.Context) string {
	email, ok := c.Get("user_email").(string)
	if !ok {
		return ""
	}
	return email
}

func GetUserRole(c echo.Context) string {
	role, ok := c.Get("user_role").(string)
	if !ok {
		return ""
	}
	return role
}

func GetAccountID(c echo.Context) int {
	id, ok := c.Get("account_id").(int)
	if !ok {
		return 0
	}
	return id
}
