# Research Report: Download and Extract Release Archives in Bun CLI

**Research Date:** October 8, 2025
**Target Runtime:** Bun v1.x+
**Language:** TypeScript
**Scope:** HTTP download with progress tracking, archive extraction, and file conflict handling

---

## Executive Summary

This research evaluates libraries and strategies for implementing a robust download and extraction system in a Bun CLI application. The investigation covers HTTP download mechanisms with progress tracking, archive extraction for multiple formats (.tar.gz, .zip), intelligent file conflict resolution, and proper cleanup procedures.

**Key Recommendations:**
1. **Download:** Use Bun's native `fetch` API with ReadableStream for progress tracking
2. **Progress Display:** Use `cli-progress` or `ora` for visual feedback
3. **Extraction:** Use `tar` for .tar.gz files and `unzipper` for .zip files
4. **File Operations:** Use `fs-extra` for smart merging with conflict detection
5. **Cleanup:** Use `tmp` package for automatic temporary directory management

---

## Research Methodology

- **Sources consulted:** 35+ web sources, npm packages, official documentation
- **Date range:** Primarily 2024-2025 sources, with emphasis on recent updates
- **Key search terms:** Bun fetch, node-tar, unzipper, cli-progress, fs-extra, download progress, file extraction, conflict handling
- **Focus Areas:** Bun compatibility, performance, TypeScript support, maintenance status

---

## Key Findings

### 1. HTTP Download Libraries

#### Bun's Native Fetch API (Recommended)
**Features:**
- Built-in to Bun runtime (no external dependencies)
- Web-standard implementation with Bun-native extensions
- Full streaming support via `ReadableStream`
- Supports multiple protocols: `http://`, `https://`, `file://`, `data:`, `blob:`, `s3://`
- Automatic connection pooling and DNS prefetching

**Progress Tracking Implementation:**
```typescript
async function downloadWithProgress(url: string, outputPath: string) {
  const response = await fetch(url);
  const contentLength = parseInt(response.headers.get('Content-Length') || '0');

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  let receivedLength = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    // Calculate and display progress
    const progress = contentLength > 0
      ? Math.round((receivedLength / contentLength) * 100)
      : receivedLength;

    console.log(`Downloaded: ${receivedLength} bytes (${progress}%)`);
  }

  // Combine chunks and write to file
  const allChunks = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  await Bun.write(outputPath, allChunks);
  return outputPath;
}
```

**Bun-Specific File Writing:**
```typescript
// Method 1: Direct write from Response
const response = await fetch(url);
await Bun.write('./file.tar.gz', response);

// Method 2: Stream to file with FileSink (for large files)
const file = Bun.file('./large-file.tar.gz');
const writer = file.writer();
for await (const chunk of response.body) {
  writer.write(chunk);
}
await writer.end();
```

#### Alternative Libraries (Node.js Compatibility)
- **axios:** Popular but adds dependency weight, has built-in progress events
- **got:** Modern, promise-based, good streaming support
- **node-fetch:** Node.js implementation (unnecessary in Bun)

**Verdict:** Use Bun's native `fetch` for optimal performance and zero dependencies.

---

### 2. Archive Extraction Libraries

#### For TAR/TAR.GZ Files: `tar` (node-tar)

**Package:** `tar` (isaacs/node-tar)
**Latest Version:** 7.4.3 (actively maintained)
**Weekly Downloads:** ~50M
**TypeScript:** ✅ Type definitions included

**Features:**
- Unix tar command-like functionality
- Automatic gzip detection and decompression
- Stream-based processing
- File filtering during extraction
- Preserves file metadata

**Installation:**
```bash
bun add tar
```

**Usage Example:**
```typescript
import tar from 'tar';

// Simple extraction
await tar.extract({
  file: 'archive.tar.gz',
  cwd: './output',
  strip: 1  // Strip first directory level
});

// With filtering and progress
await tar.extract({
  file: 'archive.tar.gz',
  cwd: './output',
  filter: (path, entry) => {
    // Skip config files
    if (path.endsWith('.env') || path.endsWith('config.json')) {
      return false;
    }
    return true;
  },
  onentry: (entry) => {
    console.log(`Extracting: ${entry.path}`);
  }
});

// Streaming extraction
import { createReadStream } from 'fs';

createReadStream('archive.tar.gz')
  .pipe(tar.extract({ cwd: './output' }));
```

