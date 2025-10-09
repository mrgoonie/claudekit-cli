# GitHub Setup Guide

This document outlines the GitHub repository configuration required for the CI/CD pipeline.

## GitHub Actions Workflows

The project includes two GitHub Actions workflows:

### 1. CI Workflow (`.github/workflows/ci.yml`)

Runs on every pull request and push to `main`/`master` branches:

- Type checking
- Linting
- Tests
- Build verification

### 2. Release Workflow (`.github/workflows/release.yml`)

Runs on every push to the `main` branch:

- Full CI checks (type checking, linting, tests, build)
- Semantic release (version bump, changelog generation, npm publishing)
- Creates GitHub releases with auto-generated release notes

## Required GitHub Secrets

The following secrets must be configured in your GitHub repository:

1. **`NPM_TOKEN`** (Already configured)
   - NPM authentication token for publishing packages
   - Get from: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Required permission: Automation (for CI/CD)

2. **`GITHUB_TOKEN`** (Automatically provided)
   - Automatically provided by GitHub Actions
   - Used for creating releases and updating repository

## Branch Protection Rules

To ensure code quality and prevent accidental direct pushes to main, configure the following branch protection rules for the `main` branch:

### Steps to Configure:

1. Go to **Settings** → **Branches** in your GitHub repository
2. Click **Add rule** under "Branch protection rules"
3. Enter `main` as the branch name pattern
4. Enable the following options:

#### Required Settings:

- ✅ **Require a pull request before merging**
  - Require approvals: 1 (or more, based on team size)
  - ✅ Dismiss stale pull request approvals when new commits are pushed

- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - Required status checks:
    - `test` (from CI workflow)

- ✅ **Require conversation resolution before merging**

- ✅ **Do not allow bypassing the above settings**

#### Optional but Recommended:

- ✅ **Require linear history** (keeps git history clean)
- ✅ **Restrict who can push to matching branches** (for larger teams)

### What This Achieves:

1. **PR Required**: Direct pushes to `main` are blocked
2. **Tests Must Pass**: PRs can only be merged after all CI checks pass
3. **Code Review**: At least one approval required before merging
4. **Clean History**: Linear git history for easier tracking
5. **Automatic Releases**: Merged PRs to `main` trigger semantic-release

## Semantic Release

The project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and package publishing.

### Commit Message Convention

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Commit Types:

- `feat:` - New feature (triggers minor version bump)
- `fix:` - Bug fix (triggers patch version bump)
- `docs:` - Documentation changes only
- `style:` - Code style changes (formatting, missing semicolons, etc.)
- `refactor:` - Code refactoring without feature changes
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks (dependencies, build config, etc.)
- `ci:` - CI/CD changes

#### Breaking Changes:

For breaking changes, add `BREAKING CHANGE:` in the commit body or use `!` after the type:

```
feat!: remove deprecated API endpoint

BREAKING CHANGE: The /api/v1/old endpoint has been removed. Use /api/v2/new instead.
```

This triggers a **major version bump**.

### Examples:

```bash
# Patch release (0.1.0 -> 0.1.1)
fix: resolve authentication token expiration issue

# Minor release (0.1.0 -> 0.2.0)
feat: add support for custom templates

# Major release (0.1.0 -> 1.0.0)
feat!: redesign CLI commands structure

BREAKING CHANGE: Command syntax has changed. Use 'ck create' instead of 'ck init'.

# No release
docs: update installation instructions
chore: upgrade dependencies
```

## Automated Changelog

The changelog is automatically generated based on commit messages and updated in `CHANGELOG.md` with each release.

## Workflow Summary

1. Developer creates a feature branch
2. Developer makes changes using conventional commits
3. Developer opens a PR to `main`
4. CI workflow runs automatically
5. Code review and approval required
6. PR is merged to `main`
7. Release workflow runs automatically:
   - Analyzes commits since last release
   - Determines version bump
   - Generates changelog
   - Creates GitHub release
   - Publishes to npm
   - Commits version and changelog updates

## Troubleshooting

### Release Not Triggering

- Ensure commits follow conventional commit format
- Check that `NPM_TOKEN` secret is configured
- Verify workflow permissions are correct
- Check GitHub Actions logs for errors

### NPM Publish Fails

- Verify `NPM_TOKEN` is valid and not expired
- Ensure package name is available or you own it
- Check npm registry permissions

### Tests Failing

- Run tests locally: `bun test`
- Check test output in GitHub Actions logs
- Ensure all dependencies are installed correctly
