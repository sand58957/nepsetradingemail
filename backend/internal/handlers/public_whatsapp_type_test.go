package handlers

import (
	"os"
	"strings"
	"testing"
)

// Omitting "type" used to mean "template". A caller posting {to, message} — the
// obvious way to send a text, and what the dashboard's own examples showed — was
// answered with "Template name is required for template messages": an error about
// a request they had not made. It accounted for most of the rejected calls on the
// endpoint.
//
// The type is now inferred from which field is present, so template_name still
// selects a template and nothing that previously worked changes.
func TestSendInfersTheMessageTypeFromTheFieldsGiven(t *testing.T) {
	src, err := os.ReadFile("public_whatsapp_api.go")
	if err != nil {
		t.Fatalf("reading public_whatsapp_api.go: %v", err)
	}

	body := string(src)

	// Both the single send and the bulk send.
	if n := strings.Count(body, `req.Type = "template"`); n != 2 {
		t.Errorf(`found %d assignments of req.Type = "template", want 2 (one per handler, `+
			`each inside a template_name check)`, n)
	}

	for _, handler := range []string{"func (h *PublicWhatsAppHandler) Send(", "func (h *PublicWhatsAppHandler) SendBulk("} {
		at := strings.Index(body, handler)
		if at < 0 {
			t.Errorf("%s not found", handler)

			continue
		}

		end := strings.Index(body[at:], "\n}\n")
		if end < 0 {
			end = len(body) - at
		}

		fn := body[at : at+end]

		block := strings.Index(fn, `if req.Type == "" {`)
		if block < 0 {
			t.Errorf("%s no longer defaults an empty type at all", handler)

			continue
		}

		window := fn[block:min(block+320, len(fn))]

		if !strings.Contains(window, `req.TemplateName != ""`) {
			t.Errorf("%s defaults an empty type without looking at template_name, so a plain "+
				"{to, message} send is rejected as a malformed template send", handler)
		}

		if !strings.Contains(window, `req.Type = "text"`) {
			t.Errorf("%s never infers a text send from an empty type", handler)
		}
	}
}

// An account with no templates at all gets told that, rather than being told the
// one it named does not exist — which reads as a typo instead of a step never
// taken. Every account but one had zero templates.
func TestTemplateNotFoundExplainsAnEmptyTemplateList(t *testing.T) {
	src, err := os.ReadFile("public_whatsapp_api.go")
	if err != nil {
		t.Fatalf("reading public_whatsapp_api.go: %v", err)
	}

	body := string(src)

	at := strings.Index(body, `"TEMPLATE_NOT_FOUND"`)
	if at < 0 {
		t.Fatal("TEMPLATE_NOT_FOUND branch not found")
	}

	window := body[max(at-900, 0):min(at+200, len(body))]

	if !strings.Contains(window, "COUNT(*) FROM wa_templates WHERE account_id") {
		t.Error("the TEMPLATE_NOT_FOUND branch does not check whether the account has any templates, " +
			"so an account with none is told its template name is wrong")
	}

	if !strings.Contains(window, "no WhatsApp templates yet") {
		t.Error("no message for the has-no-templates case")
	}
}
