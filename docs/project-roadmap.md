# Project Roadmap: ClaudeKit CLI

**Last Updated**: 2026-01-29
**Version**: 3.32.0-dev.3 (next stable: 3.32.0)
**Repository**: https://github.com/mrgoonie/claudekit-cli

---

## Project Overview

ClaudeKit CLI (`ck`) is a command-line tool for bootstrapping and updating ClaudeKit projects from private GitHub releases. Built with Bun and TypeScript, provides fast, secure project setup and maintenance with cross-platform support.

**Current Status**: Active Development / Maintenance Phase

---

## Release Timeline

### Version 3.32.0-dev.3 (Current Development)
**Release Date**: 2026-01-29
**Status**: IN PROGRESS

#### Recent Improvements (#339-#346)
- **#346 Stale lock fix**: Global exit handler, activeLocks registry, 1-min stale timeout
- **#344 Installation detection**: Fallback support for installs without metadata.json
- **#343 Dev prerelease suppression**: Hide dev→stable update notifications
- **Skills rename**: Command renamed from `skill` to `skills`, multi-select, registry
- **Deletion handling**: Glob pattern support via picomatch, cross-platform path.sep
- **#339 Sync validation**: Filter deletion paths before validation

### Version 1.17.0 (Previous - In Development)
**Release Date**: 2025-12-21
**Status**: SUPERSEDED

#### Major Refactoring Complete
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
| Diagnostics | Complete | 100% | 2025-11-26 |
| Testing | Complete | 100% | 2025-11-26 |
| Documentation | Complete | 100% | 2025-12-21 |
| Code Quality | Complete | 100% | 2025-11-26 |
| **Modularization** | **Complete** | **100%** | **2025-12-21** |
| **OVERALL** | **PRODUCTION READY** | **100%** | **2025-12-21** |

---

## Notes

- All core functionality production-ready and actively maintained
- v1.17.0 introduces major codebase modularization with 122 focused modules
- v1.16.0 introduces init command, fresh install, beta versions, optional packages
- Future development focuses on maintenance, security updates, minor enhancements
- No breaking changes anticipated in v1.x releases
- Modularization improves maintainability and LLM context efficiency