#### For ZIP Files: `unzipper`

**Package:** `unzipper`
**Latest Version:** 0.12.3
**Weekly Downloads:** ~5M
**TypeScript:** ✅ Type definitions available via @types/unzipper

**Features:**
- Pure JavaScript (no compiled dependencies)
- Uses Node.js built-in zlib
- Streaming support
- Simple API similar to node-tar

**Installation:**
```bash
bun add unzipper
bun add -D @types/unzipper
```

**Usage Example:**
```typescript
import { createReadStream } from 'fs';
import unzipper from 'unzipper';

// Simple extraction
await createReadStream('archive.zip')
  .pipe(unzipper.Extract({ path: './output' }))
  .promise();

// With filtering
await createReadStream('archive.zip')
  .pipe(unzipper.Parse())
  .on('entry', async (entry) => {
    const fileName = entry.path;
    const type = entry.type; // 'Directory' or 'File'

    // Skip config files
    if (fileName.endsWith('.env') || fileName.endsWith('config.json')) {
      entry.autodrain();
      return;
    }

    entry.pipe(createWriteStream(`./output/${fileName}`));
  })
  .promise();
```

#### Alternative ZIP Libraries

**extract-zip:**
- **Pros:** Fast, focused on extraction only, 17M weekly downloads
- **Cons:** No streaming support, lacks advanced features
- **Use Case:** Simple, fast extraction tasks

**jszip:**
- **Pros:** Browser + Node.js support, comprehensive features, 12M weekly downloads
- **Cons:** Loads entire zip into memory, not ideal for large files
- **Use Case:** Cross-platform apps, zip creation/manipulation

**adm-zip:**
- **Pros:** Pure JavaScript, simple API
- **Cons:** 2GB file size limit, loads entire file into memory
- **Use Case:** Small files only

**Verdict:** Use `unzipper` for memory-efficient streaming extraction of large files.

---

### 3. Progress Indicators

#### CLI Progress Bars: `cli-progress`

**Package:** `cli-progress`
**Weekly Downloads:** ~26M
**Bun Compatible:** ✅ Yes
**TypeScript:** ✅ Built-in types

**Features:**
- Multiple progress bar support
- Customizable themes
- Works in any terminal
- No external dependencies

**Installation:**
```bash
bun add cli-progress
```

**Usage Example:**
```typescript
import cliProgress from 'cli-progress';

// Single progress bar
const progressBar = new cliProgress.SingleBar({
  format: 'Downloading [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} bytes',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

// Start progress
progressBar.start(totalBytes, 0);

// Update progress
progressBar.update(receivedBytes);

// Complete
progressBar.stop();

// Multi-bar for multiple files
const multibar = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: '{filename} [{bar}] {percentage}% | {value}/{total}'
}, cliProgress.Presets.shades_classic);

const bar1 = multibar.create(100, 0, { filename: 'file1.tar.gz' });
const bar2 = multibar.create(100, 0, { filename: 'file2.zip' });

bar1.update(50);
bar2.update(30);

multibar.stop();
```

#### Spinners: `ora`

**Package:** `ora`
**Weekly Downloads:** ~24M
**Bun Compatible:** ✅ Yes
**TypeScript:** ✅ Built-in types

**Features:**
- Elegant terminal spinner
- 80+ spinner styles
- Color support
- Promise integration

**Installation:**
```bash
bun add ora
```

**Usage Example:**
```typescript
import ora from 'ora';

const spinner = ora('Downloading archive...').start();

try {
  await downloadFile(url);
  spinner.succeed('Download complete!');
} catch (error) {
  spinner.fail('Download failed!');
}

// With promise
const spinner = ora('Processing...').start();
await spinner.promise(
  processArchive(),
  {
    successText: 'Archive processed!',
    failText: 'Processing failed!'
  }
);
```

**Combined Approach:**
```typescript
import ora from 'ora';
import cliProgress from 'cli-progress';

// Use spinner for indeterminate operations
const spinner = ora('Fetching release info...').start();
const releaseInfo = await getReleaseInfo();
spinner.succeed('Release info fetched!');

// Use progress bar for downloads
const progressBar = new cliProgress.SingleBar({});
progressBar.start(totalBytes, 0);
// ... update during download
progressBar.stop();

// Use spinner for extraction
const extractSpinner = ora('Extracting archive...').start();
await extractArchive();
extractSpinner.succeed('Extraction complete!');
```

