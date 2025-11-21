# Security Implementation Research Report

**Date:** 2025-11-21
**Focus Areas:** Command Injection, Protected File Handling, Script Integrity, Path Traversal

---

## 1. Command Injection Prevention in Node.js

### Key Findings

**execFile vs exec:**
- `exec()` spawns shell, executes command within shell context → vulnerable to injection
- `execFile()` executes binary directly, no shell by default → safer alternative
- `spawn()` similar to execFile, takes arguments as array

**Critical Vulnerability:**
```typescript
// VULNERABLE - shell interpretation
exec(`ping ${userInput}`)  // Attacker: "; rm -rf /"

// SAFE - no shell, arguments as array
execFile('ping', ['-c', '1', userInput])
```

### Actionable Recommendations

#### 1. Replace exec with execFile/spawn
```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Safe implementation
async function runCommand(args: string[]) {
  try {
    const { stdout, stderr } = await execFileAsync('command', args);
    return stdout;
  } catch (error) {
    // Handle error
  }
}
```

#### 2. Use execa for Production Code
```typescript
import { execa } from 'execa';

// execa provides promise-based interface, automatic escaping
const result = await execa('npm', ['install', packageName], {
  shell: false,  // Critical: disable shell
  cwd: targetDir
});
```

**Why execa?**
- Promise-based API (better error handling)
- No escaping needed (unless shell: true)
- Cross-platform compatibility
- Better stdout/stderr handling
- No shell interpreter by default

