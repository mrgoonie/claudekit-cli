# Security Analysis: Command Injection Vulnerabilities in package-installer.ts

**File:** `/Users/duynguyen/www/claudekit/claudekit-cli/src/utils/package-installer.ts`
**Issue:** Using `execAsync()` with string interpolation creates command injection vulnerabilities
**Risk Level:** Medium (mitigated by regex validation but violates defense-in-depth)

## Executive Summary

Found 11 locations where `execAsync()` uses template literals with interpolated values. Despite NPM_PACKAGE_REGEX validation, this pattern is vulnerable to:
- Potential regex bypass via future changes
- Command injection if validation is accidentally removed/modified
- Shell metacharacter interpretation
- Failure to follow security best practices (defense-in-depth)

**Recommendation:** Replace ALL `execAsync()` calls with `execFileAsync()` to eliminate shell interpretation entirely.

---

## Detailed Vulnerability Analysis

### Location 1: Line 60
**Function:** `isPackageInstalled()` - npm version check
**Current Code:**
```typescript
await execAsync(`${getNpmCommand()} --version`, { timeout: 3000 });
```

**Issue:** Executes npm command through shell
**Replacement:**
```typescript
await execFileAsync(getNpmCommand(), ["--version"], { timeout: 3000 });
```

**Notes:**
- No interpolated variables, but still spawns shell unnecessarily
- Special case: checking npm itself exists

---

### Location 2: Line 71
**Function:** `isPackageInstalled()` - npm view check
**Current Code:**
```typescript
await execAsync(`${getNpmCommand()} view ${packageName} version`, { timeout: 3000 });
```

**Issue:** Interpolates `packageName` into shell command
**Replacement:**
```typescript
await execFileAsync(getNpmCommand(), ["view", packageName, "version"], { timeout: 3000 });
```

**Notes:**
- `packageName` validated by NPM_PACKAGE_REGEX but defense-in-depth violated
- Shell metacharacters in packageName could theoretically bypass if regex changes

---

### Location 3: Line 76
**Function:** `isPackageInstalled()` - npm list global check
**Current Code:**
```typescript
const { stdout } = await execAsync(`${getNpmCommand()} list -g ${packageName} --depth=0`, {
    timeout: 3000,
});
```

**Issue:** Interpolates `packageName` into shell command
**Replacement:**
```typescript
const { stdout } = await execFileAsync(getNpmCommand(), ["list", "-g", packageName, "--depth=0"], {
    timeout: 3000,
});
```

**Notes:** Same risk as Location 2

---

### Location 4: Line 87-88
**Function:** `isPackageInstalled()` - npm list JSON format
**Current Code:**
```typescript
const { stdout: jsonOutput } = await execAsync(
    `${getNpmCommand()} list -g ${packageName} --depth=0 --json`,
    { timeout: 3000 }
);
```

**Issue:** Interpolates `packageName` into shell command
**Replacement:**
```typescript
const { stdout: jsonOutput } = await execFileAsync(
    getNpmCommand(),
    ["list", "-g", packageName, "--depth=0", "--json"],
    { timeout: 3000 }
);
```

**Notes:** Same risk as Location 2

---

### Location 5: Line 122
**Function:** `getPackageVersion()` - npm version for npm itself
**Current Code:**
```typescript
const { stdout } = await execAsync(`${getNpmCommand()} --version`, { timeout: 3000 });
```

**Issue:** Executes npm command through shell
**Replacement:**
```typescript
const { stdout } = await execFileAsync(getNpmCommand(), ["--version"], { timeout: 3000 });
```

**Notes:** Same as Location 1

---

### Location 6: Line 131
**Function:** `getPackageVersion()` - npm view version check
**Current Code:**
```typescript
await execAsync(`${getNpmCommand()} view ${packageName} version`, { timeout: 3000 });
```

**Issue:** Interpolates `packageName` into shell command
**Replacement:**
```typescript
await execFileAsync(getNpmCommand(), ["view", packageName, "version"], { timeout: 3000 });
```

**Notes:** Same risk as Location 2

---

### Location 7: Line 139-140
**Function:** `getPackageVersion()` - npm list JSON
**Current Code:**
```typescript
const { stdout: jsonOutput } = await execAsync(
    `${getNpmCommand()} list -g ${packageName} --depth=0 --json`,
    { timeout: 3000 }
);
```

**Issue:** Interpolates `packageName` into shell command
**Replacement:**
```typescript
const { stdout: jsonOutput } = await execFileAsync(
    getNpmCommand(),
    ["list", "-g", packageName, "--depth=0", "--json"],
    { timeout: 3000 }
);
```

**Notes:** Same risk as Location 2

---

### Location 8: Line 156
**Function:** `getPackageVersion()` - npm list text format
**Current Code:**
```typescript
const { stdout } = await execAsync(`${getNpmCommand()} list -g ${packageName} --depth=0`, {
    timeout: 3000,
});
```