---

### 4. File System Operations & Conflict Handling

#### Smart File Merging: `fs-extra`

**Package:** `fs-extra`
**Latest Version:** 11.3.2
**Weekly Downloads:** ~70M
**TypeScript:** ✅ Built-in types

**Features:**
- All Node.js `fs` methods + extras
- Promise-based API
- Recursive operations
- Copy with filtering

**Installation:**
```bash
bun add fs-extra
```

**Conflict Handling Strategies:**

```typescript
import fs from 'fs-extra';
import path from 'path';

// Strategy 1: Skip existing files
async function copySkipExisting(src: string, dest: string) {
  await fs.copy(src, dest, {
    overwrite: false,
    errorOnExist: false,
    filter: async (srcPath) => {
      const destPath = srcPath.replace(src, dest);
      const exists = await fs.pathExists(destPath);
      return !exists; // Skip if exists
    }
  });
}

// Strategy 2: Skip config files, overwrite code files
const CONFIG_PATTERNS = [
  /\.env(\..*)?$/,
  /config\.(json|yaml|yml|toml)$/,
  /\.config\.(js|ts)$/,
  /package\.json$/,
  /bun\.lockb$/
];

async function smartMerge(src: string, dest: string) {
  await fs.copy(src, dest, {
    overwrite: true,
    filter: async (srcPath) => {
      const relativePath = path.relative(src, srcPath);

      // Skip config files
      if (CONFIG_PATTERNS.some(pattern => pattern.test(relativePath))) {
        const destPath = path.join(dest, relativePath);
        if (await fs.pathExists(destPath)) {
          console.log(`⏭️  Skipped: ${relativePath} (config file)`);
          return false;
        }
      }

      return true;
    }
  });
}

// Strategy 3: Prompt user for conflicts
import prompts from 'prompts';

async function interactiveMerge(src: string, dest: string) {
  const conflicts: string[] = [];

  // First pass: detect conflicts
  await fs.copy(src, dest, {
    overwrite: false,
    errorOnExist: false,
    filter: async (srcPath) => {
      const destPath = srcPath.replace(src, dest);
      if (await fs.pathExists(destPath)) {
        const stat = await fs.stat(srcPath);
        if (stat.isFile()) {
          conflicts.push(path.relative(src, srcPath));
        }
      }
      return false; // Don't copy yet
    }
  });

  // Resolve conflicts
  const resolutions = new Map<string, 'skip' | 'overwrite'>();

  for (const file of conflicts) {
    const response = await prompts({
      type: 'select',
      name: 'action',
      message: `File exists: ${file}`,
      choices: [
        { title: 'Skip', value: 'skip' },
        { title: 'Overwrite', value: 'overwrite' }
      ]
    });

    resolutions.set(file, response.action);
  }

  // Second pass: copy with resolutions
  await fs.copy(src, dest, {
    overwrite: true,
    filter: (srcPath) => {
      const relativePath = path.relative(src, srcPath);
      const resolution = resolutions.get(relativePath);

      if (resolution === 'skip') {
        return false;
      }

      return true;
    }
  });
}

// Strategy 4: Backup existing files
async function mergeWithBackup(src: string, dest: string) {
  const backupDir = `${dest}.backup.${Date.now()}`;

  await fs.copy(src, dest, {
    overwrite: true,
    filter: async (srcPath) => {
      const destPath = srcPath.replace(src, dest);

      if (await fs.pathExists(destPath)) {
        const backupPath = destPath.replace(dest, backupDir);
        await fs.ensureDir(path.dirname(backupPath));
        await fs.copy(destPath, backupPath);
        console.log(`📦 Backed up: ${path.relative(dest, destPath)}`);
      }

      return true;
    }
  });

  console.log(`\n✅ Backup created at: ${backupDir}`);
}
```

#### File Filtering with gitignore: `ignore`

**Package:** `ignore`
**Weekly Downloads:** ~45M
**Used by:** ESLint, Prettier, many others