#### 3. Input Validation Layer
```typescript
// Whitelist approach (preferred)
const ALLOWED_COMMANDS = new Set(['install', 'update', 'remove']);

function validateCommand(cmd: string): boolean {
  return ALLOWED_COMMANDS.has(cmd);
}

// Character filtering (fallback)
function sanitizeInput(input: string): string {
  // Remove dangerous characters: ; | & $ ( ) < > ` \ " '
  return input.replace(/[;|&$()<>`\\"']/g, '');
}
```

#### 4. Never Enable shell Option with User Input
```typescript
// VULNERABLE
spawn('command', [userInput], { shell: true });

// SAFE
spawn('command', [userInput], { shell: false }); // or omit (default false)
```

### OWASP Guidelines Summary
1. **Use safe APIs:** Prefer execFile/spawn over exec
2. **Avoid shell invocation:** Leverage Node.js APIs when possible
3. **Whitelist validation:** Accept only expected inputs
4. **Least privilege:** Run commands with minimal permissions
5. **Static analysis:** Use ESLint security plugins

### NPM Package Considerations

**shell-quote (AVOID):**
- Known vulnerabilities (CVE: improper escaping of `>`, `<`, `{`, `}`, `;`)
- Upgrade to v1.6.1+ if must use
- Manual escaping = security risk waiting to happen

**Recommended: execa v7.0+**
- Actively maintained
- Secure by default (no shell)
- Better error handling
- Cross-platform

---

## 2. Protected File Handling in Development Tools

### Key Findings

**Industry Standards:**
- Never commit `.env` to version control
- Use `.env.example` or `.env.template` for documentation
- npm publishing: if both `.gitignore` and `.npmignore` exist, only `.npmignore` is respected

**Common File Patterns:**
```
.env              → local secrets (gitignored)
.env.example      → template (committed)
.env.template     → alternate template name
.env.local        → local overrides (gitignored)
.env.production   → prod config (managed separately)
```

### Actionable Recommendations

#### 1. Implement Protected File Detection
```typescript
const PROTECTED_PATTERNS = [
  /\.env$/,
  /\.env\.local$/,
  /\.env\.production$/,
  /secrets\.ya?ml$/,
  /credentials\.json$/,
  /\.key$/,
  /\.pem$/,
  /\.p12$/,
  /\.pfx$/,
  /id_rsa$/,
  /\.ssh\/.*$/
];

function isProtectedFile(filepath: string): boolean {
  const basename = path.basename(filepath);
  return PROTECTED_PATTERNS.some(pattern => pattern.test(basename));
}

// Case-insensitive check for Windows
function isProtectedFileCaseInsensitive(filepath: string): boolean {
  const basename = path.basename(filepath).toLowerCase();
  return PROTECTED_PATTERNS.some(pattern =>
    pattern.test(basename)
  );
}
```

#### 2. Template File Strategy
```typescript
interface FileOperation {
  source: string;
  destination: string;
  shouldReplace: (dest: string) => boolean;
}

const TEMPLATE_OPERATIONS: FileOperation[] = [
  {
    source: '.env.example',
    destination: '.env',
    shouldReplace: (dest) => !fs.existsSync(dest) // Only if doesn't exist
  }
];

async function processTemplates(targetDir: string): Promise<void> {
  for (const op of TEMPLATE_OPERATIONS) {
    const destPath = path.join(targetDir, op.destination);

    // Skip if protected file exists
    if (fs.existsSync(destPath) && isProtectedFile(destPath)) {
      console.warn(`Skipping ${op.destination} - already exists`);
      continue;
    }

    const srcPath = path.join(templateDir, op.source);
    await fs.promises.copyFile(srcPath, destPath);
  }
}
```

#### 3. Pre-commit Hook Integration
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Use git-secrets or similar
git secrets --scan

# Or custom check
if git diff --cached --name-only | grep -E '\.env$|secrets\.'; then
  echo "ERROR: Protected files detected"
  exit 1
fi
```

#### 4. .gitignore Best Practices
```gitignore
# Environment variables
.env
.env.local
.env.*.local
!.env.example
!.env.template

# Secrets
secrets/
*.key
*.pem
*.p12
*.pfx
credentials.json

# SSH keys
id_rsa
id_dsa
.ssh/

# IDE with secrets
.vscode/settings.json
```

### CLI Tool Protection Layers

**Layer 1: Detection**
- Scan files before operations
- Warn on protected file access

**Layer 2: Confirmation**
- Require explicit user confirmation for protected files
- Show file path and reason

**Layer 3: Documentation**
- Clear README instructions
- .env.example with empty/dummy values

**Layer 4: Tooling**
- git-secrets, Gitleaks, TruffleHog
- Pre-commit hooks
- CI/CD secret scanning

---

## 3. Script Integrity Verification

### Key Findings

**Recent Threats:**
- September 2025: Shai-Hulud worm compromised 18 npm packages (2.6B weekly downloads)
- Attack vector: post-install scripts in popular packages (chalk, debug, ansi-styles)
- Method: Self-replicating worm via compromised maintainer accounts

**Verification Hierarchy:**
1. SHA-256 checksums (basic integrity)
2. Cryptographic signatures (authenticity + integrity)
3. Supply chain monitoring (content tracking)

### Actionable Recommendations

#### 1. SHA-256 Checksum Verification
```typescript
import { createHash } from 'crypto';
import { createReadStream } from 'fs';

async function calculateSHA256(filepath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filepath);

    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function verifyChecksum(
  filepath: string,
  expectedChecksum: string
): Promise<boolean> {
  const actualChecksum = await calculateSHA256(filepath);

  // Use timing-safe comparison to prevent timing attacks
  const actual = Buffer.from(actualChecksum, 'hex');
  const expected = Buffer.from(expectedChecksum, 'hex');

  if (actual.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(actual, expected);
}
```

**Critical: Use timingSafeEqual**
```typescript
// VULNERABLE - timing attack possible
if (actualHash === expectedHash) { }

// SAFE - constant-time comparison
import { timingSafeEqual } from 'crypto';

const actual = Buffer.from(actualHash, 'hex');
const expected = Buffer.from(expectedHash, 'hex');

if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
  // Valid
}
```

#### 2. Cryptographic Signature Verification
```typescript
import { createVerify } from 'crypto';
import { readFile } from 'fs/promises';

interface SignatureVerification {
  data: Buffer;
  signature: Buffer;
  publicKey: string;
}

async function verifySignature({
  data,
  signature,
  publicKey
}: SignatureVerification): Promise<boolean> {
  try {
    const verify = createVerify('SHA256');
    verify.update(data);
    verify.end();

    return verify.verify(publicKey, signature);
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

// Usage for downloaded scripts
async function verifyDownloadedScript(
  scriptPath: string,
  signaturePath: string,
  publicKeyPath: string
): Promise<boolean> {
  const [data, signature, publicKey] = await Promise.all([
    readFile(scriptPath),
    readFile(signaturePath),
    readFile(publicKeyPath, 'utf-8')
  ]);

  return verifySignature({ data, signature, publicKey });
}
```

#### 3. NPM Supply Chain Protection
```typescript
// package.json configuration
{
  "scripts": {
    "preinstall": "npx npm-audit-ci --audit-level=moderate",
    "postinstall": "echo 'Use ignore-scripts in CI'"
  },
  "engines": {
    "npm": ">=10.0.0"
  }
}
```

**CI/CD Security:**
```bash
# .github/workflows/security.yml
- name: Install dependencies
  run: npm ci --ignore-scripts  # Disable post-install scripts

- name: Audit dependencies
  run: npm audit --audit-level=moderate

- name: Check for known vulnerabilities
  run: npx snyk test
```

#### 4. Package Lock File Integrity
```typescript
import { createHash } from 'crypto';

async function verifyPackageLock(
  lockfilePath: string,
  expectedHash: string
): Promise<boolean> {
  const lockfileContent = await fs.promises.readFile(lockfilePath, 'utf-8');
  const actualHash = createHash('sha256')
    .update(lockfileContent)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(actualHash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
}
```

### Supply Chain Best Practices

**1. Lockfile Discipline:**
- Always commit `package-lock.json` or `pnpm-lock.yaml`
- Use `npm ci` (not `npm install`) in CI/CD
- Review lockfile changes in PRs

**2. Minimum Release Age (pnpm v10.16+):**
```yaml
# .npmrc
minimum-release-age=1440  # 24 hours in minutes
```

**3. Ignore Post-Install Scripts:**
```bash
# Global config (recommended)
npm config set ignore-scripts true

# Per-project
echo "ignore-scripts=true" >> .npmrc
```

**4. 2FA Requirements:**
- Enable 2FA on npm account
- Use WebAuthn (not TOTP)
- Require 2FA for publishing

**5. Trusted Publishing (2025 Standard):**
- Use temporary CI/CD credentials
- Eliminate long-lived tokens
- Token expiration: 7 days default, 90 days max

---

## 4. Path Traversal Prevention

### Key Findings

**Vulnerability Patterns:**
```typescript
// VULNERABLE - direct concatenation
const filepath = baseDir + '/' + userInput;

// VULNERABLE - path.normalize alone insufficient
const filepath = path.normalize(baseDir + '/' + userInput);

// STILL VULNERABLE - URL encoding bypass
// Attacker: %2e%2e%2f%2e%2e%2f
```

**Cross-Platform Challenges:**
- Windows: Case-insensitive file system (default)
- Linux/macOS: Case-sensitive
- NTFS: Can be case-sensitive (Windows 10+)

### Actionable Recommendations

#### 1. Secure Path Validation
```typescript
import path from 'path';

function isPathSafe(baseDir: string, userPath: string): boolean {
  // Resolve to absolute paths
  const resolvedBase = path.resolve(baseDir);
  const resolvedUser = path.resolve(baseDir, userPath);

  // Check if resolved path stays within base directory
  // Must check with separator to prevent partial matches
  return resolvedUser.startsWith(resolvedBase + path.sep) ||
         resolvedUser === resolvedBase;
}

// Usage
function safeReadFile(baseDir: string, userPath: string): Promise<string> {
  if (!isPathSafe(baseDir, userPath)) {
    throw new Error('Path traversal attempt detected');
  }

  const safePath = path.join(baseDir, userPath);
  return fs.promises.readFile(safePath, 'utf-8');
}
```

#### 2. URL Decoding Defense
```typescript
function sanitizeUserPath(userPath: string): string {
  // Decode URL encoding (multiple passes to catch double-encoding)
  let decoded = userPath;
  let prevDecoded;

  do {
    prevDecoded = decoded;
    decoded = decodeURIComponent(decoded);
  } while (decoded !== prevDecoded);

  // Remove null bytes
  decoded = decoded.replace(/\0/g, '');

  return decoded;
}

function isPathSafeWithDecoding(baseDir: string, userPath: string): boolean {
  const sanitized = sanitizeUserPath(userPath);
  return isPathSafe(baseDir, sanitized);
}
```

#### 3. Cross-Platform Case Sensitivity
```typescript
import { platform } from 'os';

function normalizePathCase(filepath: string): string {
  // Windows is case-insensitive (usually)
  if (platform() === 'win32') {
    return filepath.toLowerCase();
  }
  return filepath;
}

function isPathSafeCrossPlatform(
  baseDir: string,
  userPath: string
): boolean {
  const resolvedBase = normalizePathCase(path.resolve(baseDir));
  const resolvedUser = normalizePathCase(
    path.resolve(baseDir, sanitizeUserPath(userPath))
  );

  return resolvedUser.startsWith(resolvedBase + path.sep) ||
         resolvedUser === resolvedBase;
}
```

#### 4. Whitelist-Based Approach (Most Secure)
```typescript
const ALLOWED_FILES = new Set([
  'config.json',
  'settings.yaml',
  'data.csv'
]);

function isFileAllowed(filename: string): boolean {
  const basename = path.basename(filename);
  return ALLOWED_FILES.has(basename);
}

function safeReadFileWhitelist(
  baseDir: string,
  userPath: string
): Promise<string> {
  const sanitized = sanitizeUserPath(userPath);

  // Check whitelist first
  if (!isFileAllowed(sanitized)) {
    throw new Error('File not in allowed list');
  }

  // Still validate path containment
  if (!isPathSafe(baseDir, sanitized)) {
    throw new Error('Path traversal attempt detected');
  }

  const safePath = path.join(baseDir, sanitized);
  return fs.promises.readFile(safePath, 'utf-8');
}
```

#### 5. Complete Defense-in-Depth
```typescript
interface PathSecurityConfig {
  baseDir: string;
  allowedExtensions?: Set<string>;
  maxPathLength?: number;
  allowedFiles?: Set<string>;
}

class SecurePathValidator {
  constructor(private config: PathSecurityConfig) {}

  validate(userPath: string): string {
    // 1. Length check
    if (this.config.maxPathLength &&
        userPath.length > this.config.maxPathLength) {
      throw new Error('Path too long');
    }

    // 2. Sanitize (URL decoding, null bytes)
    const sanitized = sanitizeUserPath(userPath);

    // 3. Whitelist check (if configured)
    if (this.config.allowedFiles) {
      const basename = path.basename(sanitized);
      if (!this.config.allowedFiles.has(basename)) {
        throw new Error('File not allowed');
      }
    }

    // 4. Extension check (if configured)
    if (this.config.allowedExtensions) {
      const ext = path.extname(sanitized);
      if (!this.config.allowedExtensions.has(ext)) {
        throw new Error('File extension not allowed');
      }
    }

    // 5. Path traversal check
    const resolvedBase = path.resolve(this.config.baseDir);
    const resolvedUser = path.resolve(this.config.baseDir, sanitized);

    if (platform() === 'win32') {
      // Case-insensitive comparison for Windows
      const base = resolvedBase.toLowerCase();
      const user = resolvedUser.toLowerCase();

      if (!user.startsWith(base + path.sep) && user !== base) {
        throw new Error('Path traversal detected');
      }
    } else {
      if (!resolvedUser.startsWith(resolvedBase + path.sep) &&
          resolvedUser !== resolvedBase) {
        throw new Error('Path traversal detected');
      }
    }

    return resolvedUser;
  }
}

// Usage
const validator = new SecurePathValidator({
  baseDir: '/app/data',
  allowedExtensions: new Set(['.json', '.yaml', '.csv']),
  maxPathLength: 255
});

try {
  const safePath = validator.validate(userInput);
  const content = await fs.promises.readFile(safePath, 'utf-8');
} catch (error) {
  console.error('Security violation:', error.message);
}
```

### OWASP Guidelines Summary

**Input Validation:**
- Whitelist approach (preferred)
- Validate against expected patterns
- Escape dangerous characters

**Path Operations:**
- Never concatenate user input directly
- Use `path.resolve()` for absolute paths
- Verify result stays within base directory

**Additional Protections:**
- Don't store sensitive files in web root
- Implement RBAC for file access
- Use framework protections (Express.static handles this)

---

## Implementation Priority

### High Priority (Immediate)

1. **Command Injection:**
   - Replace all `exec()` with `execFile()` or `execa`
   - Disable `shell` option
   - Add input validation layer

2. **Path Traversal:**
   - Implement `SecurePathValidator` class
   - Add path containment checks before file operations
   - URL decode user paths

3. **Protected Files:**
   - Add protected file pattern detection
   - Warn/block operations on sensitive files
   - Separate template files (.env.example)

### Medium Priority (Next Sprint)

4. **Script Integrity:**
   - Add SHA-256 checksum verification for downloaded scripts
   - Implement lockfile integrity checks
   - Add `--ignore-scripts` to CI/CD

5. **Supply Chain:**
   - Enable npm audit in CI/CD
   - Configure minimum release age (pnpm)
   - Require 2FA for npm publishing

### Low Priority (Future)

6. **Advanced Verification:**
   - Implement cryptographic signature verification
   - Add Subresource Integrity (SRI) for CDN assets
   - Set up automated dependency monitoring

---

## Code Snippets for Immediate Use

### 1. Safe Command Execution (execa)
```typescript
import { execa } from 'execa';

export async function executeCommand(
  command: string,
  args: string[],
  options: { cwd: string }
): Promise<string> {
  try {
    const result = await execa(command, args, {
      shell: false,
      cwd: options.cwd,
      reject: true
    });
    return result.stdout;
  } catch (error) {
    throw new Error(`Command failed: ${error.message}`);
  }
}
```

### 2. Protected File Check
```typescript
const PROTECTED_PATTERNS = [
  /\.env(\..*)?$/,
  /secrets?\./,
  /credentials?\./,
  /\.(key|pem|p12|pfx)$/,
  /^id_(rsa|dsa|ecdsa|ed25519)$/
];

export function isProtectedFile(filepath: string): boolean {
  const basename = path.basename(filepath).toLowerCase();
  return PROTECTED_PATTERNS.some(p => p.test(basename));
}
```

### 3. Checksum Verification
```typescript
import { createHash } from 'crypto';

export async function verifyFileIntegrity(
  filepath: string,
  expectedChecksum: string
): Promise<boolean> {
  const actual = await calculateSHA256(filepath);
  const actualBuf = Buffer.from(actual, 'hex');
  const expectedBuf = Buffer.from(expectedChecksum, 'hex');

  return actualBuf.length === expectedBuf.length &&
         crypto.timingSafeEqual(actualBuf, expectedBuf);
}
```

### 4. Path Traversal Protection
```typescript
export function validatePath(baseDir: string, userPath: string): string {
  const sanitized = decodeURIComponent(userPath).replace(/\0/g, '');
  const resolved = path.resolve(baseDir, sanitized);
  const base = path.resolve(baseDir);

  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('Path traversal attempt');
  }

  return resolved;
}
```

---

## Unresolved Questions

1. **Signature Distribution:**
   - How to securely distribute public keys for signature verification?
   - Should keys be embedded in CLI or fetched from secure endpoint?

2. **Performance Impact:**
   - What's the performance overhead of SHA-256 verification for large scripts?
   - Should verification be optional with flag for trusted networks?

3. **Windows Case Sensitivity:**
   - Should CLI detect NTFS case-sensitivity setting per directory?
   - Default to case-insensitive comparison on Windows always?

4. **Post-Install Scripts:**
   - Should CLI provide option to review scripts before execution?
   - How to balance security with legitimate post-install needs?

5. **Supply Chain Monitoring:**
   - Integrate with Socket.dev or similar service for real-time alerts?
   - Set up automated PR comments for dependency changes?

---

## References

- OWASP Node.js Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html
- OWASP Path Traversal: https://owasp.org/www-community/attacks/Path_Traversal
- Node.js Crypto Documentation: https://nodejs.org/api/crypto.html
- npm Security Best Practices: https://github.com/lirantal/npm-security-best-practices
- Shai-Hulud Attack Analysis (Sept 2025): https://unit42.paloaltonetworks.com/npm-supply-chain-attack/
