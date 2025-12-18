# Multi-Kit Metadata Migration Guide

## Overview

ClaudeKit CLI v1.17+ supports multiple kits (engineer, marketing) in a single installation. This document explains the automatic migration process, user experience, and rollback strategies.

## Auto-Migration Process

### When Migration Occurs

Migration happens automatically during:
- `ck init` - When installing a kit into an existing installation
- `ck new` - When creating a new project (fresh multi-kit format)

### What Gets Migrated

Legacy single-kit metadata:
```json
{
  "name": "ClaudeKit Engineer",
  "version": "v1.16.0",
  "installedAt": "2024-01-01T00:00:00.000Z",
  "scope": "local",
  "files": [...]
}
```

Becomes multi-kit format:
```json
{
  "kits": {
    "engineer": {
      "version": "v1.16.0",
      "installedAt": "2024-01-01T00:00:00.000Z",
      "files": [...]
    }
  },
  "scope": "local",
  "name": "ClaudeKit Engineer",
  "version": "v1.16.0",
  "installedAt": "2024-01-01T00:00:00.000Z",
  "files": [...]
}
```

### User Experience

1. **Transparent Migration**: Users see an info message during migration
2. **No Data Loss**: All existing tracked files are preserved
3. **Backward Compatible**: Legacy fields retained for older CLI versions

### Concurrent Installation Protection

File locking prevents race conditions when multiple processes install kits simultaneously:
- Uses `proper-lockfile` for atomic read-modify-write operations
- Retries up to 5 times with exponential backoff
- Lock considered stale after 10 seconds (crash recovery)

## Kit-Scoped Operations

### Installing Multiple Kits

```bash
# Install engineer kit
ck init --kit engineer

# Install marketing kit (preserves engineer)
ck init --kit marketing
```

### Uninstalling Specific Kit

```bash
# Remove only marketing kit (preserves engineer)
ck uninstall --kit marketing

# Remove all kits
ck uninstall
```

### Shared File Handling

When both kits track the same file, uninstalling one kit preserves the file for the other:
- Files only deleted when no remaining kit references them
- Works correctly even with different versions/checksums across kits

## Rollback Strategies

### Downgrading CLI Version

If you need to use an older CLI version:

1. **Metadata remains compatible**: Legacy fields preserved in metadata.json
2. **Feature limitations**: Older CLIs won't see multi-kit structure
3. **Safe operations**: Uninstall/update will work but treat as single kit

### Manual Rollback

To convert back to legacy format (not recommended):

```bash
# Read current metadata
cat .claude/metadata.json

# Manually extract kit info and rewrite as legacy format
# (Only if necessary for specific tooling compatibility)
```

## Troubleshooting

### "Lock acquisition failed"

If installation hangs or fails with lock errors:
1. Check for stale lock files: `.claude/metadata.json.lock`
2. Remove manually if process crashed: `rm .claude/metadata.json.lock`
3. Retry installation

### Migration Warning Messages

`Metadata migration warning: ...`
- Usually indicates corrupted or malformed metadata.json
- Migration continues with best-effort approach
- Check verbose output with `--verbose` for details

### Kit Not Found During Uninstall

`Kit "marketing" is not installed`
- Use `ck versions` to see installed kits
- Check both local and global installations

## Technical Details

### Metadata Schema

See `src/types/metadata.ts` for full Zod schemas:
- `KitMetadataSchema`: Per-kit version, files, installedAt
- `MultiKitMetadataSchema`: Root structure with kits map
- `MetadataSchema`: Combined schema with legacy fields

### Detection Logic

Migration detection in `src/domains/migration/metadata-migration.ts`:
1. Check for `kits` object with entries → multi-kit format
2. Check for `name`/`version`/`files` at root → legacy format
3. Otherwise → no metadata (fresh install)
