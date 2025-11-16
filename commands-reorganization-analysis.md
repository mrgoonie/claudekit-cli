# ClaudeKit CLI - Commands Directory Reorganization Analysis

**Date:** 2025-11-16
**Analyst:** Investigation Agent
**Purpose:** Understand kit extraction flow and identify where to implement `.claude/commands/**/*` reorganization

---

## Executive Summary

ClaudeKit CLI extracts GitHub release archives to project directories through a well-defined flow in `new.ts` and `update.ts` commands. The optimal integration point for commands directory reorganization is **immediately after extraction validation** and **before file merging**, leveraging existing file manipulation utilities like `SkillsMigrator.copySkillDirectory()` and `FileMerger` patterns.

**Key Finding:** The codebase already has a proven precedent for post-extraction directory reorganization in the **skills migration system** (6 dedicated modules), which provides the exact architectural pattern needed.

---

## 1. Kit Extraction Flow

### 1.1 Entry Points

#### **new.ts** (New Project Creation)
```
Line 120-173: Download & Extract Flow
├── DownloadManager.createTempDir() → /tmp/claudekit-{timestamp}
├── downloadFile() → tempDir/{archive-name}
├── extractArchive() → tempDir/extracted/
├── validateExtraction() → verify .claude/ and CLAUDE.md exist
└── FileMerger.merge() → copy to target directory
```

#### **update.ts** (Existing Project Update)
```
Line 130-262: Download, Extract & Merge Flow
├── DownloadManager.createTempDir() → /tmp/claudekit-{timestamp}
├── downloadFile() → tempDir/{archive-name}
├── extractArchive() → tempDir/extracted/
├── validateExtraction() → verify .claude/ and CLAUDE.md exist
├── SkillsMigrator.migrate() → reorganize skills if needed (Lines 177-207)
├── FileScanner.findCustomFiles() → identify custom files
└── FileMerger.merge() → copy to target directory
```

### 1.2 Critical Paths

**Temporary Extraction Location:**
- `/tmp/claudekit-{timestamp}/extracted/`
- Contains full archive structure including `.claude/` directory

**Target Locations:**