**Issue:** Interpolates `packageName` into shell command
**Replacement:**
```typescript
const { stdout } = await execFileAsync(getNpmCommand(), ["list", "-g", packageName, "--depth=0"], {
    timeout: 3000,
});
```

**Notes:** Same risk as Location 2

---

### Location 9: Line 198
**Function:** `installPackageGlobally()` - npm install
**Current Code:**
```typescript
await execAsync(`${getNpmCommand()} install -g ${packageName}`, {
    timeout: 120000,
});
```

**Issue:** Interpolates `packageName` into shell command
**Replacement:**
```typescript
await execFileAsync(getNpmCommand(), ["install", "-g", packageName], {
    timeout: 120000,
});
```

**Notes:**
- Most critical location - actually modifies system state
- If regex bypassed, attacker could execute arbitrary commands during install

---

### Location 10: Line 287
**Function:** `installOpenCode()` - version verification
**Current Code:**
```typescript
await execAsync("opencode --version");
```

**Issue:** Hardcoded command but still spawns shell
**Replacement:**
```typescript
await execFileAsync("opencode", ["--version"]);
```

**Special Considerations:**
- Command is hardcoded, no interpolation
- Checking if `opencode` binary exists in PATH
- Lower risk but should still use `execFileAsync()` for consistency
- No timeout specified (should add one)

**Recommended with timeout:**
```typescript
await execFileAsync("opencode", ["--version"], { timeout: 5000 });
```

---

### Location 11: Line 338
**Function:** `processPackageInstallations()` - opencode version check
**Current Code:**
```typescript
await execAsync("opencode --version");
```

**Issue:** Same as Location 10
**Replacement:**
```typescript
await execFileAsync("opencode", ["--version"], { timeout: 5000 });
```

**Notes:** Duplicate of Location 10 logic

---

## Summary Statistics

- **Total vulnerable locations:** 11
- **Locations with interpolated variables:** 8 (lines 71, 76, 87, 131, 139, 156, 198)
- **Locations with hardcoded strings:** 3 (lines 60, 122, 287, 338)
- **Critical severity (install operations):** 1 (line 198)
- **High severity (package name interpolation):** 7
- **Medium severity (hardcoded but unnecessary shell):** 3

---

## Edge Cases & Special Considerations

### 1. `getNpmCommand()` Function
- Returns `"npm.cmd"` on Windows, `"npm"` on Unix
- Both are valid binaries for `execFileAsync()`
- No changes needed to this function

### 2. OpenCode Version Checks (Lines 287, 338)
- Hardcoded string: `"opencode --version"`
- No interpolation = lower risk
- Should still use `execFileAsync()` for consistency
- **Missing timeout** - should add 5000ms timeout

### 3. Package Name Validation
- Current: `NPM_PACKAGE_REGEX = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/`
- Validates before all uses
- Defense: prevents obvious injection attempts
- **Problem:** Relies on single validation layer; regex could be modified/bypassed

### 4. CI Environment Detection
- Code skips network calls in CI
- Some vulnerable calls never execute in CI
- Still needs fixing - defense-in-depth applies everywhere

### 5. Windows Platform Considerations
- `getNpmCommand()` returns `"npm.cmd"` on Windows
- `execFileAsync()` handles `.cmd` files correctly on Windows
- No special handling needed

### 6. Timeout Values
- Most calls: 3000ms
- Install operations: 120000ms
- OpenCode checks: **missing timeout** (should be 5000ms)

---

## Implementation Recommendations

### Priority Order:
1. **Critical (P0):** Line 198 - `installPackageGlobally()`
2. **High (P1):** Lines 71, 76, 87, 131, 139, 156 - package name interpolation
3. **Medium (P2):** Lines 60, 122, 287, 338 - hardcoded commands

### Testing Requirements:
- Test on Windows (npm.cmd) and Unix (npm)
- Test with scoped packages (@org/package)
- Test with packages containing dots/hyphens
- Test timeout behavior
- Test error handling (command not found)

### Breaking Changes:
**None expected** - `execFileAsync()` output format identical to `execAsync()`

---

## Unresolved Questions

1. Should we add timeout to opencode checks (lines 287, 338)?
   - **Recommendation:** Yes, add 5000ms timeout for consistency

2. Should validation remain in place after switching to `execFileAsync()`?
   - **Recommendation:** Yes, keep `validatePackageName()` as additional safety layer

3. Are there other files in the codebase with similar patterns?
   - **Recommendation:** Run codebase scan: `grep -r "execAsync" src/`

4. Should we create a wrapper function for npm commands?
   - **Recommendation:** Consider `execNpmCommand(args: string[])` helper for DRY

---

## Additional Notes

- All `execFileAsync()` calls maintain same signature: `(command, args[], options)`
- Error handling unchanged - same try/catch patterns work
- stdout/stderr parsing unchanged
- Performance impact: negligible (no shell spawn overhead actually improves perf)
