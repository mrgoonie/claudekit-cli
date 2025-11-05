# Version Synchronization Fix - Issue #44

## Problem

Users experienced a version discrepancy where:
- `npm show claudekit-cli version` showed `1.9.2`
- But `ck --version` showed `1.9.1`

## Root Cause

The issue occurred because:
1. Precompiled binaries in the `bin/` directory were built with an older version of the source code
2. The release process built binaries BEFORE semantic-release bumped the package.json version
3. This resulted in published packages containing outdated binaries with incorrect versions

## Solution

### 1. Fixed Release Workflow
- Updated `.github/workflows/release.yml` to use the existing build-binaries workflow
- Created custom semantic-release plugin to rebuild binaries AFTER version bump
- Added binary verification step in release process

### 2. Added Version Synchronization Scripts

#### `scripts/build-binaries-after-version-bump.js`
- Custom semantic-release plugin
- Rebuilds all platform binaries after package.json version is bumped
- Ensures binaries contain correct version

#### `scripts/check-binary-version-sync.js`
- Pre-commit hook script
- Verifies binary versions match package.json version
- Prevents commits with version mismatches

#### `scripts/build-all-binaries.js`
- Utility script to build all platform binaries locally
- Useful for testing and development

### 3. Pre-commit Hook Protection
- Added `.git/hooks/pre-commit` to automatically:
  - Check binary version synchronization
  - Run linting
  - Prevent commits with version mismatches

### 4. Updated Package.json Scripts
- `compile:binaries`: Build all platform binaries
- `check-version-sync`: Verify binary versions match package.json

## Files Modified

1. **package.json**: Updated to version 1.9.2, added new scripts
2. **.github/workflows/release.yml**: Simplified workflow using build-binaries
3. **.releaserc.json**: Added custom plugin for rebuilding binaries
4. **scripts/**: Created three new utility scripts
5. **.git/hooks/pre-commit**: Added pre-commit protection

## How to Prevent Future Issues

1. **Always use the new scripts**:
   ```bash
   npm run compile:binaries  # Build all binaries
   npm run check-version-sync  # Verify versions
   ```

2. **Pre-commit hook will automatically catch issues**

3. **Release process now handles synchronization automatically**

## Verification

```bash
# Test current fix
./bin/ck-darwin-arm64 --version  # Should show: ck/1.9.2
npm run check-version-sync       # Should pass all checks
```

This fix ensures that binary versions will always be synchronized with package.json version in future releases.