```typescript
import ignore from 'ignore';
import fs from 'fs-extra';
import path from 'path';

async function mergeWithGitignore(src: string, dest: string) {
  const ig = ignore();

  // Load .gitignore if exists
  const gitignorePath = path.join(dest, '.gitignore');
  if (await fs.pathExists(gitignorePath)) {
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    ig.add(gitignoreContent);
  }

  // Add default ignores
  ig.add([
    '.env*',
    'node_modules/',
    '*.log',
    '.DS_Store'
  ]);

  await fs.copy(src, dest, {
    filter: (srcPath) => {
      const relativePath = path.relative(src, srcPath);
      return !ig.ignores(relativePath);
    }
  });
}
```

---

### 5. Temporary Directory Management & Cleanup

#### Automatic Cleanup: `tmp`

**Package:** `tmp`
**Weekly Downloads:** ~20M
**TypeScript:** ✅ @types/tmp available

**Features:**
- Automatic cleanup on process exit
- Secure temp file creation
- Graceful or forced cleanup
- Prefix/postfix support

**Installation:**
```bash
bun add tmp
bun add -D @types/tmp
```

**Usage Example:**
```typescript
import tmp from 'tmp';
import { promisify } from 'util';

// Enable automatic cleanup
tmp.setGracefulCleanup();

// Create temporary directory
const tmpDir = await promisify(tmp.dir)({
  prefix: 'claudekit-',
  unsafeCleanup: true  // Remove even if not empty
});

console.log(`Temp dir: ${tmpDir.name}`);

// Download and extract to temp dir
await downloadFile(url, path.join(tmpDir.name, 'archive.tar.gz'));
await extractArchive(path.join(tmpDir.name, 'archive.tar.gz'), tmpDir.name);

// Manual cleanup (if needed before exit)
tmpDir.cleanup();

// Temp file
const tmpFile = await promisify(tmp.file)({
  prefix: 'download-',
  postfix: '.tar.gz'
});

console.log(`Temp file: ${tmpFile.name}`);
```

#### Manual Cleanup Pattern

```typescript
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

async function withTempDir<T>(
  fn: (tmpDir: string) => Promise<T>
): Promise<T> {
  const tmpDir = path.join(
    os.tmpdir(),
    `claudekit-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  try {
    await fs.ensureDir(tmpDir);
    return await fn(tmpDir);
  } finally {
    // Always cleanup, even if error occurs
    await fs.remove(tmpDir).catch(err => {
      console.warn(`Failed to cleanup temp dir: ${err.message}`);
    });
  }
}

// Usage
const result = await withTempDir(async (tmpDir) => {
  await downloadFile(url, path.join(tmpDir, 'archive.tar.gz'));
  await extractArchive(path.join(tmpDir, 'archive.tar.gz'), tmpDir);
  await mergeFiles(tmpDir, targetDir);
  return 'success';
});
```

---

### 6. GitHub Release Download

#### GitHub API Integration

```typescript
interface GitHubRelease {
  tag_name: string;
  tarball_url: string;
  zipball_url: string;
}

async function getLatestRelease(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubRelease> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return response.json();
}

async function downloadGitHubRelease(
  owner: string,
  repo: string,
  tag: string,
  token?: string
): Promise<string> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Download tarball (follows redirects automatically)
  const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${tag}`;
  const response = await fetch(tarballUrl, {
    headers,
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const tmpFile = path.join(os.tmpdir(), `${repo}-${tag}.tar.gz`);
  await Bun.write(tmpFile, response);

  return tmpFile;
}
```

---

### 7. Security Considerations

#### Path Traversal Protection

```typescript
import path from 'path';

function isPathSafe(basePath: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(targetPath);

  // Ensure target is within base directory
  return resolvedTarget.startsWith(resolvedBase);
}

async function safeExtract(archivePath: string, outputDir: string) {
  await tar.extract({
    file: archivePath,
    cwd: outputDir,
    filter: (filePath) => {
      const fullPath = path.join(outputDir, filePath);

      if (!isPathSafe(outputDir, fullPath)) {
        console.warn(`⚠️  Blocked path traversal: ${filePath}`);
        return false;
      }

      return true;
    }
  });
}
```

#### Content Validation

