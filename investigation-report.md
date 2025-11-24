# Code Review Investigation Report
Date: 2025-11-23
Branch: dev

## EXECUTIVE SUMMARY

6 issues investigated. Results:
- 1 CRITICAL BUG confirmed (protected files)
- 1 VALID test coverage gap
- 3 MEDIUM issues (error handling, duplication, doctor)  
- 1 SECURITY issue already fixed (PowerShell timeout)

IMMEDIATE ACTION: Issue #1 breaks first-time installation

---

## ISSUE #1: Protected Files Merge Logic ⚠️ CRITICAL

Claim: ACCURATE
Severity: CRITICAL - Breaks first-time installation

Root Cause:
Commit eaf48e2 → 59913e3 changed merge.ts:97-104 from conditional to always-skip

BEFORE (eaf48e2):
- If protected file exists: skip
- If protected file missing: copy (enables first install)

AFTER (59913e3):
- Always skip protected files (BREAKS FIRST INSTALL)

Evidence:
git diff eaf48e2 59913e3 -- src/lib/merge.ts shows:

```
-if (this.ig.ignores(normalizedRelativePath)) {
-    if (await pathExists(destPath)) {
-        logger.debug(`Skipping protected file (exists): ${normalizedRelativePath}`);
-        skippedCount++;
-        continue;
-    }
-    // If doesn't exist, allow copying
-    logger.debug(`Copying protected file (new): ${normalizedRelativePath}`);
-}
+if (this.ig.ignores(normalizedRelativePath)) {
+    logger.debug(`Skipping protected file: ${normalizedRelativePath}`);
+    skippedCount++;
+    continue;  // ← ALWAYS SKIP
+}
```

Impact:
- ck new won't copy .gitignore, .repomixignore, CLAUDE.md
- Users missing critical template files on first install
- Regression from working code

Recommendation:
Revert to conditional logic with pathExists check

---

## ISSUE #2: Test Coverage Gaps - Beta Flag

Claim: ACCURATE
Severity: HIGH - Implementation untested

Analysis:
tests/lib/github.test.ts:50-185 tests mock data structures, NOT actual getLatestRelease()

Evidence:
```typescript
test("should call listReleases when includePrereleases is true", async () => {
    const mockListReleases = mock(async () => [...]);
    // ❌ getLatestRelease never called
    const releases = await mockListReleases(); // Tests mock directly
    expect(prereleaseVersion?.tag_name).toBe("v1.1.0-beta.1");
});
```

What's tested: Mock data filtering
What's NOT tested: 
- getLatestRelease(kit, true) actual call
- listReleases integration
- Fallback when no prereleases
- Error handling

Impact: Beta flag could break in production undetected

Recommendation: Add integration tests calling actual methods with mocked Octokit

---

## ISSUE #3: Script Execution Security

Claims:
1. validateScriptPath missing injection vectors
2. Preview only 20 lines  
3. Missing PowerShell timeout

Analysis:

Claim 3.1 (injection): PARTIALLY ADDRESSED
- ✅ Path traversal prevented (resolve + startsWith)
- ✅ Shell metacharacters blocked
- ✅ execFile (no shell spawning)
- ⚠️ Missing Unicode normalization
Status: Acceptable (execFile provides defense layer)

Claim 3.2 (preview): ACCURATE - BY DESIGN
- Shows 20 lines intentionally (UX)
- Warns when truncated
- User can inspect full file
Status: Low risk

Claim 3.3 (timeout): INACCURATE - ALREADY FIXED
package-installer.ts:532 has timeout: 600000
Status: Not an issue

Overall: LOW RISK - security posture adequate

---

## ISSUE #4: Skills Error Handling

Claim: ACCURATE  
Severity: MEDIUM - Poor UX

Problem:
commands/new.ts:235-249 and update.ts:323-337 log warnings but don't explain impact

Current output:
```
⚠️  Skills installation failed: Installation script not found
ℹ️  You can install skills dependencies manually later
```

Missing:
- What features won't work?
- Clear remediation steps
- Impact assessment

Recommendation:
```typescript
if (!skillsResult.success) {
    logger.warning(`⚠️  Skills incomplete: ${skillsResult.error}`);
    logger.warning("📉 Impact: AI skills unavailable");
    logger.info("Manual install: cd ${skillsDir} && bash install.sh");
}
```

---

## ISSUE #5: Code Duplication

Claim: ACCURATE
Severity: MEDIUM - Maintenance burden

Evidence:
new.ts:229-249 and update.ts:323-337 have ~90% identical code
Only difference: skillsDir path calculation

Impact:
- Changes need 2 locations
- Bug fix risk (fix one, forget other)

Recommendation:
Extract to utils/skills-installer.ts::installSkillsWithErrorHandling()

---

## ISSUE #6: Doctor Command

Claim: ACCURATE
Severity: MEDIUM - Incomplete checks

Analysis:
doctor.ts:20-46 checkSkillsInstallation() only checks:
```typescript
const globalAvailable = existsSync(globalScriptPath);  // Script exists?
```

Doesn't check:
- Dependencies actually installed (pip packages, npm packages)
- Python/Node available
- Script executable
- Installation success state

Output misleading:
```
✅ Global Skills
   Status: Installation script available
```

Implies skills working, but only script file exists

Recommendation:
Add dependency verification:
- Check requirements.txt packages installed
- Verify Python/pip availability
- Test import of key packages
- Check installation manifest/state file

---

## SUMMARY TABLE

| Issue | Severity | Claim Accurate | Fixed | Action |
|-------|----------|---------------|-------|--------|
| #1 Merge Logic | CRITICAL | YES | NO | **URGENT FIX** |
| #2 Test Coverage | HIGH | YES | NO | Add integration tests |
| #3 Security | LOW | PARTIAL | YES | Optional: Unicode validation |
| #4 Error UX | MEDIUM | YES | NO | Improve messaging |
| #5 Duplication | MEDIUM | YES | NO | Refactor |
| #6 Doctor Check | MEDIUM | YES | NO | Add dep verification |

---

## UNRESOLVED QUESTIONS

1. Are there .example files in kit repos that should be copied?
2. What's expected behavior for protected files on updates vs new installs?
3. Should skills installation be blocking or continue-on-fail?
4. Is there test coverage regression tracking?

---

End of Report
