#!/bin/bash

# Quick Development Workflow Script
# Optimizes development speed by automating common tasks

set -e

echo "🚀 Quick Dev Workflow Started"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Quick quality check
quick_quality_check() {
    print_info "Running quick quality checks..."

    echo "🔍 Running lint..."
    if bun run lint > /dev/null 2>&1; then
        print_status "Lint passed"
    else
        echo -e "${RED}❌ Lint failed${NC}"
        bun run lint
        exit 1
    fi

    echo "🔍 Running type check..."
    if bun run typecheck > /dev/null 2>&1; then
        print_status "Type check passed"
    else
        echo -e "${RED}❌ Type check failed${NC}"
        bun run typecheck
        exit 1
    fi
}

# Smart testing
smart_test() {
    local test_pattern=${1:-""}

    if [ -n "$test_pattern" ]; then
        print_info "Running focused tests: $test_pattern"
        bun test "$test_pattern"
    else
        print_info "Running quick tests..."
        # Run only changed files tests if available, otherwise run all
        if command -v git >/dev/null 2>&1 && git rev-parse --git-dir > /dev/null 2>&1; then
            local changed_files=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E "\.(test|spec)\." || echo "")
            if [ -n "$changed_files" ]; then
                print_info "Running tests for changed files..."
                bun test $changed_files
            else
                print_info "Running all tests..."
                bun test
            fi
        else
            bun test
        fi
    fi
}

# Quick commit
quick_commit() {
    local message=${1:-"chore: quick update"}

    print_info "Quick commit with message: $message"

    # Stage changes
    git add -A

    # Quick quality check
    quick_quality_check

    # Commit
    git commit -m "$message"

    print_status "Changes committed successfully"
}

# Quick build and test
quick_build_test() {
    print_info "Quick build and test..."

    # Build
    echo "🔨 Building..."
    bun run build

    # Test
    smart_test

    print_status "Build and test completed"
}

# Show usage
usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  lint          Run linting only"
    echo "  test [pattern] Run tests (optionally with pattern)"
    echo "  typecheck     Run type checking only"
    echo "  commit msg    Quick commit with message"
    echo "  build-test    Quick build and test"
    echo "  all           Run full quick workflow (lint + typecheck + test)"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 test              # Run all tests"
    echo "  $0 test utils       # Run tests matching 'utils'"
    echo "  $0 commit 'fix bug'  # Commit with message"
    echo "  $0 all              # Run full workflow"
}

# Main execution
case "${1:-help}" in
    "lint")
        bun run lint
        ;;
    "test")
        smart_test "$2"
        ;;
    "typecheck")
        bun run typecheck
        ;;
    "commit")
        quick_commit "$2"
        ;;
    "build-test")
        quick_build_test
        ;;
    "all")
        quick_quality_check
        smart_test
        print_status "✅ All quality checks passed!"
        ;;
    "help"|*)
        usage
        ;;
esac