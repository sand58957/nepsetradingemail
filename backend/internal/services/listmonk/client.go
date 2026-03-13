package listmonk

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"time"
)

type Client struct {
	baseURL    string
	username   string
	password   string
	httpClient *http.Client
}

func NewClient(baseURL, username, password string) *Client {
	return &Client{
		baseURL:  baseURL,
		username: username,
		password: password,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type ListmonkResponse struct {
	Data interface{} `json:"data"`
}

func (c *Client) doRequest(method, path string, body io.Reader, contentType string) (*http.Response, error) {
	reqURL := fmt.Sprintf("%s%s", c.baseURL, path)
	req, err := http.NewRequest(method, reqURL, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.SetBasicAuth(c.username, c.password)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request to listmonk failed: %w", err)
	}

	return resp, nil
}

func (c *Client) Get(path string, queryParams map[string]string) (json.RawMessage, int, error) {
	if len(queryParams) > 0 {
		params := url.Values{}
		for k, v := range queryParams {
			params.Set(k, v)
		}
		path = fmt.Sprintf("%s?%s", path, params.Encode())
	}

	resp, err := c.doRequest(http.MethodGet, path, nil, "")
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return json.RawMessage(respBody), resp.StatusCode, nil
}

func (c *Client) Post(path string, payload interface{}) (json.RawMessage, int, error) {
	var body io.Reader
	if payload != nil {
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to marshal payload: %w", err)
		}
		body = bytes.NewReader(jsonData)
	}

	resp, err := c.doRequest(http.MethodPost, path, body, "application/json")
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return json.RawMessage(respBody), resp.StatusCode, nil
}

func (c *Client) Put(path string, payload interface{}) (json.RawMessage, int, error) {
	var body io.Reader
	if payload != nil {
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to marshal payload: %w", err)
		}
		body = bytes.NewReader(jsonData)
	}

	resp, err := c.doRequest(http.MethodPut, path, body, "application/json")
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return json.RawMessage(respBody), resp.StatusCode, nil
}

func (c *Client) Delete(path string) (json.RawMessage, int, error) {
	resp, err := c.doRequest(http.MethodDelete, path, nil, "")
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return json.RawMessage(respBody), resp.StatusCode, nil
}

func (c *Client) DeleteWithBody(path string, payload interface{}) (json.RawMessage, int, error) {
	var body io.Reader
	if payload != nil {
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to marshal payload: %w", err)
		}
		body = bytes.NewReader(jsonData)
	}

	resp, err := c.doRequest(http.MethodDelete, path, body, "application/json")
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return json.RawMessage(respBody), resp.StatusCode, nil
}

func (c *Client) PostMultipart(path string, fileField string, fileName string, fileData io.Reader, fields map[string]string) (json.RawMessage, int, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	for key, val := range fields {
		if err := writer.WriteField(key, val); err != nil {
			return nil, 0, fmt.Errorf("failed to write field %s: %w", key, err)
		}
	}

	if fileData != nil {
		part, err := writer.CreateFormFile(fileField, fileName)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to create form file: %w", err)
		}
		if _, err := io.Copy(part, fileData); err != nil {
			return nil, 0, fmt.Errorf("failed to copy file data: %w", err)
		}
	}

	if err := writer.Close(); err != nil {
		return nil, 0, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	resp, err := c.doRequest(http.MethodPost, path, &buf, writer.FormDataContentType())
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return json.RawMessage(respBody), resp.StatusCode, nil
}

func (c *Client) PutRaw(path string, body io.Reader, contentType string) (json.RawMessage, int, error) {
	resp, err := c.doRequest(http.MethodPut, path, body, contentType)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return json.RawMessage(respBody), resp.StatusCode, nil
}