| Mode   | Target Directory                          | Example                           |
|--------|-------------------------------------------|-----------------------------------|
| Local  | `{targetDir}/.claude/`                   | `./my-project/.claude/`          |
| Global | `~/.claude/` (Windows: `%USERPROFILE%\.claude\`) | `/home/user/.claude/` |

---

## 2. Extraction Details

### 2.1 DownloadManager (`src/lib/download.ts`)

**Key Methods:**

1. **`extractArchive(archivePath, destDir)`** (Line 348-380)
   - Detects archive type (tar.gz or zip)
   - Delegates to `extractTarGz()` or `extractZip()`
   - Handles wrapper directory stripping

2. **`extractTarGz()`** (Line 385-464)
   - Extracts to temp directory first: `{destDir}-temp`
   - Applies `isWrapperDirectory()` detection (Line 471-478)
   - Strips version wrappers like `claudekit-engineer-v1.0.0/`
   - Moves contents to final `destDir`
   - **Respects exclude patterns** (EXCLUDE_PATTERNS + user patterns)

3. **`extractZip()`** (Line 483-556)
   - Same wrapper detection logic
   - Normalizes Unicode/Mojibake in filenames
   - Same temp-then-move pattern

**Exclude Patterns** (Line 31-41):
```typescript
['.git', '.github', 'node_modules', '.DS_Store', 'Thumbs.db', '*.log']
+ user-defined patterns via setExcludePatterns()
```

### 2.2 Validation

**`validateExtraction(extractDir)`** (Line 659-703)
- Checks for critical paths: `.claude/`, `CLAUDE.md`
- **WARNING:** Only logs warnings if missing, doesn't fail
- Perfect integration point for custom validation/reorganization

---

## 3. Local vs Global Installation Handling

### 3.1 Path Resolution (`src/utils/path-resolver.ts`)

**`getGlobalKitDir()`** (Line 105-108):
- Returns `~/.claude/` on all platforms
- Windows: `C:\Users\{USER}\.claude\`
- macOS/Linux: `/home/{user}/.claude/`

### 3.2 Merge Behavior Differences

**update.ts** handles mode differences (Line 179-181, 212-213, 259-260):

```typescript
// Skills directory location
const currentSkillsDir = validOptions.global
  ? join(resolvedDir, "skills")        // Global: ~/.claude/skills
  : join(resolvedDir, ".claude", "skills");  // Local: project/.claude/skills

// Source directory for merge
const sourceDir = validOptions.global
  ? join(extractDir, ".claude")  // Global: merge FROM .claude/ contents
  : extractDir;                   // Local: merge FROM root (includes .claude/)
```

**Key Insight:** Global mode merges `.claude/` **contents** directly to `~/.claude/`, while local mode merges entire `.claude/` directory.

---

## 4. Recommended Implementation Location

### 4.1 Integration Point: Post-Extraction Hook

**Location:** Between `validateExtraction()` and `FileMerger.merge()`

**In new.ts (after Line 163):**
```typescript
await downloadManager.validateExtraction(extractDir);

// 🔥 ADD HERE: Commands directory reorganization
await reorganizeCommandsDirectory(extractDir);

// Copy files to target directory
const merger = new FileMerger();
```

**In update.ts (after Line 173):**
```typescript
await downloadManager.validateExtraction(extractDir);

// 🔥 ADD HERE: Commands directory reorganization
await reorganizeCommandsDirectory(extractDir);

// Check for skills migration need
const newSkillsDir = join(extractDir, ".claude", "skills");
```

### 4.2 Why This Location?

✅ **Pros:**
- Archive fully extracted to temp directory
- Before files copied to target (can modify temp safely)
- After validation (critical paths confirmed)
- Same pattern as skills migration (Lines 177-207 in update.ts)
- No risk of modifying user's existing files
- Can fail/rollback without affecting target directory

❌ **Alternative Rejected:** Inside `extractArchive()`
- Too low-level, mixes concerns
- Would need to distinguish commands from other files during extraction
- Harder to test in isolation

---

## 5. Existing File Manipulation Utilities

### 5.1 Available for Reuse

#### **SkillsMigrator.copySkillDirectory()** (`src/lib/skills-migrator.ts`, Line 336-356)
```typescript
private static async copySkillDirectory(sourceDir: string, destDir: string)
```
- Recursively copies directories
- Skips hidden files, node_modules, symlinks
- Can be used as-is or adapted for commands

#### **FileScanner.getFiles()** (`src/utils/file-scanner.ts`, Line 22-71)
```typescript
static async getFiles(dirPath: string, relativeTo?: string): Promise<string[]>
```
- Recursively scans directories
- Returns relative paths
- Security: validates paths, skips symlinks
- Perfect for discovering command files

#### **FileMerger.getFiles()** (`src/lib/merge.ts`, Line 153-208)
- Private but shows pattern for recursive file operations
- Handles include patterns for selective copying

### 5.2 File Operation Primitives

From `fs-extra` (already imported):
- `copy(src, dest, options)` - Copy files/directories
- `move(src, dest, options)` - Move files/directories
- `mkdir(path, options)` - Create directories
- `readdir(path, options)` - List directory contents
- `pathExists(path)` - Check existence

From Node.js `fs/promises`:
- `copyFile(src, dest)` - Copy single file
- `rm(path, options)` - Remove files/directories
- `readdir(path, options)` - Directory listing

---

## 6. Architectural Pattern: Follow Skills Migration

### 6.1 Skills Migration Architecture

The codebase has a **complete precedent** for post-extraction directory reorganization:

**Skills Migration Modules** (6 files in `src/lib/`):
1. `skills-detector.ts` - Detects structure changes (flat → categorized)
2. `skills-migrator.ts` - Orchestrates reorganization
3. `skills-backup-manager.ts` - Creates backups before changes
4. `skills-customization-scanner.ts` - Detects user customizations (SHA-256)
5. `skills-manifest.ts` - Generates structure metadata
6. `skills-migration-prompts.ts` - Interactive user prompts

**Integration in update.ts** (Lines 177-207):
```typescript
// Check for skills migration need
const migrationDetection = await SkillsMigrationDetector.detectMigration(
  newSkillsDir,
  currentSkillsDir,
);

if (migrationDetection.status === "recommended" || "required") {
  const migrationResult = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, {
    interactive: !isNonInteractive,
    backup: true,
    dryRun: false,
  });
}
```

### 6.2 Recommended Approach for Commands

**Create Parallel Structure:**
```
src/lib/
├── commands-detector.ts        # Detect commands structure changes
├── commands-migrator.ts        # Orchestrate reorganization
├── commands-reorganizer.ts     # Core reorganization logic
└── (reuse existing utilities)  # FileScanner, backup patterns
```

**Simplified (if no user customization detection needed):**
```
src/lib/
└── commands-reorganizer.ts     # Single module with reorganization logic
```

**Key Methods Needed:**
```typescript
export class CommandsReorganizer {
  // Detect if reorganization needed
  static async shouldReorganize(extractDir: string): Promise<boolean>

