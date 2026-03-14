package sendgrid

import (
	"encoding/json"
	"fmt"
)

// MailRequest represents an email to send via SendGrid Mail Send API.
type MailRequest struct {
	To       string
	From     string
	FromName string
	Subject  string
	HTML     string
	Text     string
	ReplyTo  string
}

// MailResponse represents the send result.
type MailResponse struct {
	MessageID string
}

// SendMail sends an email via SendGrid v3 Mail Send API.
func (c *Client) SendMail(req MailRequest) (*MailResponse, error) {
	payload := map[string]interface{}{
		"personalizations": []map[string]interface{}{
			{
				"to": []map[string]string{
					{"email": req.To},
				},
			},
		},
		"from": map[string]string{
			"email": req.From,
			"name":  req.FromName,
		},
		"subject": req.Subject,
		"content": []map[string]string{},
	}

	content := []map[string]string{}
	if req.Text != "" {
		content = append(content, map[string]string{"type": "text/plain", "value": req.Text})
	}
	if req.HTML != "" {
		content = append(content, map[string]string{"type": "text/html", "value": req.HTML})
	}
	if len(content) == 0 {
		content = append(content, map[string]string{"type": "text/plain", "value": " "})
	}
	payload["content"] = content

	if req.ReplyTo != "" {
		payload["reply_to"] = map[string]string{"email": req.ReplyTo}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal mail payload: %w", err)
	}

	respBody, statusCode, err := c.doRequest("POST", "/mail/send", body)
	if err != nil {
		return nil, fmt.Errorf("send mail: %w", err)
	}

	if statusCode >= 400 {
		return nil, fmt.Errorf("SendGrid mail error (%d): %s", statusCode, string(respBody))
	}

	// SendGrid returns 202 with empty body on success; message ID is in header
	// but we don't have access to headers through doRequest, so generate our own
	return &MailResponse{
		MessageID: fmt.Sprintf("sg_%d", statusCode),
	}, nil
}
