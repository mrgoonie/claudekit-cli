# ClaudeKit Watch Command (`ck watch`)

## Overview

`ck watch` is a GitHub issue monitoring daemon that automatically detects new issues with specific labels, generates AI-powered analysis and implementation plans via Claude CLI, and creates pull requests with proposed solutions. Designed for 6-8+ hour unattended overnight operation.

**Key Features:**
- Real-time GitHub issue polling (configurable intervals)
- Label-based filtering (e.g., "good-first-issue", "auto-implement")
- Multi-repo support with automatic repository discovery
- AI-powered issue analysis and implementation planning via Claude CLI
- Branch creation and pull request submission
- Approval workflow with manual/auto modes
- Rate limiting and graceful shutdown
- Process locking to prevent duplicate daemons

---

## Quick Start

```bash
# Start watch daemon (single or multi-repo)
ck watch

# With custom poll interval (milliseconds)
ck watch --interval 30000

# Dry-run: detect issues without posting PRs
ck watch --dry-run

# Force restart (kill existing instance)
ck watch --force

# Follow verbose logging
ck watch --verbose
```

---

## Architecture

```mermaid
flowchart TD
    A["Start Daemon<br/>ck watch"] --> B["Discover Repos<br/>Single or multi-repo mode"]
    B --> C["Load Config<br/>from .ck.json watch key"]
    C --> D["Validate Setup<br/>GitHub token, repo access"]
    D --> E["Write PID Lock<br/>~/.claudekit/locks/ck-watch.lock"]
    E --> F["Register Signal Handlers<br/>SIGINT, SIGTERM"]
    F --> G["Main Loop"]
    G --> H["Per-repo Poll Cycle"]
    H --> I["Fetch Issues<br/>GitHub API recent issues"]
    I --> J["Filter Issues<br/>By label, state, assignee"]
    J --> K["Approve Workflow<br/>Manual or auto mode"]
    K --> L["Generate Analysis<br/>Claude CLI on issue details"]
    L --> M["Create Branch<br/>git checkout -b auto-impl-#NNN"]
    M --> N["Make Changes<br/>Based on Claude analysis"]
    N --> O["Create PR<br/>gh pr create"]
    O --> P["Track State<br/>Store issue status"]
    P --> Q["Sleep poll interval"]
    Q --> R{"Abort?"}
    R -->|No| G
    R -->|Yes| S["Graceful Shutdown<br/>Save state, remove lock"]
    S --> T["Print Summary<br/>Issues processed, PRs created"]
    T --> U["Exit"]
```

---

## Repository Discovery

Watch supports both single-repo and multi-repo modes:

### Single-Repo Mode
When CWD is a git repository:
```bash
cd /path/to/my-project
ck watch
# Monitors only this repository
```

Uses `.git/config` to determine repo owner/name:
```
[remote "origin"]
    url = https://github.com/owner/repo-name.git
```

### Multi-Repo Mode
When CWD contains git subdirectories:
```bash
cd /path/to/projects-root
ck watch
# Scans for .git subdirs and monitors all found repos
```

Useful for monorepos or managing multiple projects overnight.

---

## Configuration

Watch is configured via `.ck.json` in project root:

```json
{
  "watch": {
    "enabled": true,
    "pollIntervalMs": 30000,
    "issueLabels": ["auto-implement", "good-first-issue"],
    "approvalMode": "manual",
    "maxIssuesPerHour": 5,
    "processedIssueTtlDays": 7,
    "logMaxBytes": 5242880,
    "claudeCliPath": "ck",
    "branchPrefix": "auto-impl-",
    "prTemplate": "Fixes #{{issue_number}}\n\n{{analysis}}",
    "skipMaintainerReplies": false,
    "autoDetectMaintainers": true,
    "worktree": {
      "enabled": false,
      "baseBranch": "main",
      "maxConcurrent": 3,
      "autoCleanup": true
    }
  }
}
```

### Configuration Fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `enabled` | boolean | false | Enable/disable watch daemon |
| `pollIntervalMs` | number | 30000 | How often to check for new issues (ms) |
| `issueLabels` | string[] | [] | Only process issues with these labels |
| `approvalMode` | "manual" \| "auto" | "manual" | auto = create PR immediately, manual = wait for approval |
| `maxIssuesPerHour` | number | 5 | Rate limit: max issues to process per hour |
| `processedIssueTtlDays` | number | 7 | Expire processed issue entries after N days; auto-migrates legacy `number[]` format to timestamped entries |
| `skipMaintainerReplies` | boolean | false | Skip turn if last comment is from a repo collaborator; see auto-detection below |
| `autoDetectMaintainers` | boolean | true | Auto-detect maintainers via `gh api collaborators` with 1h cache; feature disabled for that cycle on API failure |
| `logMaxBytes` | number | 5242880 | Rotate logs when they exceed this size (5MB default) |
| `claudeCliPath` | string | "ck" | Path to Claude CLI executable |
| `branchPrefix` | string | "auto-impl-" | Prefix for auto-created branches |
| `prTemplate` | string | "{title}\n\n{analysis}" | Template for PR description |
| `worktree` | object | See below | Worktree settings for isolated issue implementations |

