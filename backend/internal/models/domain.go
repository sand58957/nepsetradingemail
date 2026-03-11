package models

import "time"

// Domain represents a sending or site domain owned by an account.
type Domain struct {
	ID               int        `json:"id" db:"id"`
	AccountID        int        `json:"account_id" db:"account_id"`
	Domain           string     `json:"domain" db:"domain"`
	Type             string     `json:"type" db:"type"`
	Status           string     `json:"status" db:"status"`
	DKIMPrivateKey   string     `json:"-" db:"dkim_private_key"` // never exposed via JSON
	DKIMPublicKey    string     `json:"dkim_public_key,omitempty" db:"dkim_public_key"`
	DKIMSelector     string     `json:"dkim_selector" db:"dkim_selector"`
	VerificationHash string     `json:"verification_hash" db:"verification_hash"`
	DomainAlignment  bool       `json:"domain_alignment" db:"domain_alignment"`
	SSL              bool       `json:"ssl" db:"ssl"`
	Site             string     `json:"site" db:"site"`
	VerifiedAt       *time.Time `json:"verified_at" db:"verified_at"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
}

// CreateDomainRequest is the payload for adding a new domain.
type CreateDomainRequest struct {
	Domain string `json:"domain"`
	Type   string `json:"type"` // "sending" or "site"
}

// DnsRecord describes a single DNS record the user must add.
type DnsRecord struct {
	Label string `json:"label"`
	Type  string `json:"type"`
	Name  string `json:"name"`
	Value string `json:"value"`
}

// DnsRecordsResponse is returned by the GET /domains/:id/dns-records endpoint.
type DnsRecordsResponse struct {
	DomainID int         `json:"domain_id"`
	Domain   string      `json:"domain"`
	Records  []DnsRecord `json:"records"`
}
