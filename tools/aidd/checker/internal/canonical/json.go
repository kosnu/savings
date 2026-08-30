package canonical

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
)

const MaxJSONBytes = 4 << 20

func Decode(data []byte, artifact string, target any) error {
	if len(data) > MaxJSONBytes {
		return diagnostic.New(
			"AIDD_JSON_TOO_LARGE", "", artifact, "JSON source exceeds the size limit",
			MaxJSONBytes, len(data),
		)
	}
	if !utf8.Valid(data) {
		return diagnostic.New(
			"AIDD_JSON_UTF8", "", artifact, "JSON source must be valid UTF-8", nil, nil,
		)
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	if err := rejectDuplicateKeys(decoder, "$", artifact); err != nil {
		return err
	}
	if token, err := decoder.Token(); err != io.EOF {
		if err == nil {
			return diagnostic.New(
				"AIDD_JSON_TRAILING", "$", artifact, "JSON source contains trailing data", nil, token,
			)
		}
		return diagnostic.New(
			"AIDD_JSON_INVALID", "$", artifact, "JSON source is invalid", nil, err.Error(),
		)
	}

	strict := json.NewDecoder(bytes.NewReader(data))
	strict.DisallowUnknownFields()
	if err := strict.Decode(target); err != nil {
		return diagnostic.New(
			"AIDD_JSON_SHAPE", "$", artifact, "JSON source has an invalid shape", nil, err.Error(),
		)
	}
	return nil
}

func rejectDuplicateKeys(decoder *json.Decoder, path, artifact string) error {
	token, err := decoder.Token()
	if err != nil {
		return diagnostic.New(
			"AIDD_JSON_INVALID", path, artifact, "JSON source is invalid", nil, err.Error(),
		)
	}
	delimiter, ok := token.(json.Delim)
	if !ok {
		return nil
	}
	switch delimiter {
	case '{':
		seen := map[string]struct{}{}
		for decoder.More() {
			keyToken, keyErr := decoder.Token()
			if keyErr != nil {
				return diagnostic.New(
					"AIDD_JSON_INVALID", path, artifact, "JSON object is invalid", nil, keyErr.Error(),
				)
			}
			key, ok := keyToken.(string)
			if !ok {
				return diagnostic.New(
					"AIDD_JSON_INVALID", path, artifact, "JSON object key must be a string", nil, keyToken,
				)
			}
			childPath := path + "." + key
			if _, exists := seen[key]; exists {
				return diagnostic.New(
					"AIDD_JSON_DUPLICATE_KEY", childPath, artifact,
					"JSON object contains a duplicate key", "unique key", key,
				)
			}
			seen[key] = struct{}{}
			if childErr := rejectDuplicateKeys(decoder, childPath, artifact); childErr != nil {
				return childErr
			}
		}
		if _, endErr := decoder.Token(); endErr != nil {
			return diagnostic.New(
				"AIDD_JSON_INVALID", path, artifact, "JSON object is not closed", nil, endErr.Error(),
			)
		}
	case '[':
		index := 0
		for decoder.More() {
			if childErr := rejectDuplicateKeys(decoder, fmt.Sprintf("%s[%d]", path, index), artifact); childErr != nil {
				return childErr
			}
			index++
		}
		if _, endErr := decoder.Token(); endErr != nil {
			return diagnostic.New(
				"AIDD_JSON_INVALID", path, artifact, "JSON array is not closed", nil, endErr.Error(),
			)
		}
	}
	return nil
}

func Hash(value any) (string, error) {
	encoded, err := Marshal(value)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

func HashBytes(value []byte) string {
	digest := sha256.Sum256(value)
	return hex.EncodeToString(digest[:])
}

func Marshal(value any) ([]byte, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	var normalized any
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(&normalized); err != nil {
		return nil, err
	}
	var output bytes.Buffer
	if err := writeCanonical(&output, normalizeNewlines(normalized)); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

func Pretty(value any) ([]byte, error) {
	var output bytes.Buffer
	encoder := json.NewEncoder(&output)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(normalizeNewlines(value)); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

func normalizeNewlines(value any) any {
	switch typed := value.(type) {
	case string:
		return strings.ReplaceAll(typed, "\r\n", "\n")
	case []any:
		result := make([]any, len(typed))
		for index, entry := range typed {
			result[index] = normalizeNewlines(entry)
		}
		return result
	case map[string]any:
		result := make(map[string]any, len(typed))
		for key, entry := range typed {
			result[key] = normalizeNewlines(entry)
		}
		return result
	default:
		return value
	}
}

func writeCanonical(output *bytes.Buffer, value any) error {
	switch typed := value.(type) {
	case nil:
		output.WriteString("null")
	case bool:
		output.WriteString(strconv.FormatBool(typed))
	case string:
		encoded, err := json.Marshal(typed)
		if err != nil {
			return err
		}
		output.Write(encoded)
	case json.Number:
		output.WriteString(typed.String())
	case float64:
		output.WriteString(strconv.FormatFloat(typed, 'g', -1, 64))
	case []any:
		output.WriteByte('[')
		for index, entry := range typed {
			if index > 0 {
				output.WriteByte(',')
			}
			if err := writeCanonical(output, entry); err != nil {
				return err
			}
		}
		output.WriteByte(']')
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key := range typed {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		output.WriteByte('{')
		for index, key := range keys {
			if index > 0 {
				output.WriteByte(',')
			}
			encodedKey, err := json.Marshal(key)
			if err != nil {
				return err
			}
			output.Write(encodedKey)
			output.WriteByte(':')
			if err := writeCanonical(output, typed[key]); err != nil {
				return err
			}
		}
		output.WriteByte('}')
	default:
		raw, err := json.Marshal(typed)
		if err != nil {
			return err
		}
		var generic any
		decoder := json.NewDecoder(bytes.NewReader(raw))
		decoder.UseNumber()
		if err := decoder.Decode(&generic); err != nil {
			return err
		}
		return writeCanonical(output, normalizeNewlines(generic))
	}
	return nil
}
