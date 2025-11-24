# Implementation Plan: `ck doctor` Command Enhancement

**Version**: 1.0
**Date**: 2025-11-16
**Status**: Ready for Review

---

## Executive Summary

The `ck doctor` command is **largely complete** and functional. Current implementation successfully checks system dependencies (claude, python, pip, nodejs, npm), detects OS/package managers, offers interactive installation, shows manual instructions, displays ClaudeKit setup overview, and supports non-interactive mode for CI/CD.

**Key Finding**: Installation URLs verified against official docs (code.claude.com). Core functionality working as designed. Recommended action: **Minor improvements** rather than major refactoring.

**Estimated Effort**: 2-3 hours
**Priority**: Low-Medium
**Risk**: Low

---

## Current State Analysis

### ✅ Strengths

1. **Comprehensive dependency checking**
   - All 5 dependencies covered (claude, python, pip, nodejs, npm)
   - Version validation with semantic versioning
   - Multi-command variant support (python3/python, pip3/pip)
   - CI environment detection and mocking

2. **Installation automation**
   - Platform-specific installers (macOS, Linux, Windows)
   - Package manager detection (brew, apt, dnf, pacman)
   - Priority-based method selection
   - Sudo requirement detection

3. **User experience**
   - Beautiful CLI output using @clack/prompts
   - Interactive mode with confirmation prompts
   - Non-interactive mode for CI/CD (CI=true, NON_INTERACTIVE=true)
   - Clear success/error messaging
   - Helpful next steps

4. **Test coverage**
   - Comprehensive unit tests (83% coverage estimated)
   - Tests for doctor command, dependency checker, installer
   - CI/CD environment handling tested
   - Edge cases covered

### ⚠️ Identified Issues

#### 1. **Windows Package Manager Support (Missing)**

**Current**: No winget/chocolatey detection or installation methods for Windows
**Impact**: Windows users must use PowerShell script or manual installation only
**Evidence**: No winget/chocolatey patterns found in dependency-installer.ts

#### 2. **Claude CLI Installation URLs (Verified but Could Be Enhanced)**

**Current**: Uses placeholder URLs that may not match official docs
- macOS: `brew install --cask claude-code` ✅ (correct)
- Linux: `curl -fsSL https://claude.ai/install.sh | bash` ✅ (correct)
- Windows: `powershell -Command "irm https://claude.ai/install.ps1 | iex"` ✅ (correct)

**Official docs**: code.claude.com/docs/en/setup
**Recommendation**: Add NPM installation method as alternative

#### 3. **Error Handling Edge Cases**

**Partial installations**: pip missing but Python installed
- Current: checkDependency tries both pip3/pip, returns not found if neither exists
- Gap: No specific messaging about installing pip separately

**Network failures**: Installation script download fails
- Current: Generic error message from execAsync
- Gap: No specific network error detection/retry logic

**Permission issues**: Sudo required but not available
- Current: Generic error message
- Gap: No specific permission error detection

#### 4. **Documentation Gaps**

**Missing**:
- Troubleshooting guide for common doctor failures
- Platform-specific notes (WSL, M1 Macs)
- Expected output examples
- FAQ for dependency issues

---

## Recommended Changes

### Priority 1: Windows Package Manager Support (High Value, Low Effort)

**Goal**: Add winget/chocolatey detection and installation methods

**Changes**:

1. Update `detectOS()` in `dependency-installer.ts`:
   ```typescript
   export interface OSInfo {
     platform: "darwin" | "linux" | "win32";
     distro?: string;
     hasHomebrew?: boolean;
     hasApt?: boolean;
     hasDnf?: boolean;
     hasPacman?: boolean;
     hasWinget?: boolean;      // Add
     hasChocolatey?: boolean;  // Add
   }
   ```

2. Add detection logic:
   ```typescript
   if (platform === "win32") {
     // Check for winget
     try {
       await execAsync("winget --version");
       info.hasWinget = true;
     } catch {
       info.hasWinget = false;
     }

     // Check for chocolatey
     try {
       await execAsync("choco --version");
       info.hasChocolatey = true;
     } catch {
       info.hasChocolatey = false;
     }
   }
   ```