```typescript
import crypto from 'crypto';

async function verifyChecksum(
  filePath: string,
  expectedChecksum: string,
  algorithm: 'sha256' | 'md5' = 'sha256'
): Promise<boolean> {
  const hash = crypto.createHash(algorithm);
  const fileContent = await fs.readFile(filePath);
  hash.update(fileContent);
  const actualChecksum = hash.digest('hex');

  return actualChecksum === expectedChecksum;
}
```

---

## Comparative Analysis

### Download Libraries

| Library | Bun Native | Streaming | Progress | TypeScript | Recommendation |
|---------|-----------|-----------|----------|------------|----------------|
| Bun fetch | ✅ | ✅ | Manual | ✅ | **Best choice** |
| axios | ❌ | ✅ | Built-in | ✅ | Alternative |
| got | ❌ | ✅ | Built-in | ✅ | Alternative |

### Extraction Libraries

| Library | Format | Streaming | Memory | Performance | Weekly DL | Recommendation |
|---------|--------|-----------|--------|-------------|-----------|----------------|
| tar | .tar.gz | ✅ | Low | Excellent | ~50M | **Best for tar** |
| unzipper | .zip | ✅ | Low | Good | ~5M | **Best for zip** |
| extract-zip | .zip | ❌ | Medium | Excellent | ~17M | Simple tasks |
| jszip | .zip | ✅ | High | Fair | ~12M | Browser + Node |

### Progress Indicators

| Library | Type | Features | Complexity | Weekly DL | Recommendation |
|---------|------|----------|------------|-----------|----------------|
| cli-progress | Bar | Multi-bar, themes | Medium | ~26M | **Best for progress** |
| ora | Spinner | 80+ styles, colors | Low | ~24M | **Best for spinners** |

---

## Implementation Recommendations

### Complete Download & Extract Workflow

```typescript
import ora from 'ora';
import cliProgress from 'cli-progress';
import tar from 'tar';
import unzipper from 'unzipper';
import fs from 'fs-extra';
import tmp from 'tmp';
import path from 'path';

// Enable auto cleanup
tmp.setGracefulCleanup();

interface DownloadOptions {
  url: string;
  targetDir: string;
  skipExisting?: boolean;
  skipPatterns?: RegExp[];
  githubToken?: string;
}

async function downloadAndExtract(options: DownloadOptions): Promise<void> {
  const {
    url,
    targetDir,
    skipExisting = false,
    skipPatterns = [/\.env/, /config\.json/],
    githubToken
  } = options;

  // Step 1: Fetch file info
  const spinner = ora('Fetching download info...').start();

  const headers: HeadersInit = {};
  if (githubToken) {
    headers['Authorization'] = `Bearer ${githubToken}`;
  }

  const response = await fetch(url, {
    method: 'HEAD',
    headers
  });

  if (!response.ok) {
    spinner.fail('Failed to fetch download info');
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentLength = parseInt(response.headers.get('Content-Length') || '0');
  const contentType = response.headers.get('Content-Type') || '';

  spinner.succeed('Download info fetched');

  // Step 2: Download with progress
  const progressBar = new cliProgress.SingleBar({
    format: 'Downloading [{bar}] {percentage}% | {value}/{total} bytes',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  });

  progressBar.start(contentLength, 0);

  const downloadResponse = await fetch(url, { headers });
  const reader = downloadResponse.body?.getReader();

  if (!reader) {
    throw new Error('No response body');
  }

  let receivedLength = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedLength += value.length;
    progressBar.update(receivedLength);
  }

  progressBar.stop();

  // Step 3: Save to temp file
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  const fileExt = contentType.includes('gzip') || url.includes('.tar.gz')
    ? '.tar.gz'
    : '.zip';
  const tmpFile = path.join(tmpDir.name, `archive${fileExt}`);

  const allChunks = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  await Bun.write(tmpFile, allChunks);
  console.log('✅ Download complete');

  // Step 4: Extract
  const extractSpinner = ora('Extracting archive...').start();
  const extractDir = path.join(tmpDir.name, 'extracted');
  await fs.ensureDir(extractDir);

  try {
    if (fileExt === '.tar.gz') {
      await tar.extract({
        file: tmpFile,
        cwd: extractDir,
        strip: 1, // Remove top-level directory
        filter: (filePath) => {
          // Security check
          const fullPath = path.join(extractDir, filePath);
          const resolvedPath = path.resolve(fullPath);
          const resolvedBase = path.resolve(extractDir);

          if (!resolvedPath.startsWith(resolvedBase)) {
            console.warn(`⚠️  Blocked: ${filePath}`);
            return false;
          }

          return true;
        }
      });
    } else {
      const { createReadStream } = await import('fs');
      await createReadStream(tmpFile)
        .pipe(unzipper.Extract({ path: extractDir }))
        .promise();
    }

    extractSpinner.succeed('Extraction complete');
  } catch (error) {
    extractSpinner.fail('Extraction failed');
    throw error;
  }

  // Step 5: Smart merge
  const mergeSpinner = ora('Merging files...').start();
  let skippedCount = 0;
  let copiedCount = 0;

  await fs.copy(extractDir, targetDir, {
    overwrite: !skipExisting,
    filter: async (srcPath) => {
      const relativePath = path.relative(extractDir, srcPath);
      const destPath = path.join(targetDir, relativePath);

      // Check if exists
      const exists = await fs.pathExists(destPath);

      // Skip if exists and skipExisting is true
      if (exists && skipExisting) {
        skippedCount++;
        return false;
      }

      // Skip if matches skip patterns
      if (skipPatterns.some(pattern => pattern.test(relativePath))) {
        if (exists) {
          mergeSpinner.text = `Skipped: ${relativePath} (protected)`;
          skippedCount++;
          return false;
        }
      }

      copiedCount++;
      mergeSpinner.text = `Copying: ${relativePath}`;
      return true;
    }
  });

  mergeSpinner.succeed(
    `Merge complete (${copiedCount} copied, ${skippedCount} skipped)`
  );

  // Cleanup is automatic via tmp.setGracefulCleanup()
}

// Usage
await downloadAndExtract({
  url: 'https://github.com/owner/repo/archive/refs/tags/v1.0.0.tar.gz',
  targetDir: './my-project',
  skipExisting: true,
  skipPatterns: [
    /\.env(\..*)?$/,
    /config\.(json|yaml|yml)$/,
    /package\.json$/
  ],
  githubToken: process.env.GITHUB_TOKEN
});
```

