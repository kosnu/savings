package main

import (
	"context"
	"fmt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/binarycache"
	"os"
)

func main() {
	if len(os.Args) != 1 {
		fmt.Fprintln(os.Stderr, "usage: go run ./cmd/aidd-prepare (from tools/aidd/checker)")
		os.Exit(2)
	}
	path, err := binarycache.Prepare(context.Background(), "../../..")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(path)
}