  // Reorganize commands/**/* to flat structure
  static async reorganize(extractDir: string): Promise<void>

  // Validate reorganization result
  static async validateReorganization(extractDir: string): Promise<void>
}
```

---

## 7. Edge Cases to Handle

### 7.1 Archive Structure Variations

**Case 1: Commands already flat in new release**
- Detection: Check if `.claude/commands/` contains only `.md` files (no subdirs)
- Action: Skip reorganization

**Case 2: Commands already flat in current project**
- Detection: No subdirectories in `.claude/commands/`
- Action: Skip reorganization (no-op)

**Case 3: Mixed flat + nested structure**
- Detection: Both `.md` files and subdirectories in `.claude/commands/`
- Action: Reorganize nested, preserve existing flat files

### 7.2 Filename Conflicts

**Case: Multiple commands with same basename**
```
.claude/commands/
├── general/create.md
└── project/create.md
```
- **Solution 1:** Prefix with category: `general-create.md`, `project-create.md`
- **Solution 2:** Fail with clear error message
- **Recommended:** Solution 1 (preserves both, prevents data loss)

### 7.3 Non-Command Files

**Case: Subdirectories contain non-.md files**
```
.claude/commands/
└── utils/
    ├── helper.md
    └── config.json  ← not a command
```
- **Action:** Skip non-.md files, log warning
- **Or:** Move all files (if non-.md files are supporting resources)

### 7.4 Symlinks

- **Action:** Skip symlinks (security risk)
- **Pattern:** Already handled in `SkillsMigrator.copySkillDirectory()` (Line 346)

### 7.5 Global vs Local Mode

**No special handling needed:**
- Reorganization happens in temp `extractDir` before merge
- Merge logic in `FileMerger` already handles path differences
- Global mode: merges `.claude/` contents to `~/.claude/`
- Local mode: merges entire `.claude/` directory to project

### 7.6 Wrapper Directory Variations

**Already handled:**
- `DownloadManager.isWrapperDirectory()` strips version wrappers
- By the time code reaches `validateExtraction()`, structure is normalized
- Safe to assume `.claude/` is at root of `extractDir`

---

## 8. Implementation Strategy

### 8.1 Minimal Approach (Recommended for MVP)

**Single module:** `src/lib/commands-reorganizer.ts`

```typescript
export class CommandsReorganizer {
  static async reorganize(extractDir: string): Promise<void> {
    const commandsDir = join(extractDir, '.claude', 'commands');

    // 1. Check if reorganization needed
    const hasSubdirs = await this.hasSubdirectories(commandsDir);
    if (!hasSubdirs) return;

    // 2. Scan for command files in subdirectories
    const commandFiles = await FileScanner.getFiles(commandsDir);
    const nestedCommands = commandFiles.filter(f =>
      f.endsWith('.md') && f.includes('/')
    );

    // 3. Create temp directory for reorganization
    const tempDir = join(extractDir, '.commands-reorg-temp');
    await mkdir(tempDir, { recursive: true });

    // 4. Copy nested commands to flat structure
    for (const file of nestedCommands) {
      const basename = path.basename(file);
      const destPath = join(tempDir, basename);

      // Handle conflicts: prefix with category
      if (await pathExists(destPath)) {
        const category = path.dirname(file);
        const newName = `${category}-${basename}`;
        await copyFile(join(commandsDir, file), join(tempDir, newName));
      } else {
        await copyFile(join(commandsDir, file), destPath);
      }
    }

    // 5. Copy existing flat commands
    const flatCommands = commandFiles.filter(f =>
      f.endsWith('.md') && !f.includes('/')
    );
    for (const file of flatCommands) {
      await copyFile(join(commandsDir, file), join(tempDir, file));
    }

    // 6. Replace commands directory
    await rm(commandsDir, { recursive: true });
    await move(tempDir, commandsDir);

    logger.success('Commands directory reorganized to flat structure');
  }
}
```

### 8.2 Integration in Commands

**new.ts** (after Line 163):
```typescript
await downloadManager.validateExtraction(extractDir);