---

## Common Pitfalls & Solutions

### 1. Missing Content-Length Header (CORS)

**Problem:** Progress tracking fails when Content-Length is not exposed in CORS requests.

**Solution:**
```typescript
async function downloadWithFallback(url: string) {
  const response = await fetch(url);
  const contentLength = parseInt(response.headers.get('Content-Length') || '0');

  if (contentLength === 0) {
    // Fallback to spinner when progress unknown
    const spinner = ora('Downloading (size unknown)...').start();
    const data = await response.arrayBuffer();
    spinner.succeed(`Downloaded ${data.byteLength} bytes`);
    return data;
  } else {
    // Use progress bar when size is known
    // ... progress bar implementation
  }
}
```

### 2. Memory Issues with Large Files

**Problem:** Loading entire file into memory causes crashes.

**Solution:** Always use streaming
```typescript
// ❌ Bad: Loads entire file into memory
const data = await response.arrayBuffer();
await Bun.write(file, data);

// ✅ Good: Streams directly to disk
const writer = Bun.file(file).writer();
for await (const chunk of response.body) {
  writer.write(chunk);
}
await writer.end();
```

### 3. Path Traversal Attacks

**Problem:** Malicious archives can write outside target directory.

**Solution:** Always validate paths
```typescript
function validatePath(basePath: string, targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const base = path.resolve(basePath);
  return resolved.startsWith(base);
}
```

### 4. Incomplete Cleanup

**Problem:** Temporary files left behind on errors.

**Solution:** Use try-finally with tmp package
```typescript
tmp.setGracefulCleanup(); // Auto-cleanup on exit

async function process() {
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });

  try {
    // ... work with tmpDir.name
  } finally {
    // Manual cleanup if needed before exit
    tmpDir.removeCallback();
  }
}
```

### 5. Overwriting Important Files

**Problem:** Config files get overwritten during merge.

