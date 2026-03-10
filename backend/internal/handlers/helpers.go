package handlers

import (
	"strconv"

	"github.com/labstack/echo/v4"

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
