# Project Roadmap: ClaudeKit CLI

**Last Updated**: 2026-04-16
**Version**: 3.41.4-dev.26
**Repository**: https://github.com/mrgoonie/claudekit-cli

---

## Project Overview

ClaudeKit CLI (`ck`) is a command-line tool for bootstrapping and updating ClaudeKit projects from private GitHub releases. Built with Bun and TypeScript, provides fast, secure project setup and maintenance with cross-platform support.

**Current Status**: Active Development / Maintenance Phase

## Desktop Control Center Foundation

- Tauri v2 native shell now has Phase 1 backend coverage for sessions, entity browsers, MCP discovery, dashboard aggregates, and system diagnostics.
- Typed invoke wrappers in `src/ui/src/lib/tauri-commands.ts` cover the expanded native command surface.
- Phase 3 now adds unsigned desktop distribution plumbing: portable release assets, a plain `desktop-manifest.json` download manifest, and reusable desktop install/launch helpers.
- Phase 4 now ships `ck app`, which detects an installed desktop binary, downloads and installs it on demand, and launches the native Control Center.
- Phase 5A removes the Express boot requirement from Tauri desktop mode for supported native reads and routes unsupported flows back to CLI/web guidance.
- Phase 5B expands the native tray with recent projects, dashboard/settings shortcuts, project recency tracking, and system-terminal launch for the most recent project.
- Phase 5C adds a desktop-first first-run onboarding flow that scans common development folders, lets users register discovered projects, and persists onboarding completion in the native store.
- Browser mode still uses the Express `/api` backend for `ck config` and the remaining server-backed flows.

---

## Release Timeline

### Version 3.36.0-dev.11 (Current Development)
**Release Date**: 2026-03-05
**Status**: IN PROGRESS

#### New Social Content Daemon
- **Content Command**: `ck content` (NEW) - Multi-daemon for monitoring Git repos and publishing social media content
- **Subcommands**: start, stop, status, logs, setup, queue, approve, reject
- **Features**:
  - ✅ Git scanning with repo discovery and event classification (commit, PR, tag, plan, release)
  - ✅ Content generation via Claude CLI with 4-strategy JSON parser
  - ✅ SQLite database (WAL mode) for content and event persistence
  - ✅ Review modes: auto, manual, hybrid (score-based)
  - ✅ Platform adapters: X (Twitter) via xurl CLI, Facebook via Graph API v21.0
  - ✅ Engagement tracking and performance analytics
  - ✅ Interactive setup wizard with @clack/prompts
  - ✅ State persistence in `.ck.json` under content key
  - ✅ Graceful signal handling and lock file management
  - ✅ Security: credential sanitization, stdin-based prompts

#### Recent Improvements (#339-#462)
### Version 3.36.0-dev.7 (Current Development)
**Release Date**: 2026-03-02
**Status**: IN PROGRESS

#### New Features in This Release
- **ck watch Command (f36249e)**: GitHub Issues auto-responder daemon
  - Process locking prevents concurrent executions
  - Polls GitHub Issues at configurable intervals (default: 30s)
  - Invokes `/ck:brainstorm` skill for issue analysis
  - Invokes `/ck:plan` skill for structured response planning
  - Multi-turn conversations (configurable, max 10 turns/issue)
  - Rate limiting (configurable, max 10 issues/hour)
  - Credential scanning (9 patterns, blocks unsafe posting)
  - Input sanitization against 6+ prompt injection patterns
  - Graceful SIGINT/SIGTERM shutdown with state persistence
  - Daily rotated logging in ~/.claudekit/logs/
  - CLI flags: --interval, --dry-run, --verbose
  - Configuration in .ck.json with timeouts, author exclusions, branding
  - 73 tests across 7 test files
  - Designed for 6-8+ hour unattended overnight operation
- **ck api Command Group (d06dbb3)**: 20+ subcommands for ClaudeKit.cc backend API interaction
  - Core: `api status`, `api services`, `api setup`, `api proxy`
  - VidCap: `api vidcap {info,search,summary,caption,screenshot,comments,media}`
  - ReviewWeb: `api reviewweb {scrape,summarize,markdown,extract,links,screenshot,seo-*}`
  - HTTP client with auth, rate limit retry on 429, typed error handling
  - All handlers support `--json` output