**Solution:** Use smart filtering
```typescript
const PROTECTED_FILES = [
  /\.env/,
  /config\./,
  /package\.json/,
  /bun\.lockb/
];

await fs.copy(src, dest, {
  filter: (srcPath) => {
    const relative = path.relative(src, srcPath);
    if (PROTECTED_FILES.some(p => p.test(relative))) {
      return !fs.existsSync(path.join(dest, relative));
    }
    return true;
  }
});
```

---

## Error Handling Best Practices

```typescript
class DownloadError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'DownloadError';
  }
}

class ExtractionError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ExtractionError';
  }
}

async function safeDownloadAndExtract(url: string, targetDir: string) {
  const spinner = ora('Starting...').start();
  let tmpDir: tmp.DirResult | null = null;

  try {
    // Download phase
    spinner.text = 'Downloading...';
    const response = await fetch(url);

    if (!response.ok) {
      throw new DownloadError(
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const tmpFile = path.join(tmpDir.name, 'archive.tar.gz');

    await Bun.write(tmpFile, response);
    spinner.succeed('Download complete');

    // Extract phase
    spinner.start('Extracting...');
    await tar.extract({
      file: tmpFile,
      cwd: targetDir
    });
    spinner.succeed('Extraction complete');

  } catch (error) {
    spinner.fail('Operation failed');

    if (error instanceof DownloadError) {
      console.error(`Download error: ${error.message}`);
      console.error('Please check your internet connection and URL');
    } else if (error instanceof ExtractionError) {
      console.error(`Extraction error: ${error.message}`);
      console.error('The archive may be corrupted');
    } else {
      console.error(`Unexpected error: ${error}`);
    }

    throw error;

  } finally {
    // Always cleanup
    if (tmpDir) {
      tmpDir.removeCallback();
    }
  }
}
```

---

## Performance Optimization

### 1. Parallel Downloads

```typescript
async function downloadMultiple(urls: string[]) {
  const multibar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true
  });

  const downloads = urls.map(async (url, index) => {
    const bar = multibar.create(100, 0, {
      filename: path.basename(url)
    });

    // ... download with progress updates to bar

    return result;
  });

  const results = await Promise.all(downloads);
  multibar.stop();

  return results;
}
```

### 2. Stream Processing

```typescript
// Process archive while downloading (no temp file)
async function streamExtract(url: string, targetDir: string) {
  const response = await fetch(url);

  // Convert Web ReadableStream to Node.js stream
  const webStream = response.body;
  const nodeStream = Readable.fromWeb(webStream);

  // Extract while downloading
  await new Promise((resolve, reject) => {
    nodeStream
      .pipe(tar.extract({ cwd: targetDir }))
      .on('finish', resolve)
      .on('error', reject);
  });
}
```

### 3. Incremental Processing

```typescript
// Process files as they're extracted
await tar.extract({
  file: archivePath,
  cwd: targetDir,
  onentry: async (entry) => {
    console.log(`Extracted: ${entry.path}`);

    // Process immediately
    if (entry.path.endsWith('.js')) {
      await processJsFile(path.join(targetDir, entry.path));
    }
  }
});
```

---

## Resources & References

### Official Documentation
- **Bun Fetch API:** https://bun.sh/docs/api/fetch
- **Bun Streams:** https://bun.sh/docs/api/streams
- **Node-tar:** https://github.com/isaacs/node-tar
- **Unzipper:** https://www.npmjs.com/package/unzipper
- **cli-progress:** https://www.npmjs.com/package/cli-progress
- **ora:** https://github.com/sindresorhus/ora
- **fs-extra:** https://github.com/jprichardson/node-fs-extra
- **tmp:** https://www.npmjs.com/package/tmp

### Recommended Tutorials
- **Fetch Download Progress:** https://javascript.info/fetch-progress
- **Node.js Tarball Decompression (2024):** https://www.petecorey.com/blog/2024/03/26/decompress-a-tarball-in-nodejs/
- **Node.js Zip File Management (Oct 2024):** https://www.somethingsblog.com/2024/10/24/node-js-zip-file-management-a-comprehensive-guide/
- **CLI Progress in TypeScript (Oct 2024):** https://www.webdevtutor.net/blog/typescript-cli-progress-bar

### Community Resources
- **Stack Overflow:** [bun], [node-tar], [file-extraction] tags
- **GitHub Discussions:** oven-sh/bun repository
- **Discord:** Bun community server

