## [3.15.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.15.2...v3.15.3) (2025-12-26)


### Bug Fixes

* preserve .ck.json user config on updates ([d234ffc](https://github.com/mrgoonie/claudekit-cli/commit/d234ffcf832cf696bb9c688c5934397e1b93a6d4)), closes [#246](https://github.com/mrgoonie/claudekit-cli/issues/246)

## [3.15.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.15.1...v3.15.2) (2025-12-25)


### Bug Fixes

* use semver sorting for beta version selection ([#256](https://github.com/mrgoonie/claudekit-cli/issues/256)) ([4f0369d](https://github.com/mrgoonie/claudekit-cli/commit/4f0369d87fd2dd83f57bf86a377b56ce003f3b6c))

## [3.15.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.15.0...v3.15.1) (2025-12-24)


### Bug Fixes

* remove duplicate 'v' prefix in kit version display ([478f68b](https://github.com/mrgoonie/claudekit-cli/commit/478f68b374fb2a38ffcc2bb8f9e363dc065c1605))

# [3.15.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.14.0...v3.15.0) (2025-12-24)


### Bug Fixes

* improve key sorting logic and add unit tests ([9e29f2a](https://github.com/mrgoonie/claudekit-cli/commit/9e29f2aeaf35030e28d0b631898780456483e29f))


### Features

* support multiple Gemini API keys in setup wizard ([c36c1e7](https://github.com/mrgoonie/claudekit-cli/commit/c36c1e76b3230e9e6848c6f8a7dbd7d440a446d2)), closes [#252](https://github.com/mrgoonie/claudekit-cli/issues/252)

# [3.14.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.13.2...v3.14.0) (2025-12-24)


### Bug Fixes

* **test:** restore expected examples count and section title ([725647a](https://github.com/mrgoonie/claudekit-cli/commit/725647a3ef384bcbd8707179f93fa579c36fe02d))
* **update:** improve kit update reminder robustness ([7bfbb72](https://github.com/mrgoonie/claudekit-cli/commit/7bfbb72fdc52d2c78f61d21f56cae2230cc5b3bc))
* **ux:** use positive framing for update tip ([e6c6597](https://github.com/mrgoonie/claudekit-cli/commit/e6c65970fafd07c034edebb0a504af24e5e750cd))


### Features

* **update:** add warning to clarify ck update vs ck init ([67cc4c3](https://github.com/mrgoonie/claudekit-cli/commit/67cc4c38bba9b4aab1700e08f589be4e1c974ffa)), closes [#249](https://github.com/mrgoonie/claudekit-cli/issues/249)
* **ux:** add ck init hints across CLI touchpoints ([02fa90f](https://github.com/mrgoonie/claudekit-cli/commit/02fa90facf361a6de4fde3e9fd76fd0924c853fd))

## [3.13.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.13.1...v3.13.2) (2025-12-24)


### Bug Fixes

* improve type safety and error logging in config merge ([4817aa3](https://github.com/mrgoonie/claudekit-cli/commit/4817aa3c88391b17ce4d85550f5458deb2f2d731))
* saveProjectConfig uses selective merge to preserve user settings ([3e10da1](https://github.com/mrgoonie/claudekit-cli/commit/3e10da1f5168696531f66a9e9dbcd9155c5667c4)), closes [#246](https://github.com/mrgoonie/claudekit-cli/issues/246)

## [3.13.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.13.0...v3.13.1) (2025-12-23)


### Bug Fixes

* **init:** respect -y flag for merge confirmation prompt ([dad64d3](https://github.com/mrgoonie/claudekit-cli/commit/dad64d394beedef40a4d85a96640984e383fd14a))

# [3.13.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.12.1...v3.13.0) (2025-12-23)


### Bug Fixes

* address PR review - fix PYTHONPATH misuse and add tests ([49cd692](https://github.com/mrgoonie/claudekit-cli/commit/49cd692ccad1dd0a70c9d2bc1c86eb81cc238b38))
* **output:** prevent race condition in JSON buffer auto-flush ([9336bc2](https://github.com/mrgoonie/claudekit-cli/commit/9336bc234179e86c530643b351ab7902e878c364))
* **types:** replace error: any with proper unknown type handling ([4de45aa](https://github.com/mrgoonie/claudekit-cli/commit/4de45aa43733c19cd8a27b2c1f842fb38ee783a3))


### Features

* **cli:** add --with-sudo flag and fix non-interactive mode prompts ([#241](https://github.com/mrgoonie/claudekit-cli/issues/241)) ([16e8124](https://github.com/mrgoonie/claudekit-cli/commit/16e81240884ca0a871028119637eb34512654371))
* **errors:** add standardized error message helpers ([c8c3bc2](https://github.com/mrgoonie/claudekit-cli/commit/c8c3bc23b320e4ed4fba544c65526f65b617dd82))
* **logger:** add process exit handler for graceful cleanup ([5662422](https://github.com/mrgoonie/claudekit-cli/commit/566242265c6f344407a0f4704564b0eee04e86a9))
* **new:** add types.ts with NewContext and phase result types ([ce18d10](https://github.com/mrgoonie/claudekit-cli/commit/ce18d109d5c08452ffe31f4f07274b09441b7eaf))

## [3.12.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.12.0...v3.12.1) (2025-12-22)


### Bug Fixes

* add pagination to release fetching to find stable releases ([7c0d381](https://github.com/mrgoonie/claudekit-cli/commit/7c0d3818e930610d111a7533378af96ad958e9ce))
* address code review feedback for release pagination ([3129068](https://github.com/mrgoonie/claudekit-cli/commit/31290687af2d3fac23c355011ddb9be136a10a04))

# [3.12.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.11.1...v3.12.0) (2025-12-21)


### Features

* **cli:** add easter-egg command for Code Hunt 2025 campaign ([5e1f0ee](https://github.com/mrgoonie/claudekit-cli/commit/5e1f0ee28f5c41728ff99d8edd57b2756b4cea79))

## [3.11.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.11.0...v3.11.1) (2025-12-18)


### Bug Fixes

* **metadata:** migrate all direct metadata.files access to getAllTrackedFiles() ([9d8823e](https://github.com/mrgoonie/claudekit-cli/commit/9d8823e768082b766efed4091693b898d864693a))
* **metadata:** remove duplicate file tracking from root-level fields ([aab77fa](https://github.com/mrgoonie/claudekit-cli/commit/aab77fa9240510d11d92836443bd8830de7efe04))

# [3.11.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.10.2...v3.11.0) (2025-12-18)


### Bug Fixes

* **metadata:** harden multi-kit metadata handling and file locking ([4c6f419](https://github.com/mrgoonie/claudekit-cli/commit/4c6f419038781f9268b184ddb211a1dfa439930c)), closes [#231](https://github.com/mrgoonie/claudekit-cli/issues/231)
* preserve backward compatibility for legacy metadata format ([b207aeb](https://github.com/mrgoonie/claudekit-cli/commit/b207aeb24a31d5d0456da3a691ac82d20869f9b7))
* **security:** remove unused keytar dependency ([1c8c60e](https://github.com/mrgoonie/claudekit-cli/commit/1c8c60e962dbf5b64305f041f5e0f1ef9f367d71)), closes [#229](https://github.com/mrgoonie/claudekit-cli/issues/229)


### Features

* **init:** add selective merge to skip unchanged files during init ([5c4d542](https://github.com/mrgoonie/claudekit-cli/commit/5c4d542e666e50ce83034c47a67ea3b623a1c1a2)), closes [#225](https://github.com/mrgoonie/claudekit-cli/issues/225)
* **metadata:** add multi-kit architecture for marketing kit support ([083eb03](https://github.com/mrgoonie/claudekit-cli/commit/083eb03c28f137ff018bf629dfe113c865bd7021)), closes [#226](https://github.com/mrgoonie/claudekit-cli/issues/226)

## [3.10.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.10.1...v3.10.2) (2025-12-15)


### Bug Fixes

* **gemini-mcp:** correct symlink location for global installs ([#222](https://github.com/mrgoonie/claudekit-cli/issues/222)) ([428edf9](https://github.com/mrgoonie/claudekit-cli/commit/428edf94156e291a531ecb9d66610ff371e9e1c6))
* **system-checker:** skip git/gh checks in CI to prevent Windows timeout ([2b8686e](https://github.com/mrgoonie/claudekit-cli/commit/2b8686e188bc943886974b101094dd2794500482))

## [3.10.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.10.0...v3.10.1) (2025-12-15)


### Bug Fixes

* **config:** prevent duplicate hook matchers during selective merge ([13d5014](https://github.com/mrgoonie/claudekit-cli/commit/13d5014c551ec574fbfdd049197e7f62b9afa1f6)), closes [#219](https://github.com/mrgoonie/claudekit-cli/issues/219)

# [3.10.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.9.2...v3.10.0) (2025-12-15)


### Bug Fixes

* **gemini-mcp:** add missing export and fix race condition ([f836d73](https://github.com/mrgoonie/claudekit-cli/commit/f836d73c6927d24eee5d9a6f9e56cd273488ffab))
* **gemini-mcp:** use relative symlink paths for portability and add Windows fallback ([7910ff5](https://github.com/mrgoonie/claudekit-cli/commit/7910ff54e3b7d40e639ad5fb2ff2ff8045bd76ab)), closes [#218](https://github.com/mrgoonie/claudekit-cli/issues/218)
* **test:** normalize symlink path for Windows compatibility ([8e8bde7](https://github.com/mrgoonie/claudekit-cli/commit/8e8bde77ffc3151840785a0ec7e190adf17e0fad))


### Features

* **gemini-mcp:** auto-setup MCP config via symlink or selective merge ([ae9d452](https://github.com/mrgoonie/claudekit-cli/commit/ae9d452c77de802e7c5c76a8614f260e8eab1654))

## [3.9.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.9.1...v3.9.2) (2025-12-11)


### Bug Fixes

* use ExecutionPolicy Bypass for Windows PowerShell scripts ([#213](https://github.com/mrgoonie/claudekit-cli/issues/213)) ([d736648](https://github.com/mrgoonie/claudekit-cli/commit/d736648400e5be2294ad97c7c38027ba96240894))

## [3.9.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.9.0...v3.9.1) (2025-12-11)


### Bug Fixes

* show installation progress and current version ([#213](https://github.com/mrgoonie/claudekit-cli/issues/213), [#214](https://github.com/mrgoonie/claudekit-cli/issues/214)) ([bd567c6](https://github.com/mrgoonie/claudekit-cli/commit/bd567c66372413bdae4b99d2b92dc34c45af489f))

# [3.9.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.8.1...v3.9.0) (2025-12-10)


### Features

* **ui:** add verbosity levels and unicode fallback for CLI output ([35ba09d](https://github.com/mrgoonie/claudekit-cli/commit/35ba09df177fec58a6f3c9a79a73909f24d23db2)), closes [#210](https://github.com/mrgoonie/claudekit-cli/issues/210)

## [3.8.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.8.0...v3.8.1) (2025-12-10)


### Bug Fixes

* standardize settings.json formatting to 2-space indentation ([e1c8dc7](https://github.com/mrgoonie/claudekit-cli/commit/e1c8dc7a96dae13e6d0f8f76fc5562f688f18058))

# [3.8.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.7.1...v3.8.0) (2025-12-09)


### Bug Fixes

* address code review feedback for settings merger ([92191d7](https://github.com/mrgoonie/claudekit-cli/commit/92191d752c5e4d15c6164bcd3b1fd177a5b1ab38))
* **settings-merger:** address code review feedback ([2f7374d](https://github.com/mrgoonie/claudekit-cli/commit/2f7374dbe71c2546cf51b26dc44d8df7cf631699))
* **settings-merger:** address code review feedback from PR [#195](https://github.com/mrgoonie/claudekit-cli/issues/195) ([a08221f](https://github.com/mrgoonie/claudekit-cli/commit/a08221fe4f4a6ec507c6fa5d7b81965b2d0c8c59))


### Features

* **settings-merge:** implement selective settings merge with force overwrite option ([acb900d](https://github.com/mrgoonie/claudekit-cli/commit/acb900d24bd5d73e281a285a7d5e1d38f9571b2a)), closes [#192](https://github.com/mrgoonie/claudekit-cli/issues/192)

## [3.7.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.7.0...v3.7.1) (2025-12-09)


### Bug Fixes

* **encoding:** replace Unicode spinner and prompts with ASCII alternatives ([a05260f](https://github.com/mrgoonie/claudekit-cli/commit/a05260f02b6a9608ec0d7a64790ed8c702c5d586))

# [3.7.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.6.2...v3.7.0) (2025-12-08)


### Bug Fixes

* **ci:** skip gh token check in test mode to prevent timeout on Windows CI ([850eaae](https://github.com/mrgoonie/claudekit-cli/commit/850eaae78e4ce5fde1fde221660afc5b27963409))
* **health-checks:** resolve memory leaks and race conditions in PR [#189](https://github.com/mrgoonie/claudekit-cli/issues/189) ([e146dec](https://github.com/mrgoonie/claudekit-cli/commit/e146dec10bc8c7fd1daccf9ae989e3d6456b5c50))
* resolve 4 critical issues from PR [#188](https://github.com/mrgoonie/claudekit-cli/issues/188) review ([d01e194](https://github.com/mrgoonie/claudekit-cli/commit/d01e194805f4b5a7c759dbe887bf55ed7c19fbb6))
* resolve linting errors for CI/CD compliance ([0825e1f](https://github.com/mrgoonie/claudekit-cli/commit/0825e1f9c2af0c7a6341ecd197ef07bd6cb32c8f)), closes [#188](https://github.com/mrgoonie/claudekit-cli/issues/188)
* **security:** resolve TOCTOU race condition and path traversal vulnerabilities ([5e7b877](https://github.com/mrgoonie/claudekit-cli/commit/5e7b877b7752c80b2ba52db1c8ea57a4cd71db17))


### Features

* comprehensive doctor diagnostic suite with platform/network checks ([244fc77](https://github.com/mrgoonie/claudekit-cli/commit/244fc771c4be13b0fbaab8b8d96e6f0501e697d2))

## [3.6.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.6.1...v3.6.2) (2025-12-08)


### Bug Fixes

* prevent timeout in doctor command by skipping Claude directories ([4a34b88](https://github.com/mrgoonie/claudekit-cli/commit/4a34b88121c55775d856ff0df3d5f565bc30335c))


### Performance Improvements

* exclude Claude Code internal directories from file scanner ([61bff31](https://github.com/mrgoonie/claudekit-cli/commit/61bff316d200c5ea54bc73fbf113b271d9e58b31)), closes [#184](https://github.com/mrgoonie/claudekit-cli/issues/184)

## [3.6.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.6.0...v3.6.1) (2025-12-07)


### Bug Fixes

* add safeguard for file scanner detecting excessive custom files ([#180](https://github.com/mrgoonie/claudekit-cli/issues/180)) ([cd4d86f](https://github.com/mrgoonie/claudekit-cli/commit/cd4d86fa84d18f6dd83e3eb92d795b7ad970a736))
* **auth:** add debug logging for empty token response ([1144db6](https://github.com/mrgoonie/claudekit-cli/commit/1144db61db71a432f03f45d01b6256e500e8e6c2))
* skip local detection when cwd is global kit directory ([#178](https://github.com/mrgoonie/claudekit-cli/issues/178)) ([28f6b65](https://github.com/mrgoonie/claudekit-cli/commit/28f6b65ad2b608661712e973df467902a40a94a1))

# [3.6.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.5.2...v3.6.0) (2025-12-07)


### Bug Fixes

* address PR review recommendations ([5514db3](https://github.com/mrgoonie/claudekit-cli/commit/5514db33a122d6240f2614cc22f44a20ae6e1212))
* **install-error-handler:** address PR review critical issues ([44bac87](https://github.com/mrgoonie/claudekit-cli/commit/44bac87dc6864c7ef625dfe5a081c2d193b32974))
* **install:** address PR review improvements ([d2d0168](https://github.com/mrgoonie/claudekit-cli/commit/d2d0168e023ca5a9d4affab116df5a45bf2a84db))
* **install:** address PR review issues ([f2bcd8d](https://github.com/mrgoonie/claudekit-cli/commit/f2bcd8dfcefb8a533e8478c5bd726d668c76f932)), closes [#2](https://github.com/mrgoonie/claudekit-cli/issues/2) [#3](https://github.com/mrgoonie/claudekit-cli/issues/3) [#4](https://github.com/mrgoonie/claudekit-cli/issues/4) [#6](https://github.com/mrgoonie/claudekit-cli/issues/6)
* **path:** handle spaces in user profile paths in shell commands ([43de102](https://github.com/mrgoonie/claudekit-cli/commit/43de10207a6207147a1c7d18e98a86bd4cf472ad))


### Features

* **install:** add bulletproof skills installation with error handling ([d2c7168](https://github.com/mrgoonie/claudekit-cli/commit/d2c71687a43ce478eaca4d6cd66b9888979613c3))

## [3.5.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.5.1...v3.5.2) (2025-12-06)


### Bug Fixes

* add gh CLI version check to warn users with outdated versions ([35fa070](https://github.com/mrgoonie/claudekit-cli/commit/35fa0709b74911a048e830bd504f559d3cdd7b3a)), closes [#171](https://github.com/mrgoonie/claudekit-cli/issues/171)

## [3.5.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.5.0...v3.5.1) (2025-12-05)


### Bug Fixes

* skip PM detection in test mode to prevent Windows CI timeout ([ef62ba9](https://github.com/mrgoonie/claudekit-cli/commit/ef62ba9f25088816a1a3d13b716ef64fad090a31))
* transform .claude/ paths to $CLAUDE_PROJECT_DIR for local installs ([11e8df5](https://github.com/mrgoonie/claudekit-cli/commit/11e8df5f2e68b887f0dda20017546f60eadf29f5)), closes [#168](https://github.com/mrgoonie/claudekit-cli/issues/168)

# [3.5.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.4.0...v3.5.0) (2025-12-05)


### Bug Fixes

* address PR review feedback ([fa6ff8d](https://github.com/mrgoonie/claudekit-cli/commit/fa6ff8d70eaff6503fe286e1b44482490a2a9ed7))
* **auth:** resolve intermittent GitHub CLI token retrieval failures ([2736e8b](https://github.com/mrgoonie/claudekit-cli/commit/2736e8b11ef687e44d3028348d98b60f72532c0d)), closes [#161](https://github.com/mrgoonie/claudekit-cli/issues/161)
* **cli:** resolve regex flags error for Node.js < 20 ([0183cbe](https://github.com/mrgoonie/claudekit-cli/commit/0183cbe5c1fe285d39224be077f4f107aaab7463))


### Features

* **init:** add --yes/-y flag for non-interactive mode ([e83c9c0](https://github.com/mrgoonie/claudekit-cli/commit/e83c9c0e9cfa0594ba86c7f1cff32f66cd6fa2ad))

# [3.4.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.3.1...v3.4.0) (2025-12-05)


### Features

* **doctor:** add comprehensive verbose logging for hang diagnosis ([74d52f5](https://github.com/mrgoonie/claudekit-cli/commit/74d52f54f9616ca31521e482c55f4f62a9b5adc1))

## [3.3.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.3.0...v3.3.1) (2025-12-04)


### Bug Fixes

* add global mode tests and auto-migration for .ck.json ([9cf1aa1](https://github.com/mrgoonie/claudekit-cli/commit/9cf1aa1e0a89fb553a31c63d9660dc698d5bb35b))
* save .ck.json to correct location in global mode ([0d7892e](https://github.com/mrgoonie/claudekit-cli/commit/0d7892eef1db086b5e42d0a563d6f7daadbdbc1e)), closes [#157](https://github.com/mrgoonie/claudekit-cli/issues/157)

# [3.3.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.2.0...v3.3.0) (2025-12-04)


### Bug Fixes

* correct debug log filename from .claudekit.json to .claude/.ck.json ([dc46594](https://github.com/mrgoonie/claudekit-cli/commit/dc4659457ddd4896ca65d0694a9c410e517dd346))
* correct typo using folders.plans instead of folders.docs for single-quote replacement ([17dfe35](https://github.com/mrgoonie/claudekit-cli/commit/17dfe35e0413529da0ae21f097248f8b5f6d3333))
* resolve createTempDir race condition in CI environment ([b1f1674](https://github.com/mrgoonie/claudekit-cli/commit/b1f16743a73649d0e2b4dcb91e26159724ebd02f))
* **windows:** add error handling to IIFE and resolve promise on exit ([d29b07f](https://github.com/mrgoonie/claudekit-cli/commit/d29b07fcc58af5d2b06568946007afaccc2ed92d))
* **windows:** prevent libuv assertion failure on Node.js 23.x/24.x/25.x ([28703a9](https://github.com/mrgoonie/claudekit-cli/commit/28703a9ce0c6af2cb8a985567a48053fcdec918a)), closes [nodejs/node#56645](https://github.com/nodejs/node/issues/56645) [#153](https://github.com/mrgoonie/claudekit-cli/issues/153)


### Features

* **custom-folders:** add CLI flags for custom docs and plans directory names ([50bb1bf](https://github.com/mrgoonie/claudekit-cli/commit/50bb1bf881fc65755956280fa77ddd662e72e6a0))

# [3.2.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.1.0...v3.2.0) (2025-12-04)


### Bug Fixes

* address PR review feedback ([649f402](https://github.com/mrgoonie/claudekit-cli/commit/649f4020086115552c092de75fe9c3ff678df48b))


### Features

* detect local installation during global init ([bcb5ca7](https://github.com/mrgoonie/claudekit-cli/commit/bcb5ca7ea7b8065ba5a71327a3d3804e2b4edc7f))

# [3.1.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.0.1...v3.1.0) (2025-12-03)


### Bug Fixes

* **security:** address PR review concerns for doctor command ([742e87f](https://github.com/mrgoonie/claudekit-cli/commit/742e87fe6161f3860e0b1b55bf793593128c861f))


### Features

* **doctor:** enhance UI/UX with table-aligned health checks ([346081b](https://github.com/mrgoonie/claudekit-cli/commit/346081b4edc7570ef3381032243290cb01ebc6a9))
* **doctor:** implement unified health-check system with auto-healing ([6d3f4a9](https://github.com/mrgoonie/claudekit-cli/commit/6d3f4a94975569827f16e99214c6bfd7e7e7ca1c))

## [3.0.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.0.0...v3.0.1) (2025-12-02)


### Bug Fixes

* gracefully handle legacy installs without ownership metadata ([5f70889](https://github.com/mrgoonie/claudekit-cli/commit/5f708891e54c3503a711c16b80232d1a5dcd9679))

# [3.0.0](https://github.com/mrgoonie/claudekit-cli/compare/v2.6.0...v3.0.0) (2025-12-02)


### Bug Fixes

* add stream.destroy() to skills-customization-scanner hashFile for consistency ([ebfcce3](https://github.com/mrgoonie/claudekit-cli/commit/ebfcce389af4bc0df46b18f27d8364cce5cc902a))
* address PR [#142](https://github.com/mrgoonie/claudekit-cli/issues/142) code review feedback ([6f1c21a](https://github.com/mrgoonie/claudekit-cli/commit/6f1c21ac3a40cd8437666d86ec1a5d8151a6dd5f))
* improve gh CLI error messages and add 401 cache invalidation ([6cabe64](https://github.com/mrgoonie/claudekit-cli/commit/6cabe649f0c20754e1a6a8aecf8bd5ca64485baa)), closes [#141](https://github.com/mrgoonie/claudekit-cli/issues/141)
* remove GitHub PAT support, use gh auth login only ([1e904ff](https://github.com/mrgoonie/claudekit-cli/commit/1e904ff6d8b4a1b87bc4c8ff7f52b20ae51f59b5)), closes [#139](https://github.com/mrgoonie/claudekit-cli/issues/139)
* resolve uninstall command hanging by properly destroying file streams ([2471863](https://github.com/mrgoonie/claudekit-cli/commit/2471863bdbfaada21a0bc29c6eabeb237868a5b8)), closes [#115](https://github.com/mrgoonie/claudekit-cli/issues/115)


### BREAKING CHANGES

* Personal Access Tokens (PAT) are no longer supported.
ClaudeKit now requires GitHub CLI authentication via `gh auth login`.

Changes:
- Remove PAT authentication methods (env vars, keychain, prompt)
- Remove github.token from config schema
- Simplify AuthManager to only use gh auth token
- Update all error messages to recommend gh auth login
- Remove isValidTokenFormat method (no longer needed)
- Update tests for new simplified auth behavior

This change aligns with GitHub's deprecation of PAT for accessing
external private repositories. Users must now authenticate via:
  1. Install GitHub CLI: https://cli.github.com
  2. Run: gh auth login

# [2.6.0](https://github.com/mrgoonie/claudekit-cli/compare/v2.5.2...v2.6.0) (2025-12-01)


### Bug Fixes

* use pathToFileURL for Windows ESM dynamic import compatibility ([0abfab9](https://github.com/mrgoonie/claudekit-cli/commit/0abfab9a60f3d305a5a60b97f101e1c816fcf730)), closes [#135](https://github.com/mrgoonie/claudekit-cli/issues/135)


### Features

* add --refresh flag to bypass release cache ([59ec229](https://github.com/mrgoonie/claudekit-cli/commit/59ec229c5062746eabaa6f64f74ac7fc46a75b0f))

## [2.5.2](https://github.com/mrgoonie/claudekit-cli/compare/v2.5.1...v2.5.2) (2025-12-01)


### Bug Fixes

* npm publish payload too large - complete fix ([65b15df](https://github.com/mrgoonie/claudekit-cli/commit/65b15dfc8bfae658f5dae846b5a90af9372f1a82)), closes [#130](https://github.com/mrgoonie/claudekit-cli/issues/130)
* remove prepublishOnly hook to prevent npm publish payload too large ([a54dc8f](https://github.com/mrgoonie/claudekit-cli/commit/a54dc8f3aede43c95493af47d3153bcab3a477dc)), closes [#130](https://github.com/mrgoonie/claudekit-cli/issues/130) [#132](https://github.com/mrgoonie/claudekit-cli/issues/132)
* reorder semantic-release plugins to build binaries before npm publish ([88c98bb](https://github.com/mrgoonie/claudekit-cli/commit/88c98bb3882d6f2c1e94c36345794a482c7c1b91))
* **test:** skip dist check in CI environment ([26c7057](https://github.com/mrgoonie/claudekit-cli/commit/26c7057676c50e429c7c1ee540d2a9306ed4ba1a))

## [2.5.2](https://github.com/mrgoonie/claudekit-cli/compare/v2.5.1...v2.5.2) (2025-12-01)


### Bug Fixes

* npm publish payload too large - complete fix ([65b15df](https://github.com/mrgoonie/claudekit-cli/commit/65b15dfc8bfae658f5dae846b5a90af9372f1a82)), closes [#130](https://github.com/mrgoonie/claudekit-cli/issues/130)
* remove prepublishOnly hook to prevent npm publish payload too large ([a54dc8f](https://github.com/mrgoonie/claudekit-cli/commit/a54dc8f3aede43c95493af47d3153bcab3a477dc)), closes [#130](https://github.com/mrgoonie/claudekit-cli/issues/130) [#132](https://github.com/mrgoonie/claudekit-cli/issues/132)
* reorder semantic-release plugins to build binaries before npm publish ([88c98bb](https://github.com/mrgoonie/claudekit-cli/commit/88c98bb3882d6f2c1e94c36345794a482c7c1b91))
* **test:** skip dist check in CI environment ([26c7057](https://github.com/mrgoonie/claudekit-cli/commit/26c7057676c50e429c7c1ee540d2a9306ed4ba1a))

## [2.5.3](https://github.com/mrgoonie/claudekit-cli/compare/v2.5.2...v2.5.3) (2025-12-01)


### Bug Fixes

* exclude platform binaries and tarballs from npm package ([727bce9](https://github.com/mrgoonie/claudekit-cli/commit/727bce92dc9383241b5f416491abccce3cc56ceb))

## [2.5.2](https://github.com/mrgoonie/claudekit-cli/compare/v2.5.1...v2.5.2) (2025-12-01)


### Bug Fixes

* build script must update version and create dist before binaries ([4a85bac](https://github.com/mrgoonie/claudekit-cli/commit/4a85bacd6281ef7dd9b0f378f152081c61c117b3))
* remove prepublishOnly hook to prevent npm publish payload too large ([a54dc8f](https://github.com/mrgoonie/claudekit-cli/commit/a54dc8f3aede43c95493af47d3153bcab3a477dc)), closes [#130](https://github.com/mrgoonie/claudekit-cli/issues/130) [#132](https://github.com/mrgoonie/claudekit-cli/issues/132)
* remove version validation that fails due to plugin order ([d15d726](https://github.com/mrgoonie/claudekit-cli/commit/d15d72685bb5f3aa4d1ae0d129c4246c6b0b7487))
* reorder semantic-release plugins to build binaries before npm publish ([88c98bb](https://github.com/mrgoonie/claudekit-cli/commit/88c98bb3882d6f2c1e94c36345794a482c7c1b91))
* **test:** skip dist check in CI environment ([26c7057](https://github.com/mrgoonie/claudekit-cli/commit/26c7057676c50e429c7c1ee540d2a9306ed4ba1a))

## [2.5.1](https://github.com/mrgoonie/claudekit-cli/compare/v2.5.0...v2.5.1) (2025-12-01)


### Bug Fixes

* **cli:** add Node.js fallback for Alpine/musl compatibility ([699cd75](https://github.com/mrgoonie/claudekit-cli/commit/699cd755a395d71365e4ea6e680b939183047b0c))
* **cli:** address code review recommendations ([fb38063](https://github.com/mrgoonie/claudekit-cli/commit/fb3806357b3b5f63efb117cc0c07aa9635329acc))
* **cli:** address PR review concerns for Alpine fallback ([17279e3](https://github.com/mrgoonie/claudekit-cli/commit/17279e335f3cc649ca9628c296421680eca3e212))
* **cli:** address second round of PR review concerns ([e850170](https://github.com/mrgoonie/claudekit-cli/commit/e8501709393751dfe1d874933416dd3ef697187e))
* **test:** skip dist check in CI environment ([ee002a6](https://github.com/mrgoonie/claudekit-cli/commit/ee002a668ee7f5898a8f642efb05dd1c3f610346))

# [2.5.0](https://github.com/mrgoonie/claudekit-cli/compare/v2.4.0...v2.5.0) (2025-12-01)


### Bug Fixes

* **auth:** improve PAT error messaging and add temp directory fallback ([#128](https://github.com/mrgoonie/claudekit-cli/issues/128)) ([dc25ad4](https://github.com/mrgoonie/claudekit-cli/commit/dc25ad4c48daf039a3b6c7952d22c02823613096))


### Features

* **dev-quick-start:** add --dry-run flag to commit command ([6e753be](https://github.com/mrgoonie/claudekit-cli/commit/6e753be2bdeda35cdaf78ab12ec7988072afd52a))

# [2.4.0](https://github.com/mrgoonie/claudekit-cli/compare/v2.3.2...v2.4.0) (2025-11-30)


### Bug Fixes

* **macos:** optimize extraction and file tracking for macOS ([#124](https://github.com/mrgoonie/claudekit-cli/issues/124)) ([b09d99c](https://github.com/mrgoonie/claudekit-cli/commit/b09d99c3ffc79dda1c3f9230be756eab45ca7d8d))
* **security:** prevent command injection in native unzip fallback ([07353a0](https://github.com/mrgoonie/claudekit-cli/commit/07353a05918b1b297062ce3cfb993d0ea5e76053)), closes [#127](https://github.com/mrgoonie/claudekit-cli/issues/127)
* **ux:** correct update notification command and layout issues ([b645a9a](https://github.com/mrgoonie/claudekit-cli/commit/b645a9a1ac83d5bb50ae04f8e6273ad0c0957856))
* **ux:** improve update notification clarity and visual design ([#123](https://github.com/mrgoonie/claudekit-cli/issues/123)) ([d9d9818](https://github.com/mrgoonie/claudekit-cli/commit/d9d981894e885456bc6cfc8b95c9898531ee66f7))
* **ux:** remove truncated URL from update notifications ([e20a4e1](https://github.com/mrgoonie/claudekit-cli/commit/e20a4e16f48991283de66f680af789a141ef2a83))


### Features

* preserve .ckignore during kit updates ([#126](https://github.com/mrgoonie/claudekit-cli/issues/126)) ([bae6285](https://github.com/mrgoonie/claudekit-cli/commit/bae628523c9ede2aba80cf770d98d64db6bbb02c))

## [2.3.2](https://github.com/mrgoonie/claudekit-cli/compare/v2.3.1...v2.3.2) (2025-11-30)


### Bug Fixes

* **init:** parallelize file tracking to prevent CLI hanging ([#121](https://github.com/mrgoonie/claudekit-cli/issues/121)) ([cb29a3d](https://github.com/mrgoonie/claudekit-cli/commit/cb29a3d14fc4e05b330181079bb64c5da197edac))
* **tracking:** address PR [#122](https://github.com/mrgoonie/claudekit-cli/issues/122) code review feedback ([5510644](https://github.com/mrgoonie/claudekit-cli/commit/5510644e6d0e49264dee77fee8cf47d02ccbbf94))

## [2.3.1](https://github.com/mrgoonie/claudekit-cli/compare/v2.3.0...v2.3.1) (2025-11-29)


### Bug Fixes

* **new:** remove misleading next steps from command output ([204f5d4](https://github.com/mrgoonie/claudekit-cli/commit/204f5d44132a0615d9204b388b666a59d294a0eb))
* **tests:** add timeout to git operations in CI ([331b426](https://github.com/mrgoonie/claudekit-cli/commit/331b4264a3b74d86c407412e5e2bba6b127b947b))

# [2.3.0](https://github.com/mrgoonie/claudekit-cli/compare/v2.2.0...v2.3.0) (2025-11-29)


### Bug Fixes

* address PR [#119](https://github.com/mrgoonie/claudekit-cli/issues/119) code review feedback ([c66cf51](https://github.com/mrgoonie/claudekit-cli/commit/c66cf51fb5ab4f3743841ae6d952b1ceef7f17a3))
* **init:** track files correctly in global mode for ownership checksums ([00a3f3f](https://github.com/mrgoonie/claudekit-cli/commit/00a3f3f4a1607d674c3c28a70d11bb4ca128a771)), closes [#112](https://github.com/mrgoonie/claudekit-cli/issues/112)
* **setup-wizard:** improve UX with explicit inheritance flow ([9f3e1a9](https://github.com/mrgoonie/claudekit-cli/commit/9f3e1a9939dd92d1dbf593b2e1a0800354c2ef6a))
* skip file permission test on Windows ([b97c0e4](https://github.com/mrgoonie/claudekit-cli/commit/b97c0e47fd8183ae943ef1e3d68b60f9c9f2e867))


### Features

* **init:** add interactive setup wizard core modules ([8d894c4](https://github.com/mrgoonie/claudekit-cli/commit/8d894c493193fd37cb43ed26870416063655f4b2)), closes [#76](https://github.com/mrgoonie/claudekit-cli/issues/76)
* **init:** integrate setup wizard into init command ([9d490f1](https://github.com/mrgoonie/claudekit-cli/commit/9d490f19c80f12fe4b39aef6dfe0408efc10667a)), closes [#76](https://github.com/mrgoonie/claudekit-cli/issues/76)

# [2.2.0](https://github.com/mrgoonie/claudekit-cli/compare/v2.1.0...v2.2.0) (2025-11-28)


### Bug Fixes

* improve checksum and error handling per PR review ([98adceb](https://github.com/mrgoonie/claudekit-cli/commit/98adcebca8f908aec7c684d82c52a3b676afe4f5))
* **lib:** improve package manager detection to identify true owner ([97c9206](https://github.com/mrgoonie/claudekit-cli/commit/97c9206b6851c7fd5a5f93fa93ea33fada97004b)), closes [#111](https://github.com/mrgoonie/claudekit-cli/issues/111)
* **ownership:** preserve user files in destructive operations ([#106](https://github.com/mrgoonie/claudekit-cli/issues/106)) ([9b20a29](https://github.com/mrgoonie/claudekit-cli/commit/9b20a29b111d9b00dc4ac808993b7f1dd4fb0814))
* skip slow PM tests in CI and improve path traversal validation ([cc1736d](https://github.com/mrgoonie/claudekit-cli/commit/cc1736da90950e1db43c3881c1c6d47c35ee93c4)), closes [#117](https://github.com/mrgoonie/claudekit-cli/issues/117)
* **test:** skip all tests that trigger slow PM queries in CI ([ab2e6c1](https://github.com/mrgoonie/claudekit-cli/commit/ab2e6c18da287eb828c63f50fe9639c072466450))
* **test:** skip findOwningPm test that times out in CI ([163ab4b](https://github.com/mrgoonie/claudekit-cli/commit/163ab4b4b972463d80a8d554afa00927c6d587ba))
* **test:** skip slow PM query tests on Windows CI ([f94cb40](https://github.com/mrgoonie/claudekit-cli/commit/f94cb403c2db57ee3e22110a2b940586eaad0e3d))
* **tracking:** use getAllInstalledFiles for ownership tracking ([2c9bad8](https://github.com/mrgoonie/claudekit-cli/commit/2c9bad82311e6840f247bcbfd28fd54f2980eccf))
* **ux:** handle undefined input when user presses Enter ([#109](https://github.com/mrgoonie/claudekit-cli/issues/109)) ([92dde16](https://github.com/mrgoonie/claudekit-cli/commit/92dde16145a39cf80126b8695db214c2cbc2c2a1))
* **ux:** prevent directory input from prepending default value ([#109](https://github.com/mrgoonie/claudekit-cli/issues/109)) ([4ad6caa](https://github.com/mrgoonie/claudekit-cli/commit/4ad6caa046ee7e594539ef173bee34c7a7fde115))
* Windows CI failures ([4853ff8](https://github.com/mrgoonie/claudekit-cli/commit/4853ff81b4093602e167dca179c533aa817da862))


### Features

* **migration:** add legacy install migration system ([7dc6547](https://github.com/mrgoonie/claudekit-cli/commit/7dc654751b1b142f58ec7959e1f04e105c65f64c)), closes [#106](https://github.com/mrgoonie/claudekit-cli/issues/106)
* **ownership:** add core ownership tracking types and checker ([cc2617f](https://github.com/mrgoonie/claudekit-cli/commit/cc2617fcd5adfdd391f95a9421136747e35d7ec2)), closes [#106](https://github.com/mrgoonie/claudekit-cli/issues/106)
* **uninstall:** add ownership-aware uninstall with dry-run support ([5658751](https://github.com/mrgoonie/claudekit-cli/commit/5658751b6c3f69aabb1db1953d6b0aad149c4c14))
* **ux:** add dry-run and force-overwrite modes for ownership operations ([32ef938](https://github.com/mrgoonie/claudekit-cli/commit/32ef938375280099c01a43b20d7937ec9d64a28b)), closes [#106](https://github.com/mrgoonie/claudekit-cli/issues/106)

# [2.1.0](https://github.com/mrgoonie/claudekit-cli/compare/v2.0.0...v2.1.0) (2025-11-28)


### Bug Fixes

* **help:** only show help when no command matched ([3586608](https://github.com/mrgoonie/claudekit-cli/commit/35866086834dfa7f30aa60632d8b14b7acf0f302))
* **help:** show help when no command provided ([5156bc9](https://github.com/mrgoonie/claudekit-cli/commit/5156bc9b05eb88f0bd6c72dd7a84ad7d13064c2b))
* **windows:** convert Unix env var syntax for cross-platform compatibility ([ca8d105](https://github.com/mrgoonie/claudekit-cli/commit/ca8d1058e03671191565469cfc956ec93c1b05a1)), closes [#105](https://github.com/mrgoonie/claudekit-cli/issues/105)
* **windows:** use forward slashes for cross-platform path consistency ([2c50c38](https://github.com/mrgoonie/claudekit-cli/commit/2c50c382b59d3c42e78fc1841f44d0e1fcfde61e))


### Features

* **help:** add declarative command help definitions ([1a7c42f](https://github.com/mrgoonie/claudekit-cli/commit/1a7c42f46d2f8ac0bc24d67e48684d1e59142348))
* **help:** add help interceptor for custom help output ([0dc258d](https://github.com/mrgoonie/claudekit-cli/commit/0dc258de8f1ed4d7e564feebe52aa396b7a970e3))
* **help:** add help renderer core with colors and banner ([6a68198](https://github.com/mrgoonie/claudekit-cli/commit/6a6819862d71367b2f9d8b846b3037930ee466c2))
* **help:** add help system type definitions ([5caf67b](https://github.com/mrgoonie/claudekit-cli/commit/5caf67be0695ea23c7ec11280688bf46aeaf34af))
* **help:** add interactive paging for long help content ([5d6b1ca](https://github.com/mrgoonie/claudekit-cli/commit/5d6b1ca93e45f34182e473f68c18e6b74783a4b4))
* **update:** add grace handling for deprecated kit update options ([be64e39](https://github.com/mrgoonie/claudekit-cli/commit/be64e39c762d24956eee0df55433646f2b51af5b))

# [2.0.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.16.1...v2.0.0) (2025-11-27)


### Bug Fixes

* **cli:** rename --version to --release flag and fix test isolation ([0bf421e](https://github.com/mrgoonie/claudekit-cli/commit/0bf421eb5b55795c14f8ea812d44cbc0b200fa77)), closes [#99](https://github.com/mrgoonie/claudekit-cli/issues/99)
* **tests:** add test isolation with CK_TEST_HOME environment variable ([44477e0](https://github.com/mrgoonie/claudekit-cli/commit/44477e0480afd560347d95549e685d01ce46190a))
* **tests:** use cross-platform paths in path-resolver tests ([9603889](https://github.com/mrgoonie/claudekit-cli/commit/9603889e5a35f0edaf61371ca8a50c27175bfeae))
* **update:** handle 'latest' as special value for --release flag ([610cdff](https://github.com/mrgoonie/claudekit-cli/commit/610cdff5b608534c9700dbb3da7fb7598a1df3f3))
* **update:** rename --version to --release to avoid CLI flag conflict ([52bb022](https://github.com/mrgoonie/claudekit-cli/commit/52bb022fd0c3bf4e0f887b4fc3da65c8fe958ce1))


### Features

* **install:** add manifest tracking for accurate uninstall ([44b6352](https://github.com/mrgoonie/claudekit-cli/commit/44b6352ede9c7eb4b185b7d59956f5f81a9fa3a9))
* **uninstall:** add scope selection for local/global uninstall ([5dcba2a](https://github.com/mrgoonie/claudekit-cli/commit/5dcba2aa16080cbc7db36858f5f64e85b6803351))


### BREAKING CHANGES

* **cli:** The --version flag for specifying release version in
`ck new` and `ck init` commands is now --release (-r) to avoid conflict
with the global -V/--version flag.

Changes:
- Rename --version <ver> to --release (-r) <ver> in new/init commands
- Fix test isolation by using CK_TEST_HOME in claudekit-scanner
- Update uninstall tests to use setupTestPaths() helper

## [1.16.1](https://github.com/mrgoonie/claudekit-cli/compare/v1.16.0...v1.16.1) (2025-11-26)


### Bug Fixes

* **global-path-transformer:** use platform-appropriate home paths for Windows compatibility ([d5dc75e](https://github.com/mrgoonie/claudekit-cli/commit/d5dc75e263006032ed3f768d3e24d50ea81ac933))

# [1.16.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.15.1...v1.16.0) (2025-11-25)


### Bug Fixes

* **global-init:** correct pattern matching for .claude subdirectories in selective mode ([83bb309](https://github.com/mrgoonie/claudekit-cli/commit/83bb309fad995751ec413abe91b44498794fb1eb))
* **tests:** rewrite version management tests to prevent mock pollution ([c66c889](https://github.com/mrgoonie/claudekit-cli/commit/c66c88907d5c007d11a2b914b82684a8703b0538))


### Features

* add interactive version selection UI with enhanced release management ([da2832a](https://github.com/mrgoonie/claudekit-cli/commit/da2832a2b6c3d77bbc316f313bbe913fb9cba79e))
* global path resolution and doctor improvements ([#94](https://github.com/mrgoonie/claudekit-cli/issues/94)) ([51ddb73](https://github.com/mrgoonie/claudekit-cli/commit/51ddb7355e4a96d9a4323361f788cbf57745058f))

## [1.15.1](https://github.com/mrgoonie/claudekit-cli/compare/v1.15.0...v1.15.1) (2025-11-24)


### Bug Fixes

* copy CLAUDE.md to global directory during installation ([3aaa9b2](https://github.com/mrgoonie/claudekit-cli/commit/3aaa9b22c6e9b0897f8d060ebe7dcc375886eb04))
* interactive script issue on powershell window ([0f6927e](https://github.com/mrgoonie/claudekit-cli/commit/0f6927ea0b784a474168fe3db1fd71ae5262ce5d))

# [1.15.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.14.3...v1.15.0) (2025-11-23)


### Bug Fixes

* **merge:** implement two-tier protected files system and eliminate duplication ([6f0a318](https://github.com/mrgoonie/claudekit-cli/commit/6f0a3187bac8fa1501f1fc0c51525d6532e64352))
* preserve user config files during init ([eaf48e2](https://github.com/mrgoonie/claudekit-cli/commit/eaf48e2646ce545fdd8c59762ddf528acce45564))
* **security:** add safeguards to skills installation script execution ([4b71408](https://github.com/mrgoonie/claudekit-cli/commit/4b714083dec8180a59ab8612c1933febef005c73)), closes [#90](https://github.com/mrgoonie/claudekit-cli/issues/90)
* **test:** convert isCIEnvironment to function for test reliability ([b3fa8b5](https://github.com/mrgoonie/claudekit-cli/commit/b3fa8b58e067b460b23e6a94f531d4846b76f238))
* **test:** remove real GitHub API calls from github.test.ts ([955766f](https://github.com/mrgoonie/claudekit-cli/commit/955766f3517cb4dee6abd0a1f125ec9dc712215f))
* **test:** remove unused mock import from package-installer tests ([b4e20cf](https://github.com/mrgoonie/claudekit-cli/commit/b4e20cfe8873eba12c79809bdf7e0853a4629706))
* **test:** resolve Windows CI timeout in github tests ([a91755a](https://github.com/mrgoonie/claudekit-cli/commit/a91755a13450f4f0e1221484535893b1ea32db3a))
* **tests:** resolve TypeScript type errors across test files ([e71d30f](https://github.com/mrgoonie/claudekit-cli/commit/e71d30fe1ade2b25720e80fec3a6509136a90ab3))
* **test:** unset CI_SAFE_MODE in tests to fix CI failures ([9130929](https://github.com/mrgoonie/claudekit-cli/commit/9130929573b7e149faba55c23940743e113ab077))
* use initialValue for directory prompt default ([248c781](https://github.com/mrgoonie/claudekit-cli/commit/248c781424d8a0b4b9683f4d0f95c02c82085923))


### Features

* add --beta flag to download prerelease versions from GitHub ([c43d092](https://github.com/mrgoonie/claudekit-cli/commit/c43d092b3badf546ff9ade1f930abd0e2a451b73))
* **skills:** add --install-skills flag and integrate with doctor command ([895e752](https://github.com/mrgoonie/claudekit-cli/commit/895e752783a33115a2e1663788562b466d9c0fd2))
* **skills:** add optional installation prompt to new and init commands ([5151064](https://github.com/mrgoonie/claudekit-cli/commit/515106489f09355df9629c0733a72161ee7cf287))

## [1.14.3](https://github.com/mrgoonie/claudekit-cli/compare/v1.14.2...v1.14.3) (2025-11-17)


### Bug Fixes

* Windows CI test failure and permission errors ([4bd3b5b](https://github.com/mrgoonie/claudekit-cli/commit/4bd3b5b9c92c4bc2377595925ff250a7b8b79742))

## [1.14.2](https://github.com/mrgoonie/claudekit-cli/compare/v1.14.1...v1.14.2) (2025-11-17)


### Bug Fixes

* allow windows paths and add CI coverage ([1089326](https://github.com/mrgoonie/claudekit-cli/commit/10893263e775266df69cb7e6a84e78e1a313aab6))
* normalize file scanner paths on windows ([96c4f1e](https://github.com/mrgoonie/claudekit-cli/commit/96c4f1e6f00e3b3153f7d63f45aed59caa628865))
* window ci issues ([124ccc7](https://github.com/mrgoonie/claudekit-cli/commit/124ccc7aa81851d20851683427085da235de10cd))

## [1.14.1](https://github.com/mrgoonie/claudekit-cli/compare/v1.14.0...v1.14.1) (2025-11-16)


### Bug Fixes

* **uninstall:** preserve user configs during uninstall and fresh install ([20786b3](https://github.com/mrgoonie/claudekit-cli/commit/20786b39077275f2c738dd09d79ef28127d0fe01)), closes [#82](https://github.com/mrgoonie/claudekit-cli/issues/82)

# [1.14.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.13.0...v1.14.0) (2025-11-16)


### Features

* **commands:** add uninstall command to remove ClaudeKit installations ([170277b](https://github.com/mrgoonie/claudekit-cli/commit/170277b27312129732c273fbd3a134eb2285462e))
* **init:** add --fresh flag to completely reinstall claude directory ([3dac070](https://github.com/mrgoonie/claudekit-cli/commit/3dac0708e31eb3d02e2f3a027789feedbf615c4f))

# [1.13.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.12.3...v1.13.0) (2025-11-16)


### Bug Fixes

* incorrect hook path in global settings.json template when using `--global` flag ([e9cd67a](https://github.com/mrgoonie/claudekit-cli/commit/e9cd67a90302e733a05423a53bf6d618b0041e62)), closes [#75](https://github.com/mrgoonie/claudekit-cli/issues/75)
* print npm instead of bun ([ed63b53](https://github.com/mrgoonie/claudekit-cli/commit/ed63b531a646031d8241cc012887a8aee693784c))


### Features

* **commands:** implement --prefix flag for /ck: slash command namespace ([#79](https://github.com/mrgoonie/claudekit-cli/issues/79)) ([db0bbe3](https://github.com/mrgoonie/claudekit-cli/commit/db0bbe3d86e4986cac77d30df9f85e245dd333b0))

## [1.12.3](https://github.com/mrgoonie/claudekit-cli/compare/v1.12.2...v1.12.3) (2025-11-13)


### Bug Fixes

* `--version` show new version notification ([fff8d17](https://github.com/mrgoonie/claudekit-cli/commit/fff8d17ba17d7f872bb46e190d3df22179ac0886))
* pin bun version to 1.3.2 across all workflows and package.json ([9a329d6](https://github.com/mrgoonie/claudekit-cli/commit/9a329d66c57656cf82a0508298ae6ca2ea0f5cb0))
* version cache ([2a1ced6](https://github.com/mrgoonie/claudekit-cli/commit/2a1ced642dbb303542610da142adb127d9b1a8d0))

## [1.12.2](https://github.com/mrgoonie/claudekit-cli/compare/v1.12.1...v1.12.2) (2025-11-13)


### Bug Fixes

* correct windows user-scope directory ([fe3fb17](https://github.com/mrgoonie/claudekit-cli/commit/fe3fb170567e1be0946493480f14f848fd81d846))

## [1.12.1](https://github.com/mrgoonie/claudekit-cli/compare/v1.12.0...v1.12.1) (2025-11-13)


### Bug Fixes

* correct Windows app directory of global installation ([8be84e8](https://github.com/mrgoonie/claudekit-cli/commit/8be84e8e040011fc7aaa4e990cbd4ec55d4e1c1c))

# [1.12.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.11.0...v1.12.0) (2025-11-12)


### Bug Fixes

* **merge:** add symlink detection to prevent directory traversal ([4cdc509](https://github.com/mrgoonie/claudekit-cli/commit/4cdc509456d2985dd59581dec6aace43cfe95bd8)), closes [#67](https://github.com/mrgoonie/claudekit-cli/issues/67)
* **merge:** enable directory traversal for include patterns ([4b01067](https://github.com/mrgoonie/claudekit-cli/commit/4b01067a2401fb6943d11e7e54b2dca00c7bb6c0)), closes [#26](https://github.com/mrgoonie/claudekit-cli/issues/26)


### Features

* add `--global` flag ([e516457](https://github.com/mrgoonie/claudekit-cli/commit/e516457867d75e0ff80855ee05fa1ae5241e5ddd))
* **cli:** fix global flag and rename update to init ([548877a](https://github.com/mrgoonie/claudekit-cli/commit/548877af94e3f172945fb1e9ea1bebaabcd3e5b6))

# [1.11.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.10.0...v1.11.0) (2025-11-07)


### Bug Fixes

* add CI environment detection to dependency-checker and diagnose ([0b1bc6e](https://github.com/mrgoonie/claudekit-cli/commit/0b1bc6ef3b5e07dc75275dfc03cf6a9fe6d01563))
* address Claude review security and performance concerns ([6f540d0](https://github.com/mrgoonie/claudekit-cli/commit/6f540d0f7fc2dfe47aacb74efca655f08222838a))
* optimize package detection to prevent CI timeouts ([965eff3](https://github.com/mrgoonie/claudekit-cli/commit/965eff3fcf15ea5f6ac4d67ffa4cca0e9a12e02f))
* resolve CI workflow failures in PR [#56](https://github.com/mrgoonie/claudekit-cli/issues/56) ([45987ec](https://github.com/mrgoonie/claudekit-cli/commit/45987ec4a1db45ddd9fc42bab12e9c4c185ada48))
* resolve linting issues in CI environment ([6b9af7b](https://github.com/mrgoonie/claudekit-cli/commit/6b9af7bbda3ded1b12b59e7d4d0cfe95d12064be))
* **skills:** handle nested file structures in skills migration ([3ea37db](https://github.com/mrgoonie/claudekit-cli/commit/3ea37db5a72798d6db4862dc35ca66ba17fc11c7))
* **skills:** implement PR[#55](https://github.com/mrgoonie/claudekit-cli/issues/55) security and performance fixes ([58815c5](https://github.com/mrgoonie/claudekit-cli/commit/58815c5c17006d8970fc5f09917481e640cb8c09))
* **skills:** resolve TypeScript unused variable error ([93c6bdd](https://github.com/mrgoonie/claudekit-cli/commit/93c6bdd0c2bce8002db7d361248c0d90ed642c43))
* update diagnose tests for CI environment ([b2705e9](https://github.com/mrgoonie/claudekit-cli/commit/b2705e93fbd00bf55fa25144bce6cb9f658a412f))
* update package installer with correct OpenCode and Gemini CLI packages ([31694e1](https://github.com/mrgoonie/claudekit-cli/commit/31694e114cf95cee303f2bed935239329739327f))
* use correct official OpenCode installation URL ([5d9161c](https://github.com/mrgoonie/claudekit-cli/commit/5d9161c0afb7090cb43e69b1c1ccc68834fe4370))


### Features

* enhance OS detection for end-users with platform-specific CI handling ([e2ca9a7](https://github.com/mrgoonie/claudekit-cli/commit/e2ca9a76e136e8f6462475cd7a413e1084575c62))
* **skills:** implement comprehensive skills migration system ([b0c2e13](https://github.com/mrgoonie/claudekit-cli/commit/b0c2e139929d383a517104b1a2e29e8160ff204a))

# [1.10.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.9.3...v1.10.0) (2025-11-06)


### Bug Fixes

* **skills:** handle nested file structures in skills migration ([6a982c0](https://github.com/mrgoonie/claudekit-cli/commit/6a982c05899d8f900426c34007671e8bac22e640))
* **skills:** implement PR[#55](https://github.com/mrgoonie/claudekit-cli/issues/55) security and performance fixes ([20ca88d](https://github.com/mrgoonie/claudekit-cli/commit/20ca88dd71b793126e98277d74d74c566a7c8d97))
* **skills:** resolve TypeScript unused variable error ([e322e9f](https://github.com/mrgoonie/claudekit-cli/commit/e322e9fd45ebd9067939237cba25fb3ce68010fe))


### Features

* **skills:** implement comprehensive skills migration system ([3161fbe](https://github.com/mrgoonie/claudekit-cli/commit/3161fbe7615a6fdf6cb282029c2109a54586b5fe))

## [1.9.3](https://github.com/mrgoonie/claudekit-cli/compare/v1.9.2...v1.9.3) (2025-11-06)


### Bug Fixes

* `ck -v` shows both cli and kit version ([ed5f947](https://github.com/mrgoonie/claudekit-cli/commit/ed5f947c837e3474570b39055119de7a655a0615))
* apply biome linting fixes to scripts ([28920a6](https://github.com/mrgoonie/claudekit-cli/commit/28920a685155b6eb78d2845d38b37b6040f497c0))
* **ci:** prevent committing large binaries to git ([db92d61](https://github.com/mrgoonie/claudekit-cli/commit/db92d61df5e7997a44341f9971544c71ab30634d))
* import order ([5aa1a9a](https://github.com/mrgoonie/claudekit-cli/commit/5aa1a9a3c5aa4f8e392e576e2e01fe18ce744820))
* resolve version discrepancy issue [#44](https://github.com/mrgoonie/claudekit-cli/issues/44) ([b8b229b](https://github.com/mrgoonie/claudekit-cli/commit/b8b229b5444615b4120bb26bac569953ecefb47c))
* use ES module export syntax in semantic-release plugin ([6850cec](https://github.com/mrgoonie/claudekit-cli/commit/6850cecca03996afd51197f606f1294f0db981d5))

## [1.9.2](https://github.com/mrgoonie/claudekit-cli/compare/v1.9.1...v1.9.2) (2025-11-05)


### Bug Fixes

* add automated platform binary build process ([c7759a1](https://github.com/mrgoonie/claudekit-cli/commit/c7759a188aab11aaab40f14196e3de1784e992d1)), closes [#44](https://github.com/mrgoonie/claudekit-cli/issues/44)
* address Claude review security and quality concerns ([7f3ebba](https://github.com/mrgoonie/claudekit-cli/commit/7f3ebbad4928f5f45c1a1b9a7aee68f84d2a7d38))
* address remaining Claude review feedback ([1e21c59](https://github.com/mrgoonie/claudekit-cli/commit/1e21c5962ad36e893b422fba37b698dff4d0bdcc))
* quote shell variable to prevent word splitting ([87e25eb](https://github.com/mrgoonie/claudekit-cli/commit/87e25eb86057ea285d100e3750219b44b97aea8f))
* resolve lint issues in build script ([1f6d8c2](https://github.com/mrgoonie/claudekit-cli/commit/1f6d8c27d4a62339dae0971fe23cd5c5253cb4f6))


### Performance Improvements

* optimize workflows for speed & quality (fixes [#21](https://github.com/mrgoonie/claudekit-cli/issues/21)) ([3a4b423](https://github.com/mrgoonie/claudekit-cli/commit/3a4b42335925c6bccfcb465365353ffa1fed493b))

## [1.9.1](https://github.com/mrgoonie/claudekit-cli/compare/v1.9.0...v1.9.1) (2025-11-04)


### Bug Fixes

* change npm registry from GitHub Packages to npmjs.org ([93e70e9](https://github.com/mrgoonie/claudekit-cli/commit/93e70e966c4b9c7dff2bf6ec3fe92f423195b21a))
* resolve semantic-release skipping version bump ([ce9f96f](https://github.com/mrgoonie/claudekit-cli/commit/ce9f96f05c1851d7e6d08f24fa1d5eb150d96ace))

# [1.9.0](https://github.com/mrgoonie/claudekit-cli/compare/v1.8.1...v1.9.0) (2025-11-04)


### Bug Fixes

* ensure Linux label in Python installation instructions for CI tests ([6343184](https://github.com/mrgoonie/claudekit-cli/commit/63431844432a951be2cca76c9a3f3131d2e37c0c))
* format package.json keywords array to single line ([0505954](https://github.com/mrgoonie/claudekit-cli/commit/0505954abbee02b7d6c0558a6978851de9a37de7))
* resolve CI hanging issue in doctor command tests ([0d652ec](https://github.com/mrgoonie/claudekit-cli/commit/0d652ec0a06ff2f16f9b851a44a1428d5a1d9617))


### Features

* add dependency checking and auto-installation to doctor command ([dc44892](https://github.com/mrgoonie/claudekit-cli/commit/dc4489266c08653a8d009b135435c60921368a5a))

## [1.8.1](https://github.com/mrgoonie/claudekit-cli/compare/v1.8.0...v1.8.1) (2025-11-04)


### Bug Fixes

* resolve CI/CD pipeline issues for GitHub Packages publishing ([2c3b87b](https://github.com/mrgoonie/claudekit-cli/commit/2c3b87bdd434e09236b1bada9466ce017436d285))

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
