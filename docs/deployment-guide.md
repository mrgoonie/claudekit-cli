# Deployment Guide

## GitHub Secrets Required

The following secrets must be configured in the GitHub repository settings for successful releases:

### NPM_TOKEN
- **Purpose**: Authentication for GitHub Packages npm registry
- **Format**: GitHub Personal Access Token with `write:packages` scope
- **How to generate**:
  1. Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
  2. Generate new token with the following scopes:
     - `write:packages` - Required for publishing to GitHub Packages
     - `repo` - Required for repository access
  3. Add the token to repository secrets as `NPM_TOKEN`

### GITHUB_TOKEN
- **Purpose**: Automatic authentication for GitHub API
- **Source**: Automatically provided by GitHub Actions
- **Permissions**: Contents, Issues, Pull Requests, ID Token
- **Note**: This token is automatically available and doesn't need to be configured

### DISCORD_WEBHOOK_URL (Optional)
- **Purpose**: Discord notifications for releases
- **Format**: Discord webhook URL
- **Optional**: Yes - notifications will be skipped if not configured
- **How to set up**:
  1. In Discord server settings, create a new webhook
  2. Copy the webhook URL
  3. Add it to repository secrets as `DISCORD_WEBHOOK_URL`

## Package Publishing Configuration

### GitHub Packages Setup

This project publishes to GitHub Packages using the following configuration:

1. **Package Name**: `@mrgoonie/claudekit-cli` (scoped package)
2. **Registry**: `https://npm.pkg.github.com`
3. **Authentication**: Uses NPM_TOKEN with GitHub Packages registry

### .npmrc Configuration

The `.npmrc` file should contain:
```
@mrgoonie:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

### package.json Configuration

Key settings in `package.json`:
```json
{
  "name": "@mrgoonie/claudekit-cli",
  "publishConfig": {
    "access": "public",
    "registry": "https://npm.pkg.github.com"
  }
}
```

## Dev Channel

For internal testing before beta release:

1. Go to Actions → Publish Dev → Run workflow
2. Enter version (e.g., `3.13.0-dev.1`)
3. Install: `ck update --dev`

**Naming convention:** `X.Y.Z-dev.N` (e.g., 3.13.0-dev.1, 3.13.0-dev.2)

**Usage:**
- `ck update --dev` - Install latest dev version
- `ck update --dev --force` - Force reinstall same dev version
- `ck update --release 3.13.0-dev.1` - Install specific dev version

**Notes:**
- Dev versions are published to @dev npm dist-tag
- Not shown in default version listings
- Used for internal testing before beta release
- Fallback to latest stable if no dev version available

## Config Dashboard Build

The React dashboard is built as part of the standard build process:

```bash
# Full build (includes dashboard via prebuild/postbuild hooks)
bun run build

# Dashboard only
bun run build:dashboard

# Development mode (Vite HMR)
bun run dev:dashboard
```

### Dashboard Bundle

The React dashboard (~500KB gzipped) is embedded in the npm package:
- Source: `dashboard/src/`
- Build output: `dashboard/dist/`
- Packaged at: `dist/dashboard/`
- Served by Express on `ck config ui`

### Build Pipeline

The build hooks ensure dashboard is always bundled:
1. `prebuild`: Runs `bun run build:dashboard` (builds React app)
2. `build`: Compiles CLI TypeScript to `dist/index.js`
3. `postbuild`: Copies `dashboard/dist` to `dist/dashboard`

### Testing Dashboard

```bash
# Run all tests
bun test

# Config command tests
bun test tests/commands/config.test.ts

# Manual dashboard testing
bun run dev config ui    # Launches at http://localhost:3847
```

## Release Process

### Automated Release Workflow

1. **Trigger**: Push to `main` branch
2. **Build**: Creates binaries for all platforms (macOS, Linux, Windows)
3. **Test**: Runs full test suite
4. **Publish**: Publishes package to GitHub Packages
5. **Release**: Creates GitHub release with binary assets

### Manual Release (if needed)

If automated releases fail, you can manually publish:

```bash
# Install dependencies
bun install

# Build binaries
bun run build

# Publish to GitHub Packages
npm publish
```

## Troubleshooting

### Common Issues

1. **Authentication failures**
   - Ensure NPM_TOKEN has `write:packages` scope
   - Verify .npmrc is correctly configured
   - Check that package name is scoped (@mrgoonie/)

2. **Build failures**
   - Check system dependencies (libsecret-1-dev for Linux)
   - Verify Bun installation
   - Review build logs for specific errors

3. **Release failures**
   - Verify all GitHub Actions permissions
   - Check semantic-release configuration
   - Ensure package.json is valid

### Debug Steps

1. Check workflow logs in GitHub Actions
2. Verify all required secrets are set
3. Test local build process
4. Validate package.json with `npm pkg fix`

## Migration from Public NPM

If migrating from public npm to GitHub Packages:

1. **Package Name Change**: Update from `claudekit-cli` to `@mrgoonie/claudekit-cli`
2. **Installation Update**: Users need to run:
   ```bash
   npm uninstall claudekit-cli
   npm install @mrgoonie/claudekit-cli -g
   ```
3. **Registry Configuration**: Users may need to configure .npmrc for GitHub Packages:
   ```bash
   npm config set @mrgoonie:registry https://npm.pkg.github.com
   npm config set //npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
   ```

## Security Considerations

- NPM_TOKEN should have minimal required scopes
- Regularly rotate personal access tokens
- Use fine-grained tokens when possible
- Monitor package access and usage

## Support

For deployment issues:
1. Check GitHub Actions logs
2. Review this documentation
3. Create an issue in the repository
4. Contact the maintainers