# Claude Code Hooks Configuration

This document explains the hooks configured in `.claude/settings.json` for the ClaudeKit CLI project.

## Overview

Claude Code hooks are event-driven scripts that execute at specific points in the development workflow. We use hooks to enhance the development experience with automatic checks, notifications, and contextual information.

## Configured Hooks

### 1. SessionStart Hook: Version Check

**Location:** `.claude/settings.json` → `hooks.SessionStart`

**Purpose:** Automatically check for ClaudeKit updates when a new session starts.

**Configuration:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/version-check.js"
          }
        ]
      }
    ]
  }
}
```

**Behavior:**
- Runs `node .claude/version-check.js` when Claude Code session starts
- Compares current ClaudeKit version with latest GitHub release
- Displays notification if update available
- Caches results for 7 days to minimize API calls
- Cache location: `~/.claudekit/cache/version-check.json`

### 2. PostToolUse Hook: Version Check Explanation

**Location:** `.claude/settings.json` → `hooks.PostToolUse`

**Purpose:** Automatically explain version check output to users after the command runs.

**Configuration:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "filter": {
          "toolName": "Bash"
        },
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'if echo \"$TOOL_INPUT\" | grep -q \"version-check\"; then echo \"\n📊 Version Check Explanation:\n   - Compares your ClaudeKit version with the latest release\n   - Notifies you if updates are available\n   - Cache is refreshed every 7 days\n   - Cached at: ~/.claudekit/cache/version-check.json\" >&2; fi'",
            "continueOnError": true
          }
        ]
      }
    ]
  }
}
```

**Behavior:**
- Triggers after any Bash command executes (`PostToolUse` event)
- Filters for commands containing "version-check"
- Outputs explanation to stderr (visible to user but doesn't interfere with command output)
- Uses `continueOnError: true` to prevent hook failures from blocking workflow
- Provides context about:
  - What the version check does
  - Update notification behavior
  - Cache refresh interval
  - Cache file location

**Why PostToolUse instead of prompt-based hook:**

Prompt-based hooks are limited to specific events (`PreToolUse`, `Stop`, `SubagentStop`, `UserPromptSubmit`) and are designed for decision-making (approve/block), not output explanation. PostToolUse command hooks are the appropriate choice for adding contextual information after tool execution.

### 3. PostToolUse Hook: File Modularization Review

**Location:** `.claude/settings.json` → `hooks.PostToolUse`

**Purpose:** Automatically review large files and suggest modularization strategies.

**Configuration:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Review the modified file in $ARGUMENTS. If it is >200 LOC that would benefit from modularization. Suggest specific split strategies. Use kebab-case for file names with a meaningful name that describes the purpose of the file, make sure when LLMs read the file names while using Grep or other tools, they can understand the purpose of the file without reading the file content."
          }
        ]
      }
    ]
  }
}
```

**Behavior:**
- Triggers after Write tool executes
- Uses LLM (prompt-based hook) to analyze file size and complexity
- Suggests modularization if file exceeds 200 lines of code
- Recommends kebab-case naming conventions
- Ensures file names are descriptive for better code navigation

## Hook Types

### Command Hooks

Execute bash commands with access to hook context variables:
- `$TOOL_INPUT` - The input provided to the tool
- `$TOOL_OUTPUT` - The output from the tool (PostToolUse only)
- `$TOOL_NAME` - Name of the tool that was executed

**Best for:**
- Deterministic checks (syntax validation, path checking)
- System commands and scripts
- Fast, predictable operations

### Prompt-Based Hooks

Query an LLM for context-aware decision-making:

**Available events:**
- `PreToolUse` - Before tool execution
- `Stop` - When main agent finishes
- `SubagentStop` - When subagents complete
- `UserPromptSubmit` - When users submit prompts

**Best for:**
- Complex criteria requiring natural language understanding
- Nuanced judgments about code quality
- Context-aware evaluations

**Not suitable for:**
- Explaining command output (use PostToolUse command hooks instead)
- Events outside the supported list above

## Troubleshooting

### Version Check Hook Not Running

1. **Check cache age:** Cache may be fresh (<7 days old)
   ```bash
   cat ~/.claudekit/cache/version-check.json
   ```

2. **Clear cache to force refresh:**
   ```bash
   rm ~/.claudekit/cache/version-check.json
   ```

3. **Verify hook configuration:**
   ```bash
   cat .claude/settings.json | grep -A 10 SessionStart
   ```

### Hook Errors

- Check stderr output for error messages
- Ensure bash is available in PATH
- Verify node is installed for version-check.js
- Review hook command syntax

### Disable Version Check

To disable version check temporarily:

1. **Option 1:** Remove SessionStart hook from `.claude/settings.json`
2. **Option 2:** Set environment variable:
   ```bash
   export NO_UPDATE_NOTIFIER=1
   ```

## References

- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks.md)
- [Version Cache Manager](../src/lib/version-cache.ts)
- [Version Checker](../src/lib/version-checker.ts)

## Changelog

- **2025-01-16:** Added PostToolUse hook for version check explanation
- **2024-11-XX:** Initial SessionStart hook for version checking
- **2024-11-XX:** Added PostToolUse prompt-based hook for file modularization