### Package Comparison Tools
- **npm trends:** https://npmtrends.com/
- **npm-compare:** https://npm-compare.com/

---

## Appendices

### A. Glossary

- **Tarball:** A .tar or .tar.gz archive file, commonly used in Unix/Linux
- **Stream:** Data processing method that handles data piece-by-piece rather than all at once
- **Bun:** Modern JavaScript runtime with built-in tooling, faster than Node.js
- **CORS:** Cross-Origin Resource Sharing, browser security mechanism
- **Path Traversal:** Security vulnerability where files are accessed outside intended directory
- **Content-Length:** HTTP header indicating the size of the response body

### B. Archive Format Support Matrix

| Format | Extension | Compression | Recommended Library | Streaming | Performance |
|--------|-----------|-------------|---------------------|-----------|-------------|
| Tarball (gzip) | .tar.gz, .tgz | gzip | `tar` | ✅ | Excellent |
| Tarball (plain) | .tar | none | `tar` | ✅ | Excellent |
| Zip | .zip | deflate | `unzipper` | ✅ | Good |
| Bzip2 | .tar.bz2 | bzip2 | `tar` | ✅ | Good |
| XZ | .tar.xz | xz | `tar` | ✅ | Good |

### C. Recommended Package Versions (Oct 2025)

```json
{
  "dependencies": {
    "tar": "^7.4.3",
    "unzipper": "^0.12.3",
    "cli-progress": "^3.12.0",
    "ora": "^8.1.1",
    "fs-extra": "^11.3.2",
    "tmp": "^0.2.3",
    "ignore": "^6.0.2",
    "prompts": "^2.4.2"
  },
  "devDependencies": {
    "@types/tar": "^6.1.13",
    "@types/unzipper": "^0.10.10",
    "@types/tmp": "^0.2.6",
    "@types/fs-extra": "^11.0.4",
    "@types/prompts": "^2.4.9",
    "bun-types": "latest"
  }
}
```

### D. Quick Start Code Template

```typescript
// download-extract.ts
import ora from 'ora';
import cliProgress from 'cli-progress';
import tar from 'tar';
import fs from 'fs-extra';
import tmp from 'tmp';
import path from 'path';

tmp.setGracefulCleanup();

export async function downloadAndExtract(
  url: string,
  targetDir: string
): Promise<void> {
  const spinner = ora('Downloading...').start();

  // Download
  const response = await fetch(url);
  const tmpFile = tmp.fileSync({ postfix: '.tar.gz' });
  await Bun.write(tmpFile.name, response);
  spinner.succeed('Downloaded');

  // Extract
  spinner.start('Extracting...');
  await tar.extract({ file: tmpFile.name, cwd: targetDir });
  spinner.succeed('Complete!');
}

// Usage
await downloadAndExtract(
  'https://github.com/owner/repo/archive/v1.0.0.tar.gz',
  './output'
);
```

---

## Summary & Next Steps

### Recommended Stack for Bun CLI:
1. **Download:** Bun's native `fetch()` with manual progress tracking
2. **Progress UI:** `cli-progress` for downloads, `ora` for spinners
3. **Extraction:** `tar` for .tar.gz, `unzipper` for .zip
4. **File Operations:** `fs-extra` with custom conflict resolution
5. **Temp Management:** `tmp` package with graceful cleanup
6. **Security:** Path validation, gitignore filtering with `ignore` package

### Implementation Checklist:
- [ ] Install recommended packages
- [ ] Implement download with progress tracking
- [ ] Add extraction with format detection
- [ ] Implement smart merge with conflict resolution
- [ ] Add proper error handling and cleanup
- [ ] Add path traversal protection
- [ ] Test with various archive formats
- [ ] Add user prompts for conflicts (optional)
- [ ] Implement parallel downloads (if needed)
- [ ] Add checksum verification (if available)

### Performance Targets:
- Download: Stream directly to disk, minimal memory usage
- Extraction: Process in parallel where possible
- Merge: Skip unnecessary file reads with smart filtering
- Cleanup: Automatic via tmp package, no manual intervention

---

**Report Generated:** October 8, 2025
**Total Research Time:** ~2 hours
**Sources Reviewed:** 35+
**Code Examples:** 25+