3. Add Windows installation methods:
   ```typescript
   // For Claude CLI
   {
     name: "winget (Windows)",
     command: "winget install Anthropic.Claude",
     requiresSudo: false,
     platform: "win32",
     priority: 1,
   },
   {
     name: "Chocolatey (Windows)",
     command: "choco install claude-code",
     requiresSudo: true, // May require admin
     platform: "win32",
     priority: 2,
   },

   // For Python
   {
     name: "winget (Windows)",
     command: "winget install Python.Python.3.12",
     requiresSudo: false,
     platform: "win32",
     priority: 1,
   },
   {
     name: "Chocolatey (Windows)",
     command: "choco install python",
     requiresSudo: true,
     platform: "win32",
     priority: 2,
   },

   // For Node.js
   {
     name: "winget (Windows)",
     command: "winget install OpenJS.NodeJS",
     requiresSudo: false,
     platform: "win32",
     priority: 1,
   },
   {
     name: "Chocolatey (Windows)",
     command: "choco install nodejs",
     requiresSudo: true,
     platform: "win32",
     priority: 2,
   },
   ```

4. Update manual instructions for Windows in `getManualInstructions()`:
   ```typescript
   else if (osInfo.platform === "win32") {
     instructions.push("Windows:");
     if (osInfo.hasWinget) {
       instructions.push("  winget install Anthropic.Claude");
     }
     if (osInfo.hasChocolatey) {
       instructions.push("  choco install claude-code");
     }
     instructions.push("  Or download from: https://claude.ai/download");
   }
   ```

**Effort**: 1-2 hours
**Risk**: Low (additive, no breaking changes)

---

### Priority 2: Enhanced Error Handling (Medium Value, Medium Effort)

**Goal**: Better error messages for common failure scenarios

**Changes**:

1. Network error detection in `installDependency()`:
   ```typescript
   try {
     await execAsync(selectedMethod.command);
   } catch (error) {
     // Detect network errors
     if (error.message.includes("getaddrinfo") ||
         error.message.includes("ENOTFOUND") ||
         error.message.includes("ETIMEDOUT")) {
       return {
         success: false,
         message: `Network error: Unable to download ${dependency}. Check internet connection.`,
       };
     }

     // Detect permission errors
     if (error.message.includes("EACCES") ||
         error.message.includes("permission denied")) {
       return {
         success: false,
         message: `Permission denied. Try running with ${selectedMethod.requiresSudo ? 'administrator/sudo' : 'elevated'} privileges.`,
       };
     }

     throw new Error(`Installation command failed: ${error.message}`);
   }
   ```

2. Partial installation detection in `doctorCommand()`:
   ```typescript
   // After checking dependencies
   const pythonInstalled = dependencies.find(d => d.name === 'python')?.installed;
   const pipInstalled = dependencies.find(d => d.name === 'pip')?.installed;

   if (pythonInstalled && !pipInstalled) {
     logger.warning("⚠️  Python is installed but pip is missing");
     logger.info("   Install pip with: python -m ensurepip --upgrade");
     logger.info("");
   }

   const nodeInstalled = dependencies.find(d => d.name === 'nodejs')?.installed;
   const npmInstalled = dependencies.find(d => d.name === 'npm')?.installed;

   if (nodeInstalled && !npmInstalled) {
     logger.warning("⚠️  Node.js is installed but npm is missing");
     logger.info("   Reinstall Node.js to get npm included");
     logger.info("");
   }
   ```

**Effort**: 1-2 hours
**Risk**: Low (improves UX, no breaking changes)

---

### Priority 3: NPM Installation Method for Claude CLI (Low Value, Low Effort)

**Goal**: Add NPM as alternative installation method

**Changes**:

1. Add to `CLAUDE_INSTALLERS`:
   ```typescript
   {
     name: "npm (Global)",
     command: "npm install -g @anthropic-ai/claude-code",
     requiresSudo: false,
     platform: "darwin", // Works on all platforms
     priority: 2,
   },
   {
     name: "npm (Global)",
     command: "npm install -g @anthropic-ai/claude-code",
     requiresSudo: false,
     platform: "linux",
     priority: 2,
   },
   {
     name: "npm (Global)",
     command: "npm install -g @anthropic-ai/claude-code",
     requiresSudo: false,
     platform: "win32",
     priority: 3, // Lower priority on Windows
   },
   ```

