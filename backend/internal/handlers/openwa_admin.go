package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"

	"github.com/sandeep/nepsetradingemail/backend/internal/config"
	"github.com/sandeep/nepsetradingemail/backend/internal/services/openwa"
	"github.com/sandeep/nepsetradingemail/backend/pkg/response"
)

// OpenWAAdminHandler exposes the self-hosted WhatsApp gateway to super admins.
//
// Linking a number is necessarily a human step: the gateway drives a real
// WhatsApp account, so somebody has to scan a QR code with the handset that owns
// the number. These endpoints exist to make that possible from the admin panel
// rather than by shelling into the server, and to show whether the link is still
// alive afterwards.
//
// Super-admin only. A linked session can read and send as the account it is
// linked to, which is a far stronger capability than any per-tenant setting.
type OpenWAAdminHandler struct {
	db  *sqlx.DB
	cfg *config.Config
	wa  *openwa.Client
}

func NewOpenWAAdminHandler(db *sqlx.DB, cfg *config.Config) *OpenWAAdminHandler {
	return &OpenWAAdminHandler{
		db:  db,
		cfg: cfg,
		wa:  openwa.NewClient(cfg.OpenWABaseURL, cfg.OpenWAAPIKey),
	}
}

// gatewayError turns a client error into an HTTP response. The gateway being
// unconfigured or having no linked phone are ordinary states an operator needs to
// see and act on, not server faults.
func (h *OpenWAAdminHandler) gatewayError(c echo.Context, err error) error {
	switch {
	case errors.Is(err, openwa.ErrNotConfigured):
		return response.Error(c, http.StatusServiceUnavailable,
			"The WhatsApp gateway is not configured. Set OPENWA_BASE_URL and OPENWA_API_KEY.")
	case errors.Is(err, openwa.ErrNoConnectedSession):
		return response.Error(c, http.StatusConflict,
			"No WhatsApp number is linked. Create a session and scan its QR code.")
	default:
		return response.Error(c, http.StatusBadGateway, "WhatsApp gateway error: "+err.Error())
	}
}

// ListSessions returns every session on the gateway.
func (h *OpenWAAdminHandler) ListSessions(c echo.Context) error {
	sessions, err := h.wa.ListSessions(c.Request().Context())
	if err != nil {
		return h.gatewayError(c, err)
	}

	if sessions == nil {
		sessions = []openwa.Session{}
	}

	return response.Success(c, sessions)
}

// CreateSession registers a session. It does not link anything on its own: the
// caller then starts it and scans the QR.
func (h *OpenWAAdminHandler) CreateSession(c echo.Context) error {
	var req struct {
		Name string `json:"name"`
	}

	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Invalid request body")
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return response.Error(c, http.StatusBadRequest, "A session name is required")
	}

	session, err := h.wa.CreateSession(c.Request().Context(), req.Name)
	if err != nil {
		return h.gatewayError(c, err)
	}

	return response.SuccessWithMessage(c, "Session created. Start it to get a QR code.", session)
}

// GetSession reports one session's live state.
func (h *OpenWAAdminHandler) GetSession(c echo.Context) error {
	session, err := h.wa.GetSession(c.Request().Context(), c.Param("id"))
	if err != nil {
		return h.gatewayError(c, err)
	}

	return response.Success(c, session)
}

// StartSession boots the engine so a QR code can be produced.
func (h *OpenWAAdminHandler) StartSession(c echo.Context) error {
	session, err := h.wa.StartSession(c.Request().Context(), c.Param("id"))
	if err != nil {
		return h.gatewayError(c, err)
	}

	return response.SuccessWithMessage(c, "Session starting. Fetch the QR code to link a phone.", session)
}

// GetQR returns the current linking code as a data URI the admin UI can render
// directly. The code rotates, so the UI is expected to poll while the session
// sits in qr_ready.
func (h *OpenWAAdminHandler) GetQR(c echo.Context) error {
	qr, err := h.wa.GetQR(c.Request().Context(), c.Param("id"))
	if err != nil {
		return h.gatewayError(c, err)
	}

	return response.Success(c, qr)
}

// StopSession shuts the engine down but keeps the phone linked.
func (h *OpenWAAdminHandler) StopSession(c echo.Context) error {
	if err := h.wa.StopSession(c.Request().Context(), c.Param("id")); err != nil {
		return h.gatewayError(c, err)
	}

	return response.SuccessWithMessage(c, "Session stopped", nil)
}

// LogoutSession unlinks the phone; relinking needs a fresh QR scan.
func (h *OpenWAAdminHandler) LogoutSession(c echo.Context) error {
	if err := h.wa.LogoutSession(c.Request().Context(), c.Param("id")); err != nil {
		return h.gatewayError(c, err)
	}

	return response.SuccessWithMessage(c, "Phone unlinked. Scan a QR code to link again.", nil)
}

// DeleteSession removes the session from the gateway.
func (h *OpenWAAdminHandler) DeleteSession(c echo.Context) error {
	if err := h.wa.DeleteSession(c.Request().Context(), c.Param("id")); err != nil {
		return h.gatewayError(c, err)
	}

	return response.SuccessWithMessage(c, "Session deleted", nil)
}

// SendTest sends one message so an operator can confirm a freshly linked number
// actually delivers, without going near a campaign.
func (h *OpenWAAdminHandler) SendTest(c echo.Context) error {
	var req struct {
		Phone   string `json:"phone"`
		Message string `json:"message"`
	}

	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Invalid request body")
	}

	if strings.TrimSpace(req.Phone) == "" {
		return response.Error(c, http.StatusBadRequest, "A destination phone number is required")
	}

	if strings.TrimSpace(req.Message) == "" {
		req.Message = "Test message from Nepal Fillings."
	}

	// Fail on an unusable number here rather than letting the gateway reject it,
	// so the operator gets a precise message.
	if _, err := openwa.ChatID(req.Phone); err != nil {
		return response.Error(c, http.StatusBadRequest, "That does not look like a usable phone number")
	}

	result, err := h.wa.SendText(c.Request().Context(), c.Param("id"), req.Phone, req.Message)
	if err != nil {
		return h.gatewayError(c, err)
	}

	return response.SuccessWithMessage(c, "Test message sent", result)
}
