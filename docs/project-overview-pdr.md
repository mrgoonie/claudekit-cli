# Project Overview & Product Development Requirements (PDR)

## Project Identity

**Project Name**: ClaudeKit CLI

**Version**: 1.5.1

**Repository**: https://github.com/mrgoonie/claudekit-cli

**NPM Package**: https://www.npmjs.com/package/claudekit-cli

**License**: MIT

## Executive Summary

ClaudeKit CLI (`ck`) is a command-line tool designed to streamline the bootstrapping and updating of ClaudeKit projects from private GitHub repository releases. Built with Bun and TypeScript, it provides developers with a fast, secure, and user-friendly way to create and maintain projects based on premium ClaudeKit starter kits.

### Problem Statement

Developers purchasing ClaudeKit starter kits need an efficient way to:
- Bootstrap new projects from private GitHub releases
- Update existing projects with new versions while preserving customizations
- Manage authentication securely across multiple platforms
- Handle file conflicts intelligently during updates
- Work in both interactive and CI/CD environments

### Solution

ClaudeKit CLI provides a comprehensive solution with:
- Multi-tier authentication fallback system
- Smart file merging with conflict detection
- Protected file patterns to preserve user customizations
- Custom .claude file preservation
- Streaming downloads with progress tracking
- Cross-platform binary distribution
- Flexible exclude patterns for file filtering

## Target Users

### Primary Users
1. **Professional Developers**: Purchasing ClaudeKit kits for production projects
2. **Engineering Teams**: Using ClaudeKit for collaborative development
3. **Solo Developers**: Building projects with Claude Code assistance
4. **CI/CD Engineers**: Automating project setup in pipelines

### User Personas

#### Persona 1: Professional Full-Stack Developer
- **Needs**: Fast project setup, version control integration, team collaboration
- **Pain Points**: Manual project configuration, dependency management
- **Goals**: Focus on feature development rather than boilerplate setup

#### Persona 2: DevOps Engineer
- **Needs**: Automated deployment, CI/CD integration, non-interactive mode
- **Pain Points**: Manual environment setup, inconsistent configurations
- **Goals**: Streamlined automated project initialization

#### Persona 3: Indie Developer
- **Needs**: Quick prototyping, latest features, community templates
- **Pain Points**: Time-consuming setup, outdated templates
- **Goals**: Launch projects rapidly with best practices

## Core Features

### 1. Project Initialization (`ck new`)

#### Functional Requirements
- Create new projects from GitHub releases
- Interactive kit selection (engineer, marketing)
- Directory validation and conflict handling
- Support for specific version selection
- Force overwrite option for non-empty directories
- Exclude pattern support

#### Non-Functional Requirements
- Response time: <5s for release fetch
- Download progress visibility
- Graceful error handling
- Clear success/failure messaging

#### Acceptance Criteria
- User can create project in empty directory without confirmation
- User receives warning for non-empty directories
- Custom exclude patterns are respected
- Progress bars display correctly
- Next steps are shown after successful creation

### 2. Project Updates (`ck update`)

#### Functional Requirements
- Update existing projects to new versions
- Preserve custom .claude files
- Detect and protect user modifications
- Show file conflict warnings
- Request user confirmation before overwriting
- Support version-specific updates

#### Non-Functional Requirements
- Preservation accuracy: 100% for protected patterns
- Conflict detection: <1s for typical projects
- Memory efficient merging
- Safe file operations (no data loss)

#### Acceptance Criteria
- Protected files are never overwritten
- Custom .claude files are preserved
- User confirms before any overwrites
- Version information is validated
- Rollback available on failure

### 3. Version Management (`ck versions`)

#### Functional Requirements
- List all available releases for kits
- Filter by specific kit type
- Display release metadata (date, assets, status)
- Show prerelease and draft releases optionally
- Configurable result limit
- Parallel fetching for multiple kits

#### Non-Functional Requirements
- Fetch time: <3s for 30 releases
- Formatted output with relative dates
- Clear release status indicators
- Responsive pagination

#### Acceptance Criteria
- All releases are fetched correctly
- Metadata is displayed accurately
- Filtering works as expected
- Performance acceptable for 50+ releases

### 4. Authentication System

#### Functional Requirements
- Multi-tier authentication fallback:
  1. GitHub CLI integration
  2. Environment variable support
  3. Configuration file storage
  4. OS keychain integration
  5. Interactive user prompt
- Secure token storage
- Token format validation
- Token sanitization in logs

