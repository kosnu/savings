package diagnostic

import (
	"encoding/json"
	"fmt"
)

// Diagnostic is the stable machine-readable error boundary exposed by the checker.
type Diagnostic struct {
	Code     string `json:"code"`
	Path     string `json:"path"`
	Artifact string `json:"artifact"`
	Expected any    `json:"expected"`
	Actual   any    `json:"actual"`
	Message  string `json:"message"`
}

func (d *Diagnostic) Error() string {
	location := d.Path
	if d.Artifact != "" {
		if location != "" {
			location = d.Artifact + ":" + location
		} else {
			location = d.Artifact
		}
	}
	if location == "" {
		return fmt.Sprintf("%s: %s", d.Code, d.Message)
	}
	return fmt.Sprintf("%s: %s: %s", d.Code, location, d.Message)
}

func New(code, path, artifact, message string, expected, actual any) *Diagnostic {
	return &Diagnostic{
		Code:     code,
		Path:     path,
		Artifact: artifact,
		Expected: expected,
		Actual:   actual,
		Message:  message,
	}
}

func JSON(err error) []byte {
	diagnostic, ok := err.(*Diagnostic)
	if !ok {
		diagnostic = New("AIDD_INTERNAL", "", "", err.Error(), nil, nil)
	}
	encoded, marshalErr := json.Marshal(diagnostic)
	if marshalErr != nil {
		return []byte(`{"code":"AIDD_INTERNAL","path":"","artifact":"diagnostic","expected":null,"actual":null,"message":"diagnostic encoding failed"}`)
	}
	return encoded
}