### Feature: skipMaintainerReplies & autoDetectMaintainers

When `skipMaintainerReplies` is enabled, the daemon skips its turn if the last comment on an issue is from a repo collaborator (e.g., maintainer, reviewer). This prevents stepping on human feedback.

```json
{
  "skipMaintainerReplies": true,
  "autoDetectMaintainers": true
}
```

**Auto-Detection:**
- Queries `gh api repos/{owner}/{repo}/collaborators` on first issue with maintainer check
- Caches results for 1 hour to minimize API usage
- If API call fails, feature is disabled for that poll cycle and retried next cycle
- Fallback: When disabled, `skipMaintainerReplies` is ignored

**Example:** Issue #42 has last comment from user @maintainer (repo collaborator). Daemon detects this and skips processing, allowing human to guide the solution.

### Feature: processedIssueTtlDays

Controls how long processed issue entries remain in state before expiring. Prevents state file bloat on long-running daemons.

```json
{
  "processedIssueTtlDays": 7
}
```

**Migration:**
- Legacy format: `processedIssues: [123, 456, 789]` (array of numbers)
- New format: `processedIssues: [{ issueNumber: 123, processedAt: "2026-03-27T..." }, ...]`
- Auto-migrates on startup; legacy entries get current timestamp

**Cleanup:**
- Entries older than N days are removed from state on each poll cycle
- `activeIssues` entries in error/timeout states cleaned after 24h
- Example: `processedIssueTtlDays: 7` means issues expire after 7 days

### Feature: Worktree Support

When enabled, each issue implementation runs in an isolated git worktree (`.worktrees/issue-{N}`) instead of switching branches in the main checkout. Eliminates stash/branch pollution and simplifies cleanup.

```json
{
  "worktree": {
    "enabled": false,
    "baseBranch": "main",
    "maxConcurrent": 3,
    "autoCleanup": true
  }
}
```

**Configuration:**
- `enabled` (boolean, default false) — Enable worktree isolation
- `baseBranch` (string, default "main") — Base branch for new worktrees
- `maxConcurrent` (number, default 3) — Reserved for future parallel support; currently unused
- `autoCleanup` (boolean, default true) — Auto-clean worktrees on startup and shutdown

**Behavior:**
- Each issue gets `.worktrees/issue-{issueNumber}/` directory
- Branch created from `baseBranch` within that worktree
- Implementation happens in isolation, no main checkout pollution
- Cleaned up after PR creation or rejection
- On daemon startup, stale worktrees from crashed sessions cleaned

**Example:**
```
# With worktree enabled
.worktrees/
├── issue-123/           # Implementation for #123
├── issue-124/           # Implementation for #124
└── issue-125/           # Cleaned up after PR merged
```

### Feature: Rate Limit Persistence

`processedThisHour` and `hourStart` now persist to state file. If daemon crashes and restarts within the same hour, the rate limit counter is restored instead of resetting.

**State File:**
```json
{
  "lastScanAt": "2026-03-27T14:30:00Z",
  "hourStart": "2026-03-27T14:00:00Z",
  "processedThisHour": 3,
  "activeIssues": { ... }
}
```

**Behavior:**
- On startup, check if current hour matches `hourStart`
- If yes, restore `processedThisHour` counter
- If no (new hour), reset counter to 0 and update `hourStart`
- Prevents rate limit bypass via daemon restart
- Example: Daemon processes 3 issues (3/5 limit) then crashes. Restart within same hour restores `processedThisHour: 3`, respecting the limit.

---

## Issue Processing Flow

### 1. Issue Detection

```mermaid
flowchart TD
    A["Fetch Issues<br/>GitHub API per_page=50"] --> B["Filter by Labels"]
    B --> C["Filter by State<br/>open, not assigned"]
    C --> D["Filter by Created Date<br/>Since last scan"]
    D --> E["Deduplicate<br/>Track processed issue IDs"]
    E --> F["Apply Rate Limit<br/>max N per hour"]
    F --> G["Return Filtered Issues"]
```