#### Non-Functional Requirements
- Security: No token exposure in logs
- Reliability: Fallback always available
- Performance: <1s authentication check
- Cross-platform keychain support

#### Acceptance Criteria
- All authentication methods work correctly
- Tokens are stored securely
- Fallback chain executes properly
- Invalid tokens are rejected
- Logs never expose sensitive data

### 5. Download Management

#### Functional Requirements
- Streaming downloads with progress tracking
- Support for TAR.GZ and ZIP archives
- Authenticated GitHub API requests
- Asset priority selection:
  1. Official ClaudeKit packages
  2. Custom uploaded assets
  3. GitHub automatic tarballs
- Automatic fallback on download failure
- Exclude pattern application

#### Non-Functional Requirements
- Memory efficiency: Streaming (no buffering)
- Progress accuracy: ±1% of actual
- Download speed: Network limited
- Temporary file cleanup guaranteed

#### Acceptance Criteria
- Downloads complete successfully
- Progress bars are accurate
- Fallbacks work correctly
- Temporary files are cleaned up
- Network errors handled gracefully

### 6. Extraction & Merging

#### Functional Requirements
- Safe archive extraction
- Path traversal prevention
- Archive bomb detection
- Wrapper directory stripping
- Exclude pattern enforcement
- Conflict detection
- Protected file preservation

#### Non-Functional Requirements
- Security: 100% path traversal prevention
- Size limit: 500MB extraction maximum
- Performance: <5s for typical archives
- Safety: No data loss on errors

#### Acceptance Criteria
- Archives extract correctly
- Malicious paths are rejected
- Size limits are enforced
- Conflicts are detected accurately
- Protected files are preserved

## Technical Requirements

### Platform Support
- **Operating Systems**: macOS (arm64, x64), Linux (x64), Windows (x64)
- **Node.js**: Compatible with Node.js LTS
- **Bun**: >=1.0.0 required for development

### Performance Targets
- Project creation: <30s for typical kit
- Update check: <5s
- Authentication: <1s
- Version list: <3s for 30 releases
- Memory usage: <100MB during operations

### Security Requirements
- Token encryption in keychain
- Path traversal prevention
- Archive bomb detection
- Sensitive data sanitization
- HTTPS for all network requests
- Token format validation

### Compatibility Requirements
- Cross-platform binary support
- CI/CD environment compatibility
- Non-TTY environment support
- npm, yarn, pnpm, bun package manager support

## User Experience Requirements

### Interactive Mode
- Beautiful CLI interface using @clack/prompts
- Clear progress indicators
- Informative error messages
- Helpful success messages
- Next steps guidance

### Non-Interactive Mode
- Full functionality via flags
- CI/CD environment detection
- Proper exit codes
- Structured error output
- No blocking prompts

### Error Handling
- User-friendly error messages
- Actionable error guidance
- Detailed errors in verbose mode
- Graceful fallbacks
- Clear failure reasons

## Quality Standards

### Code Quality
- TypeScript strict mode
- 100% type coverage
- Zod schema validation
- ESLint/Biome compliance
- Comprehensive error types

### Testing Requirements
- Unit test coverage: >80%
- Integration tests for all commands
- End-to-end tests for critical flows
- CI/CD test automation
- Cross-platform testing

### Documentation Requirements
- Comprehensive README
- API documentation
- Code comments for complex logic
- Example usage for all commands
- Troubleshooting guide

## Success Metrics

### Adoption Metrics
- NPM downloads per month
- GitHub stars and forks
- Issue resolution rate
- Community contributions

### Performance Metrics
- Average project creation time
- Download success rate
- Authentication success rate
- Error rate by operation type

### Quality Metrics
- Test coverage percentage
- Bug report frequency
- User satisfaction score
- Time to resolution for issues

## Product Roadmap

### Phase 1: Core Functionality (Completed)
- ✅ Project creation command
- ✅ Project update command
- ✅ Multi-tier authentication
- ✅ GitHub integration
- ✅ Download management
- ✅ Basic documentation

### Phase 2: Enhanced Features (Completed)
- ✅ Version listing command
- ✅ Exclude patterns
- ✅ Custom .claude file preservation
- ✅ Verbose logging mode
- ✅ Multi-platform binaries

### Phase 3: Quality & Polish (Current)
- ✅ Comprehensive testing
- ✅ Security hardening
- ✅ Performance optimization
- ✅ Documentation enhancement
- 🔄 User feedback integration