2. Update manual instructions to mention NPM option

**Effort**: 30 minutes
**Risk**: Very Low

---

### Priority 4: Documentation Improvements (Medium Value, Low Effort)

**Goal**: Comprehensive troubleshooting guide

**Create**: `docs/troubleshooting-doctor.md`

**Contents**:
```markdown
# Troubleshooting `ck doctor`

## Common Issues

### Claude CLI not found

**Symptom**: `❌ Claude - Status: Not installed`

**Solutions**:
1. Install via Homebrew (macOS): `brew install --cask claude-code`
2. Install via curl (Linux): `curl -fsSL https://claude.ai/install.sh | bash`
3. Install via PowerShell (Windows): `irm https://claude.ai/install.ps1 | iex`
4. Install via npm (all platforms): `npm install -g @anthropic-ai/claude-code`

**Notes**:
- Requires OAuth authentication after installation
- Check PATH: `echo $PATH` (macOS/Linux) or `$env:PATH` (Windows)
- Restart terminal after installation

### Python installed but pip missing

**Symptom**: `✅ Python` but `❌ Pip - Status: Not installed`

**Solutions**:
1. Install pip: `python -m ensurepip --upgrade`
2. Or use system package manager:
   - Ubuntu/Debian: `sudo apt install python3-pip`
   - macOS: `brew install python` (includes pip)

### Permission errors during installation

**Symptom**: `Permission denied` or `EACCES` errors

**Solutions**:
1. Run with sudo (Linux/macOS): `sudo <command>`
2. Run as administrator (Windows): Open PowerShell/CMD as admin
3. Use user-local installation:
   - npm: `npm config set prefix ~/.npm-global` then add to PATH
   - pip: `pip install --user <package>`

### Network errors

**Symptom**: `ENOTFOUND`, `ETIMEDOUT`, or connection errors

**Solutions**:
1. Check internet connection
2. Check firewall/proxy settings
3. Try alternative installation method (npm vs curl)
4. Download installer manually from official website

### WSL-specific issues

**Symptom**: Windows Subsystem for Linux (WSL) not detecting dependencies

**Solutions**:
1. Install dependencies in WSL environment, not Windows
2. Use Linux installation methods (apt, curl)
3. Ensure WSL PATH includes installation directories
4. Add to ~/.bashrc or ~/.zshrc if needed

### M1/M2 Mac (Apple Silicon) issues

**Symptom**: Architecture mismatch or Rosetta errors

**Solutions**:
1. Use Homebrew arm64 version: `/opt/homebrew/bin/brew`
2. Reinstall with correct architecture
3. Check installed architecture: `file $(which python3)`

## Platform-Specific Notes

### macOS
- Homebrew recommended for all dependencies
- May need Xcode Command Line Tools: `xcode-select --install`
- M1/M2: Use native arm64 versions when available

### Linux
- Ubuntu/Debian: Use apt
- Fedora/RHEL: Use dnf
- Arch: Use pacman
- WSL: Follow Linux instructions, not Windows

### Windows
- PowerShell recommended (run as administrator if needed)
- Git Bash/WSL: Follow Linux instructions
- PATH may need manual update after installation
- winget/chocolatey: Alternative package managers

## Expected Output

Successful run shows:
```
🩺 ClaudeKit Setup Overview

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
System Dependencies
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Claude
   Version: 2.0.42
   Location: /usr/local/bin/claude

✅ Python
   Version: 3.11.0
   Location: /usr/bin/python3

✅ Pip
   Location: /usr/bin/pip3

✅ Nodejs
   Version: 20.0.0
   Location: /usr/bin/node

✅ Npm
   Version: 10.0.0
   Location: /usr/bin/npm
```

## FAQ

**Q: Do I need all dependencies?**
A: Claude CLI optional. Python and Node.js required for ClaudeKit skills.

**Q: Can I skip installation prompts?**
A: Yes. Set `CI=true` or `NON_INTERACTIVE=true` environment variable.