**API Call:**
```bash
gh api repos/{owner}/{repo}/issues \
  --state=open \
  --labels=auto-implement \
  --sort=created \
  --direction=desc \
  --limit=50
```

**Filtering:**
- State: `open` only (skip closed, draft PRs)
- Labels: Exact match against configured labels
- Recently created: Skip if processed in this session
- Rate limit: Max 5 per hour (configurable)

### 2. Approval Workflow

#### Manual Mode (Default)
```
Issue detected → Status: "new" → Wait for human approval
ck watch approve #123
→ Status: "approved" → Proceed to analysis
```

#### Auto Mode
```
Issue detected → Status: "awaiting_approval" → Auto-approve → Status: "approved"
```

### 3. Analysis & Planning

Spawn Claude CLI with issue details:

```bash
echo "Issue: {title}
Description: {body}
Labels: {labels}

Analyze this GitHub issue and:
1. Understand the requirement
2. Identify implementation steps
3. Suggest code changes
4. Create a plan for a pull request" | ck --stream
```

Claude's response parsed for:
- **Understanding**: What the issue asks for
- **Implementation Steps**: Numbered list of changes
- **Code Plan**: Pseudo-code or actual code suggestions
- **PR Summary**: Brief summary for pull request

**State:** Issue → `"brainstorming"`

### 4. Branch & Implementation

```bash
# Create branch from main/master
git checkout main
git pull origin main
git checkout -b auto-impl-123

# Make changes based on analysis
# (actual implementation varies by issue type)

# Stage and commit
git add .
git commit -m "feat: Auto-implement issue #123

Based on AI analysis via ck watch daemon
Suggested implementation: [Claude analysis summary]"
```

**State:** Issue → `"planning"`

### 5. Pull Request Creation

```bash
gh pr create \
  --title "Auto-implement: {issue_title}" \
  --body "Fixes #{issue_number}

{claude_analysis_summary}

Generated by: ck watch daemon" \
  --head auto-impl-123 \
  --base main
```

**State:** Issue → `"awaiting_approval"`

Daemon waits for manual approval to merge PR.

---

## Rate Limiting

### Per-Hour Limits

```json
"maxIssuesPerHour": 5
```

Prevents overwhelming the system:
- Tracks issues processed in current hour
- Hour resets at top of each hour (UTC)
- If limit reached, daemon continues polling but skips processing

**Example Log:**
```
[12:45] Processed issue #42 (2/5 this hour)
[12:50] Processed issue #43 (3/5 this hour)
[12:55] Issue #44 detected but rate limit reached (5/5 this hour)
```

### GitHub API Rate Limits

Respects GitHub's rate limits:
- **Unauthenticated**: 60 requests/hour
- **Authenticated**: 5,000 requests/hour

Watch uses `gh auth token` for higher limits. Check status:
```bash
gh api rate_limit
```

---

## State Management

Runtime state persisted at `~/.claudekit/watch.state.json`:

```typescript
interface WatchState {
  lastScanAt: string;           // ISO 8601 of last poll
  activeIssues: {
    [issueNumber: string]: {
      number: number;
      status: "new" | "approved" | "brainstorming" | "planning" | "awaiting_approval" | "pr_created" | "merged" | "rejected";
      title: string;
      prNumber?: number;
      prUrl?: string;
      createdAt: string;
      updatedAt: string;
      branchName: string;
    }
  };
  currentlyImplementing: number | null;  // Currently being implemented
}
```

**State Transitions:**

```mermaid
stateDiagram-v2
    [*] --> new
    new --> approved: manual approve
    new --> approved: auto (if autoApprove)
    approved --> brainstorming: Claude analysis started
    brainstorming --> planning: Branch created
    planning --> awaiting_approval: PR created
    awaiting_approval --> pr_created: Manual merge approved
    pr_created --> merged: gh pr merge
    merged --> [*]
    new --> rejected: Reject
    rejected --> [*]
```

---

## Plan Directory Resolution

Watch integrates with ClaudeKit's plan system:

### Detection
When an issue mentions `.claude/plans/` or references a plan:
```
Fixes #123

Related to plan: plans/260305-1300-feature-name/
```

Watch resolves the plan directory and can:
1. Extract existing requirements
2. Add implementation progress
3. Create/update phase files based on analysis

### Configuration
```json
"planDirPattern": "plans/\\d+-\\d+-[a-z-]+/",
"updatePlansOnImplementation": true
```

---

## Graceful Shutdown

Watch respects shutdown signals for long-running operations:

### SIGINT / SIGTERM
```bash
# Keyboard interrupt (Ctrl+C) or system shutdown
# Handler saves state and exits cleanly
```