### Phase 4: Future Enhancements (Planned)
- 📋 Marketing kit support
- 📋 Diff preview before merge
- 📋 Rollback functionality
- 📋 Update notifications
- 📋 Plugin system
- 📋 Template customization

## Dependencies & Integrations

### Required Services
- **GitHub API**: Release and repository management
- **npm Registry**: Package distribution
- **OS Keychain**: Secure credential storage

### External Dependencies
- @octokit/rest: GitHub API client
- @clack/prompts: Interactive CLI
- keytar: Keychain integration
- cac: CLI framework
- zod: Schema validation

### Optional Integrations
- GitHub CLI: Enhanced authentication
- Discord Webhooks: Release notifications
- Environment variables: Configuration

## Risk Assessment

### Technical Risks
- **GitHub API rate limits**: Mitigated by caching and efficient requests
- **Keychain compatibility**: Fallback to file-based storage
- **Binary distribution size**: Optimized compilation and compression
- **Cross-platform bugs**: Extensive testing on all platforms

### Operational Risks
- **Private repository access**: Clear documentation on token requirements
- **Breaking changes**: Semantic versioning and changelog
- **Support burden**: Comprehensive documentation and examples

### Security Risks
- **Token exposure**: Sanitization and secure storage
- **Path traversal**: Validation and safe path handling
- **Malicious archives**: Size limits and content validation

## Compliance & Legal

### License
- MIT License for maximum flexibility
- No warranty disclaimer
- Attribution requirements
- Commercial use allowed

### Data Privacy
- No personal data collection
- Tokens stored locally only
- No telemetry or analytics
- User control over credentials

### Security Standards
- OWASP security guidelines
- Secure coding practices
- Regular dependency updates
- Vulnerability disclosure policy

## Support & Maintenance

### User Support
- GitHub Issues for bug reports
- GitHub Discussions for questions
- Documentation for common issues
- Example repository

### Maintenance Plan
- Regular dependency updates
- Security patch releases
- Feature releases (semantic versioning)
- Deprecation notices (6-month minimum)

### Community Guidelines
- Code of conduct
- Contribution guidelines
- Issue templates
- Pull request process

## Constraints & Assumptions

### Constraints
- Requires GitHub token with repo scope
- Requires purchased ClaudeKit kit
- Internet connection required
- Minimum 100MB free disk space

### Assumptions
- Users have basic CLI knowledge
- Users have Git understanding
- Users have npm/bun installed
- Users can create GitHub tokens

## Appendices

### Appendix A: Command Reference

#### ck new
```bash
ck new [--dir <directory>] [--kit <kit>] [--version <version>] [--force] [--exclude <pattern>] [--verbose]
```

#### ck update
```bash
ck update [--dir <directory>] [--kit <kit>] [--version <version>] [--exclude <pattern>] [--verbose]
```

#### ck versions
```bash
ck versions [--kit <kit>] [--limit <number>] [--all] [--verbose]
```

### Appendix B: Configuration File Schema

```json
{
  "github": {
    "token": "stored_in_keychain"
  },
  "defaults": {
    "kit": "engineer",
    "dir": "."
  }
}
```

### Appendix C: Protected File Patterns

```
.env, .env.local, .env.*.local
*.key, *.pem, *.p12
.gitignore, .repomixignore, .mcp.json
CLAUDE.md
node_modules/**, .git/**
dist/**, build/**
```

### Appendix D: Available Kits

1. **engineer**: ClaudeKit Engineer - Engineering toolkit for building with Claude
2. **marketing**: ClaudeKit Marketing - [Coming Soon] Marketing toolkit

### Appendix E: Error Codes

- `AUTH_ERROR` (401): Authentication failed
- `GITHUB_ERROR`: GitHub API error
- `DOWNLOAD_ERROR`: Download failed
- `EXTRACTION_ERROR`: Archive extraction failed

## Version History

### v1.5.1 (Current)
- Fixed Windows compatibility issues
- Improved CI/CD integration
- Enhanced error handling

### v1.5.0
- Added version listing command
- Improved binary distribution
- Enhanced documentation

### v1.0.0
- Initial release
- Core create and update commands
- Multi-tier authentication
- GitHub integration

## Contact & Resources

**Repository**: https://github.com/mrgoonie/claudekit-cli

**Issues**: https://github.com/mrgoonie/claudekit-cli/issues

**NPM**: https://www.npmjs.com/package/claudekit-cli

**Website**: https://claudekit.cc

**Author**: ClaudeKit Team
