package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/middleware"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// validateParamID validates that the named path parameter is a positive integer.
// Returns the ID string and nil on success, or empty string and an error response on failure.
func validateParamID(c echo.Context, param string) (string, error) {
	id := c.Param(param)
	n, err := strconv.Atoi(id)
	if err != nil || n <= 0 {
		return "", response.BadRequest(c, "Invalid ID")
	}
	return id, nil
}

// isAdmin returns true if the current user has admin role.
func isAdmin(c echo.Context) bool {
	return middleware.GetUserRole(c) == "admin"
}

// adminOnly returns a 403 Forbidden response for non-admin users.
// Used to block write operations on shared Listmonk data.
func adminOnly(c echo.Context) error {
	return c.JSON(http.StatusForbidden, map[string]interface{}{
		"success": false,
		"message": "Admin access required",
	})
}

// emptyListmonkList returns an empty Listmonk-formatted paginated response.
// Used for non-admin users who should see a fresh/clean view without shared data.
func emptyListmonkList(c echo.Context) error {
	page := 1
	perPage := 20
	if v := c.QueryParam("page"); v != "" {
		if p, err := strconv.Atoi(v); err == nil && p > 0 {
			page = p
		}
	}
	if v := c.QueryParam("per_page"); v != "" {
		if pp, err := strconv.Atoi(v); err == nil && pp > 0 {
			perPage = pp
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"results":  []interface{}{},
			"total":    0,
			"per_page": perPage,
			"page":     page,
		},
	})
}