**Shutdown Sequence:**
1. Set `abortRequested = true` flag
2. Allow current issue to finish processing
3. Revert any in-progress states to "awaiting_approval"
4. Save state file atomically
5. Remove PID lock file
6. Print summary stats
7. Exit cleanly

**Prevents:**
- Orphaned branches
- Partial PR submissions
- State corruption

---

## Process Locking

Watch uses process locking to prevent multiple instances:

```bash
# Lock file location
~/.claudekit/locks/ck-watch.lock

# Contents: process ID
12345
```

**Startup Check:**
```
If lock file exists:
  → Read PID
  → Check if process still running (ps -p PID)
  → If running: error "Another instance detected. Use --force to override"
  → If dead: remove stale lock, proceed
```

**Usage:**
```bash
# Kill existing and start fresh
ck watch --force
```

---

## Logging

Watch logs to `~/.claudekit/logs/watch-YYYYMMDD.log`:

### Log Levels

- **INFO**: Poll cycles, issues detected, PRs created
- **WARN**: Rate limits, approval pending, API issues
- **ERROR**: GitHub API errors, CLI failures

### Log Rotation

- Daily files by date (watch-20250305.log)
- Rotate when file exceeds `logMaxBytes` (5MB default)
- Backup rotated logs: `watch-20250305.log.1`, `.log.2`, etc.

### Verbose Mode

```bash
ck watch --verbose
```

Includes:
- Full API responses (for debugging)
- Claude CLI prompts and outputs
- Git command execution details
- Timing information per phase

---

## Troubleshooting

### Daemon Won't Start

```bash
# Check for stale lock
ls ~/.claudekit/locks/ck-watch.lock

# Check GitHub credentials
gh auth status

# Validate repo access
gh repo view  # from project directory
```

### Issues Not Detected

```bash
# Verify label name exactly matches config
ck watch --verbose  # check logs for API responses

# Check rate limit not hit
gh api rate_limit

# Verify issue state (must be open, not draft)
gh issue list  # should show issues
```

### PR Creation Fails

```bash
# Test gh CLI
gh pr create --dry-run

# Check git status
git status

# Verify main branch exists
git branch -a

# Check push permissions
git push origin --dry-run
```

### Claude Analysis Not Working

```bash
# Test Claude CLI
echo "test" | ck --stream

# Check PATH
which ck

# Verify ck binary works
ck --version
```

---

## Examples

### Monitor Single Repository

```bash
cd ~/my-project
ck watch
# Monitors ~/my-project only
```

### Monitor Multiple Repositories

```bash
cd ~/projects
ck watch
# Scans for .git subdirectories:
# - ~/projects/repo-a/.git
# - ~/projects/repo-b/.git
# - ~/projects/repo-c/.git
# Monitors all three
```

### Custom Poll Interval

```bash
# Check every 15 seconds (for testing)
ck watch --interval 15000

# Check every 5 minutes (production)
ck watch --interval 300000
```

### Dry-Run Mode

```bash
# Detect issues but don't create PRs
ck watch --dry-run

# Check logs to see what would be created
ck watch --dry-run --verbose
```

### Manual Approval Workflow

```bash
# Start daemon
ck watch &

# Check detected issues
sleep 30
ck watch status  # (future: show pending approvals)

# Check logs for pending issues
tail ~/.claudekit/logs/watch-*.log

# Approve specific issue
ck watch approve 123

# Reject issue
ck watch reject 123 --reason "Out of scope"
```

### Force Restart

```bash
# Kill existing daemon and start fresh
ck watch --force --verbose
```

---

## Advanced Configuration

### Custom PR Templates

```json
"prTemplate": "## Summary\nFixes #{issue_number}\n\n## Analysis\n{analysis}\n\n## Changes\n- {changes}\n\nAuto-created by ck watch"
```

**Template Variables:**
- `{issue_number}` - GitHub issue number
- `{issue_title}` - Original issue title
- `{analysis}` - Claude's analysis summary
- `{changes}` - List of code changes
- `{branchName}` - Created branch name

### Custom Branch Prefix

```json
"branchPrefix": "fix/"
```

Results in: `fix-#123-issue-title`

### Filter by Multiple Labels

```json
"issueLabels": ["good-first-issue", "auto-implement", "type:feature"]
```

Issue must have ALL labels to match.

### Auto-Approval Mode

```json
"approvalMode": "auto"
```

All detected issues automatically proceed to analysis without waiting.

---

## Related Documentation

- **Main Command Guide**: `./ck-command-flow-guide.md` - CLI overview
- **Content Command**: `./ck-content.md` - Multi-channel content automation
- **System Architecture**: `./system-architecture.md` - Technical design