// Reorganize commands directory if needed
await CommandsReorganizer.reorganize(extractDir);

const merger = new FileMerger();
```

**update.ts** (after Line 173):
```typescript
await downloadManager.validateExtraction(extractDir);

// Reorganize commands directory if needed
await CommandsReorganizer.reorganize(extractDir);

// Check for skills migration need
const newSkillsDir = join(extractDir, ".claude", "skills");
```

### 8.3 Testing Strategy

**Unit Tests:** `tests/lib/commands-reorganizer.test.ts`
- Test nested → flat reorganization
- Test conflict handling (same basename)
- Test no-op when already flat
- Test non-.md file handling
- Test symlink skipping

**Integration Tests:** `tests/integration/commands-reorganization.test.ts`
- Test full extraction + reorganization flow
- Test with real archive structure
- Test global vs local mode
- Test with skills migration (ensure both work together)

---

## 9. Potential Issues & Mitigations

### 9.1 File System Race Conditions

**Issue:** Multiple processes accessing temp directory
**Mitigation:** Use atomic operations, unique temp directories (already done: `claudekit-{timestamp}`)

### 9.2 Disk Space

**Issue:** Reorganization creates temporary copies
**Mitigation:** Cleanup temp directory even on failure (use try/finally)

### 9.3 Unicode/Mojibake in Filenames

**Issue:** GitHub tarballs may have encoding issues
**Mitigation:** Already handled in `DownloadManager.normalizeZipEntryName()` and `decodeFilePath()`

### 9.4 Breaking Existing Projects

**Issue:** Users may have scripts/workflows expecting nested structure
**Mitigation:**
- Only reorganize in temp extraction directory (before merge)
- Doesn't affect existing project files (merge preserves custom files)
- Add flag to disable reorganization if needed: `--no-commands-reorg`

### 9.5 Performance with Large Command Sets

**Issue:** 1000s of command files could slow down reorganization
**Mitigation:**
- Use async/await with Promise.all() for parallel file operations
- Benchmark: Skills migration handles similar volumes efficiently

---

## 10. Recommended Next Steps

### Phase 1: Core Implementation (High Priority)
1. ✅ Create `src/lib/commands-reorganizer.ts` with minimal implementation
2. ✅ Add integration in `new.ts` and `update.ts` (after `validateExtraction()`)
3. ✅ Write unit tests covering all edge cases
4. ✅ Test with real archive structures (nested commands)

### Phase 2: Validation & Edge Cases (Medium Priority)
5. ✅ Add conflict handling (basename collisions)
6. ✅ Add logging (debug, info, warning levels)
7. ✅ Test global vs local mode compatibility
8. ✅ Test interaction with skills migration (ensure both run smoothly)

### Phase 3: Polish & Documentation (Low Priority)
9. ⚠️ Add `--no-commands-reorg` flag for opt-out
10. ⚠️ Update README.md with reorganization behavior
11. ⚠️ Add reorganization summary to completion message
12. ⚠️ Consider interactive prompts (like skills migration) if user customizations detected

---

## 11. Code References

**Key Files to Modify:**
- `src/commands/new.ts` (Line 163: after validateExtraction)
- `src/commands/update.ts` (Line 173: after validateExtraction)

**Key Files to Create:**
- `src/lib/commands-reorganizer.ts` (new)
- `tests/lib/commands-reorganizer.test.ts` (new)

**Key Files for Reference:**
- `src/lib/skills-migrator.ts` (architectural pattern)
- `src/lib/download.ts` (extraction flow)
- `src/lib/merge.ts` (file operations)
- `src/utils/file-scanner.ts` (directory scanning)

**Existing Utilities to Reuse:**
- `FileScanner.getFiles()` - Scan command files
- `SkillsMigrator.copySkillDirectory()` - Copy directory pattern
- `DownloadManager.copyDirectory()` - Recursive copy (private, adapt pattern)
- `fs-extra`: `copy()`, `move()`, `mkdir()`, `rm()`, `pathExists()`

---

## 12. Unresolved Questions

1. **Conflict Resolution Strategy:** Should we prefix with category or fail on conflicts?
   - **Recommendation:** Prefix with category (preserves all files, prevents data loss)

2. **Non-.md Files in Commands Directories:** Should we move or skip them?
   - **Recommendation:** Skip non-.md files, log warning (commands are .md only by convention)

3. **Interactive Prompts:** Should we prompt users like skills migration does?
   - **Recommendation:** No prompts for MVP (commands are framework files, not user customizations)
   - **Future:** Add if users report customized commands being lost

4. **Opt-out Flag:** Should we provide `--no-commands-reorg` flag?
   - **Recommendation:** Not needed for MVP (reorganization happens in temp dir only)
   - **Future:** Add if users report issues

5. **Manifest/Metadata:** Should we track reorganization in manifest like skills migration?
   - **Recommendation:** Not needed for MVP (simpler than skills migration)
   - **Future:** Add if we need to detect reorganization status

---

## Appendix A: Skills Migration Flow (Reference)

**update.ts Lines 177-207:**
```typescript
// Check for skills migration need
const newSkillsDir = join(extractDir, ".claude", "skills");
const currentSkillsDir = validOptions.global
  ? join(resolvedDir, "skills")
  : join(resolvedDir, ".claude", "skills");

if ((await pathExists(newSkillsDir)) && (await pathExists(currentSkillsDir))) {
  logger.info("Checking for skills directory migration...");

  const migrationDetection = await SkillsMigrationDetector.detectMigration(
    newSkillsDir,
    currentSkillsDir,
  );

  if (migrationDetection.status === "recommended" || migrationDetection.status === "required") {
    logger.info("Skills migration detected");

    const migrationResult = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, {
      interactive: !isNonInteractive,
      backup: true,
      dryRun: false,
    });

    if (!migrationResult.success) {
      logger.warning("Skills migration encountered errors but continuing with update");
    }
  }
}
```

**Key Insight:** Commands reorganization should follow similar pattern but simpler:
- No backup needed (happens in temp dir)
- No interactive prompts (framework files, not user customizations)
- No customization detection (commands are standardized)
- Just reorganize and continue

---

**End of Report**
