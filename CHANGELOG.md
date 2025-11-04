# [1.8.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.7.0...v1.8.0) (2025-11-03)


### Bug Fixes

* address critical security vulnerabilities identified in Claude review ([fc48c26](https://github.com/mrgoonie/claudekit-cli/commit/fc48c267c1cb468236a89678f6f5bd7faf4730e3))
* address remaining Claude review recommendations for PR [#36](https://github.com/mrgoonie/claudekit-cli/issues/36) ([b359290](https://github.com/mrgoonie/claudekit-cli/commit/b35929082ebaa1f0a93e3aac95bd3f960a90fcaa))
* apply linting fixes to test file ([2d877ee](https://github.com/mrgoonie/claudekit-cli/commit/2d877ee4926290de955ae7183a85e90f7033da80))
* resolve CI formatting issue in package-installer.ts ([7921861](https://github.com/mrgoonie/claudekit-cli/commit/792186165f33c4cce0e3e1b28038ddecd56c14d2))
* resolve CI test timeout in package installer security tests ([0d7b688](https://github.com/mrgoonie/claudekit-cli/commit/0d7b688ce9125d96f2061fc9789e0332450377cc))
* resolve TypeScript compilation errors in package installation feature ([830bd22](https://github.com/mrgoonie/claudekit-cli/commit/830bd223500f3054d8b16e9a9b72db106bf8f4f4))
* resolve TypeScript compilation errors in PR [#34](https://github.com/mrgoonie/claudekit-cli/issues/34) ([c58b6a9](https://github.com/mrgoonie/claudekit-cli/commit/c58b6a9d68bb223202f84668e44fbc840a8644f0))
* simplify package installer tests to avoid complex mocking ([c4129b7](https://github.com/mrgoonie/claudekit-cli/commit/c4129b761b760738edb1bf466f915675d375aac7))
* skip network-dependent tests in CI to avoid timeouts ([a3bf6e6](https://github.com/mrgoonie/claudekit-cli/commit/a3bf6e6da8d52221af0637b79c7757cbea24c3e4))


### Features

* implement interactive prompts for OC & Gemini CLI installation ([#25](https://github.com/mrgoonie/claudekit-cli/issues/25)) ([77dc2c9](https://github.com/mrgoonie/claudekit-cli/commit/77dc2c966045251174c43320697184d8f1ff58b9))
* implement selective directory update feature ([#26](https://github.com/mrgoonie/claudekit-cli/issues/26)) ([236ab32](https://github.com/mrgoonie/claudekit-cli/commit/236ab32fcef72ae8e580f9b09d69622aea605c96))

# [1.7.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.6.0...v1.7.0) (2025-11-03)


### Features

* add ck doctor command for setup overview (resolves [#24](https://github.com/mrgoonie/claudekit-cli/issues/24)) ([dab7ce4](https://github.com/mrgoonie/claudekit-cli/commit/dab7ce460590b6a0b9d8208e277f096a7ccd130e))

# [1.6.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.5.1...v1.6.0) (2025-10-27)


### Bug Fixes

* enhance authentication error messages and user guidance ([170f2ae](https://github.com/mrgoonie/claudekit-cli/commit/170f2ae421e3e1f11cda406fafcd8057c6084135))
* make keytar dependency optional with graceful fallback ([b1be0b4](https://github.com/mrgoonie/claudekit-cli/commit/b1be0b487643ec082715ceeed3110bea4fb26bc7))
* malformed UTF-8 filenames on extraction ([08a99c6](https://github.com/mrgoonie/claudekit-cli/commit/08a99c6843a4ba9d61176bf182c7ebca4089e04e))
* resolve Biome linting errors in CI ([c8f949d](https://github.com/mrgoonie/claudekit-cli/commit/c8f949dc9cd45cddde4eaddfbdedca075e05f44c))


### Features

* implement comprehensive diagnostics command ([494a3d3](https://github.com/mrgoonie/claudekit-cli/commit/494a3d3416504fe67c5504ebf3db6d3aeaeb41d0))
* register diagnose command in CLI ([78781b2](https://github.com/mrgoonie/claudekit-cli/commit/78781b2b1d8f6870662802ef913b67ffe9e62a04))

## [1.5.1](https://github.com/mrgoonie/claudekit-cli/compare/v1.5.0...v1.5.1) (2025-10-21)


### Bug Fixes

* **ci:** add bash shell for Windows mkdir command ([0d6d5fc](https://github.com/mrgoonie/claudekit-cli/commit/0d6d5fc984d3bdb4e00029efb3f99b30b967beeb))
* use wrapper script for global npm installs ([4d6763c](https://github.com/mrgoonie/claudekit-cli/commit/4d6763cc44a86bebbdcfc84518d41b067d30b0ae))

# [1.5.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.4.1...v1.5.0) (2025-10-21)


### Bug Fixes

* gracefully handle missing binary files ([cbbea34](https://github.com/mrgoonie/claudekit-cli/commit/cbbea3407eae50a2e430729e97b0032260e89704))


### Features

* package prebuilt cli binaries ([fd265a3](https://github.com/mrgoonie/claudekit-cli/commit/fd265a379e7f9c29db534a3c27372ba20636d7e8))

## [1.4.1](https://github.com/mrgoonie/claudekit-cli/compare/v1.4.0...v1.4.1) (2025-10-21)


### Bug Fixes

* handle protected files during merge ([fe90767](https://github.com/mrgoonie/claudekit-cli/commit/fe907670932fc5b39521586ef798f73cd1130180))

# [1.4.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.3.0...v1.4.0) (2025-10-21)


### Features

* add --exclude flag to new and update commands ([8a0d7a0](https://github.com/mrgoonie/claudekit-cli/commit/8a0d7a00de70823d4fecac26d4c7e82c4df2ab0f))

# [1.3.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.2.2...v1.3.0) (2025-10-21)


### Bug Fixes

* fix CLI path calculation in integration tests ([c841e1d](https://github.com/mrgoonie/claudekit-cli/commit/c841e1d68abf9d1a8a714cd5dcec54357fc8c646))
* regenerate bun.lock for bun v1.3.0 compatibility ([e19c943](https://github.com/mrgoonie/claudekit-cli/commit/e19c943ad5b653694476527226448850c537c88d))
* skip integration tests in CI environment ([a890423](https://github.com/mrgoonie/claudekit-cli/commit/a890423b8e9d791c1387c4219dde78298b57159d))
* update bun.lock after dependency removal ([bfccb39](https://github.com/mrgoonie/claudekit-cli/commit/bfccb393aa12b395429aef8d8440b22417c8438b))


### Features

* add version.json and integration tests ([fc538d0](https://github.com/mrgoonie/claudekit-cli/commit/fc538d033f579962f8aee73ae3f8a25370189037))
* enhance CLI with security features and non-interactive mode ([297e6bb](https://github.com/mrgoonie/claudekit-cli/commit/297e6bba73f87411d3be9918929a35758b62be41))

## [1.2.2](https://github.com/mrgoonie/claudekit-cli/compare/v1.2.1...v1.2.2) (2025-10-20)


### Bug Fixes

* new and update issue ([f4fac22](https://github.com/mrgoonie/claudekit-cli/commit/f4fac224792fe82c1556f4b9ba7a6dcfc50aa84f))

## [1.2.1](https://github.com/mrgoonie/claudekit-cli/compare/v1.2.0...v1.2.1) (2025-10-18)


### Bug Fixes

* format keywords array to single line for biome compliance ([c416b3e](https://github.com/mrgoonie/claudekit-cli/commit/c416b3e2d0bddca73ca8a3e60cdc5d32e15c888e))

# [1.2.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.1.0...v1.2.0) (2025-10-17)


### Bug Fixes

* **cli:** resolve unicode character rendering in terminal output ([a8d1e53](https://github.com/mrgoonie/claudekit-cli/commit/a8d1e53462be644e8435b17a6679453860a1c06a))
* **download:** implement hybrid asset download with GitHub tarball fallback ([bfa2262](https://github.com/mrgoonie/claudekit-cli/commit/bfa22624562f5098a017c38d39906315edde98a4))
* format package.json keywords array to single line ([c4f5858](https://github.com/mrgoonie/claudekit-cli/commit/c4f5858dc1e4d95df5b9e4233884f7ba8b09a09a))


### Features

* **cli:** add verbose logging with --verbose flag and log file support ([d0c960d](https://github.com/mrgoonie/claudekit-cli/commit/d0c960d7115f4eb38b328f08ed980eda12dacd4b))
* **download:** prioritize ClaudeKit package assets in release downloads ([07533fe](https://github.com/mrgoonie/claudekit-cli/commit/07533fead1ed7f8382db81b65c4b82a7578ac86f))
* **update:** add custom file preservation and fix download authentication ([901f356](https://github.com/mrgoonie/claudekit-cli/commit/901f356de0fed1c68e3ad249d293f3eb3867bacf))

# [1.1.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.0.1...v1.1.0) (2025-10-17)


### Bug Fixes

* format package.json keywords array to single line ([c8dd66f](https://github.com/mrgoonie/claudekit-cli/commit/c8dd66faa94a84188790947fe3ee6f562d63cd46))


### Features

* **cli:** add versions command to list available releases ([27fbad1](https://github.com/mrgoonie/claudekit-cli/commit/27fbad1be3b5df90cb85ba9a3dd1b0eeb4fa6125))

## [1.0.1](https://github.com/mrgoonie/claudekit-cli/compare/v1.0.0...v1.0.1) (2025-10-09)


### Bug Fixes

* resolve CI lint failures ([8ff0186](https://github.com/mrgoonie/claudekit-cli/commit/8ff0186d8381003802c70c7cc17383e5662239a1))

# 1.0.0 (2025-10-09)


### Bug Fixes

* add libsecret system dependency for keytar in CI workflows ([9f9bb5a](https://github.com/mrgoonie/claudekit-cli/commit/9f9bb5a351fb3071d3929fbc8c916ca88ec0167d))
* configure biome linter rules and fix formatting issues ([d68e10b](https://github.com/mrgoonie/claudekit-cli/commit/d68e10bb1e65e525069ac3b3401ae9fc8131c15e))
* ensure clearToken always clears in-memory token even if keytar fails ([ffdbb12](https://github.com/mrgoonie/claudekit-cli/commit/ffdbb12dc20f5f171be94f4fb51745eff9b6c799))
* mark native and optional dependencies as external in build ([c8a25c4](https://github.com/mrgoonie/claudekit-cli/commit/c8a25c40fb53e5bcda6fe48522ffa21f9e2907e5))
* prevent auth tests from prompting for input in CI ([4e8b8b1](https://github.com/mrgoonie/claudekit-cli/commit/4e8b8b149f03b1ae05b3fb27846786c34e58d284))


### Features

* enhance UI/UX designer agent with improved tools and workflow clarity ([57e3467](https://github.com/mrgoonie/claudekit-cli/commit/57e3467c88c951e83fe5680358a4a5ac0e3b44d3))
* initial implementation of ClaudeKit CLI ([2e4f308](https://github.com/mrgoonie/claudekit-cli/commit/2e4f308bc99b8811ea0cc72b91a18b286b9fbd3e))
