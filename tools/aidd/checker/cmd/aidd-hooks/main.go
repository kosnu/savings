package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/codexhooks"
)

func main() {
	inputBytes, err := io.ReadAll(os.Stdin)
	if err != nil {
		writeOutput(codexhooks.HookOutput{Decision: codexhooks.HookDecisionBlock, Reason: "AIDD Hook入力を読み取れません: " + err.Error()})
		return
	}
	var input codexhooks.HookInput
	if err := json.Unmarshal(inputBytes, &input); err != nil {
		writeOutput(codexhooks.HookOutput{Decision: codexhooks.HookDecisionBlock, Reason: "AIDD Hook入力を解析できません: " + err.Error()})
		return
	}
	output, err := codexhooks.Handle(context.Background(), input)
	if err != nil {
		writeOutput(codexhooks.HookOutput{Decision: codexhooks.HookDecisionBlock, Reason: strings.TrimSpace(fmt.Sprintf("AIDD Hookを実行できません: %v", err))})
		return
	}
	writeOutput(output)
}

func writeOutput(output codexhooks.HookOutput) {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetEscapeHTML(false)
	_ = encoder.Encode(output)
}
