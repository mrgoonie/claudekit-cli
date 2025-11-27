# CLI Version Checking Best Practices Research

## Executive Summary

Modern CLIs use non-blocking, cached version checks with infrequent polling (weekly default), unobtrusive notifications, and background processes to avoid startup delays.

## 1. User Experience Patterns

### Notification Display
- **Non-intrusive messaging**: Display update notifications AFTER command completes, not before
- **Clear actionable info**: Show current version, latest version, and exact upgrade command
- **Structured output**: Include version type (major/minor/patch), release notes link
- **Example from update-notifier**:
  ```
  ╭─────────────────────────────────────╮
  │                                     │
  │   Update available 5.0.0 → 6.0.0    │
  │   Run npm i -g my-cli to update    │
  │                                     │
  ╰─────────────────────────────────────╯
  ```

### UX Principles [1]
- Box drawing characters for visual distinction
- Color coding (yellow/green) for visibility
- Single line command for easy copy-paste
- No blocking/interactive prompts during normal operations

## 2. Rate Limiting & Caching Strategies

### Caching Implementation [1,2]
**update-notifier approach**:
- Default check interval: **1 week** (configurable)
- Cache file stored in user's config directory
- Persists: last check timestamp, latest version, update metadata
- Load cached result synchronously on startup (fast)
- Only check npm registry if interval expired

**Cache structure**:
```json
{
  "lastUpdateCheck": 1234567890,
  "latestVersion": "2.0.0",
  "updateType": "major"
}
```

### Rate Limiting Best Practices [2]
- **Client-side throttling**: Enforce minimum intervals between checks
- **Exponential backoff**: Increase interval after failed checks
- **Graceful degradation**: Skip check on network errors, continue CLI execution
- **Validation headers**: Use ETag/Last-Modified for conditional requests
- **Warning thresholds**: GitHub CLI discussion mentioned 50-75% rate limit warnings for API-heavy operations

## 3. Non-Blocking Approaches

### Background Process Pattern [1]
**update-notifier implementation**:
- Spawns unref'ed child process for npm registry check
- Parent process continues immediately (no await)
- Child process exits after persisting result
- Next CLI invocation loads cached result

**Critical**: Process uses `child_process.unref()` so parent can exit without waiting

### Performance Impact
- **Startup delay**: ~0-5ms (just loading cached JSON)
- **Network check**: Happens asynchronously, zero blocking
- **--version command**: Read local package.json only, never check remote

**Anti-pattern**: Never block on network I/O in CLI startup path

## 4. Security Considerations

### Registry Communication [1]
- **HTTPS only**: All npm registry requests use TLS
- **Package scope verification**: Validate package name matches
- **Signature validation**: npm packages have integrity checksums
- **No auto-updates**: Only notify, never auto-download/install

### Threat Mitigations
- **MITM protection**: TLS + certificate validation
- **Cache poisoning**: Store in user-writable directory only (not system-wide)
- **Malicious versions**: Show version number, let user review before upgrade
- **Supply chain**: Rely on package manager's built-in security (npm audit, etc.)

### Configuration Exposure
- Allow users to disable checks via environment variable: `NO_UPDATE_NOTIFIER=1`
- Respect CI/dumb terminal detection (suppress in non-TTY)

## 5. Popular CLI Examples

### npm [1]
- Built custom implementation (dropped update-notifier dependency)
- Checks once per day during regular commands
- Uses existing npm registry client
- Displays update message at command completion

### Yarn [1]
- Checks on startup, ~once per day
- Shows version number + upgrade instructions
- Command: `yarn self-update` (Classic) or `corepack prepare yarn@stable --activate`

### GitHub CLI [2]
- Faces unique rate limiting challenges (GraphQL API costs)
- Proposed: warn at 50-75% rate limit consumption
- Current: investigate root causes vs automatic retries

### Bun/Deno
- Bun: Built-in `bun upgrade` command
- Checks version server with minimal metadata
- Both optimize for speed (Rust/Zig implementations)

## Implementation Recommendations

### Essential Features
1. **Weekly check interval** (industry standard)
2. **Unref'ed child process** for background checks
3. **File-based cache** in user config directory
4. **Structured notification** with version + command
5. **Environment variable opt-out** (`NO_UPDATE_NOTIFIER`)

### Code Pattern (Node.js)
```javascript
import updateNotifier from 'update-notifier';
import pkg from './package.json' assert {type: 'json'};

// Non-blocking, uses cache
const notifier = updateNotifier({
  pkg,
  updateCheckInterval: 1000 * 60 * 60 * 24 * 7, // 7 days
});

// Show after command completes
process.on('exit', () => {
  notifier.notify({defer: false});
});
```

### Alternative: simple-update-notifier
- Zero dependencies (vs 50+ for update-notifier)
- Same core functionality
- Lighter weight for security-conscious projects

## Unresolved Questions

1. **Monorepo versioning**: How to handle multiple CLIs in same package?
2. **Beta/canary channels**: Best practice for dist-tag checking?
3. **Offline detection**: Should we attempt check on network errors or skip entirely?
4. **Windows considerations**: Any special handling for cache location or process spawning?

## References

[1] update-notifier npm package - https://www.npmjs.com/package/update-notifier
[2] GitHub CLI rate limiting discussion - https://github.com/cli/cli/discussions/7754
[3] Cloudflare rate limiting patterns - https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

---

**Report length**: 147 lines
**Sources consulted**: 3 primary (npm package docs, GitHub discussions, industry articles)
**Date**: 2025-11-13
