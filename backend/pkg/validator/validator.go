package validator

import (
	"net/mail"
	"strings"
)

func IsValidEmail(email string) bool {
	_, err := mail.ParseAddress(email)
	return err == nil
}

func IsNotEmpty(s string) bool {
	return strings.TrimSpace(s) != ""
}

func MinLength(s string, min int) bool {
	return len(strings.TrimSpace(s)) >= min
}

func MaxLength(s string, max int) bool {
	return len(s) <= max
}

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type ValidationErrors struct {
	Errors []ValidationError `json:"errors"`
}

func (ve *ValidationErrors) Add(field, message string) {
	ve.Errors = append(ve.Errors, ValidationError{
		Field:   field,
		Message: message,
	})
}

func (ve *ValidationErrors) HasErrors() bool {
	return len(ve.Errors) > 0
}

func ValidateLoginRequest(email, password string) *ValidationErrors {
	errs := &ValidationErrors{}
	if !IsValidEmail(email) {
		errs.Add("email", "A valid email address is required")
	}
	if !IsNotEmpty(password) {
		errs.Add("password", "Password is required")
	}
	return errs
}

func ValidateRegisterRequest(email, password, name string) *ValidationErrors {
	errs := &ValidationErrors{}
	if !IsValidEmail(email) {
		errs.Add("email", "A valid email address is required")
	}
	if !MinLength(password, 8) {
		errs.Add("password", "Password must be at least 8 characters")
	}
	if !MaxLength(password, 72) {
		errs.Add("password", "Password must be at most 72 characters")
	}
	if !IsNotEmpty(name) {
		errs.Add("name", "Name is required")
	}
	return errs
}