- **Skills agentskills.io Integration**: Support for `metadata.version` and `metadata.author` fields (0feb2d7)
- **Migrate UX Overhaul (PR #457)**: Action tabs (Install/Update/Skip/Delete/Conflict), type sub-sections, smart provider auto-selection, default scope to Global
- **Hooks Migration (PR #455)**: hooks settings merger, hooks migration with settings.json auto-registration
- **Droid Hooks (PR #454)**: Droid hooks migration support, explicit hooks capability per provider
- **UI Improvements**: Biome formatting for JSX, conflict branch type comparison, tab sync, expand state reset
- **Skills Dependencies**: New `skills-dependencies.ts` type file
- **API Key Domain**: New secure API key storage & validation domain
- **Claude Data Service**: New service for parsing Claude user data (history, sessions)
- **Gemini MCP Support**: Package installer submodule for Gemini MCP linking
- **Dashboard Enhancements**: WebSocket live updates, config editor, migration plan viewer with conflict resolver & diff viewer

#### Earlier Improvements (#339-#346)
- **#346 Stale lock fix**: Global exit handler, activeLocks registry, 1-min stale timeout
- **#344 Installation detection**: Fallback support for installs without metadata.json
- **#343 Dev prerelease suppression**: Hide dev→stable update notifications
- **Skills rename**: Command renamed from `skill` to `skills`, multi-select, registry
- **Deletion handling**: Glob pattern support via picomatch, cross-platform path.sep
- **#339 Sync validation**: Filter deletion paths before validation
- **#413 Migration Reconciliation**: Architecture docs, installer rollback protections, regression tests
- **#462 Plan command**: Parse, validate, status, kanban, create, check, uncheck, add-phase

### Version 1.17.0 (Previous)
#### Migration Reconciliation (PR #413) - Completed
- ✅ Architecture documentation: `docs/reconciliation-architecture.md`
- ✅ Installer rollback protections for write-before-registry failures
- ✅ Regression tests for rollback behavior and mock isolation
- ✅ Portable migration system for idempotent updates
- ✅ Dashboard conflict resolver with diff preview

### Version 1.17.0 (Previous - In Development)
**Release Date**: 2025-12-21
**Status**: ✅ STABLE

#### Major Codebase Refactoring Complete
- **Codebase Modularization**: Major refactor reducing 24 large files (~12,197 lines) to facades (~2,466 lines) with 122 new focused modules
- **Facade Pattern**: All domains now expose facade files for backward compatibility
- **Phase Handler Pattern**: Complex commands use orchestrator + phase handlers
- **File Size Target**: 200-line hard limit, 100-line target for submodules
- **Self-Documenting Names**: kebab-case file names describe purpose

#### Modularized Components
- `init.ts` → `init/` (12 modules: orchestrator + 8 phase handlers + types)
- `new.ts` → `new/` (5 modules: orchestrator + 3 phase handlers)
- `uninstall.ts` → `uninstall/` (5 modules: command + handlers)
- `download-manager.ts` → `download/`, `extraction/`, `utils/` (12 modules)
- `claudekit-checker.ts` → `checkers/`, `utils/` (14 modules)
- `github-client.ts` → `client/` (6 modules)
- `settings-merger.ts` → `merger/` (6 modules)
- `version-selector.ts` → `selection/` (3 modules)
- `version-checker.ts` → `checking/` (5 modules)
- `skills-customization-scanner.ts` → `customization/` (3 modules)
- `package-installer.ts` → types, validators, installers (7 modules)
- And 13 more domains modularized...

### Version 1.16.0 (Previous - Released)
**Release Date**: 2025-11-26
**Status**: ✅ STABLE

#### Completed Features
- ✅ **Init Command** (Renamed from update, deprecation warning)
- ✅ **Fresh Installation** (--fresh flag for clean reinstall)
- ✅ **Beta Version Support** (--beta flag for pre-releases)
- ✅ **Command Prefix** (--prefix flag for /ck: namespace)
- ✅ **Optional Packages** (OpenCode, Gemini integration)
- ✅ **Skills Dependencies** (--install-skills auto-installation)
- ✅ **Update Notifications** (7-day cached version checks)
- ✅ **Release Caching** (Configurable TTL for release data)
- ✅ **Uninstall Command** (Safe removal of installations)
- ✅ **Version Selection** (Interactive version picker)
- ✅ **Global Path Resolution** (XDG-compliant, cross-platform)

### Version 1.5.1
**Release Date**: 2025-11-16
**Status**: ✅ STABLE

- ✅ Bug fixes (bun version pinning, biome linting, version cache)
- ✅ Update notifications fixed
- ✅ Cross-platform compatibility improvements

#### Global Path Resolution Implementation (Complete ✅)
**Status**: ✅ COMPLETE
**Completion Date**: 2025-11-24
**Code Review Score**: 9.5/10 (Excellent)
**Test Coverage**: 625 tests passing

**Problem Solved**:
- CLI failed when installed globally due to hardcoded `.claude/` prefixes
- No centralized path resolution for global vs local installation modes
- Inconsistent directory structure handling across platforms

**Implementation Details**:
- **Files Updated**: 6 critical files updated to use centralized path logic
- **New PathResolver Methods**:
  - `getPathPrefix(global)`: Returns directory prefix based on mode
  - `buildSkillsPath(baseDir, global)`: Builds skills directory paths
  - `buildComponentPath(baseDir, component, global)`: Builds component paths
- **Pattern Matching**: Automatic detection of local vs global directory structures
- **Cross-Platform Support**: XDG compliance for Unix, %LOCALAPPDATA% for Windows
- **Backward Compatibility**: Preserves existing local installation behavior

**Quality Assurance**:
- **Testing**: 625 tests passing with comprehensive coverage
- **Code Review**: 9.5/10 rating, production-ready
- **Security**: Proper path validation and traversal prevention
- **Performance**: No performance impact, optimized path resolution

**Global vs Local Modes**:
```
Local Mode (Project Installation):
/project/.claude/{agents,commands,rules,hooks,skills}

Global Mode (Kit Installation):
~/.claude/{agents,commands,rules,hooks,skills}
```

---

## Feature Roadmap by Phase

### Phase 1: Core Functionality (Complete ✅)
**Status**: 100% Complete
**Completion Date**: 2025-09-xx

**Features**:
- ✅ Project initialization from releases
- ✅ Multi-tier authentication
- ✅ Streaming downloads with progress
- ✅ Basic file merging
- ✅ Version listing

**Quality Metrics**:
- Test Coverage: 85%+
- Code Review Score: 8.0/10+
- Production Ready: Yes

---

### Phase 2: Advanced Features (Complete ✅)
**Status**: 100% Complete
**Completion Date**: 2025-10-xx

**Features**:
- ✅ Smart file conflict detection
- ✅ Custom .claude file preservation
- ✅ Skills directory migration (flat → categorized)
- ✅ Backup & rollback capability
- ✅ Protected file patterns
- ✅ Exclude pattern support
- ✅ Global configuration management

**Quality Metrics**:
- Test Coverage: 85%+
- Code Review Score: 8.2/10+
- Production Ready: Yes

---

### Phase 4: Codebase Modularization (Complete ✅)
**Status**: 100% Complete
**Completion Date**: 2025-12-21

**Features**:
- ✅ Facade pattern for all domains
- ✅ Phase handler pattern for complex commands
- ✅ 200-line file size limit enforcement
- ✅ Self-documenting kebab-case file names
- ✅ 122 new focused modules created
- ✅ Backward compatibility maintained
- ✅ All tests passing

**Quality Metrics**:
- Original Files: 24 large files (~12,197 lines)
- Facade Lines: ~2,466 lines
- New Modules: 122 focused submodules
- Test Coverage: All existing tests passing
- Code Review Score: Production-ready

---

### Phase 3: Diagnostics & Polish (Complete ✅)
**Status**: 100% Complete
**Completion Date**: 2025-11-16

**Features**:

#### 3.1 Uninstall Command (Complete ✅)
**Status**: ✅ COMPLETE
**Completion Date**: 2025-11-16
**Code Review Score**: A+ (Excellent)

**Implementation**:
- Files: `src/commands/uninstall.ts` (119 lines)
- Implementation Time: ~2 hours (as planned)
- Code Review: Approved (No critical/high issues)

**Features**:
- ✅ Detects local and global `.claude` installations
- ✅ Displays paths with clear formatting
- ✅ Interactive confirmation required (safe default)
- ✅ Non-interactive mode with `--yes`/`-y` flag
- ✅ Safely removes directories with recursive + force
- ✅ Cross-platform support (Windows, macOS, Linux)
- ✅ Graceful error handling with context-rich messages
- ✅ Validates installations have valid metadata.json

**Security Features**:
- User confirmation required before deletion
- Shows paths clearly before deletion
- No elevation/sudo required
- Safe path handling (no user-controlled paths)
- No shell injection vectors

**Quality Metrics**:
- TypeScript Errors: 0
- Linting Errors: 0
- File Size: 119 LOC (target <500)
- Security Issues: None identified
- Platform Support: Windows, macOS, Linux ✅

**Phase 4 Status**:
- Unit Tests: Recommended (optional)
- README Update: Recommended
- Manual Testing: Pending

#### 3.2 Doctor Command (Complete ✅)
**Status**: ✅ COMPLETE
**Completion Date**: 2025-11-16
**Code Review Score**: 8.5/10 (Production-Ready)

**Implementation**:
- Files: `src/commands/doctor.ts` (267 lines)
- Utils: `src/utils/dependency-checker.ts` (270 lines)
- Utils: `src/utils/dependency-installer.ts` (350 lines)
- Test Coverage: 50 passing tests, 324 assertions

**Features**:
- ✅ Checks Claude CLI installation (optional, v1.0.0+)
- ✅ Checks Python 3.8.0+ installation
- ✅ Checks pip installation
- ✅ Checks Node.js 16.0.0+ installation
- ✅ Checks npm installation
- ✅ Auto-detects OS and package managers
- ✅ Interactive installation with confirmation
- ✅ Manual installation instructions
- ✅ Non-interactive mode (CI/CD compatible)
- ✅ Cross-platform support (Windows, macOS, Linux, WSL)
- ✅ Displays ClaudeKit setup (global & project)
- ✅ Reports component counts (agents, commands, rules, skills)

**Platform Support**:
- ✅ Windows (PowerShell installer)
- ✅ macOS (Homebrew, installer script)
- ✅ Linux (apt, dnf, pacman, installer script)
- ✅ WSL (Windows Subsystem for Linux)

**Security Features**:
- User confirmation required in interactive mode
- No automatic sudo/admin elevation
- Secure installation URLs (verified against official docs)
- Graceful degradation with manual fallback
- CI/CD safe (no prompts in non-interactive mode)

**Documentation**:
- ✅ README.md updated (lines 161-196)
- ✅ docs/codebase-summary.md enhanced
- ✅ docs/code-standards.md added security standards
- ✅ docs/project-overview-pdr.md updated
- ✅ Integration tests validated

#### 3.3 Diagnose Command (Complete ✅)
**Status**: ✅ COMPLETE

**Features**:
- ✅ Authentication status checking
- ✅ GitHub access verification
- ✅ Release availability validation
- ✅ Token scope verification
- ✅ Verbose diagnostics mode

#### 3.4 Binary Distribution (Complete ✅)
**Status**: ✅ COMPLETE

**Features**:
- ✅ Cross-platform binary compilation
- ✅ Automated release packaging
- ✅ Platform-specific installers
- ✅ Checksum verification
- ✅ GitHub Actions workflows

#### 3.5 Update Notifications (Complete ✅)
**Status**: ✅ COMPLETE

**Features**:
- ✅ Version check caching (7-day cache)
- ✅ New version notifications
- ✅ Cache disabling support
- ✅ Cross-platform cache location

**Quality Metrics**:
- Test Coverage: 85%+
- Code Review Score: 8.3/10+
- Production Ready: Yes

---

## Quality Metrics

### Test Coverage
- **Current**: 97%+ across all modules (625 tests passing)
- **Target**: Maintain 95%+ minimum
- **Test Suite**: 50+ integration tests for doctor command alone
- **Global Path Resolution**: Comprehensive test coverage for new PathResolver methods

### Code Review Standards
- **Target Score**: 8.0/10+
- **Current Average**: 8.2/10
- **Doctor Command**: 8.5/10 (Production-Ready)

### Security Standards
- All dependencies verified
- Installation URLs validated against official sources
- User confirmation required for elevated operations
- No hardcoded credentials
- Secure keychain storage for tokens

---

## Known Issues & Enhancements

### Completed Enhancements
- ✅ Windows PowerShell installation support
- ✅ Multi-platform package manager detection
- ✅ Error handling for partial installations
- ✅ WSL environment detection

### Future Enhancements (Low Priority)
- Consider: Windows Package Manager (winget) support
- Consider: Chocolatey package manager integration
- Consider: Interactive troubleshooting guide
- Consider: Installation failure retry logic
- Consider: Network error detection & recovery

### Documentation Gaps (Closed)
- ✅ Troubleshooting guide for doctor command
- ✅ Platform-specific notes (WSL, M1 Macs)
- ✅ Expected output examples
- ✅ Security practices codified in standards

---

## Success Metrics

### User Experience
- ✅ Installation time: <2 minutes from scratch
- ✅ Error messages: Clear and actionable
- ✅ Documentation: Comprehensive and accessible
- ✅ CLI output: Beautiful and readable

### Reliability
- ✅ Test pass rate: 100% (625/625 total tests)
- ✅ Error handling: Graceful degradation
- ✅ Cross-platform: All major OS supported
- ✅ CI/CD: Non-interactive mode functional
- ✅ Global path resolution: Production-ready with 9.5/10 code review

### Maintainability
- ✅ Code clarity: 8.5/10 review score
- ✅ Type safety: Full TypeScript coverage
- ✅ Documentation: Kept current with releases
- ✅ Test coverage: 85%+ across codebase

---

## Dependencies & Compatibility

### Runtime Dependencies
- Node.js 16.0.0+
- Python 3.8.0+
- npm (latest)
- Claude CLI 1.0.0+ (optional)

### Development Dependencies
- Bun 1.3.2+
- TypeScript 5.0+
- Biome 1.0+ (linting)
- Vitest (testing)

---

## Release History

### v1.5.1 (Current)
- Release Date: 2025-11-16
- Status: Stable
- Changes: Bug fixes, version pinning, doctor command completion

### v1.5.0
- Release Date: 2025-11-xx
- Status: Stable
- Changes: Doctor command, diagnostics, update notifications

### v1.4.x
- Status: Previous stable
- Changes: Skills migration, file merging enhancements

### v1.0.0 - v1.3.x
- Status: Legacy (still supported)
- Changes: Initial releases through feature maturity

---

## Maintenance Schedule

### Regular Tasks
- **Weekly**: Monitor GitHub issues and PRs
- **Monthly**: Dependency updates and security patches
- **Quarterly**: Major feature review and planning
- **As Needed**: Hotfixes for critical issues

### Documentation Updates
- Update roadmap after each major release
- Update changelog for all notable changes
- Keep code examples current
- Archive outdated documentation

---

## Contact & Support

- **Repository**: https://github.com/mrgoonie/claudekit-cli
- **NPM Package**: https://www.npmjs.com/package/claudekit-cli
- **Issues**: GitHub Issues
- **Documentation**: https://github.com/mrgoonie/claudekit-cli/tree/main/docs

---

## Project Completion Status

| Category | Status | Completion % | Last Updated |
|----------|--------|--------------|--------------|
| Core Features | Complete | 100% | 2025-11-26 |
| Advanced Features | Complete | 100% | 2025-11-26 |
| Diagnostics & Doctor | Complete | 100% | 2025-11-26 |
| Testing | Complete | 100% | 2025-11-26 |
| Documentation | Complete | 100% | 2025-12-21 |
| Code Quality & Standards | Complete | 100% | 2025-11-26 |
| Modularization | Complete | 100% | 2025-12-21 |
| **Reconciliation & Migration** | **Complete** | **100%** | **2026-02-20** |
| **Dashboard & Web UI** | **In Progress** | **85%** | **2026-03-02** |
| **Skills & API Key** | **In Progress** | **75%** | **2026-03-02** |
| **Hooks Migration** | **Complete** | **100%** | **2026-02-15** |
| **GitHub Issues Auto-Responder (watch)** | **Complete** | **100%** | **2026-03-03** |
| **OVERALL** | **PRODUCTION READY** | **93%** | **2026-03-03** |

---

## Notes

- All core functionality production-ready and actively maintained
- v1.17.0 introduces major codebase modularization with 122 focused modules
- v1.16.0 introduces init command, fresh install, beta versions, optional packages
- Future development focuses on maintenance, security updates, minor enhancements
- No breaking changes anticipated in v1.x releases
- Modularization improves maintainability and LLM context efficiency
