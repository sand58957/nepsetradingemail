package response

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type Response struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

type PaginatedResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Total   int         `json:"total"`
	Page    int         `json:"page"`
	PerPage int         `json:"per_page"`
	// TotalPages was missing, so clients computing "is there a next page?" from
	// it always saw zero. The blog index used it to decide whether to render
	// pagination links, so every post past the first page was reachable only
	// through the sitemap.
	TotalPages int `json:"total_pages"`
}

// TotalPages returns how many pages cover total items at perPage each.
func TotalPages(total, perPage int) int {
	if perPage <= 0 || total <= 0 {
		return 0
	}
	return (total + perPage - 1) / perPage
}

type ErrorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

func Success(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

func SuccessWithMessage(c echo.Context, message string, data interface{}) error {
	return c.JSON(http.StatusOK, Response{
		Success: true,
		Message: message,
		Data:    data,
	})
}

func Created(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusCreated, Response{
		Success: true,
		Data:    data,
	})
}

func Paginated(c echo.Context, data interface{}, total, page, perPage int) error {
	return c.JSON(http.StatusOK, PaginatedResponse{
		Success:    true,
		Data:       data,
		Total:      total,
		Page:       page,
		PerPage:    perPage,
		TotalPages: TotalPages(total, perPage),
	})
}

func Error(c echo.Context, status int, message string) error {
	return c.JSON(status, ErrorResponse{
		Success: false,
		Message: message,
	})
}

func ErrorWithDetail(c echo.Context, status int, message, detail string) error {
	return c.JSON(status, ErrorResponse{
		Success: false,
		Message: message,
		Error:   detail,
	})
}

func BadRequest(c echo.Context, message string) error {
	return Error(c, http.StatusBadRequest, message)
}

func Unauthorized(c echo.Context, message string) error {
	return Error(c, http.StatusUnauthorized, message)
}

func Forbidden(c echo.Context, message string) error {
	return Error(c, http.StatusForbidden, message)
}

func NotFound(c echo.Context, message string) error {
	return Error(c, http.StatusNotFound, message)
}

func InternalError(c echo.Context, message string) error {
	return Error(c, http.StatusInternalServerError, message)
}