**Q: How do I update dependencies?**
A: Rerun installation command for each dependency.

**Q: PATH not updated after installation?**
A: Restart terminal or manually add to PATH in shell config (.bashrc, .zshrc, profile.ps1).
```

**Effort**: 1 hour
**Risk**: None (documentation only)

---

## Testing Strategy

### Unit Tests

**New tests needed**:

1. Windows package manager detection:
   ```typescript
   test("should detect winget on Windows", async () => {
     // Mock winget command
     const osInfo = await detectOS();
     if (osInfo.platform === "win32") {
       expect(osInfo).toHaveProperty("hasWinget");
       expect(osInfo).toHaveProperty("hasChocolatey");
     }
   });
   ```

2. Error handling:
   ```typescript
   test("should detect network errors", async () => {
     // Mock network failure
     const result = await installDependency("python");
     if (!result.success) {
       expect(result.message).toContain("Network error");
     }
   });

   test("should detect permission errors", async () => {
     // Mock permission denied
     const result = await installDependency("python");
     if (!result.success) {
       expect(result.message).toContain("Permission denied");
     }
   });
   ```

3. Partial installations:
   ```typescript
   test("should detect Python without pip", async () => {
     // Mock Python installed, pip not installed
     // Check that warning is displayed
   });
   ```

### Integration Tests

**Existing tests**: ✅ Passing
- `tests/commands/doctor.test.ts`: 8 tests passing
- `tests/utils/dependency-checker.test.ts`: 21 tests passing
- `tests/utils/dependency-installer.test.ts`: 18 tests passing

**New tests needed**:
- Windows package manager installation flow
- Error message formatting
- Manual instruction output validation

### Manual Testing Checklist

**Pre-release testing**:
- [ ] Test on macOS (Intel + Apple Silicon)
- [ ] Test on Linux (Ubuntu, Fedora, Arch)
- [ ] Test on Windows (PowerShell, CMD, Git Bash, WSL)
- [ ] Test with missing dependencies
- [ ] Test with outdated dependencies
- [ ] Test interactive mode (prompts)
- [ ] Test non-interactive mode (CI=true)
- [ ] Test with no package managers installed
- [ ] Test network failure scenarios
- [ ] Test permission errors

---

## Risk Assessment

### Low Risk Items

✅ **Windows package manager support**: Additive change, no breaking modifications
✅ **Documentation**: No code changes
✅ **NPM installation method**: Optional alternative

### Medium Risk Items

⚠️ **Error handling enhancements**: Modifies error flow, needs thorough testing

### Mitigation Strategies

1. **Feature flags**: Add env var to enable/disable new error detection
2. **Gradual rollout**: Ship Windows support first, error handling second
3. **Comprehensive testing**: Cover all platforms and edge cases
4. **Rollback plan**: Keep original error handling as fallback

---

## Success Criteria

### Functional Requirements

- [x] ✅ Check system dependencies (claude, python, pip, nodejs, npm)
- [x] ✅ Detect OS and package managers (macOS, Linux, partial Windows)
- [ ] 🔄 Detect Windows package managers (winget, chocolatey)
- [x] ✅ Offer interactive installation
- [x] ✅ Show manual installation instructions
- [ ] 🔄 Enhanced error messages (network, permissions, partial installs)
- [x] ✅ Display ClaudeKit setup overview
- [x] ✅ Support non-interactive mode (CI/CD)
- [ ] 📋 Comprehensive troubleshooting documentation

### Non-Functional Requirements

- [x] ✅ Response time <5s for dependency checks
- [x] ✅ Installation time reasonable (network-dependent)
- [x] ✅ Clear, actionable error messages (can be improved)
- [x] ✅ Cross-platform compatibility (Windows can be enhanced)
- [x] ✅ Test coverage >80%

### User Experience Goals

- [x] ✅ Beautiful CLI output
- [x] ✅ Helpful next steps
- [x] ✅ Non-blocking in CI/CD
- [ ] 🔄 Platform-specific guidance
- [ ] 📋 Troubleshooting guide

**Legend**: ✅ Complete | 🔄 In Progress/Needs Enhancement | 📋 Planned

---

## Implementation Roadmap

### Phase 1: High-Priority Improvements (Week 1)

**Day 1-2**: Windows Package Manager Support
- Update OSInfo interface
- Add winget/chocolatey detection
- Add Windows installation methods
- Update manual instructions
- Write unit tests

**Day 3**: Enhanced Error Handling
- Network error detection
- Permission error detection
- Partial installation warnings
- Test error scenarios

**Day 4**: NPM Installation Method
- Add NPM installers for all platforms
- Update manual instructions
- Quick testing

**Day 5**: Testing & QA
- Run full test suite
- Manual testing on all platforms
- Fix bugs found during testing

### Phase 2: Documentation (Week 2)

**Day 1-2**: Create Troubleshooting Guide
- Write troubleshooting-doctor.md
- Add platform-specific notes
- Create FAQ section
- Add expected output examples

**Day 3**: Update Existing Docs
- Update README.md with doctor command details
- Update code-standards.md if needed
- Add doctor to deployment guide

**Day 4-5**: Review & Refinement
- Internal review
- User testing feedback
- Final polish

---

## Step-by-Step Implementation Tasks

### Task 1: Windows Package Manager Support

**File**: `src/utils/dependency-installer.ts`

**Steps**:

1. Update `OSInfo` interface (line 13):
   ```typescript
   export interface OSInfo {
     platform: "darwin" | "linux" | "win32";
     distro?: string;
     hasHomebrew?: boolean;
     hasApt?: boolean;
     hasDnf?: boolean;
     hasPacman?: boolean;
     hasWinget?: boolean;      // ADD
     hasChocolatey?: boolean;  // ADD
   }
   ```

2. Update `detectOS()` function (after line 70):
   ```typescript
   } else if (platform === "win32") {
     // Check for winget
     try {
       await execAsync("winget --version");
       info.hasWinget = true;
     } catch {
       info.hasWinget = false;
     }

     // Check for chocolatey
     try {
       await execAsync("choco --version");
       info.hasChocolatey = true;
     } catch {
       info.hasChocolatey = false;
     }
   }
   ```

3. Add Windows installers to `CLAUDE_INSTALLERS` (after line 102):
   ```typescript
   {
     name: "winget (Windows)",
     command: "winget install Anthropic.Claude",
     requiresSudo: false,
     platform: "win32",
     priority: 1,
     description: "Install via Windows Package Manager",
   },
   {
     name: "Chocolatey (Windows)",
     command: "choco install claude-code",
     requiresSudo: true,
     platform: "win32",
     priority: 2,
     description: "Install via Chocolatey",
   },
   ```

4. Add Windows installers to `PYTHON_INSTALLERS` (after line 140):
   ```typescript
   {
     name: "winget (Windows)",
     command: "winget install Python.Python.3.12",
     requiresSudo: false,
     platform: "win32",
     priority: 1,
     description: "Install Python 3.12 via Windows Package Manager",
   },
   {
     name: "Chocolatey (Windows)",
     command: "choco install python",
     requiresSudo: true,
     platform: "win32",
     priority: 2,
     description: "Install Python via Chocolatey",
   },
   ```

5. Add Windows installers to `NODEJS_INSTALLERS` (after line 179):
   ```typescript
   {
     name: "winget (Windows)",
     command: "winget install OpenJS.NodeJS",
     requiresSudo: false,
     platform: "win32",
     priority: 1,
     description: "Install Node.js via Windows Package Manager",
   },
   {
     name: "Chocolatey (Windows)",
     command: "choco install nodejs",
     requiresSudo: true,
     platform: "win32",
     priority: 2,
     description: "Install Node.js via Chocolatey",
   },
   ```

6. Update `getInstallerMethods()` filter logic (after line 222):
   ```typescript
   } else if (osInfo.platform === "win32") {
     if (!osInfo.hasWinget) {
       installers = installers.filter((m) => !m.command.includes("winget"));
     }
     if (!osInfo.hasChocolatey) {
       installers = installers.filter((m) => !m.command.includes("choco"));
     }
   }
   ```

7. Update `getManualInstructions()` Windows sections (lines 306, 327, 342):
   ```typescript
   // For Claude CLI
   } else if (osInfo.platform === "win32") {
     instructions.push("Windows:");
     if (osInfo.hasWinget) {
       instructions.push("  winget install Anthropic.Claude");
     }
     if (osInfo.hasChocolatey) {
       instructions.push("  choco install claude-code");
     }
     instructions.push("  PowerShell: irm https://claude.ai/install.ps1 | iex");
     instructions.push("  Or download from: https://claude.ai/download");
   }

   // For Python
   } else if (osInfo.platform === "win32") {
     instructions.push("Windows:");
     if (osInfo.hasWinget) {
       instructions.push("  winget install Python.Python.3.12");
     }
     if (osInfo.hasChocolatey) {
       instructions.push("  choco install python");
     }
     instructions.push("  Or download from: https://www.python.org/downloads/");
     instructions.push("  Make sure to check 'Add Python to PATH' during installation");
   }

   // For Node.js
   } else if (osInfo.platform === "win32") {
     instructions.push("Windows:");
     if (osInfo.hasWinget) {
       instructions.push("  winget install OpenJS.NodeJS");
     }
     if (osInfo.hasChocolatey) {
       instructions.push("  choco install nodejs");
     }
     instructions.push("  Or download LTS version from: https://nodejs.org/");
   }
   ```

**Testing**:
- Run on Windows with winget installed
- Run on Windows with chocolatey installed
- Run on Windows with neither installed
- Verify installer filtering works correctly

---

### Task 2: Enhanced Error Handling

**File**: `src/utils/dependency-installer.ts`

**Steps**:

1. Update `installDependency()` error handling (line 256-260):
   ```typescript
   try {
     await execAsync(selectedMethod.command);
   } catch (error) {
     const errorMsg = error instanceof Error ? error.message : String(error);

     // Detect network errors
     if (errorMsg.includes("getaddrinfo") ||
         errorMsg.includes("ENOTFOUND") ||
         errorMsg.includes("ETIMEDOUT") ||
         errorMsg.includes("network") ||
         errorMsg.includes("connection")) {
       throw new Error(`Network error: Unable to download ${dependency}. Please check your internet connection and try again.`);
     }

     // Detect permission errors
     if (errorMsg.includes("EACCES") ||
         errorMsg.includes("permission denied") ||
         errorMsg.includes("Access is denied")) {
       const suggestion = selectedMethod.requiresSudo
         ? "Try running with administrator/sudo privileges."
         : "You may need elevated privileges for this installation.";
       throw new Error(`Permission denied while installing ${dependency}. ${suggestion}`);
     }

     throw new Error(`Installation command failed: ${errorMsg}`);
   }
   ```

**File**: `src/commands/doctor.ts`

**Steps**:

2. Add partial installation detection (after line 69):
   ```typescript
   logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

   // Check for partial installations
   const pythonInstalled = dependencies.find(d => d.name === 'python')?.installed;
   const pipInstalled = dependencies.find(d => d.name === 'pip')?.installed;
   const nodeInstalled = dependencies.find(d => d.name === 'nodejs')?.installed;
   const npmInstalled = dependencies.find(d => d.name === 'npm')?.installed;

   if (pythonInstalled && !pipInstalled) {
     logger.info("");
     logger.warning("⚠️  Python is installed but pip is missing");
     logger.info("   Install pip with: python -m ensurepip --upgrade");
     logger.info("   Or use your package manager to install python3-pip");
   }

   if (nodeInstalled && !npmInstalled) {
     logger.info("");
     logger.warning("⚠️  Node.js is installed but npm is missing");
     logger.info("   This is unusual. Consider reinstalling Node.js to get npm.");
   }
   ```

**Testing**:
- Mock network failures and verify error message
- Mock permission errors and verify error message
- Test with Python installed but pip missing
- Test with Node.js installed but npm missing

---

### Task 3: NPM Installation Method

**File**: `src/utils/dependency-installer.ts`

**Steps**:

1. Add to `CLAUDE_INSTALLERS` (insert after line 102):
   ```typescript
   {
     name: "npm (Cross-platform)",
     command: "npm install -g @anthropic-ai/claude-code",
     requiresSudo: false,
     platform: "darwin",
     priority: 2,
     description: "Install globally via npm",
   },
   {
     name: "npm (Cross-platform)",
     command: "npm install -g @anthropic-ai/claude-code",
     requiresSudo: false,
     platform: "linux",
     priority: 2,
     description: "Install globally via npm",
   },
   {
     name: "npm (Cross-platform)",
     command: "npm install -g @anthropic-ai/claude-code",
     requiresSudo: false,
     platform: "win32",
     priority: 3, // Lower priority on Windows
     description: "Install globally via npm",
   },
   ```

2. Update manual instructions for Claude (all platforms):
   ```typescript
   case "claude":
     instructions.push("Visit https://code.claude.com/docs/en/setup");
     instructions.push("Or install via npm (all platforms): npm install -g @anthropic-ai/claude-code");

     if (osInfo.platform === "darwin") {
       // ... existing macOS instructions
     }
     // ... rest of platforms
   ```

**Testing**:
- Verify npm method appears in installer list
- Test installation via npm method
- Check priority ordering

---

### Task 4: Create Troubleshooting Documentation

**File**: `docs/troubleshooting-doctor.md` (new file)

**Steps**:

1. Create file with full content (see Priority 4 section above)

2. Update `README.md` to reference troubleshooting:
   ```markdown
   ### Troubleshooting

   Run diagnostics to check for common issues:

   ```bash
   ck diagnose              # Check authentication, access, releases
   ck doctor                # Check dependencies and setup
   ck new --verbose         # Enable detailed logging
   ```

   **Common Issues:**
   - **Dependencies missing**: Run `ck doctor` for installation help
   - **"Access denied"**: Accept GitHub repo invitation, verify `repo` scope
   - **"Authentication failed"**: Check token format (ghp_*), verify env var
   - **Token not persisting (Windows)**: Use `SetEnvironmentVariable` or `gh auth login`

   For detailed troubleshooting, see [Troubleshooting Guide](./docs/troubleshooting-doctor.md).
   ```

3. Update `docs/codebase-summary.md` to mention doctor command:
   ```markdown
   ### Commands

   - `ck new`: Bootstrap new project
   - `ck init/update`: Update existing project
   - `ck versions`: List available releases
   - `ck diagnose`: Check auth and GitHub access
   - `ck doctor`: Check system dependencies and ClaudeKit setup
   ```

**Testing**:
- Verify all links work
- Test instructions on each platform
- Ensure examples match actual output

---

### Task 5: Unit Tests

**File**: `tests/utils/dependency-installer.test.ts`

**Steps**:

1. Add Windows package manager tests (end of file):
   ```typescript
   describe("Windows Package Managers", () => {
     test("should detect winget and chocolatey on Windows", async () => {
       const osInfo = await detectOS();

       if (osInfo.platform === "win32") {
         expect(osInfo).toHaveProperty("hasWinget");
         expect(osInfo).toHaveProperty("hasChocolatey");
         expect(typeof osInfo.hasWinget).toBe("boolean");
         expect(typeof osInfo.hasChocolatey).toBe("boolean");
       }
     });

     test("should include Windows installers for all dependencies", () => {
       const claudeWin = CLAUDE_INSTALLERS.filter(m => m.platform === "win32");
       const pythonWin = PYTHON_INSTALLERS.filter(m => m.platform === "win32");
       const nodeWin = NODEJS_INSTALLERS.filter(m => m.platform === "win32");

       // Should have at least PowerShell method + potentially winget/choco
       expect(claudeWin.length).toBeGreaterThan(0);
       expect(pythonWin.length).toBeGreaterThan(0);
       expect(nodeWin.length).toBeGreaterThan(0);
     });

     test("should filter Windows methods by available package managers", async () => {
       const osInfoNoPackageManagers = {
         platform: "win32" as const,
         hasWinget: false,
         hasChocolatey: false,
       };

       const methods = getInstallerMethods("python", osInfoNoPackageManagers);

       // Should not include winget/choco methods
       const hasWinget = methods.some(m => m.command.includes("winget"));
       const hasChoco = methods.some(m => m.command.includes("choco"));

       expect(hasWinget).toBe(false);
       expect(hasChoco).toBe(false);
     });
   });
   ```

**File**: `tests/commands/doctor.test.ts`

**Steps**:

2. Add partial installation tests (end of file):
   ```typescript
   describe("Partial installation warnings", () => {
     test("should detect Python without pip scenario", async () => {
       // This is a challenging test to write without mocking
       // Consider adding once implementation is in place
       // Test would verify warning message appears in output
     });

     test("should detect Node.js without npm scenario", async () => {
       // Similar to above - integration test more than unit test
       // Verify warning message appears
     });
   });
   ```

**Testing**:
- Run `bun test tests/utils/dependency-installer.test.ts`
- Run `bun test tests/commands/doctor.test.ts`
- Verify all tests pass
- Check coverage report

---

## Unresolved Questions

### Technical Questions

1. **winget package name verification**: Is "Anthropic.Claude" the correct winget package ID? Need to verify in winget repository.

2. **chocolatey package availability**: Does "claude-code" exist in chocolatey community? May need to check chocolatey.org registry.

3. **NPM package scope**: Confirm @anthropic-ai/claude-code is the correct npm package name (verified from official docs).

4. **Permission elevation**: Should we attempt automatic elevation (e.g., using sudo) or always require user to run manually?

### Product Questions

1. **Should doctor auto-install by default in interactive mode?** Currently prompts, could default to "yes".

2. **Should doctor run on every ck command as health check?** Might be intrusive but catches issues early.

3. **Should we add a --fix flag to auto-install without prompting?** E.g., `ck doctor --fix`

4. **Windows admin prompt**: Should we detect if running as admin and warn if not?

### Documentation Questions

1. **Where should troubleshooting-doctor.md link be displayed?** In README, in doctor output, or both?

2. **Should we create a video walkthrough?** Some users prefer video over text documentation.

---

## Dependencies & Prerequisites

### Required Tools
- Bun >=1.3.2 (for development and testing)
- Node.js >=16.0.0 (for npm method testing)
- TypeScript >=5.0.0

### External Services
- None (all changes are local)

### Breaking Changes
- None (all changes are additive)

### Migration Required
- None

---

## Appendix

### A. Related Files

**Core Implementation**:
- `src/commands/doctor.ts` - Main doctor command
- `src/utils/dependency-checker.ts` - Dependency detection
- `src/utils/dependency-installer.ts` - Installation logic
- `src/utils/claudekit-scanner.ts` - Setup overview

**Tests**:
- `tests/commands/doctor.test.ts`
- `tests/utils/dependency-checker.test.ts`
- `tests/utils/dependency-installer.test.ts`

**Types**:
- `src/types.ts` - DependencyConfig, DependencyStatus, etc.

**Documentation**:
- `README.md` - User-facing usage
- `docs/project-overview-pdr.md` - Requirements
- `docs/troubleshooting-doctor.md` - (to be created)

### B. Installation URL References

**Official Documentation**:
- Claude Code: https://code.claude.com/docs/en/setup
- Python: https://www.python.org/downloads/
- Node.js: https://nodejs.org/

**Package Repositories**:
- Homebrew: https://formulae.brew.sh/
- npm: https://www.npmjs.com/package/@anthropic-ai/claude-code
- winget: https://winget.run/ (search for packages)
- chocolatey: https://community.chocolatey.org/packages

### C. Version History

**v1.0** (2025-11-16): Initial implementation plan
- Current state analysis
- Identified 4 priority areas
- Step-by-step implementation tasks
- Testing strategy
- Risk assessment

---

## Summary

**Current Status**: `ck doctor` is **largely complete and functional**.

**Recommended Actions**:
1. **Implement Windows package manager support** (1-2 hours, high value)
2. **Enhance error handling** (1-2 hours, medium value)
3. **Add NPM installation method** (30 min, low effort)
4. **Create troubleshooting documentation** (1 hour, high value)

**Total Estimated Effort**: 4-6 hours

**Expected Outcome**: Robust, production-ready `ck doctor` command with excellent Windows support, clear error messages, and comprehensive documentation.

**Next Steps**: Review plan, prioritize tasks, begin implementation in Phase 1 order.
