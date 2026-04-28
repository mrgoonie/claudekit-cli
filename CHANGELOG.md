## [3.42.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.42.0...v3.42.1) (2026-04-28)

### 🔥 Hotfixes

* **release:** enforce Discord 6000-char embed limit and surface webhook errors ([9913504](https://github.com/mrgoonie/claudekit-cli/commit/9913504f0a365bfa3261a2668bbdd2c34cb22a2f))
* **release:** pin Discord field count below 25 to make room for pointer ([93cf75e](https://github.com/mrgoonie/claudekit-cli/commit/93cf75eea1596fde21fef16e4bcd6ee21317d2ce)), closes [#751](https://github.com/mrgoonie/claudekit-cli/issues/751)

## [3.42.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.41.4...v3.42.0) (2026-04-28)

### 🚀 Features

* add metadata-deletions-check CI gate and CLAUDE.md quality rules ([15580ab](https://github.com/mrgoonie/claudekit-cli/commit/15580ab0581b5c3392929734fa95711b8ac1b3b3)), closes [#601](https://github.com/mrgoonie/claudekit-cli/issues/601) [#605](https://github.com/mrgoonie/claudekit-cli/issues/605) [#600](https://github.com/mrgoonie/claudekit-cli/issues/600)
* add release-dry-run CI gate for npm package validation ([491c2de](https://github.com/mrgoonie/claudekit-cli/commit/491c2dec275c51e31ebd8daa4c204398b014b3e9)), closes [#602](https://github.com/mrgoonie/claudekit-cli/issues/602) [#600](https://github.com/mrgoonie/claudekit-cli/issues/600)
* **app:** add --dev/--stable flags to ck app with channel auto-detect ([1b664ea](https://github.com/mrgoonie/claudekit-cli/commit/1b664ea4fabf8d70eb6074ee4103c4c0a1ceb5e8)), closes [#703](https://github.com/mrgoonie/claudekit-cli/issues/703)
* **cli:** support provider-aware image onboarding ([d1c9afc](https://github.com/mrgoonie/claudekit-cli/commit/d1c9afcaebaf0bdcca5dd8935732d8a343ef4774))
* **codex:** add capability-gated hook compatibility layer ([fd341de](https://github.com/mrgoonie/claudekit-cli/commit/fd341de07578915494f30c7a44197028689d4bdd)), closes [#730](https://github.com/mrgoonie/claudekit-cli/issues/730)
* **config:** default simplify-gate to opt-in (off by default) ([18449dc](https://github.com/mrgoonie/claudekit-cli/commit/18449dc08dbcaad787bc0a13498db45c1020e283))
* **config:** simplify-gate CLI parity (closes [#705](https://github.com/mrgoonie/claudekit-cli/issues/705)) ([5db437e](https://github.com/mrgoonie/claudekit-cli/commit/5db437e8b36a1d427e324965e7ddb26d4e9613b3)), closes [#676](https://github.com/mrgoonie/claudekit-cli/issues/676)
* **dashboard:** add agents browser with card grid and model filter ([#625](https://github.com/mrgoonie/claudekit-cli/issues/625)) ([265ad17](https://github.com/mrgoonie/claudekit-cli/commit/265ad177a40f705d2711ed68e26de20bf0396940))
* **dashboard:** add commands browser with tree view ([#626](https://github.com/mrgoonie/claudekit-cli/issues/626)) ([e3fcc76](https://github.com/mrgoonie/claudekit-cli/commit/e3fcc76304671c66c45ec4e28a782bb052f7b164))
* **dashboard:** add home dashboard, session browser, enhanced sidebar, and global search ([0cca53d](https://github.com/mrgoonie/claudekit-cli/commit/0cca53d52380ced9e45bef69010abacedd90683c)), closes [#631](https://github.com/mrgoonie/claudekit-cli/issues/631) [#622](https://github.com/mrgoonie/claudekit-cli/issues/622) [#623](https://github.com/mrgoonie/claudekit-cli/issues/623) [#624](https://github.com/mrgoonie/claudekit-cli/issues/624) [#629](https://github.com/mrgoonie/claudekit-cli/issues/629)
* **dashboard:** add MCP server status view with multi-source discovery ([#628](https://github.com/mrgoonie/claudekit-cli/issues/628)) ([5b0bf89](https://github.com/mrgoonie/claudekit-cli/commit/5b0bf897b2d490e43bbf4cbeb05ee5f55594d71c))
* **dashboard:** add skills browser with card grid ([#627](https://github.com/mrgoonie/claudekit-cli/issues/627)) ([197e487](https://github.com/mrgoonie/claudekit-cli/commit/197e487085887393f0835c33d8ee22b0a382f803))
* **dashboard:** enhance system dashboard with hook diagnostics and activity metrics ([#630](https://github.com/mrgoonie/claudekit-cli/issues/630)) ([36c9d18](https://github.com/mrgoonie/claudekit-cli/commit/36c9d18b7e7a2f21fa01d63ed1539d5611a8b81f))
* **dashboard:** make session items clickable — navigate to read-only session detail view ([17aa5d7](https://github.com/mrgoonie/claudekit-cli/commit/17aa5d7e3647d79678ab33342e8816540b8c672c))
* **desktop:** add ck app launcher command ([bccbbcf](https://github.com/mrgoonie/claudekit-cli/commit/bccbbcfe90d2603ee5430da947cbcd55f41c8227))
* **desktop:** add first-run onboarding flow ([c2ad348](https://github.com/mrgoonie/claudekit-cli/commit/c2ad348d04e0626669fb6b6322b36afe74bd0577))
* **desktop:** add native tray recent project actions ([81437ef](https://github.com/mrgoonie/claudekit-cli/commit/81437ef5f5705e5b097d266eaeff052d2669b392))
* **desktop:** add phase 1 rust backend core ([fb9b5ae](https://github.com/mrgoonie/claudekit-cli/commit/fb9b5ae3f8fee8326454f8068deb51c8aee1e0a1))
* **desktop:** add Phase 3 distribution pipeline ([e6bf265](https://github.com/mrgoonie/claudekit-cli/commit/e6bf26557fcdec5411d1c5d5994d2f9fb81ae059))
* **desktop:** add Tauri frontend deps, typed command bindings, updater hook ([5e9e85c](https://github.com/mrgoonie/claudekit-cli/commit/5e9e85c503ab7a623d210c85e7e712c4986d3722))
* **desktop:** channel-aware release manifest schema and resolver ([4ada573](https://github.com/mrgoonie/claudekit-cli/commit/4ada573dc2806b9ff228c5b3d2668bc8893efe2d)), closes [#703](https://github.com/mrgoonie/claudekit-cli/issues/703)
* **desktop:** convert scan_for_projects to async with spawn_blocking ([a270b46](https://github.com/mrgoonie/claudekit-cli/commit/a270b469e55bdf1e0c76a3d2f75de90137c97f4f))
* **desktop:** implement phase 2 frontend dual-mode wiring ([9c14861](https://github.com/mrgoonie/claudekit-cli/commit/9c1486164526633cabdcffd743a0993da242ffa0))
* **desktop:** integrate config commands, system tray, projects, and CI ([94be276](https://github.com/mrgoonie/claudekit-cli/commit/94be276567afad3028caba398ba5e2e5c2f644de)), closes [#586](https://github.com/mrgoonie/claudekit-cli/issues/586) [#588](https://github.com/mrgoonie/claudekit-cli/issues/588) [#589](https://github.com/mrgoonie/claudekit-cli/issues/589) [#590](https://github.com/mrgoonie/claudekit-cli/issues/590) [#591](https://github.com/mrgoonie/claudekit-cli/issues/591)
* **desktop:** regenerate icon bundle for v0.1.0-dev.2 ([949d1f4](https://github.com/mrgoonie/claudekit-cli/commit/949d1f426c9afb0db84b6fe69790176338690596))
* **desktop:** remove express dependency from tauri mode ([4623d14](https://github.com/mrgoonie/claudekit-cli/commit/4623d147d09a44684de633c551c0d7e4af8d94ea))
* **desktop:** scaffold Tauri v2 shell for Control Center ([fa8bd69](https://github.com/mrgoonie/claudekit-cli/commit/fa8bd6945fc867d436b969b31165ffdf6472c4f1)), closes [#587](https://github.com/mrgoonie/claudekit-cli/issues/587)
* **desktop:** wire tray events into the app shell ([0c143f8](https://github.com/mrgoonie/claudekit-cli/commit/0c143f80a58af007fb616f7512d7422c0ca1a49e))
* **health:** expose dashboard feature flags via /api/health ([24fd072](https://github.com/mrgoonie/claudekit-cli/commit/24fd072057acf1aa3cb509901de06a344ac2ad1f)), closes [#732](https://github.com/mrgoonie/claudekit-cli/issues/732)
* **help:** comprehensive --help coverage + agent-facing CLI docs ([6d0a0ad](https://github.com/mrgoonie/claudekit-cli/commit/6d0a0adc5780026936baaeaaa2a32567542cc372)), closes [#726](https://github.com/mrgoonie/claudekit-cli/issues/726)
* **i18n:** add translations for plans dashboard modernization ([1ed3e66](https://github.com/mrgoonie/claudekit-cli/commit/1ed3e66096e272845ae87d114b272d586903e29e))
* **migrate:** add Kiro IDE as migration target ([#656](https://github.com/mrgoonie/claudekit-cli/issues/656)) ([44d3d27](https://github.com/mrgoonie/claudekit-cli/commit/44d3d27db90d12b3cb7166a8fe94a0bcd9ce4994)), closes [#655](https://github.com/mrgoonie/claudekit-cli/issues/655)
* **migrate:** end-to-end UX redesign with ck-cli-design primitives ([264b6e2](https://github.com/mrgoonie/claudekit-cli/commit/264b6e238f3082218ddb39c585cd1b66d896dd60))
* **migrate:** full Gemini CLI migration support (tool calls, hooks, rules) ([53faa19](https://github.com/mrgoonie/claudekit-cli/commit/53faa19a8413277e2c18e63b09bd3a286ebe2f27)), closes [#671](https://github.com/mrgoonie/claudekit-cli/issues/671)
* **migrate:** interactive prompt + auth-aware default model for opencode ([c6534f6](https://github.com/mrgoonie/claudekit-cli/commit/c6534f62a7945b031e62cfc32f1d7947e142fec8))
* **migrate:** reconciler + dashboard UX overhaul — reinstall semantics, clear reasons, opt-in install mode ([#737](https://github.com/mrgoonie/claudekit-cli/issues/737)) ([1ba6105](https://github.com/mrgoonie/claudekit-cli/commit/1ba6105d5413a48a121241e8e17af3e98c9f34c7)), closes [#736](https://github.com/mrgoonie/claudekit-cli/issues/736) [#736](https://github.com/mrgoonie/claudekit-cli/issues/736) [#736](https://github.com/mrgoonie/claudekit-cli/issues/736) [#736](https://github.com/mrgoonie/claudekit-cli/issues/736) [#736](https://github.com/mrgoonie/claudekit-cli/issues/736) [#736](https://github.com/mrgoonie/claudekit-cli/issues/736)
* **plan:** add scoped global plans and dashboard context ([95fdb57](https://github.com/mrgoonie/claudekit-cli/commit/95fdb57dabccfd40d0a666b374bb9d957746317f))
* **plan:** detect and warn on self-referencing plan dependencies ([500de05](https://github.com/mrgoonie/claudekit-cli/commit/500de05d8ecefd7d2268c89500ced86e96589e2c))
* **plans:** add CLI-strict plan tracking with registry and telemetry ([c5077eb](https://github.com/mrgoonie/claudekit-cli/commit/c5077ebc69b3b7c4536d954c62d6dcf3eec3ac7f))
* **plans:** add integrated dashboard to config ui ([8ca9ed8](https://github.com/mrgoonie/claudekit-cli/commit/8ca9ed8095d327e9785972bdef2b83b9338bb288))
* relocate plans-registry.json to global ~/.claude/plans-registries/ ([0ced1f8](https://github.com/mrgoonie/claudekit-cli/commit/0ced1f80a077596922a954bd049dca96ab53b210)), closes [#694](https://github.com/mrgoonie/claudekit-cli/issues/694)
* **skills:** add skill catalog generation, inline BM25 search, and dashboard integration ([d81184b](https://github.com/mrgoonie/claudekit-cli/commit/d81184bb4f2fabcc8839b6b1c1b985c667363930)), closes [mrgoonie/claudekit-cli#644](https://github.com/mrgoonie/claudekit-cli/issues/644) [mrgoonie/claudekit-cli#645](https://github.com/mrgoonie/claudekit-cli/issues/645)
* **skills:** unify category taxonomy and vendor skill-schema.json ([6ac3052](https://github.com/mrgoonie/claudekit-cli/commit/6ac30523844b364cf814ba7b3b95c570fb8f1e53)), closes [#646](https://github.com/mrgoonie/claudekit-cli/issues/646) [#647](https://github.com/mrgoonie/claudekit-cli/issues/647)
* **ui:** add human-readable labels with tier info to Gemini model dropdown ([a5492a2](https://github.com/mrgoonie/claudekit-cli/commit/a5492a255bfb990ba17f367bc80a8f9d3f73274b)), closes [#583](https://github.com/mrgoonie/claudekit-cli/issues/583)
* **ui:** make Gemini model field editable with combobox pattern ([3ea53e5](https://github.com/mrgoonie/claudekit-cli/commit/3ea53e5a321018233fec3c5470516f418d270b91))
* **ui:** modernize plans dashboard with double-bezel design and 2-column layout ([c6764d0](https://github.com/mrgoonie/claudekit-cli/commit/c6764d01397e352a5dc167cd01bbb7ed4fa30ac8))
* **ui:** multi-skill detection and Skill tool_use styling in session detail ([ae46bb7](https://github.com/mrgoonie/claudekit-cli/commit/ae46bb7a09a77c7670eb87ba3d0beed8a89400e2))
* **ui:** refine heatmap grid with temporal labels and fixed cell sizing ([1900820](https://github.com/mrgoonie/claudekit-cli/commit/1900820f66dbf3fab5a179afb6373dfb136122d0))
* **ui:** session detail v1 — markdown rendering, tool inputs, collapsible cards ([0a52829](https://github.com/mrgoonie/claudekit-cli/commit/0a528297336b9715a0d5c0dea966789efb5a52b8))
* **ui:** session detail v2 — content block model, tool-specific rendering, search ([43e88d4](https://github.com/mrgoonie/claudekit-cli/commit/43e88d436bba04598267c3c25593c1d88e5b27f8))
* **workflows:** add react flow dependency and core data models ([5994ead](https://github.com/mrgoonie/claudekit-cli/commit/5994eadffe4594ac1e72f954520ac1f0727d3337))
* **workflows:** implement visualization dashboard UI ([5c28528](https://github.com/mrgoonie/claudekit-cli/commit/5c2852867ea963f64478624f5b28f8f93a838dd7))
* **workflows:** integrate workflows page into router and sidebar ([59dbdd4](https://github.com/mrgoonie/claudekit-cli/commit/59dbdd447391936665eea14f14c34609186f530b))

### 🔥 Hotfixes

* **hooks:** self-heal stale Claude hook command paths ([6777d30](https://github.com/mrgoonie/claudekit-cli/commit/6777d303968f7fe1f5ea9246733c4e1f27f65d0d))
* remove stale prefixed command duplicates on upgrade ([bfd5777](https://github.com/mrgoonie/claudekit-cli/commit/bfd5777a8611cddb859588f6f2eee4ae9d2ab35e))
* **uninstall:** sync preserved metadata retention to dev ([04fe39f](https://github.com/mrgoonie/claudekit-cli/commit/04fe39ffdfeeaad02e26c8c0883c6c15ff59a295)), closes [#619](https://github.com/mrgoonie/claudekit-cli/issues/619)

### 🐞 Bug Fixes

* **action:** allow discovered projects on external volumes ([9da77a6](https://github.com/mrgoonie/claudekit-cli/commit/9da77a6a92b68bfc18887ce7428d7764ecfe2794)), closes [#613](https://github.com/mrgoonie/claudekit-cli/issues/613)
* add backup management commands and retention ([553452b](https://github.com/mrgoonie/claudekit-cli/commit/553452b57afec82efe3b8694d36fe49069ee2674))
* add quotaLow/quotaHigh to StatuslineThemeSchema ([383fa92](https://github.com/mrgoonie/claudekit-cli/commit/383fa9202066e091f39d0730890c48800107f7c3)), closes [mrgoonie/claudekit-cli#674](https://github.com/mrgoonie/claudekit-cli/issues/674)
* address adversarial review findings for Gemini CLI migration ([97f387c](https://github.com/mrgoonie/claudekit-cli/commit/97f387c0ea6bfc1255e024fc743c8c2402782eff))
* address all 8 code review findings from PR [#636](https://github.com/mrgoonie/claudekit-cli/issues/636) ([aff38b6](https://github.com/mrgoonie/claudekit-cli/commit/aff38b64d130c336aefa63017830b3730ec04fe1))
* address PR [#696](https://github.com/mrgoonie/claudekit-cli/issues/696) review feedback for global plans registry ([b1f3742](https://github.com/mrgoonie/claudekit-cli/commit/b1f37429182078d5f7e3f9a0c7859ff31d0aa84c))
* address PR review feedback for Gemini CLI migration ([88c1e7f](https://github.com/mrgoonie/claudekit-cli/commit/88c1e7fc99a8c3bb212eb963ff7742bceb9bea9f))
* address round-2 review — dead code, parallel fetches, file-size guard ([7fbfde3](https://github.com/mrgoonie/claudekit-cli/commit/7fbfde3341c96b9520ccd9c081de48550e5acb57))
* always emit $HOME in path transformer (drop %USERPROFILE% on Windows) ([3924353](https://github.com/mrgoonie/claudekit-cli/commit/3924353fd8b44584778ebdfe539af36b0080f243)), closes [#715](https://github.com/mrgoonie/claudekit-cli/issues/715)
* **app:** skip no-op desktop updates when already current ([4b458e0](https://github.com/mrgoonie/claudekit-cli/commit/4b458e0f4dacb616987f864e204a13abe2483e55))
* back up destructive fresh and uninstall operations ([3f75cf6](https://github.com/mrgoonie/claudekit-cli/commit/3f75cf6f3614b7ab5a93ad4f78392b0dd184e8e2))
* **ci:** address PR 725 review follow-ups ([be3e2bb](https://github.com/mrgoonie/claudekit-cli/commit/be3e2bb395e0e91f39218cabaeb42063acd4195d))
* **ci:** ignore PR ref names in desktop sync checks ([0a634e4](https://github.com/mrgoonie/claudekit-cli/commit/0a634e419ed7b5dec2a855cc961ccff3fe65e69b))
* **ci:** run desktop sync preflight with bash on windows ([346218e](https://github.com/mrgoonie/claudekit-cli/commit/346218e63fdcd9b7a861adf20600e6e0af5dc0ac))
* clear CK_TEST_HOME in settings-processor tests to prevent CI env leakage ([95f71fe](https://github.com/mrgoonie/claudekit-cli/commit/95f71fee104a0bb3d094d94b1d63f96ea9a9e127))
* **cli:** address provider onboarding review notes ([70bdb5d](https://github.com/mrgoonie/claudekit-cli/commit/70bdb5d6a74ddd901162e5eeed6ea8c4da1613fe))
* **cli:** finalize provider-aware setup flow ([e1c2bff](https://github.com/mrgoonie/claudekit-cli/commit/e1c2bff3330b9511b46e1ed05edfe6133239e33b))
* **cli:** validate configured image providers ([c656667](https://github.com/mrgoonie/claudekit-cli/commit/c656667ba33817b9207cbc4f63dff25360902d7b))
* **codex:** address PR [#735](https://github.com/mrgoonie/claudekit-cli/issues/735) review — insert at section end, rename tests ([15a2dda](https://github.com/mrgoonie/claudekit-cli/commit/15a2dda9b263994239a68adfc5312155d0430f7b))
* **codex:** address PR [#744](https://github.com/mrgoonie/claudekit-cli/issues/744) review feedback ([92c4ccf](https://github.com/mrgoonie/claudekit-cli/commit/92c4ccf9dfdc27bde71269e1188ace857bf356ef))
* **codex:** address review feedback on hook compat layer ([b711379](https://github.com/mrgoonie/claudekit-cli/commit/b711379cdef5c4cffd950bb3e45f12c5dda577fd))
* **codex:** index wrapper substitution map by source path, not target ([053fef0](https://github.com/mrgoonie/claudekit-cli/commit/053fef03fc75ce9c8eed37e4e6f533177e7d50ef))
* **codex:** merge codex_hooks into existing [features] section; self-heal duplicates ([3c352a3](https://github.com/mrgoonie/claudekit-cli/commit/3c352a3f42bbeada1b32fbb52c93f1202f5f8e4c)), closes [#734](https://github.com/mrgoonie/claudekit-cli/issues/734)
* **codex:** route hook commands at wrapper scripts, not originals ([7d7b958](https://github.com/mrgoonie/claudekit-cli/commit/7d7b9584bdbe37a046647975941d8d8a99a4e7f3))
* **codex:** self-heal missed Codex-format commands in hooks.json ([0e10bb1](https://github.com/mrgoonie/claudekit-cli/commit/0e10bb15a4b2a9e0cc8b7d0fdb448bbd8707e71f))
* **codex:** translate Claude-Code exit-code block signal to Codex JSON deny ([99e41ea](https://github.com/mrgoonie/claudekit-cli/commit/99e41ea59d28a1a6fd260bb6ee5279787b165c36))
* **config:** align DEFAULT_CK_CONFIG with opt-in default + drop drift-prone defaults from i18n ([bda22e2](https://github.com/mrgoonie/claudekit-cli/commit/bda22e2845b998ca56aec01c1532f87dbb17bde6))
* correct Antigravity provider agents path and format in ck migrate ([2990baa](https://github.com/mrgoonie/claudekit-cli/commit/2990baa3b4414fa776ae42fe2e283d818e2f1665)), closes [#637](https://github.com/mrgoonie/claudekit-cli/issues/637)
* correct Gemini CLI tool name mappings per official docs ([83a2623](https://github.com/mrgoonie/claudekit-cli/commit/83a2623d0693ae4d77d599228bd84da0e64a4b7a))
* **dashboard:** activity filtering, system info enrichment, hook diagnostics layout ([9d276a4](https://github.com/mrgoonie/claudekit-cli/commit/9d276a4bf005ef67c0af0bc4a2a53ae9749d4b0d))
* **dashboard:** add shared markdown renderer for agent/command/skill detail pages ([e0e862b](https://github.com/mrgoonie/claudekit-cli/commit/e0e862b3dd75465684bb75be18a4c86b36cdd0ef))
* **dashboard:** address code review findings — security, correctness, browser compat ([fcf61ab](https://github.com/mrgoonie/claudekit-cli/commit/fcf61ab131e61e17d7e5b3b719ceedb8cc0be1a0))
* **dashboard:** address upstream review findings — security, perf, code quality ([ca0b737](https://github.com/mrgoonie/claudekit-cli/commit/ca0b73771875ec37b414ecd6c9c4bf9840a0d5a9)), closes [#632](https://github.com/mrgoonie/claudekit-cli/issues/632)
* **dashboard:** compact project sidebar items — single-line with session count ([c3105ba](https://github.com/mrgoonie/claudekit-cli/commit/c3105ba914ccf53a2293f437b3acc1838022d004))
* **dashboard:** count hook event directories not individual hook files in kit card ([cf63ab2](https://github.com/mrgoonie/claudekit-cli/commit/cf63ab2e00e6b25300fbb11f0d85f5e817476d34))
* **dashboard:** count skill directories not individual files in kit card ([7cb86ad](https://github.com/mrgoonie/claudekit-cli/commit/7cb86ad1342c09662fb260090939668bdd2357d9))
* **dashboard:** eliminate blank space in system page left column ([05ce815](https://github.com/mrgoonie/claudekit-cli/commit/05ce815aa1e7497c4a0f08f401b2065dfb449176))
* **dashboard:** merge session counts into project sidebar, remove standalone Sessions page ([c3c870f](https://github.com/mrgoonie/claudekit-cli/commit/c3c870fbb66fd4c34d9fe6a6e5fe185a430b188f))
* **dashboard:** resolve CI build failures and remaining security review items ([84e7f27](https://github.com/mrgoonie/claudekit-cli/commit/84e7f27ecb77d7c9c2079ee9442e0a01c9bc323f))
* **dashboard:** resolve extreme resize jank in panel drag handle ([e7eca2c](https://github.com/mrgoonie/claudekit-cli/commit/e7eca2c975877bec28a026630ae537dbc8d261ad))
* **dashboard:** restore clean project sidebar layout — remove session counts from sidebar items ([c53a39e](https://github.com/mrgoonie/claudekit-cli/commit/c53a39e971f7da754a08d128860a15a4927dea4f))
* **dashboard:** restore system page 2-column layout with settings JSON panel ([4f08069](https://github.com/mrgoonie/claudekit-cli/commit/4f0806931f30297b9879c8a8bfa71c729b97a108))
* **dashboard:** sectionize sidebar with Overview/Entities/Tools headers and count badges ([7ef7dab](https://github.com/mrgoonie/claudekit-cli/commit/7ef7dab2008b4843d87379b240369abd906bfee1))
* **dashboard:** use Express 5 compatible route param for command detail endpoint ([da79fe9](https://github.com/mrgoonie/claudekit-cli/commit/da79fe9afe66c93fbe9f7f83d139ad1f39a24dcc))
* **dashboard:** validate raw input for path traversal in MCP route, document UI build gate ([92a7e22](https://github.com/mrgoonie/claudekit-cli/commit/92a7e2224d0e93d93d0f615c78f3c8dc760a8ff9))
* **desktop:** add @tauri-apps/cli as devDependency ([a4c4c56](https://github.com/mrgoonie/claudekit-cli/commit/a4c4c567ba069635103333cba2b2dbf295096ff7))
* **desktop:** add path validation and fix dead ternary from review feedback ([4961c62](https://github.com/mrgoonie/claudekit-cli/commit/4961c6284a75351354bab3b35ce2bfe2b819e057))
* **desktop:** address ck app review feedback ([4db9a79](https://github.com/mrgoonie/claudekit-cli/commit/4db9a796375958926627ce61f9c6d2330e2d34a2))
* **desktop:** address code review security and correctness issues ([6d5c97d](https://github.com/mrgoonie/claudekit-cli/commit/6d5c97db0a26e9cd6f0048f8a255e10e640906dd))
* **desktop:** address phase 5a review feedback ([4ac2c98](https://github.com/mrgoonie/claudekit-cli/commit/4ac2c9839a9a0f2de13a154973ff413916f773b2))
* **desktop:** address PR feedback - harden routeCall and fix Windows paths ([9f15a53](https://github.com/mrgoonie/claudekit-cli/commit/9f15a5388547f6d9a69197a68ea355c6aaeb8210))
* **desktop:** address red-team review findings for phase 2 dual-mode wiring ([56d7779](https://github.com/mrgoonie/claudekit-cli/commit/56d77795e0a1e3dd36cd3178784657522e42d00b))
* **desktop:** align tray ids and cached terminal resolution ([3fb6fe7](https://github.com/mrgoonie/claudekit-cli/commit/3fb6fe75cb96a81c506402d0a140432a4673dd72))
* **desktop:** canonicalize paths, skip symlinks, scope CI permissions ([c7b3f50](https://github.com/mrgoonie/claudekit-cli/commit/c7b3f50c43d363916f55e8a3cf7d2581d02b7bf5))
* **desktop:** clean up repair flow and windows preflight ([ffd5e7c](https://github.com/mrgoonie/claudekit-cli/commit/ffd5e7ce72deec7476ec33f8eb747d0515768251))
* **desktop:** correct system info and settings loading ([e9a7b2f](https://github.com/mrgoonie/claudekit-cli/commit/e9a7b2faf2fd4ee2afc49104a6d0896d4c01b8dd))
* **desktop:** enlarge default window to 1440x900 (16:10 ratio) ([f8329d9](https://github.com/mrgoonie/claudekit-cli/commit/f8329d98dc7021abde34e3f4439a744caed124d0))
* **desktop:** enrich fetchProject with settings data (consistency with fetchProjects) ([1a0bf20](https://github.com/mrgoonie/claudekit-cli/commit/1a0bf20b74178bb5ca90aad3a99a4769c4eba45f))
* **desktop:** fail fast on invalid Windows bundle versions ([54d1928](https://github.com/mrgoonie/claudekit-cli/commit/54d19284a996e8b484f65482fd555a45172a39fb))
* **desktop:** fetch release manifest via GitHub API to bypass CDN cache ([41db502](https://github.com/mrgoonie/claudekit-cli/commit/41db5026c0369a1f8984b0b77954db056b20407a))
* **desktop:** guard regen script against wrong dimensions, wire icon drift check into CI ([37519d5](https://github.com/mrgoonie/claudekit-cli/commit/37519d5fd8279fdafaf0e0950fc8d7f25150e235)), closes [#721](https://github.com/mrgoonie/claudekit-cli/issues/721)
* **desktop:** guard release asset discovery ([c3f95ec](https://github.com/mrgoonie/claudekit-cli/commit/c3f95ec71a19a957f7e90955fa393ad106f8936f))
* **desktop:** harden first-run onboarding flow ([f8423fc](https://github.com/mrgoonie/claudekit-cli/commit/f8423fc9253002853b4d9ca9637b58c8154320dc))
* **desktop:** harden phase 5a desktop fallbacks ([da98133](https://github.com/mrgoonie/claudekit-cli/commit/da98133234a464ed794d505ce520cba5519f0c07))
* **desktop:** harden project commands and revert pubkey to empty string ([e2bd00c](https://github.com/mrgoonie/claudekit-cli/commit/e2bd00cdfa08e85eda2bfb6e6deba6a5cbd6136b))
* **desktop:** harden release guardrails and update fallback ([d8c2303](https://github.com/mrgoonie/claudekit-cli/commit/d8c2303b8591170f08f002ec3356525d01305287))
* **desktop:** harden release manifest pipeline ([54d5712](https://github.com/mrgoonie/claudekit-cli/commit/54d5712dc237dda358612d17b5e328d7b9f4273b))
* **desktop:** harden repair and sync flows ([1fb1052](https://github.com/mrgoonie/claudekit-cli/commit/1fb105230950d46c7f220c7204be479d8db2e941))
* **desktop:** harden session and project path handling ([27b563b](https://github.com/mrgoonie/claudekit-cli/commit/27b563b0c1cbf70d0eef26e4a55248061d4457cd))
* **desktop:** load [@2x](https://github.com/2x) tray asset on macOS, drop unused_mut lint ([a65f18d](https://github.com/mrgoonie/claudekit-cli/commit/a65f18ddbf11ca2ac2125c3846c5141b770ab4fc))
* **desktop:** pin dashboard port to 3456 for Tauri devUrl match ([8316c59](https://github.com/mrgoonie/claudekit-cli/commit/8316c5954f0d61d96c8791010c025536a1bf551b))
* **desktop:** preserve dev.0 wix versions ([6867db4](https://github.com/mrgoonie/claudekit-cli/commit/6867db4dccaca3d11f777cf80311e00d756baf87))
* **desktop:** preserve settings existence and field updates ([812e2de](https://github.com/mrgoonie/claudekit-cli/commit/812e2de76be07806329fb637d155b3e5a36b7862))
* **desktop:** prevent browser auto-open and reduce CI trigger scope ([e48b46f](https://github.com/mrgoonie/claudekit-cli/commit/e48b46faba2952fdbd37ebbbfb2c3655aa337542))
* **desktop:** prevent updater listener leak on fast unmount, omit undefined args ([830545a](https://github.com/mrgoonie/claudekit-cli/commit/830545ac08083c8eab333fc6aa48fb9fbe3f11d4))
* **desktop:** regenerate full icon bundle and guard against drift ([21990c0](https://github.com/mrgoonie/claudekit-cli/commit/21990c080c85a977d160da68b62e15f720f8082b)), closes [#719](https://github.com/mrgoonie/claudekit-cli/issues/719)
* **desktop:** reject file paths, gitignore gen/, bump MSRV to 1.77 ([ab842fc](https://github.com/mrgoonie/claudekit-cli/commit/ab842fcbc0778a4c9a4e9bbc296b5ead61439ccf))
* **desktop:** repair invalid installed bundles ([471a413](https://github.com/mrgoonie/claudekit-cli/commit/471a4137bde9e350843fe58af8edb071a435170a))
* **desktop:** replace corrupt logo source with canonical CK brand logo ([424d268](https://github.com/mrgoonie/claudekit-cli/commit/424d268794b5758e0a29a7780d60b2b4d2c44922)), closes [#720](https://github.com/mrgoonie/claudekit-cli/issues/720) [#719](https://github.com/mrgoonie/claudekit-cli/issues/719) [#720](https://github.com/mrgoonie/claudekit-cli/issues/720)
* **desktop:** replace generated icons with CK brand logo ([51cdee8](https://github.com/mrgoonie/claudekit-cli/commit/51cdee8d590732dedd3e94e9ffe1bcb023543048))
* **desktop:** resolve phase 5a build regressions ([b8b85ac](https://github.com/mrgoonie/claudekit-cli/commit/b8b85ace63ae020120ed8059b795565ea3bcd3e1))
* **desktop:** resolve review follow-ups ([07060da](https://github.com/mrgoonie/claudekit-cli/commit/07060da585a187e09fa645b792aceb8c853bb172))
* **desktop:** restore settings/config panels in Tauri mode ([fd0b3b7](https://github.com/mrgoonie/claudekit-cli/commit/fd0b3b7d33a77b042daceb7a89b651b3ffd9117c)), closes [#717](https://github.com/mrgoonie/claudekit-cli/issues/717)
* **desktop:** restore translated action picker labels ([231e4bb](https://github.com/mrgoonie/claudekit-cli/commit/231e4bb53aa32adba21b8ab154f587d2f34c071c))
* **desktop:** stabilize first-run onboarding exit ([d588ca3](https://github.com/mrgoonie/claudekit-cli/commit/d588ca3ccda02d1d605868059457c00f24893422))
* **desktop:** tighten tray route matching and terminal test ([b4e6f71](https://github.com/mrgoonie/claudekit-cli/commit/b4e6f7108cc2b3f0097d726cb2537d9f62b88c37))
* **desktop:** use CK logo for app icon and macOS tray template ([d97f837](https://github.com/mrgoonie/claudekit-cli/commit/d97f83776d540ce93bd7c5e41eb9d63f80e099c1))
* **desktop:** use desktop-specific updater endpoint and skip manifest without signing key ([29eb217](https://github.com/mrgoonie/claudekit-cli/commit/29eb21761b22c54afbef1d86fa12f1c4bf4b754f))
* **doctor:** clean empty hooks object and cover extra path forms ([6d109ab](https://github.com/mrgoonie/claudekit-cli/commit/6d109ab4c84896999eff4873f6877c111011cb98))
* **doctor:** detect and repair stale hook references in settings.json ([0e35a59](https://github.com/mrgoonie/claudekit-cli/commit/0e35a5922ceeb253a658750342d119fa22447786)), closes [#715](https://github.com/mrgoonie/claudekit-cli/issues/715)
* **doctor:** use delete for hooks key removal; add $HOME/%USERPROFILE% tests ([93a16d6](https://github.com/mrgoonie/claudekit-cli/commit/93a16d68bc34fc470619152bba5073f5fc025f70)), closes [#716](https://github.com/mrgoonie/claudekit-cli/issues/716)
* harden backup restore rollback ([3dd0f64](https://github.com/mrgoonie/claudekit-cli/commit/3dd0f643d1f812af4dbd62387754769e5dfcad2e))
* harden destructive backup locking and rollback ([6f2faa8](https://github.com/mrgoonie/claudekit-cli/commit/6f2faa8bd80f1324be0091c87e90459883c16515))
* **help:** address PR [#727](https://github.com/mrgoonie/claudekit-cli/issues/727) review findings ([ca60314](https://github.com/mrgoonie/claudekit-cli/commit/ca603149184ebb6be3b7a13ed2f7bcfc3a781533))
* **help:** bump maxExamples default from 2 to 3 ([228d73c](https://github.com/mrgoonie/claudekit-cli/commit/228d73cc2365bda1c4f4c6d7e1d1235ec855e584))
* **i18n:** replace hardcoded strings with translation keys in plans dashboard ([1778cc5](https://github.com/mrgoonie/claudekit-cli/commit/1778cc5202bbc795676cbe523ab8ab18925dfbb8))
* **init:** address review nits for migration guard ([64dca76](https://github.com/mrgoonie/claudekit-cli/commit/64dca768e47fe75be86cf388a8844eadd0de6b14))
* **init:** ignore wrapper noise in offline root detection ([d0c7301](https://github.com/mrgoonie/claudekit-cli/commit/d0c73012ec159fb9ff372a35224af515f3531a21))
* **init:** normalize wrapped offline kit sources ([4faa385](https://github.com/mrgoonie/claudekit-cli/commit/4faa385510f73cfd63f1b617213f43613b5586c5))
* **init:** respect CLAUDE_CONFIG_DIR in global path rewrites ([53a152f](https://github.com/mrgoonie/claudekit-cli/commit/53a152fd88f67d439174117ee304c22199577acc))
* **init:** skip runtime artifacts in legacy migration ([42cb80d](https://github.com/mrgoonie/claudekit-cli/commit/42cb80dd8ec840e42623a47bdf60e616255163f8))
* **migrate:** address 3rd review — drop speculative model hints, test prompt paths ([1f63590](https://github.com/mrgoonie/claudekit-cli/commit/1f63590954290ff4625ff94dce6eedb3347de6cd)), closes [#728](https://github.com/mrgoonie/claudekit-cli/issues/728)
* **migrate:** address PR [#743](https://github.com/mrgoonie/claudekit-cli/issues/743) review feedback ([38121d1](https://github.com/mrgoonie/claudekit-cli/commit/38121d13aa2e3cab379b37b2f48ec8cd32268db3))
* **migrate:** address review feedback on opencode model installer ([1ae5d40](https://github.com/mrgoonie/claudekit-cli/commit/1ae5d40c70591679386c3368203f9304a428c9ef))
* **migrate:** copy hook companion dirs (lib/, scout-block/) and .ckignore ([#742](https://github.com/mrgoonie/claudekit-cli/issues/742)) ([d138115](https://github.com/mrgoonie/claudekit-cli/commit/d138115cf216aa47a6481111ed86187fe747f3ca)), closes [#741](https://github.com/mrgoonie/claudekit-cli/issues/741)
* **migrate:** don't hijack user to Install mode when reconcile has work ([a9ec7e2](https://github.com/mrgoonie/claudekit-cli/commit/a9ec7e22744094fe03eff1a192db82a7c48c8aca))
* **migrate:** improve provider detection with binary checks and grouped selection UI ([1ac0303](https://github.com/mrgoonie/claudekit-cli/commit/1ac03038802dd53ebffe95e16d998a8e4382e8b9))
* **migrate:** install scope bleed + hooks.json self-heal ([876c164](https://github.com/mrgoonie/claudekit-cli/commit/876c164fcb6ccb923e59a08693a0b1aa175264fb)), closes [#739](https://github.com/mrgoonie/claudekit-cli/issues/739) [#740](https://github.com/mrgoonie/claudekit-cli/issues/740) [#739](https://github.com/mrgoonie/claudekit-cli/issues/739)
* **migrate:** write default model to opencode.json to avoid ProviderModelNotFoundError ([b48a957](https://github.com/mrgoonie/claudekit-cli/commit/b48a957c62a188deece9e28a6c01b9fdccdf31b8)), closes [#728](https://github.com/mrgoonie/claudekit-cli/issues/728)
* narrow Antigravity detection and clarify skills directory comment ([8d2628d](https://github.com/mrgoonie/claudekit-cli/commit/8d2628d3bb695ae0872f9d1ba34a1a705602e667))
* normalize BOM-prefixed migrate frontmatter parsing ([5bd1a6f](https://github.com/mrgoonie/claudekit-cli/commit/5bd1a6f4658edd3c94cdb043eeb3f23cc1a2aaef))
* normalize prune json success ([89b8c96](https://github.com/mrgoonie/claudekit-cli/commit/89b8c96860f9cdbd5256f2f8cf5046b51a7e1667))
* **opencode:** preserve shared skill roots on force uninstall ([266d46c](https://github.com/mrgoonie/claudekit-cli/commit/266d46cf2dd6eed8b970543fce6465726b543753))
* **opencode:** reuse Claude-compatible skill roots ([f12fc6a](https://github.com/mrgoonie/claudekit-cli/commit/f12fc6a2c2d19f87bbffbe33fd7b9341268eeb9b))
* **plan-dashboard:** preserve project-aware plan routing ([078b1bc](https://github.com/mrgoonie/claudekit-cli/commit/078b1bc23bc19b49f52529f333a8a08f1217107a))
* **plan-parser:** normalize CRLF in validator ([f99fe9b](https://github.com/mrgoonie/claudekit-cli/commit/f99fe9b8855d0379424e1ed033be7204a174f8b1))
* **plans:** add clearActionStore for test teardown and improve registry stats ([0c24905](https://github.com/mrgoonie/claudekit-cli/commit/0c24905cea2c813c45957941e33d8a0588692d5c))
* **plans:** address final review nits ([3689248](https://github.com/mrgoonie/claudekit-cli/commit/3689248c438d42e61a467df4fd526f6f7313219c))
* **plans:** address PR review feedback ([3141185](https://github.com/mrgoonie/claudekit-cli/commit/3141185a48722c7b43b18c22f5ca1b48f313c79a))
* **plans:** harden aggregate fallback and cache behavior ([9029555](https://github.com/mrgoonie/claudekit-cli/commit/9029555cd6a477aae623426c157ed77784a6a310))
* **plans:** harden aggregate route behavior ([d09ef54](https://github.com/mrgoonie/claudekit-cli/commit/d09ef548aff52efe5a7bd6934ca97f900276ec80))
* remove no-op filter and add empty-providers guard in migrate UI ([b1d4ac6](https://github.com/mrgoonie/claudekit-cli/commit/b1d4ac675c06ff37747f5aaddb32ba319715ec25))
* round-3 review — dialog focus trap via showModal(), fix stat shadow ([71521b6](https://github.com/mrgoonie/claudekit-cli/commit/71521b653cc2c92d90eb4a43f2cb6e86553a491d))
* **security:** disable gray-matter JS engine in all matter() calls ([f4c0c7f](https://github.com/mrgoonie/claudekit-cli/commit/f4c0c7fdfe24c78d01556fd9464d1c4062d771dd)), closes [#649](https://github.com/mrgoonie/claudekit-cli/issues/649)
* **security:** validate discovered-* project IDs against cwd/homedir bounds ([d291ea2](https://github.com/mrgoonie/claudekit-cli/commit/d291ea20ec60729f11db12c8ac1b8f8f746128b7))
* set Antigravity agents to null and correct global config path ([e09d3a8](https://github.com/mrgoonie/claudekit-cli/commit/e09d3a82eb5bc7e671a95172cf63d0fdf84b601a))
* **skills:** address PR review — gray-matter RCE, BM25 cache, async consistency ([4bc1b85](https://github.com/mrgoonie/claudekit-cli/commit/4bc1b8518c67f6d0ab473732709a75a3478ba573))
* **skills:** address review findings — fallback guard, unreachable categories, schema dupe ([90c08aa](https://github.com/mrgoonie/claudekit-cli/commit/90c08aa3696ccb4f145ec62e7f766032c4bbad36))
* **test:** scope codex-compat upgrade test to temp dir ([11b65cc](https://github.com/mrgoonie/claudekit-cli/commit/11b65cc7903181d75f43c1191ca756691a42a620))
* **ui:** auto-collapse long text blocks in session detail ([6d6674f](https://github.com/mrgoonie/claudekit-cli/commit/6d6674f48ae03c873ae20dab719a1bdb945eae19))
* **ui:** CLI update button top-right, split environment into grouped panels ([8db8848](https://github.com/mrgoonie/claudekit-cli/commit/8db884814d55abff500b815b5f6bfb72a922327b))
* **ui:** deduplicate skill blocks — single SkillBlock per invocation ([443c57a](https://github.com/mrgoonie/claudekit-cli/commit/443c57a4ce199282230ec0083f2a9a90af631a69))
* **ui:** detect multiple skills in system-reminder blocks ([97d6f3d](https://github.com/mrgoonie/claudekit-cli/commit/97d6f3d2de1fe84d1bdd19debe1431e0e23dffbb))
* **ui:** inline skill badge before prompt text in session detail ([314ef0c](https://github.com/mrgoonie/claudekit-cli/commit/314ef0c8b3cc865e2b7a537cca197d94577a5132))
* **ui:** kit card component count uses category totals not raw file count ([7ad0601](https://github.com/mrgoonie/claudekit-cli/commit/7ad0601eddd0af34fff5b5f5b4a4c3aba52d6bbd))
* **ui:** MCP discovery missing ~/.claude.json — primary source for MCP servers ([798639b](https://github.com/mrgoonie/claudekit-cli/commit/798639b8f05e692a909aa119e7e48976a36c8c6b))
* **ui:** no inline badge without prompt — deduplicate skill rendering ([f456e17](https://github.com/mrgoonie/claudekit-cli/commit/f456e174a19aa506c8f9711374ff98e2cb1bf98a))
* **ui:** raise session file size limit from 10 MB to 50 MB ([e3fcfa3](https://github.com/mrgoonie/claudekit-cli/commit/e3fcfa3768d450784929392f7aefd38dacd7fd1d))
* **ui:** relax project discovery — show all Claude CLI projects in sidebar ([09fd334](https://github.com/mrgoonie/claudekit-cli/commit/09fd334546684c8dc75fcc8965b0d29fd8b5f409))
* **ui:** remove lg:flex-row from Hook Diagnostics card header ([7a532df](https://github.com/mrgoonie/claudekit-cli/commit/7a532dfd7ac1f91e081e3b41b7c1f58bba78f479)), closes [#613](https://github.com/mrgoonie/claudekit-cli/issues/613)
* **ui:** remove stale sidebar project binding ([4925df8](https://github.com/mrgoonie/claudekit-cli/commit/4925df81021dcb60d96652a2f885ebb939879929))
* **ui:** render labels in datalist combobox and use nullish coalescing ([2ee383a](https://github.com/mrgoonie/claudekit-cli/commit/2ee383afaaf2a0a5350e9076b6aac4537e00cd2e))
* **ui:** search palette stuck open — revert dialog to conditional div ([0302850](https://github.com/mrgoonie/claudekit-cli/commit/0302850ca28071bf624c8cafac3fb313f8ceb4ea))
* **ui:** search palette transparent background — bg-dash-card undefined ([a9d29c5](https://github.com/mrgoonie/claudekit-cli/commit/a9d29c500479024dc95b0cc506b9d6c7c1a8fba5))
* **ui:** separate user prompt from skill invocation in session detail ([46805d8](https://github.com/mrgoonie/claudekit-cli/commit/46805d85856329651fd0eadfd9bb946866fe7ddb))
* **ui:** session detail back button navigates to project dashboard ([ace675b](https://github.com/mrgoonie/claudekit-cli/commit/ace675bf8cddfa0567544d15083fec9b6d8e7637))
* **ui:** set explicit color on CodeMirror .cm-content to survive prod CSS bundling ([138f0f5](https://github.com/mrgoonie/claudekit-cli/commit/138f0f51a8c373722a4ade0a6ea2f3088f50a555))
* **ui:** skill invocation detection + light theme terminal awareness ([12f16cb](https://github.com/mrgoonie/claudekit-cli/commit/12f16cb815e529d950aed8b9f6f30eaba3830e65))
* **ui:** theme-aware colors for Hook Diagnostics warning box ([b3df8c3](https://github.com/mrgoonie/claudekit-cli/commit/b3df8c3a48ace499bdf9ba6396d2c1ef568dd916))
* **ui:** use logical OR for plansDir fallback to handle empty string ([126bd48](https://github.com/mrgoonie/claudekit-cli/commit/126bd481caed7be6f9dabefb9f989fde7d3f793d))
* use delete for process.env.CK_TEST_HOME instead of undefined assignment ([5d69909](https://github.com/mrgoonie/claudekit-cli/commit/5d69909209710678cf30b29138fc039f26a5d0c1))
* use delete for process.env.CLAUDE_CONFIG_DIR restoration in tests ([88566ee](https://github.com/mrgoonie/claudekit-cli/commit/88566eea786dd0740ee2992302c543873f725060))
* use execFileSync instead of execSync to prevent shell injection in binary detection ([b1b30ff](https://github.com/mrgoonie/claudekit-cli/commit/b1b30ff787e127a1f487544464d721b394bf97dc))
* use process.cwd() for Windows-safe path resolution in metadata check ([16ee738](https://github.com/mrgoonie/claudekit-cli/commit/16ee738d700ead085fd6315eb24dbec935dd021e))
* **versioning:** correct mixed-kit update detection ([6de6269](https://github.com/mrgoonie/claudekit-cli/commit/6de6269909c2ebca26b3c3df37d536ba5d96b721))
* **versioning:** guard malformed system kit metadata ([2ab1893](https://github.com/mrgoonie/claudekit-cli/commit/2ab18936af7652045be73b26c90decf740f72823))
* **versioning:** infer beta channel in system checks ([1c027b4](https://github.com/mrgoonie/claudekit-cli/commit/1c027b40554772dfe5128a5d1207d2cb5f3e53ae))
* **versioning:** stabilize version display checks in CI ([b6c3858](https://github.com/mrgoonie/claudekit-cli/commit/b6c38584b152fc814f3a7d9fd1dfb3d48997f629))
* **watch:** handle ERELEASED after onCompromised and CRLF in logStreamEvent ([b1968b7](https://github.com/mrgoonie/claudekit-cli/commit/b1968b7252000dfb2237014bde7c8522d94b60c3))
* **watch:** resolve Windows issues with verbose flag, lock paths, and ECOMPROMISED ([4da7621](https://github.com/mrgoonie/claudekit-cli/commit/4da7621697f7086e0762a03f3ceac216167fd79a)), closes [claudekit/claudekit-engineer#589](https://github.com/claudekit/claudekit-engineer/issues/589)
* **workflows:** address code review feedback and add search functionality ([119e0e9](https://github.com/mrgoonie/claudekit-cli/commit/119e0e96aef73dbb98d6a942e99f00a2eb40d4ee)), closes [#667](https://github.com/mrgoonie/claudekit-cli/issues/667)
* **workflows:** apply biome formatting rules ([e1d65b3](https://github.com/mrgoonie/claudekit-cli/commit/e1d65b3f4eb061e9dd372fdc8ce57622689d911a))
* **workflows:** category tabs close expanded view, skills sidebar auto-scrolls ([a8fcd57](https://github.com/mrgoonie/claudekit-cli/commit/a8fcd57f5232ff05b5034a3e8ae00c41f06dcfa2))
* **workflows:** dynamic skill commands, ck- prefix handling, cleanup dead code ([914b151](https://github.com/mrgoonie/claudekit-cli/commit/914b151b98aa7fce93a185fcdb22c577e6d7566b))

### ⚡ Performance Improvements

* **plan:** preload config once for batch dependency resolution ([5b917bf](https://github.com/mrgoonie/claudekit-cli/commit/5b917bf7e255e221d69fbee857dff80bef2e1640))
* **ui:** add 5s cache to fetchProject to avoid duplicate calls ([2e13911](https://github.com/mrgoonie/claudekit-cli/commit/2e13911731036237a909a1f6f3acbc2008d098a4))

### ♻️ Code Refactoring

* address code review feedback on CLAUDE_CONFIG_DIR path handling ([c039f2b](https://github.com/mrgoonie/claudekit-cli/commit/c039f2b82f071a609a64dce204490b60cad6a984))
* **dashboard:** clean system/config page split and fix resize jank ([02babeb](https://github.com/mrgoonie/claudekit-cli/commit/02babebb6fddfd8dd9ef7a45b99050c336c4e80d))
* **dashboard:** convert entity browsers to split-panel list+detail layout ([427bfbe](https://github.com/mrgoonie/claudekit-cli/commit/427bfbef10fcce27dd2e7c84cc40a1938e783f13))
* **dashboard:** convert system dashboard to single-column flow layout ([da1efeb](https://github.com/mrgoonie/claudekit-cli/commit/da1efebf223934ce2ea18673ed03e6b1a31678db))
* **dashboard:** replace stats dashboard with system page as home ([e7595e7](https://github.com/mrgoonie/claudekit-cli/commit/e7595e77b317cfd9ac095ab78111d3f9f6c1a03f))
* **dashboard:** unify entity page designs to match Commands page pattern ([c7ccd44](https://github.com/mrgoonie/claudekit-cli/commit/c7ccd44f757e086a20886da1c7dbc1b000311a94))
* decompose update-cli.ts into modular components ([27f1c6f](https://github.com/mrgoonie/claudekit-cli/commit/27f1c6fba93d3f4384818ef3eb04ee8ab3f1e3bf)), closes [#606](https://github.com/mrgoonie/claudekit-cli/issues/606) [#600](https://github.com/mrgoonie/claudekit-cli/issues/600)
* **desktop:** move root_path directly into spawn_blocking closure ([3fa2d21](https://github.com/mrgoonie/claudekit-cli/commit/3fa2d2166c7bfa6baa949aa069c4b7b04754cbad))
* merge duplicate npm-registry imports in channel-resolver ([76fed78](https://github.com/mrgoonie/claudekit-cli/commit/76fed7824b6c145d8cef5f801e557a591526329e))
* **plans:** consolidate kanban into plans dashboard ([f475da5](https://github.com/mrgoonie/claudekit-cli/commit/f475da5c42ddcea7fb4d78c5318618bc5ef55758))
* **skills:** address low-priority review — BM25 TF precompute, catalog mkdir, forceRegenerate ([0624d71](https://github.com/mrgoonie/claudekit-cli/commit/0624d718e965ef9a057d242e3d17c3157d4da6d5))
* **ui:** merge environment into unified health panel, remove duplication ([8469314](https://github.com/mrgoonie/claudekit-cli/commit/846931408c7c0925220974648ab94b7af2adf41e))
* **ui:** remove redundant SessionProjectPage route ([48602c4](https://github.com/mrgoonie/claudekit-cli/commit/48602c46a33d3a19adc03a89a3359a8ef7a64fdd))
* **ui:** remove System tab from Config Editor — duplicates home dashboard ([638a1a6](https://github.com/mrgoonie/claudekit-cli/commit/638a1a6d32168cba1c352dc986a613ce8992f939))
* **ui:** replace noise sections with Health Check panel ([8500f79](https://github.com/mrgoonie/claudekit-cli/commit/8500f798b37b87366811b21eb1f3a8db1578b176))
* **watch:** use getLockPaths in cleanupLocks for path consistency ([a1f2ca5](https://github.com/mrgoonie/claudekit-cli/commit/a1f2ca51000d98ad228114155779e9733b195c09))

### 📚 Documentation

* add visual diff report for PR [#613](https://github.com/mrgoonie/claudekit-cli/issues/613) ([d6c07bd](https://github.com/mrgoonie/claudekit-cli/commit/d6c07bdd8574b4ea6e9db03e792c0aeb568ca5d8))
* **claude:** require desktop-v* tagging as final step for app-facing changes ([2bb08e6](https://github.com/mrgoonie/claudekit-cli/commit/2bb08e6f2ee46a0c90f913bedd72d7dbd7795434))
* **cli:** update provider setup flow guidance ([3d5368a](https://github.com/mrgoonie/claudekit-cli/commit/3d5368afca29b96b9dd0cde017ac546bf887a870))
* **desktop:** add Tauri v2 architecture to CLAUDE.md and docs ([b565bf8](https://github.com/mrgoonie/claudekit-cli/commit/b565bf8396362636c95b49a1852b8e765816d8f5))
* **desktop:** document tray enhancements ([ac91042](https://github.com/mrgoonie/claudekit-cli/commit/ac910427f1dcb54f668e13c6e6974cd425c10078))
* **desktop:** note drift guard anchor-only scope ([7ba026e](https://github.com/mrgoonie/claudekit-cli/commit/7ba026ee743b1b1b7c98cfb9e9109a752cab6f4e))
* **desktop:** update Phase 3 rollout notes ([c990920](https://github.com/mrgoonie/claudekit-cli/commit/c990920d88e6b63a2f3d76bec58201a54c17fc4d))
* **health:** clarify DASHBOARD_FEATURES scope and drop unused projects flag ([5e9d2ab](https://github.com/mrgoonie/claudekit-cli/commit/5e9d2ab35c5ac8d04952b9a24b4ac39f2da2e971))
* **readme:** clarify offline repo archive support ([0c21bfd](https://github.com/mrgoonie/claudekit-cli/commit/0c21bfd2482599c25731ef221b5baabdf7279b09))

### ✅ Tests

* add settings-merge fixture suite and Windows path matrix ([0b92911](https://github.com/mrgoonie/claudekit-cli/commit/0b929113f0aed28e8fef4ca819e569b9d5503d51)), closes [#603](https://github.com/mrgoonie/claudekit-cli/issues/603) [#604](https://github.com/mrgoonie/claudekit-cli/issues/604) [#600](https://github.com/mrgoonie/claudekit-cli/issues/600)
* add unit tests for hasBinaryInPath and detect function smoke tests ([4c9f606](https://github.com/mrgoonie/claudekit-cli/commit/4c9f606f64a28163c1d0ba5c1b5eb3f4d9570ce2))
* address final review polish for Gemini CLI migration ([1bbc207](https://github.com/mrgoonie/claudekit-cli/commit/1bbc2079b68b6ef6f08ee0467b8eef6be806fdb6))
* **cli:** relax flaky skills customization timeout ([501a961](https://github.com/mrgoonie/claudekit-cli/commit/501a9619ccee2537d0f50576b79154d85a5b42a9))
* **codex:** cover hook compat layer ([1e3c738](https://github.com/mrgoonie/claudekit-cli/commit/1e3c738d2e69b3341da0d5baccb1dbb1230fb6f2))
* **desktop:** cover tray recency and navigation ([6898a16](https://github.com/mrgoonie/claudekit-cli/commit/6898a162b63bbe76c8292da28190ee12badcba14))
* harden BOM frontmatter warning coverage ([c22346a](https://github.com/mrgoonie/claudekit-cli/commit/c22346a9db7d16a2ddbf2ea17882d90910d55ff4))
* **migrate:** reset route source-path mocks between cases ([#711](https://github.com/mrgoonie/claudekit-cli/issues/711)) ([64a52d9](https://github.com/mrgoonie/claudekit-cli/commit/64a52d9a94480fc559fc3c0cb471b2d7249dfe04))
* mock detectClaudeCodeVersion to prevent non-deterministic hook injection ([f4a15db](https://github.com/mrgoonie/claudekit-cli/commit/f4a15db2007084594447a3ef23cb1d14089dc184))
* **plan-parser:** anchor ck plan regex to word boundary ([663176a](https://github.com/mrgoonie/claudekit-cli/commit/663176a29c86884e3347362e580624e02954565e))
* **plan-parser:** support layout-aware engineer source scans ([b958cf1](https://github.com/mrgoonie/claudekit-cli/commit/b958cf1a174af07cd1c49aee11c172a3eeed5eb4))
* **plans:** add tests for clearActionStore and call in afterAll hooks ([3d2294a](https://github.com/mrgoonie/claudekit-cli/commit/3d2294af97866c297571487ee09a284dc5b3c046))
* **plans:** cover aggregation regressions ([bc293ba](https://github.com/mrgoonie/claudekit-cli/commit/bc293ba485b44372356ad32a21dedda7781f0c13))
* **ui:** align full vitest suite with repo gates ([6b72424](https://github.com/mrgoonie/claudekit-cli/commit/6b7242474e9f7e0d802a3f4b70add49dcbbf73b3))

### 👷 CI

* **desktop:** add bun test to PR gate and dedupe dev-tag detection ([30f4f79](https://github.com/mrgoonie/claudekit-cli/commit/30f4f792c87622a42b89f94e96e66617ab479bfb))
* **desktop:** gate PRs with typecheck-only runner and route dev tags separately ([a972f3d](https://github.com/mrgoonie/claudekit-cli/commit/a972f3d8df9e28c3595ee8287648f77d8a8ab95e)), closes [#703](https://github.com/mrgoonie/claudekit-cli/issues/703)
* **desktop:** sync bundle versions from release tags ([f9ffdcf](https://github.com/mrgoonie/claudekit-cli/commit/f9ffdcf4e86c443e6190c9c96fcec8d0e0c96dfe))

## [3.41.4](https://github.com/mrgoonie/claudekit-cli/compare/v3.41.3...v3.41.4) (2026-04-08)

### 🔥 Hotfixes

* **hooks:** self-heal stale Claude hook command paths ([88ecbb4](https://github.com/mrgoonie/claudekit-cli/commit/88ecbb48203965b714e4101e00ce41335cb23d2c))

## [3.41.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.41.2...v3.41.3) (2026-04-07)

### 🔥 Hotfixes

* **uninstall:** normalize retained metadata paths ([e86faa9](https://github.com/mrgoonie/claudekit-cli/commit/e86faa9157604b3fb0963d8642ccf8151b2459d9)), closes [#619](https://github.com/mrgoonie/claudekit-cli/issues/619)
* **uninstall:** prune retained metadata by kit ([71f732c](https://github.com/mrgoonie/claudekit-cli/commit/71f732c4ff58b8702c9b497f831e8fb19c8d8a34)), closes [#619](https://github.com/mrgoonie/claudekit-cli/issues/619)
* **uninstall:** retain metadata for preserved tracked files ([a0f9cdf](https://github.com/mrgoonie/claudekit-cli/commit/a0f9cdfc44e5a68a14d4f69cb0397201c2abced8)), closes [#619](https://github.com/mrgoonie/claudekit-cli/issues/619)

## [3.41.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.41.1...v3.41.2) (2026-04-06)

### 🔥 Hotfixes

* remove stale prefixed command duplicates on upgrade ([1a10fed](https://github.com/mrgoonie/claudekit-cli/commit/1a10fed86a230db383c4b4b10b8595d6ff1f9e8e))

## [3.41.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.41.0...v3.41.1) (2026-04-04)

### 🔥 Hotfixes

* **cli:** repair Windows local hook path expansion ([3252107](https://github.com/mrgoonie/claudekit-cli/commit/3252107f3be4c602cb5b4395a63e3211bda3f3cd)), closes [#593](https://github.com/mrgoonie/claudekit-cli/issues/593)

## [3.41.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.40.3...v3.41.0) (2026-04-03)

### 🚀 Features

* add 10 color theme presets and fix terminal preview text selection ([cd27542](https://github.com/mrgoonie/claudekit-cli/commit/cd27542b555959be73ac4fc23978528b305ac7f0))
* add status-line visual builder dashboard with drag-and-drop ([cd1c298](https://github.com/mrgoonie/claudekit-cli/commit/cd1c29879f9990b5e97f01519849ed0bd06f29e0)), closes [#567](https://github.com/mrgoonie/claudekit-cli/issues/567)
* add statusline layout config schema with section ordering and theme support ([f94e7a4](https://github.com/mrgoonie/claudekit-cli/commit/f94e7a40bb16d666034b76558666b15968d28f06))
* add statusline layout config schema with section ordering and theme support ([87f2e4d](https://github.com/mrgoonie/claudekit-cli/commit/87f2e4d5d18b2019253bc83068c3b33aa731c885)), closes [#566](https://github.com/mrgoonie/claudekit-cli/issues/566)
* distinct per-section colors in preview with user override support ([bf7fc6e](https://github.com/mrgoonie/claudekit-cli/commit/bf7fc6e8d831f3c17ea43d6d3b9e7f46f6739de3))
* expand color palette with bright variants and redesign all theme presets ([3812661](https://github.com/mrgoonie/claudekit-cli/commit/38126619944733c7f688174dd2ca3943dc18d9a6))
* move sections editor to right panel below preview ([c4128a2](https://github.com/mrgoonie/claudekit-cli/commit/c4128a262a4eb3dd1af467dc625fad3191eaae0e))
* per-section colors in theme presets with full Color Theme controls ([06668f4](https://github.com/mrgoonie/claudekit-cli/commit/06668f4b37dff790b37c42bb308a95704ec9f85b))
* remove General Settings tab (YAGNI — settings don't affect preview yet) ([3790d28](https://github.com/mrgoonie/claudekit-cli/commit/3790d2825e676c0f403fa8717dca2b14326f3795))
* replace flat sections with lines-based multi-line layout builder ([b94ae6a](https://github.com/mrgoonie/claudekit-cli/commit/b94ae6add6cf8eaee339b35df0f171dfccdcf43d))
* replace width presets with draggable resize handle on preview panel ([d05c309](https://github.com/mrgoonie/claudekit-cli/commit/d05c309999a4642fde0108df01d81bfa0aa6d853))
* support claude source layout for kit repos ([0a21434](https://github.com/mrgoonie/claudekit-cli/commit/0a21434b98d9ba87cb4fd3fae0e734feb227717e))

### 🐞 Bug Fixes

* add icons to Context Window and Usage Quota group headers ([2c01c78](https://github.com/mrgoonie/claudekit-cli/commit/2c01c78c7aaf3ff54c8a895bc16b7bd9a3fd53f9))
* add schema validation tests and clarify documentation per review ([7dbd11a](https://github.com/mrgoonie/claudekit-cli/commit/7dbd11a1f3e9425cbd78a083bd3417c71a4ceccb))
* align all section mocks with actual renderer output format ([99f5053](https://github.com/mrgoonie/claudekit-cli/commit/99f50530e8e46a97d1255c4966104291705acdfe))
* correct quota mock to match actual statusline format (percentage chips) ([c7ffbe9](https://github.com/mrgoonie/claudekit-cli/commit/c7ffbe93f57a83cb73d188a152848e428baa39d5))
* fixed-width preview panel, width toggle only affects section culling ([71ca829](https://github.com/mrgoonie/claudekit-cli/commit/71ca8290de1bdc6dfb353e80f9d4f2d1ee403f15))
* group color fields by purpose (Context/Quota/General) with sub-headers ([38057f5](https://github.com/mrgoonie/claudekit-cli/commit/38057f56062ef12dbd0617f9c2706fecd22d2388))
* harden layout metadata handling ([a36f80d](https://github.com/mrgoonie/claudekit-cli/commit/a36f80d924f270765fd6ab260711efcfd403a0b3))
* improve statusline builder UX per user feedback ([9ddb884](https://github.com/mrgoonie/claudekit-cli/commit/9ddb884820bcbc18b46dd04404a1cfc569bdff41))
* invert resize drag direction for right-side preview panel ([94abace](https://github.com/mrgoonie/claudekit-cli/commit/94abacea371389b572e96484cd6f9f51d5e05c9d))
* prevent config overwrite on load failure and validate PATCH responses ([52886ea](https://github.com/mrgoonie/claudekit-cli/commit/52886ead9330bd6c15ba0c66e0f74dd91c677a11))
* preview width toggle resizes entire right panel with animation ([02e70d8](https://github.com/mrgoonie/claudekit-cli/commit/02e70d89c7ae019cad58ec8a92907a79aedffd96))
* replace cryptic column numbers with Narrow/Medium/Wide labels ([c9c20d9](https://github.com/mrgoonie/claudekit-cli/commit/c9c20d9d4589de0de207cc7e33d700487fe65616))
* resolve CI build failure and address round-4 review feedback ([b03bccb](https://github.com/mrgoonie/claudekit-cli/commit/b03bccb46b6464e01fd2e6b2dc3abe1d2eeba96e))
* resolve i18n violations, add error handling, improve accessibility ([4b46bc1](https://github.com/mrgoonie/claudekit-cli/commit/4b46bc1c7a1a9dd317c039046ea032e3ed31e753))
* resolve totalSections undefined reference in terminal preview ([c0e407e](https://github.com/mrgoonie/claudekit-cli/commit/c0e407e0fc9af0c2c429eca19993886d8ea2f700))
* section color selects show correct defaults on initial load ([6e760c9](https://github.com/mrgoonie/claudekit-cli/commit/6e760c93461c592f05b4136bfa957be3f080d29d))
* show section icons alongside names in Section Colors controls ([e589b95](https://github.com/mrgoonie/claudekit-cli/commit/e589b950d9d425d1478948832d45592b9e77b3d0))
* tune preview panel widths and terminal truncation ([bcd317f](https://github.com/mrgoonie/claudekit-cli/commit/bcd317fa98c60a652c197f2397697b62bfb2074c))
* use correct progress bar chars (▰▱) matching actual statusline renderer ([779c892](https://github.com/mrgoonie/claudekit-cli/commit/779c892c0c63fc76744ab03c455a4698ee97356b))

## [3.40.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.40.2...v3.40.3) (2026-04-01)

### 🐞 Bug Fixes

* **release:** avoid shell interpolation in prepublish check ([c31ab34](https://github.com/mrgoonie/claudekit-cli/commit/c31ab34fafbef792bec42925cc7948b288f72a8c))
* **release:** sync version before release rebuild ([db5b291](https://github.com/mrgoonie/claudekit-cli/commit/db5b2919cb388af6401966b4de6b203b92ea3b12))

## [3.40.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.40.1...v3.40.2) (2026-04-01)

### 🔥 Hotfixes

* **cli:** default ck update to stable channel ([d86a67c](https://github.com/mrgoonie/claudekit-cli/commit/d86a67cd9e6964ae07821cb4e09d1d63ee56a3ed))

## [3.40.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.40.0...v3.40.1) (2026-04-01)

### 🔥 Hotfixes

* **cli:** remove Bun runtime requirement from npm installs ([8dd0488](https://github.com/mrgoonie/claudekit-cli/commit/8dd04880b7c39490cdcc5422af77ff5cbb4622e3)), closes [#568](https://github.com/mrgoonie/claudekit-cli/issues/568)

### 🐞 Bug Fixes

* **package:** make Bun runtime guards stateless ([d62c119](https://github.com/mrgoonie/claudekit-cli/commit/d62c119b3ed68268977b11d08c69a3208c426b57))

### 📚 Documentation

* **readme:** clarify Bun is optional for CLI users ([988a536](https://github.com/mrgoonie/claudekit-cli/commit/988a5368b9019cfab21d0d0c5a818e8d92c3523a))

## [3.40.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.39.4...v3.40.0) (2026-04-01)

### 🚀 Features

* **config:** add statusline quota display toggle ([a1fdb3a](https://github.com/mrgoonie/claudekit-cli/commit/a1fdb3aee8cf2b51ca096c471a74fe8dad06b618))

### 🔥 Hotfixes

* canonicalize Gemini model values after save ([7937051](https://github.com/mrgoonie/claudekit-cli/commit/79370510e7d8339b5e6e7e6035c661aefe98aa87))
* preserve ck config state on partial saves ([070f025](https://github.com/mrgoonie/claudekit-cli/commit/070f02571311d74db5ff422a83d36bed6e788d45))
* self-heal legacy Gemini model ids in ck config ([c9417f9](https://github.com/mrgoonie/claudekit-cli/commit/c9417f9ab853701e7b31ea992ccdc45a05b46bb9))

### 🐞 Bug Fixes

* add regex fallback for frontmatter parser when YAML parsing fails ([23b9bb2](https://github.com/mrgoonie/claudekit-cli/commit/23b9bb248b4897f510afeb02416cb1fa6ce78504)), closes [#558](https://github.com/mrgoonie/claudekit-cli/issues/558)
* **init:** show correct per-kit version in multi-kit version selector ([6e545f9](https://github.com/mrgoonie/claudekit-cli/commit/6e545f916867b0e4b1052ff134fa2d172a70ac17))
* **update:** let ck init show kit selection in interactive mode ([113fb71](https://github.com/mrgoonie/claudekit-cli/commit/113fb713785d550de379ca308248988cb9ec61ca))
* **update:** log spawn errors at verbose level, add autoInit+yes test ([1373429](https://github.com/mrgoonie/claudekit-cli/commit/1373429a18d0b1536b29ea2607f1fc7e2b1aec28))
* **update:** use spawn with inherited stdio for interactive kit selection ([daa38a1](https://github.com/mrgoonie/claudekit-cli/commit/daa38a1cf0dd7db829d3279ea4428c869b7149f8))
* **versioning:** suppress false update prompt for beta prereleases ([de9f6fc](https://github.com/mrgoonie/claudekit-cli/commit/de9f6fc6c004bd017e8a94a438871ca14983f0c1))

### ♻️ Code Refactoring

* address review feedback — remove embedded serving dead code ([dc657f5](https://github.com/mrgoonie/claudekit-cli/commit/dc657f5f43463bcc9a708bbc1a59cafe27f8fe8e))
* remove native binary builds, ship npm-only distribution ([f037ab2](https://github.com/mrgoonie/claudekit-cli/commit/f037ab26394eed57929e0d4aa53a166a02286aae)), closes [#553](https://github.com/mrgoonie/claudekit-cli/issues/553)
* **versioning:** reuse isNewerVersion in ConfigVersionChecker, add beta test ([499d2d9](https://github.com/mrgoonie/claudekit-cli/commit/499d2d919c59ac296334e7d6d4c66b271135e975))

### ✅ Tests

* remove dead process.execPath setup from static-server tests ([743b15e](https://github.com/mrgoonie/claudekit-cli/commit/743b15e2756c8cc217bb9d9ae22aecc62fb2b735))

### 👷 CI

* sync main back into dev after stable release [skip ci] ([8f2ad40](https://github.com/mrgoonie/claudekit-cli/commit/8f2ad4092bd824ec328db965f102aefb4cfcc7b6))

## [3.39.4](https://github.com/mrgoonie/claudekit-cli/compare/v3.39.3...v3.39.4) (2026-04-01)

### 🔥 Hotfixes

* canonicalize Gemini model values after save ([c1409d6](https://github.com/mrgoonie/claudekit-cli/commit/c1409d6eebbe56f451cd888bb7768663df21674c))
* preserve ck config state on partial saves ([c4d6624](https://github.com/mrgoonie/claudekit-cli/commit/c4d66241aa3a6080d229c0c568be17d70d1876bc))
* self-heal legacy Gemini model ids in ck config ([19042a8](https://github.com/mrgoonie/claudekit-cli/commit/19042a88952614735f01d9d32a68705299d375ef))

## [3.39.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.39.2...v3.39.3) (2026-03-30)

### 🔥 Hotfixes

* decouple autoInitAfterUpdate from --yes flag in ck init ([3b61711](https://github.com/mrgoonie/claudekit-cli/commit/3b61711c10a21cb7c63210bb77d3f30b6ff87a6d)), closes [#550](https://github.com/mrgoonie/claudekit-cli/issues/550)
* restore package.json version to 3.39.2 for main branch parity ([d69b5cb](https://github.com/mrgoonie/claudekit-cli/commit/d69b5cbc7f053b26b8b6bd5ec062e0d3a5e7adea))

## [3.39.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.39.1...v3.39.2) (2026-03-30)

### 🔥 Hotfixes

* make --yes conditional in buildInitCommand to preserve kit selection prompt ([f4c079a](https://github.com/mrgoonie/claudekit-cli/commit/f4c079a47c828a145d2efa9a301220649acc8cae)), closes [#550](https://github.com/mrgoonie/claudekit-cli/issues/550)

## [3.39.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.39.0...v3.39.1) (2026-03-30)

### 🐞 Bug Fixes

* resolve global install hook MODULE_NOT_FOUND for bare .claude/ paths ([7f6a534](https://github.com/mrgoonie/claudekit-cli/commit/7f6a534820758cb2f72040bb94d2f18a7bda3cfe)), closes [#547](https://github.com/mrgoonie/claudekit-cli/issues/547)

## [3.39.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.38.0...v3.39.0) (2026-03-30)

### 🚀 Features

* **ci:** add sync-dev-after-release workflow ([498fb89](https://github.com/mrgoonie/claudekit-cli/commit/498fb89975b40891bff1ba462d9de453c72e74c3))
* **ci:** auto-label and close issues on dev/stable releases ([779c903](https://github.com/mrgoonie/claudekit-cli/commit/779c903c417db20f017f3a872dd02355007f7e4c)), closes [#N](https://github.com/mrgoonie/claudekit-cli/issues/N) [#544](https://github.com/mrgoonie/claudekit-cli/issues/544)
* **init:** add --force flag to bypass version check and force reinstall ([7f4ec17](https://github.com/mrgoonie/claudekit-cli/commit/7f4ec17d9678af961097e891d29899ead1fee0e7)), closes [#535](https://github.com/mrgoonie/claudekit-cli/issues/535)
* **skills:** consolidate gemini-cli skill paths to .agents/skills ([0886bd5](https://github.com/mrgoonie/claudekit-cli/commit/0886bd543036ad58bb3ff4bd9eb6cc47dbae6fc3)), closes [#530](https://github.com/mrgoonie/claudekit-cli/issues/530)
* **update:** add independent migrate step to update pipeline ([be8c73e](https://github.com/mrgoonie/claudekit-cli/commit/be8c73e668d9330f0a6810e439b4b807ac0f8640)), closes [#537](https://github.com/mrgoonie/claudekit-cli/issues/537)

### 🔥 Hotfixes

* fix cross-compile smoke check and Windows CI dashboard tests ([73ffde3](https://github.com/mrgoonie/claudekit-cli/commit/73ffde30ef6c9bdfc0e308d8baaf71b7cda1ce6d))
* skip install smoke test for cross-compiled builds ([590d362](https://github.com/mrgoonie/claudekit-cli/commit/590d36208b4c7a79c3a4adb4790b62eb6687fabe))

### 🐞 Bug Fixes

* **ci:** add issues:write permission and scan full commit message for refs ([81bf87c](https://github.com/mrgoonie/claudekit-cli/commit/81bf87c0639056a2ab07f4ed9136bb4696057527))
* **ci:** store bash regex in variable to avoid syntax error on CI ([63eda5a](https://github.com/mrgoonie/claudekit-cli/commit/63eda5a257e2be26e53b022c69491622b6cd659a))
* clarify wrapper signal guard ([1be4589](https://github.com/mrgoonie/claudekit-cli/commit/1be458938ec3eef36961c0a6864749716bca4714))
* **cli:** suppress expected dev Bun fallback warning ([42993b5](https://github.com/mrgoonie/claudekit-cli/commit/42993b57e3a22632312af54ef33a17a6ed22197d)), closes [#533](https://github.com/mrgoonie/claudekit-cli/issues/533)
* harden linux binary compatibility handling ([cbfc340](https://github.com/mrgoonie/claudekit-cli/commit/cbfc34030c6a9430f7c67a1bec51679ba9f91bb0))
* **init:** clarify --force requires --yes, add runtime warning ([bcbb026](https://github.com/mrgoonie/claudekit-cli/commit/bcbb02689c934b663f672d6e8941098a4a775124))
* **release:** align tag detection and harden dev release notes generation ([53de954](https://github.com/mrgoonie/claudekit-cli/commit/53de954d0a44f4ab0385698ccae1154621ebffe6))
* **release:** rebuild dev package after version bump ([935eb7d](https://github.com/mrgoonie/claudekit-cli/commit/935eb7dac27adf3d1fe1a1776b6ce2dadd68e61b)), closes [#529](https://github.com/mrgoonie/claudekit-cli/issues/529)
* **release:** restore structured sections in dev release notifications ([e0d6633](https://github.com/mrgoonie/claudekit-cli/commit/e0d663329e121993de55da16aa50d1b0e53ec611)), closes [#542](https://github.com/mrgoonie/claudekit-cli/issues/542)
* **skills:** make legacy cleanup best-effort and guard registry migration write ([de1f2a0](https://github.com/mrgoonie/claudekit-cli/commit/de1f2a0d07416172b45a3870b4ee672a77c6dee0))
* **update:** address review feedback on migrate pipeline ([296dd05](https://github.com/mrgoonie/claudekit-cli/commit/296dd052ea9ab108fc24a33e1b37f17dae21464d))
* **update:** remove unused _yes param, add -g flag for global installs ([e2fe47b](https://github.com/mrgoonie/claudekit-cli/commit/e2fe47b903d59fcbbef73df49d39ec7228a97f76))

### ♻️ Code Refactoring

* **config:** rename autoMigrateAfterInit to autoMigrateAfterUpdate ([7c2ec95](https://github.com/mrgoonie/claudekit-cli/commit/7c2ec954b75985c518999ef5689b3b92c6ff4a91))

### ✅ Tests

* **update:** add tests for 3-step pipeline and fix deps mocks ([8c5f64c](https://github.com/mrgoonie/claudekit-cli/commit/8c5f64cf22195ae76d0a62b83bef1ee3081478a6))

## [3.38.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.37.0...v3.38.0) (2026-03-29)

### 🚀 Features

* bump version to 3.38.0 (skip faulty 3.37.0-dev series) ([acb87fb](https://github.com/mrgoonie/claudekit-cli/commit/acb87fb75a49e43d680d4838dded47bf863bd60f))

## [3.37.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.2...v3.37.0) (2026-03-29)

### 🚀 Features

* **config:** add updatePipeline schema to .ck.json ([e038ed0](https://github.com/mrgoonie/claudekit-cli/commit/e038ed084cd2b7243b4b8d717ca4263e50cdf4fc)), closes [#507](https://github.com/mrgoonie/claudekit-cli/issues/507)
* **dashboard:** add Update Pipeline section to config UI ([890461e](https://github.com/mrgoonie/claudekit-cli/commit/890461e52d2adc44bee45a65d7d6ae4831068368))
* **init:** auto-chain update -> init -> migrate pipeline ([7c8f3cc](https://github.com/mrgoonie/claudekit-cli/commit/7c8f3cc1118531243ebe794377023c14f5f269c6)), closes [#507](https://github.com/mrgoonie/claudekit-cli/issues/507)

### 🔥 Hotfixes

* fix cross-compile smoke check and Windows CI dashboard tests ([29c7806](https://github.com/mrgoonie/claudekit-cli/commit/29c78063e43ee145016ba17f61071a6c33203810))
* harden packaged cli install verification ([462b599](https://github.com/mrgoonie/claudekit-cli/commit/462b5992e28d786fb237f6a1e940ccf9dc27b9b0))
* harden packaged dashboard verification ([2f12c63](https://github.com/mrgoonie/claudekit-cli/commit/2f12c632f60b05fe49e76e6fe2c8fbaa71bc47e5))
* publish native binaries in npm package ([24aef4f](https://github.com/mrgoonie/claudekit-cli/commit/24aef4f5a8f2814a52ec80d6fcc89a28c672519e))
* restore dashboard assets in shipped binaries ([c09b984](https://github.com/mrgoonie/claudekit-cli/commit/c09b984c4c09f9b05bb7007d25c9991ea0f0b661))
* skip install smoke test for cross-compiled builds ([90da46a](https://github.com/mrgoonie/claudekit-cli/commit/90da46a10b8a2c9a81f28194bc96dfe7f57843e3))

### 🐞 Bug Fixes

* **ci:** restore Claude Code Review by fixing permissions and prompt ([74fe27a](https://github.com/mrgoonie/claudekit-cli/commit/74fe27a13f961ee356d76f80d42a5fa27d78f2a3))
* **ci:** restore claude_args removed by plugin migration ([f78349b](https://github.com/mrgoonie/claudekit-cli/commit/f78349bdfe47a48b020ad657d0f986133bb9f873))
* **config-editor:** self-heal migrate providers and panel layout ([33e0b3e](https://github.com/mrgoonie/claudekit-cli/commit/33e0b3eeb9559a0478316a6bfe6b5e4f828db769)), closes [#515](https://github.com/mrgoonie/claudekit-cli/issues/515) [#507](https://github.com/mrgoonie/claudekit-cli/issues/507)
* **config:** support intentional remote dashboard access ([eaac502](https://github.com/mrgoonie/claudekit-cli/commit/eaac502918fbd8db21b4f596ea527d451553b34f))
* **init:** address review findings — injection guard, routing, types ([6d79e24](https://github.com/mrgoonie/claudekit-cli/commit/6d79e24135529771aa07d98c7af246a635b774fb))
* **migrate:** heal merge-single checksum drift and section parsing ([81e96df](https://github.com/mrgoonie/claudekit-cli/commit/81e96df9649a5cefd37cbc036ef05c3cae8caf16))
* **migrate:** resolve false conflicts for merged providers ([a15d539](https://github.com/mrgoonie/claudekit-cli/commit/a15d53920741c92d5d149e40d693e841620856d8))
* **release:** decouple dev from semantic-release version prediction ([dc38e72](https://github.com/mrgoonie/claudekit-cli/commit/dc38e721a0e17df20d38a428b04eff17c1a13faf)), closes [#524](https://github.com/mrgoonie/claudekit-cli/issues/524)
* **release:** keep prerelease installs on dev channel ([7f47bc2](https://github.com/mrgoonie/claudekit-cli/commit/7f47bc256d2395bd12b230d57dce78e8ddf3107f))
* **release:** reorder commit before npm publish and fix credential handling ([6eb0ae0](https://github.com/mrgoonie/claudekit-cli/commit/6eb0ae05aad8167959bb1abbcc5e57c2eb085649)), closes [#524](https://github.com/mrgoonie/claudekit-cli/issues/524)
* surface hook registration failures during migrate ([ca3a4ce](https://github.com/mrgoonie/claudekit-cli/commit/ca3a4ce4edc0aa28882930b3e3baa77d910940cc))
* **tests:** align config editor coverage with root CI ([8d9f383](https://github.com/mrgoonie/claudekit-cli/commit/8d9f3839d13addd9e092600b7e29ef41cb86f3ab))
* **ui:** preserve migrate providers draft editing ([97aee1d](https://github.com/mrgoonie/claudekit-cli/commit/97aee1ddac5e6401049b6352284043c40daee8af))

### ✅ Tests

* normalize hook migration path assertions ([d771968](https://github.com/mrgoonie/claudekit-cli/commit/d771968fa91f005451f385492a858aa58bc0d4e0))
* **update-cli:** accept injected confirm helper ([756b4eb](https://github.com/mrgoonie/claudekit-cli/commit/756b4eb30a4d47fa600190331364885ea27afcf3))
* **update-cli:** cover auto-init and post-init migrate flow ([07d03dc](https://github.com/mrgoonie/claudekit-cli/commit/07d03dc7a08269947994779ca8ced0d6b818483c))
* **update-pipeline:** avoid cross-file mock pollution ([510afc5](https://github.com/mrgoonie/claudekit-cli/commit/510afc51ee135f14e1cc72f4c69b03c9c7f1e17a))

## [3.37.0-dev.6](https://github.com/mrgoonie/claudekit-cli/compare/v3.37.0-dev.5...v3.37.0-dev.6) (2026-03-29)

### 🔥 Hotfixes

* harden packaged dashboard verification ([2f12c63](https://github.com/mrgoonie/claudekit-cli/commit/2f12c632f60b05fe49e76e6fe2c8fbaa71bc47e5))
* restore dashboard assets in shipped binaries ([c09b984](https://github.com/mrgoonie/claudekit-cli/commit/c09b984c4c09f9b05bb7007d25c9991ea0f0b661))

### 🐞 Bug Fixes

* **ci:** restore claude_args removed by plugin migration ([6a4d45c](https://github.com/mrgoonie/claudekit-cli/commit/6a4d45cfdb018863aa8081b153a44a122e8d7e1a))
* **migrate:** heal merge-single checksum drift and section parsing ([81e96df](https://github.com/mrgoonie/claudekit-cli/commit/81e96df9649a5cefd37cbc036ef05c3cae8caf16))
* **migrate:** resolve false conflicts for merged providers ([a15d539](https://github.com/mrgoonie/claudekit-cli/commit/a15d53920741c92d5d149e40d693e841620856d8))

## [3.37.0-dev.5](https://github.com/mrgoonie/claudekit-cli/compare/v3.37.0-dev.4...v3.37.0-dev.5) (2026-03-29)

### 🐞 Bug Fixes

* **ci:** restore Claude Code Review by fixing permissions and prompt ([74fe27a](https://github.com/mrgoonie/claudekit-cli/commit/74fe27a13f961ee356d76f80d42a5fa27d78f2a3))
* **ci:** restore claude_args removed by plugin migration ([f78349b](https://github.com/mrgoonie/claudekit-cli/commit/f78349bdfe47a48b020ad657d0f986133bb9f873))

## [3.37.0-dev.4](https://github.com/mrgoonie/claudekit-cli/compare/v3.37.0-dev.3...v3.37.0-dev.4) (2026-03-28)

### 🐞 Bug Fixes

* surface hook registration failures during migrate ([ca3a4ce](https://github.com/mrgoonie/claudekit-cli/commit/ca3a4ce4edc0aa28882930b3e3baa77d910940cc))

### ✅ Tests

* normalize hook migration path assertions ([d771968](https://github.com/mrgoonie/claudekit-cli/commit/d771968fa91f005451f385492a858aa58bc0d4e0))

## [3.37.0-dev.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.37.0-dev.2...v3.37.0-dev.3) (2026-03-28)

### 🐞 Bug Fixes

* **config-editor:** self-heal migrate providers and panel layout ([33e0b3e](https://github.com/mrgoonie/claudekit-cli/commit/33e0b3eeb9559a0478316a6bfe6b5e4f828db769)), closes [#515](https://github.com/mrgoonie/claudekit-cli/issues/515) [#507](https://github.com/mrgoonie/claudekit-cli/issues/507)
* **tests:** align config editor coverage with root CI ([8d9f383](https://github.com/mrgoonie/claudekit-cli/commit/8d9f3839d13addd9e092600b7e29ef41cb86f3ab))
* **ui:** preserve migrate providers draft editing ([97aee1d](https://github.com/mrgoonie/claudekit-cli/commit/97aee1ddac5e6401049b6352284043c40daee8af))

## [3.37.0-dev.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.37.0-dev.1...v3.37.0-dev.2) (2026-03-28)

### 🐞 Bug Fixes

* **config:** support intentional remote dashboard access ([eaac502](https://github.com/mrgoonie/claudekit-cli/commit/eaac502918fbd8db21b4f596ea527d451553b34f))

## [3.37.0-dev.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.1...v3.37.0-dev.1) (2026-03-28)

### 🚀 Features

* **config:** add updatePipeline schema to .ck.json ([e038ed0](https://github.com/mrgoonie/claudekit-cli/commit/e038ed084cd2b7243b4b8d717ca4263e50cdf4fc)), closes [#507](https://github.com/mrgoonie/claudekit-cli/issues/507)
* **dashboard:** add Update Pipeline section to config UI ([890461e](https://github.com/mrgoonie/claudekit-cli/commit/890461e52d2adc44bee45a65d7d6ae4831068368))
* **init:** auto-chain update -> init -> migrate pipeline ([7c8f3cc](https://github.com/mrgoonie/claudekit-cli/commit/7c8f3cc1118531243ebe794377023c14f5f269c6)), closes [#507](https://github.com/mrgoonie/claudekit-cli/issues/507)

### 🔥 Hotfixes

* harden packaged cli install verification ([462b599](https://github.com/mrgoonie/claudekit-cli/commit/462b5992e28d786fb237f6a1e940ccf9dc27b9b0))
* publish native binaries in npm package ([24aef4f](https://github.com/mrgoonie/claudekit-cli/commit/24aef4f5a8f2814a52ec80d6fcc89a28c672519e))

### 🐞 Bug Fixes

* **init:** address review findings — injection guard, routing, types ([6d79e24](https://github.com/mrgoonie/claudekit-cli/commit/6d79e24135529771aa07d98c7af246a635b774fb))
* **release:** keep prerelease installs on dev channel ([7f47bc2](https://github.com/mrgoonie/claudekit-cli/commit/7f47bc256d2395bd12b230d57dce78e8ddf3107f))

### ✅ Tests

* **update-cli:** accept injected confirm helper ([756b4eb](https://github.com/mrgoonie/claudekit-cli/commit/756b4eb30a4d47fa600190331364885ea27afcf3))
* **update-cli:** cover auto-init and post-init migrate flow ([07d03dc](https://github.com/mrgoonie/claudekit-cli/commit/07d03dc7a08269947994779ca8ced0d6b818483c))
* **update-pipeline:** avoid cross-file mock pollution ([510afc5](https://github.com/mrgoonie/claudekit-cli/commit/510afc51ee135f14e1cc72f4c69b03c9c7f1e17a))

## [3.36.0-dev.37](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.36...v3.36.0-dev.37) (2026-03-28)

### 🚀 Features

* **config:** add updatePipeline schema to .ck.json ([e038ed0](https://github.com/mrgoonie/claudekit-cli/commit/e038ed084cd2b7243b4b8d717ca4263e50cdf4fc)), closes [#507](https://github.com/mrgoonie/claudekit-cli/issues/507)
* **dashboard:** add Update Pipeline section to config UI ([890461e](https://github.com/mrgoonie/claudekit-cli/commit/890461e52d2adc44bee45a65d7d6ae4831068368))
* **init:** auto-chain update -> init -> migrate pipeline ([7c8f3cc](https://github.com/mrgoonie/claudekit-cli/commit/7c8f3cc1118531243ebe794377023c14f5f269c6)), closes [#507](https://github.com/mrgoonie/claudekit-cli/issues/507)

### 🐞 Bug Fixes

* **init:** address review findings — injection guard, routing, types ([6d79e24](https://github.com/mrgoonie/claudekit-cli/commit/6d79e24135529771aa07d98c7af246a635b774fb))

### ✅ Tests

* **update-cli:** accept injected confirm helper ([756b4eb](https://github.com/mrgoonie/claudekit-cli/commit/756b4eb30a4d47fa600190331364885ea27afcf3))
* **update-cli:** cover auto-init and post-init migrate flow ([07d03dc](https://github.com/mrgoonie/claudekit-cli/commit/07d03dc7a08269947994779ca8ced0d6b818483c))
* **update-pipeline:** avoid cross-file mock pollution ([510afc5](https://github.com/mrgoonie/claudekit-cli/commit/510afc51ee135f14e1cc72f4c69b03c9c7f1e17a))

## [3.36.0-dev.36](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.35...v3.36.0-dev.36) (2026-03-28)

### 🔥 Hotfixes

* harden packaged cli install verification ([462b599](https://github.com/mrgoonie/claudekit-cli/commit/462b5992e28d786fb237f6a1e940ccf9dc27b9b0))
* publish native binaries in npm package ([24aef4f](https://github.com/mrgoonie/claudekit-cli/commit/24aef4f5a8f2814a52ec80d6fcc89a28c672519e))

## [3.36.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0...v3.36.1) (2026-03-28)

### 🔥 Hotfixes

* harden packaged cli install verification ([760f8ba](https://github.com/mrgoonie/claudekit-cli/commit/760f8bacb71a8fd714b69cbc66dcc797e869b6fa))
* publish native binaries in npm package ([97097f9](https://github.com/mrgoonie/claudekit-cli/commit/97097f932c179fc0898bc72a4c2fbc9f22de4613))

## [3.36.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0...v3.36.0) (2026-03-28)

### ⚠ BREAKING CHANGES

* **content:** none

### 🚀 Features

* add plan-parser domain with ck plan command suite and kanban dashboard ([8618961](https://github.com/mrgoonie/claudekit-cli/commit/86189617b5ef29681d4f80b3236543f3c4cc6aff))
* add statuslineColors config toggle in ck config ([64de378](https://github.com/mrgoonie/claudekit-cli/commit/64de378ba055c17e2cf76e8d2f17f5ee07a36707)), closes [#488](https://github.com/mrgoonie/claudekit-cli/issues/488)
* **api:** implement ck api command group with claudekit-api client ([d06dbb3](https://github.com/mrgoonie/claudekit-cli/commit/d06dbb3d43b87a17e2f34d77753dc0576e49e639))
* ck migrate UX overhaul — source transparency, unified discovery, path previews ([12d1149](https://github.com/mrgoonie/claudekit-cli/commit/12d114909ee3422ccc5c4d0f9368b1aa79097673)), closes [#472](https://github.com/mrgoonie/claudekit-cli/issues/472)
* **config:** add hook diagnostics dashboard ([fa0f36b](https://github.com/mrgoonie/claudekit-cli/commit/fa0f36b360a46773c00ae9f1260e9a54b4352eb4))
* **content:** add content command to help system ([60acd5c](https://github.com/mrgoonie/claudekit-cli/commit/60acd5cee5f0bbe1374c08f7a91968adb3b47ce0))
* **content:** auto-install xurl during X platform setup ([521388b](https://github.com/mrgoonie/claudekit-cli/commit/521388be48b12794d4048d6b44c54d048c04cb6a))
* **content:** implement multi-channel engine with git monitoring and social publishing ([6b13567](https://github.com/mrgoonie/claudekit-cli/commit/6b135670ff42f96eb2336ea05bf655bf9b3b1284))
* **content:** replace Facebook OAuth login with page token onboarding ([f54a9f0](https://github.com/mrgoonie/claudekit-cli/commit/f54a9f069da21250867dbf2533615367df4e00c8))
* **dashboard:** add model taxonomy editor with per-provider table grid ([9f26205](https://github.com/mrgoonie/claudekit-cli/commit/9f262051e7a8de28037bb34068a6b0eb0e6a294e))
* enforce quality gate locally via git hooks ([6cc9fe5](https://github.com/mrgoonie/claudekit-cli/commit/6cc9fe52c714efccb4decccb8ec1b4816bd335d8)), closes [#483](https://github.com/mrgoonie/claudekit-cli/issues/483)
* **help:** add watch command help documentation and registry ([d2f6c56](https://github.com/mrgoonie/claudekit-cli/commit/d2f6c561d83b0b6b82adf7df464813c5bc8d699d))
* **init:** auto-install CK plugin for ck:* skill namespace ([235e63d](https://github.com/mrgoonie/claudekit-cli/commit/235e63d3ba96e1e0d714dfbad2df5ab4183da064)), closes [#493](https://github.com/mrgoonie/claudekit-cli/issues/493)
* **migrate:** add Codex hooks support to ck migrate ([64deafc](https://github.com/mrgoonie/claudekit-cli/commit/64deafc95ed2bb18b48622f23838a94210a9dbc4)), closes [#505](https://github.com/mrgoonie/claudekit-cli/issues/505)
* **migrate:** add droid hooks migration support ([e2e0e84](https://github.com/mrgoonie/claudekit-cli/commit/e2e0e84f2fe994fd9fbc4d2b3fe7a351b1d625d7))
* **migrate:** add hooks migration with settings.json auto-registration ([b73714f](https://github.com/mrgoonie/claudekit-cli/commit/b73714f4fd2b0ef294d71d245ad657708ab3dce7))
* **migrate:** improve dashboard plan review UX and CLI help ([b92698c](https://github.com/mrgoonie/claudekit-cli/commit/b92698c486484cc36df8752a0261fd116cb57868)), closes [#456](https://github.com/mrgoonie/claudekit-cli/issues/456)
* **plan:** add write commands — create, check, uncheck, add-phase ([6870ae8](https://github.com/mrgoonie/claudekit-cli/commit/6870ae88c2a050777cc8ccd4d8bc4bc1830e67e6))
* **plugin:** add skills fallback and sync mode support ([d9416fa](https://github.com/mrgoonie/claudekit-cli/commit/d9416fa23628538ffb5bb9e020a8459422c93970))
* **plugin:** implement plugin-only migration with verified install ([96303c6](https://github.com/mrgoonie/claudekit-cli/commit/96303c61dd96033d1d7420610bdc75d62b962657))
* **plugin:** implement plugin-only migration with verified install ([ca9e378](https://github.com/mrgoonie/claudekit-cli/commit/ca9e378ba974d700df544e313bf2bac1d58cb34c))
* **portable:** add central model taxonomy for multi-provider migration ([fab43e1](https://github.com/mrgoonie/claudekit-cli/commit/fab43e1ca833c017b55ae646116ec8c65d92b715))
* **portable:** add Gemini CLI to taxonomy, user-configurable mappings ([047e2ac](https://github.com/mrgoonie/claudekit-cli/commit/047e2ac703540ec51709a6ed6315156a56f0eff5))
* **skills:** support agentskills.io `metadata.version` and `metadata.author` fields ([0feb2d7](https://github.com/mrgoonie/claudekit-cli/commit/0feb2d7ca0ffdcffe00e4da16486bd558c9beae6))
* skip kit reinstall when version unchanged during --yes mode ([8769af5](https://github.com/mrgoonie/claudekit-cli/commit/8769af53a327ed006e66f0580edb867b53f1b098)), closes [#479](https://github.com/mrgoonie/claudekit-cli/issues/479)
* support CLAUDE_CONFIG_DIR env var in getGlobalKitDir() ([75e9966](https://github.com/mrgoonie/claudekit-cli/commit/75e99667c2646b5c416de5b569e8473321d04023)), closes [#490](https://github.com/mrgoonie/claudekit-cli/issues/490)
* **ui:** add action tabs + type sub-sections to migration plan review ([7da1da2](https://github.com/mrgoonie/claudekit-cli/commit/7da1da26389e7c18cf76401bb60d93e6d952e43f))
* **update:** show kit version transition during kit content updates ([9b81142](https://github.com/mrgoonie/claudekit-cli/commit/9b811429029d2c26730edca2b60b31ec68908463)), closes [#467](https://github.com/mrgoonie/claudekit-cli/issues/467)
* **watch:** add maintainer filtering, state TTL, worktree isolation, rate persistence ([2036b2c](https://github.com/mrgoonie/claudekit-cli/commit/2036b2c9a7e81585f33fda7d8870ec982611d4cb))
* **watch:** add multi-repo support with repo discovery and plan directory resolution ([00fa025](https://github.com/mrgoonie/claudekit-cli/commit/00fa025d9069cbd60aafcda68d7e605945f4f319))
* **watch:** implement approval detection and auto-implementation ([924c47b](https://github.com/mrgoonie/claudekit-cli/commit/924c47bccc421e408677d053120b1d1dbe6cbfd5))
* **watch:** implement ck watch command for GitHub Issues automation ([f36249e](https://github.com/mrgoonie/claudekit-cli/commit/f36249e4c8aa2274e0e9f6faca1878adfe1013cd))

### 🐞 Bug Fixes

* add .claude/ path replacement for all non-Claude providers ([749e948](https://github.com/mrgoonie/claudekit-cli/commit/749e9480b470af5f70b1afd32d85f30000f4abd0))
* add error guard around checksum populate loop ([28ddb38](https://github.com/mrgoonie/claudekit-cli/commit/28ddb3819fb5bbef8717c401a69a6880ff0330ee))
* add standalone skill overlap cleanup after plugin install ([604afce](https://github.com/mrgoonie/claudekit-cli/commit/604afce969c0d2d2747febe54f65b173c9c37f5b)), closes [claudekit/claudekit-engineer#513](https://github.com/claudekit/claudekit-engineer/issues/513)
* add verbose logging in catch block, remove outro from selection-handler ([96a920c](https://github.com/mrgoonie/claudekit-cli/commit/96a920c46063a45f61d4d159e24f84723ff9390d))
* address code review feedback — lint-first order, env var docs, path docs ([f160f2b](https://github.com/mrgoonie/claudekit-cli/commit/f160f2b328a18b4be2ccca369bbf547513a318ef))
* address code review feedback (attempt 1/5) ([86eb8fc](https://github.com/mrgoonie/claudekit-cli/commit/86eb8fc75661b50df55ab0769934d7bd28ae48c8))
* address code review feedback for standalone skill cleanup ([a5cc205](https://github.com/mrgoonie/claudekit-cli/commit/a5cc205c643c1d5e3d5943b8679af7d5d7962d34))
* address PR review feedback — lint, tab sync, type safety, padding ([91037d3](https://github.com/mrgoonie/claudekit-cli/commit/91037d3448b79544f636164c0fc824f1056ea3ab))
* align statuslineColors field doc with FieldDoc interface ([8cf08f1](https://github.com/mrgoonie/claudekit-cli/commit/8cf08f1aa66f4d4bf4ec88e31125f2b3a1189aa6))
* apply biome formatting to reconciler test file ([f2d9610](https://github.com/mrgoonie/claudekit-cli/commit/f2d96106e5293f567b9cfe39ceceddfdd62d18b0))
* apply biome formatting to test file ([7dbca89](https://github.com/mrgoonie/claudekit-cli/commit/7dbca89d55a4a37ab5404a8b624657a511efeb83))
* **build:** externalize better-sqlite3 from bundle ([ae72e4f](https://github.com/mrgoonie/claudekit-cli/commit/ae72e4f8691a38866ff2b1826c11af5925d34e27))
* **build:** strip // [@bun](https://github.com/bun) marker from dist/index.js to fix UTF-8 rendering ([b0c1adb](https://github.com/mrgoonie/claudekit-cli/commit/b0c1adbd5c8987a534e1c4bbf45f6b96766bceae)), closes [#499](https://github.com/mrgoonie/claudekit-cli/issues/499)
* call promptKitUpdateFn when CLI is newer than stable latest ([a9793aa](https://github.com/mrgoonie/claudekit-cli/commit/a9793aa567dc5a7ada93cd280504416951c47090)), closes [#485](https://github.com/mrgoonie/claudekit-cli/issues/485)
* **ci:** decouple Discord notification from semantic-release exit code ([c6fc986](https://github.com/mrgoonie/claudekit-cli/commit/c6fc986713cfeba56b2672b170472c5f9ec1bb16))
* **ci:** fail fast on hung test diagnostics ([7413410](https://github.com/mrgoonie/claudekit-cli/commit/741341092a8377d1b67c4e2990a6a5ea4ac25e3b))
* clarify Case B skip reason string to reflect checksum backfill ([332c6ea](https://github.com/mrgoonie/claudekit-cli/commit/332c6eab44d40bcf99b16b36f09e408f71bbbcf7))
* clarify diff snapshot comment, inline REPO_ROOT in install.sh ([b020e38](https://github.com/mrgoonie/claudekit-cli/commit/b020e383230bde50056ce6120b1dcb317df030b1))
* **cli:** add bun runtime detection for dev releases without platform binaries ([47743f3](https://github.com/mrgoonie/claudekit-cli/commit/47743f3b00c1155517961e11d624583a3ac3d10f)), closes [#499](https://github.com/mrgoonie/claudekit-cli/issues/499)
* **cli:** add timeout, caching, and actionable error messages to bun fallback ([4acdde3](https://github.com/mrgoonie/claudekit-cli/commit/4acdde30fa9223cebbecc63b462f3a6a56a2930f)), closes [#499](https://github.com/mrgoonie/claudekit-cli/issues/499)
* **cli:** restore cross-platform wrapper script in bin/ck.js ([7d5e877](https://github.com/mrgoonie/claudekit-cli/commit/7d5e8774d41de11d45b322578df5550944a7c8de)), closes [#499](https://github.com/mrgoonie/claudekit-cli/issues/499)
* **cli:** use spawnSync for bun runtime to fix Unicode rendering ([31361d0](https://github.com/mrgoonie/claudekit-cli/commit/31361d01dc7cf1653c2abfacf56528f83e4bb135)), closes [#499](https://github.com/mrgoonie/claudekit-cli/issues/499)
* **config:** avoid sync hook log existence checks ([080a1c6](https://github.com/mrgoonie/claudekit-cli/commit/080a1c6a6595ad4bc1efeaed96d16677177e1e66))
* **config:** decouple scanner cache from test env ([cb8acba](https://github.com/mrgoonie/claudekit-cli/commit/cb8acbaa1b5a5dd0e5376accf97f9cb04647f6f7))
* **config:** harden hook diagnostics reader and dashboard ([6848e9e](https://github.com/mrgoonie/claudekit-cli/commit/6848e9ef31fd37a78f6a1fd7cb745d1216d5253b))
* **config:** harden hook diagnostics review follow-ups ([7d90497](https://github.com/mrgoonie/claudekit-cli/commit/7d904975d66b17303d5d2a0df8dde76fcd7953d3))
* **config:** tighten hook diagnostics project resolution ([a09d807](https://github.com/mrgoonie/claudekit-cli/commit/a09d807a93c4762423f1286e2468ba232abd9281))
* **config:** tighten hook diagnostics runtime contracts ([1ba66b3](https://github.com/mrgoonie/claudekit-cli/commit/1ba66b39a44af07d6fa465bf7a202a88d28b3fc0))
* **content:** address Claude review findings ([629c9fc](https://github.com/mrgoonie/claudekit-cli/commit/629c9fc0df853f765970c9089454d4ed4134cc52))
* **content:** continue daemon after setup wizard completes ([ff46fdd](https://github.com/mrgoonie/claudekit-cli/commit/ff46fdd5174964ae4e5fdb70988c4d4d3b76c5b1))
* **content:** correct xurl auth command to oauth1 ([1b9a0b7](https://github.com/mrgoonie/claudekit-cli/commit/1b9a0b7ff662851cbad5d877831a269e9a43e6b6))
* **content:** fix daemon exit and setup gate ([622ce7d](https://github.com/mrgoonie/claudekit-cli/commit/622ce7de0896ca6e9676a6de9cd6d7391d1759d7))
* **content:** fix repo detection and auto-route to setup wizard ([23c1ae2](https://github.com/mrgoonie/claudekit-cli/commit/23c1ae26b1bc0be37f73e161c2e33182c276d0b8))
* **content:** improve git fetch resilience with SSH/HTTPS fallback ([d861c0e](https://github.com/mrgoonie/claudekit-cli/commit/d861c0e88bfc9a03789c66153a0d403f9aac38d3))
* **content:** improve scan logging and extend first-run lookback ([98b430e](https://github.com/mrgoonie/claudekit-cli/commit/98b430ee74f5090a987c13ccb3a3d96f52a50686))
* **content:** resolve edge cases across content daemon pipeline ([8156e33](https://github.com/mrgoonie/claudekit-cli/commit/8156e333a08dd4fb7d1ba1a691f25364f1cf85ac))
* **content:** update help registry tests for content command ([a039490](https://github.com/mrgoonie/claudekit-cli/commit/a039490c6ec484e86ec4a30feece77cc848f318f))
* **content:** use correct xurl install methods ([a5c32c2](https://github.com/mrgoonie/claudekit-cli/commit/a5c32c20ad3dbe139b1f2fdd0f0bd8e5a73ac75f))
* **content:** use single command with action routing ([92cbbec](https://github.com/mrgoonie/claudekit-cli/commit/92cbbecd8a76c788b327a5b1f59b064fa2d6118b))
* **content:** use xurl auth status for credential check ([db3f0a4](https://github.com/mrgoonie/claudekit-cli/commit/db3f0a45dfb898b30db944605decf7ffb426e29f))
* convert OpenCode agent tools from string to boolean object ([d95bbb5](https://github.com/mrgoonie/claudekit-cli/commit/d95bbb54f89e3241699b85c83596ed6cbc3ee4d2)), closes [#459](https://github.com/mrgoonie/claudekit-cli/issues/459)
* correct Cline format (markdown not JSON) and Amp config path (AGENT.md) ([8459003](https://github.com/mrgoonie/claudekit-cli/commit/84590039c4b1488fccfe094c4499c4df360c88ad))
* correct OpenCode tool map and skills path from docs verification ([6fa5e39](https://github.com/mrgoonie/claudekit-cli/commit/6fa5e399d3eef699e766871744735ae63faddac7))
* **dashboard:** memoize i18n context, simplify phase keys, document kanban route ([f4ee125](https://github.com/mrgoonie/claudekit-cli/commit/f4ee125b6c164b3f100afb7501bef48e0d8c8d19))
* **dashboard:** taxonomy editor layout with pixel-based vertical resize ([c06d57b](https://github.com/mrgoonie/claudekit-cli/commit/c06d57b1a17f0806fd8c004b2630ff2c8dc16087))
* **dashboard:** taxonomy editor UX — default open, scrollable, dedicated section ([53c3079](https://github.com/mrgoonie/claudekit-cli/commit/53c3079eaab01b3faf104ed52dd3344f3caf5e0f))
* deduplicate shell hook skip warning in dashboard migration ([bc11c23](https://github.com/mrgoonie/claudekit-cli/commit/bc11c235f3363dbb1c813fde916e9f47e72e52f2)), closes [#474](https://github.com/mrgoonie/claudekit-cli/issues/474)
* derive source metadata from kit source path, not user's installed metadata ([6691703](https://github.com/mrgoonie/claudekit-cli/commit/6691703ed7d72d630f27974c33864baed4101a55))
* detect provider path collisions in multi-provider migrate flow ([#450](https://github.com/mrgoonie/claudekit-cli/issues/450)) ([71e62df](https://github.com/mrgoonie/claudekit-cli/commit/71e62df94c5e6ec064924e4a90c2c51cb6b5740d))
* **detect:** document .agents/skills exclusion from detect arrays as design decision ([0f31dda](https://github.com/mrgoonie/claudekit-cli/commit/0f31ddabd9650614bf775f4313d043610e5e775d)), closes [#477](https://github.com/mrgoonie/claudekit-cli/issues/477)
* **detect:** memoize hasBinary cache, add tests for consolidated .agents/skills paths ([6b78ff5](https://github.com/mrgoonie/claudekit-cli/commit/6b78ff553ea750502acb9e9035cd2aa5e19e889e))
* **detect:** remove binary detection to preserve project-awareness, restore amp AGENT.md ([598ec47](https://github.com/mrgoonie/claudekit-cli/commit/598ec479e38d2128f905c94952c9b0cce44bb68a))
* **detect:** use spawnSync to prevent shell injection, check ~/Applications, prioritize config over binary ([660ee82](https://github.com/mrgoonie/claudekit-cli/commit/660ee82e8e4a4bf8b4a5965678476f0fc0da7150))
* enforce directory boundary in collision path matching ([#450](https://github.com/mrgoonie/claudekit-cli/issues/450)) ([f32b291](https://github.com/mrgoonie/claudekit-cli/commit/f32b2918f1d498a7f0338181d276a398e4724e4b))
* extract getGlobalConfigSourcePath to prevent CWD-first from breaking config source map ([4ef6d96](https://github.com/mrgoonie/claudekit-cli/commit/4ef6d965f38f514e2126ed9f24563f97fb145392))
* extract releaseTag variable for TypeScript narrowing, remove brittle slice tests ([bb8c357](https://github.com/mrgoonie/claudekit-cli/commit/bb8c357614c045f153ffe4866e692ef81d686b98))
* format long assertion line for biome line-length compliance ([2eb9efa](https://github.com/mrgoonie/claudekit-cli/commit/2eb9efa3730b2dfdf5caf8419b07e4b20ecde0ed))
* format single-element arrays for biome compliance ([097e71e](https://github.com/mrgoonie/claudekit-cli/commit/097e71ee4bf0a6190060723d3ea1afd99b85a56d))
* guard multi-kit early-exit, replace outro with logger, add clarifying comments ([97f4710](https://github.com/mrgoonie/claudekit-cli/commit/97f47101440d33600a548aa69341a0ef35cdf3d1))
* handle exists=false target state in Case B and add inline docs ([2d97a8f](https://github.com/mrgoonie/claudekit-cli/commit/2d97a8f908b9e4f1ebafd185d2f4584cd31e64d1))
* harden hook path extraction regex and add edge case tests ([faf3b94](https://github.com/mrgoonie/claudekit-cli/commit/faf3b945eaea1e1862d6713b30dbdfe7b728cce5))
* heal stale targets during v2→v3 registry migration instead of permanent skip ([8cc30b4](https://github.com/mrgoonie/claudekit-cli/commit/8cc30b48db480f858b9719793e88204057592f87)), closes [#466](https://github.com/mrgoonie/claudekit-cli/issues/466)
* **kanban-ui:** add empty state, responsive layout, and type safety ([7c51f04](https://github.com/mrgoonie/claudekit-cli/commit/7c51f046681e6967e8dddae3936cdcf43e2871d7))
* **kanban-ui:** clear stale phases before re-fetching new plan ([02186af](https://github.com/mrgoonie/claudekit-cli/commit/02186af9b639e2d6761a92ff1b68c530b0bb53af))
* **kanban-ui:** map HTTP errors to user-friendly i18n messages ([ae5a716](https://github.com/mrgoonie/claudekit-cli/commit/ae5a716289f20705543f986e1004f4214252af5b))
* **kanban-ui:** normalize Windows backslashes in file path display ([433a3c5](https://github.com/mrgoonie/claudekit-cli/commit/433a3c57ec5d4b4d886dd3b4a7b0402bf497b94c))
* log prepare errors, lint-first in pre-push, document diff edge case ([e1b2b3b](https://github.com/mrgoonie/claudekit-cli/commit/e1b2b3b4c7a7c79490fc64fb931e60febc4d0bb7))
* make pluginSkillsDir explicit param and parallelize dir scan ([b8d0b6e](https://github.com/mrgoonie/claudekit-cli/commit/b8d0b6e970351942f610eac4706ea648f748dc5b))
* **migrate:** add file lock, registry lock, and tests for codex config cleanup ([60482e6](https://github.com/mrgoonie/claudekit-cli/commit/60482e6c287bf93f1d7b14b9e37943f65876171e))
* **migrate:** add path traversal guard and blank line normalization for legacy cleanup ([0140205](https://github.com/mrgoonie/claudekit-cli/commit/0140205a8c475e6fd013ca3a2134fa3fb60ec5c8))
* **migrate:** clean legacy codex config.toml entries and port cleanup to dashboard ([e0441c1](https://github.com/mrgoonie/claudekit-cli/commit/e0441c18d353e94d40e1f765a638bc52467bfa65)), closes [#480](https://github.com/mrgoonie/claudekit-cli/issues/480)
* **migrate:** clean up stale codex config.toml entries for deleted agent files ([a2dcb6e](https://github.com/mrgoonie/claudekit-cli/commit/a2dcb6e7db3495b90607f8173bb7a686ec6efeac))
* **migrate:** consolidate .agents/skills/ paths and strengthen provider detection ([cae9bb4](https://github.com/mrgoonie/claudekit-cli/commit/cae9bb4b3dd8177dce43a40e123b463c75e10137)), closes [#477](https://github.com/mrgoonie/claudekit-cli/issues/477)
* **migrate:** derive scope from provider-specific actions and continue Phase 2 on Phase 1 error ([328c4b1](https://github.com/mrgoonie/claudekit-cli/commit/328c4b1d2a5a6d693d19b7719e8120c4a4ddde09))
* **migrate:** eliminate TOCTOU race and improve cross-platform path matching ([3d98161](https://github.com/mrgoonie/claudekit-cli/commit/3d98161794532a9fec5ac9604a182bfd07b61a99))
* **migrate:** handle all-stale case and batch registry cleanup ([9fbf53a](https://github.com/mrgoonie/claudekit-cli/commit/9fbf53a9cbc4ee90dd94fa3cb0bfd6cede84c484))
* **migrate:** harden droid hooks compatibility paths ([43eeb56](https://github.com/mrgoonie/claudekit-cli/commit/43eeb56b5e53f99c438c125433ab4fe4f5e9c89e))
* **migrate:** iterate all scopes per provider in dashboard cleanup ([422b551](https://github.com/mrgoonie/claudekit-cli/commit/422b5516fb2320ab7c8cedd736b042f3fbea8b44))
* **migrate:** make hooks capability explicit per provider ([0d86b8d](https://github.com/mrgoonie/claudekit-cli/commit/0d86b8dc117bd981e094d378dcac8d5bd715df82))
* **migrate:** restore legacy scope fallback semantics ([3a356c6](https://github.com/mrgoonie/claudekit-cli/commit/3a356c6846e24aa55766e2c9e335808e241c6c6f))
* **migrate:** update stale comments and add missing Codex hooks tests ([3c509d5](https://github.com/mrgoonie/claudekit-cli/commit/3c509d52dcf9ebbed98e630778b3ebfa416c0f92))
* **migrate:** use locked removeInstallationsByFilter for registry cleanup ([2c79edc](https://github.com/mrgoonie/claudekit-cli/commit/2c79edc7bfbe2f5b6dc729afa5e58fcc7520dc14))
* pass resolved source paths to discoverRules/discoverConfig to prevent TOCTOU ([1cc332b](https://github.com/mrgoonie/claudekit-cli/commit/1cc332b3b0756ac0c015abc253ada8aa61bceb38))
* **plan-command:** add shutdown timeout and use ASCII-safe table separators ([7704b48](https://github.com/mrgoonie/claudekit-cli/commit/7704b483f1e2f785753b003dbd2a32d62c8a2e2f))
* **plan-command:** add try/catch for readFileSync and NaN guard for progressBar ([efdf8ba](https://github.com/mrgoonie/claudekit-cli/commit/efdf8baaec55eb5c08be440de1f610ee3e5e8b6f))
* **plan-command:** address code review feedback ([758a70e](https://github.com/mrgoonie/claudekit-cli/commit/758a70e19545d66e9932cf9403d26347076cc954))
* **plan-command:** improve action detection, scanPlanDir docs, and SIGINT clarity ([73a584b](https://github.com/mrgoonie/claudekit-cli/commit/73a584b14f54691a1746cac0a1e66aeaec880a80))
* **plan-command:** improve CLI robustness and cross-platform support ([2b66a43](https://github.com/mrgoonie/claudekit-cli/commit/2b66a43ec41f09c97570cb06429122cf58388467))
* **plan-command:** use flatMap for resilient multi-plan JSON output ([2214544](https://github.com/mrgoonie/claudekit-cli/commit/22145447454b1bb009a63a955d026662ed0f3ebc))
* **plan-parser,plan-routes:** resolve F4 file path and harden API security ([42c9ac5](https://github.com/mrgoonie/claudekit-cli/commit/42c9ac5a409954ec8f2ee0958bfdfbec30b8db48))
* **plan-parser:** acronym-aware filenameToTitle and fix ParseOptionsSchema ([285f5b4](https://github.com/mrgoonie/claudekit-cli/commit/285f5b42fbb190966f10b4ea4631bb2d948c67b4))
* **plan-parser:** eliminate unsafe casts, double frontmatter parse, and post-hoc anchor mutation ([8623535](https://github.com/mrgoonie/claudekit-cli/commit/862353590f72291acf7df5ca71b14420b71716e4))
* **plan-parser:** prevent path leaks in validator, clean up public API surface ([3de184a](https://github.com/mrgoonie/claudekit-cli/commit/3de184ab38bb9c281dae47068f08c6caa4192ee2))
* **plan-parser:** resolve CJS/TS parity divergences in table parser ([be4d33c](https://github.com/mrgoonie/claudekit-cli/commit/be4d33cffdffe076fb4757ff2905c0e5e42505f7))
* **plan-parser:** stop dropping valid phases named "Task" or "Description" ([80037a4](https://github.com/mrgoonie/claudekit-cli/commit/80037a4f484661e5650e5d923b20b906707e663e))
* **plan-routes:** explicit TOCTOU comment, strip paths from error messages, use Dirent API ([38a0620](https://github.com/mrgoonie/claudekit-cli/commit/38a0620eb52306b7ec22381c05f8ca8bd45eb21f))
* **plan-routes:** harden API security with symlink-safe path validation ([5717890](https://github.com/mrgoonie/claudekit-cli/commit/5717890d05bd29fcb4d5f1430328e67e5629401c))
* **plan-routes:** move JSDoc above imports and clarify isWithinCwd phases ([478235c](https://github.com/mrgoonie/claudekit-cli/commit/478235c401800167f25200eb6b926e39abd80406))
* **plan-routes:** use path.sep for cross-platform CWD boundary check ([5526b03](https://github.com/mrgoonie/claudekit-cli/commit/5526b03fb9058f9fe6887fafc69f05fd20524fdb))
* **plan-validator:** improve issue line numbers and import ordering ([b0902ae](https://github.com/mrgoonie/claudekit-cli/commit/b0902ae25153840ee5b84cc1165c6faa6df843dc))
* **plan:** address all review findings across domain, CLI, and UI layers ([fc71230](https://github.com/mrgoonie/claudekit-cli/commit/fc712305ef82d0eb782b2ea8b90c4d5cb0df3d6f))
* **plugin:** address all PR review findings with comprehensive test suite ([387ac71](https://github.com/mrgoonie/claudekit-cli/commit/387ac716218568dc07e8049998912c9c063eff6b))
* **plugin:** address review findings — Windows, cleanup, progress ([44189b8](https://github.com/mrgoonie/claudekit-cli/commit/44189b89725787ac3e399180e4bf4701c56fafb8)), closes [#13](https://github.com/mrgoonie/claudekit-cli/issues/13) [#16](https://github.com/mrgoonie/claudekit-cli/issues/16) [#17](https://github.com/mrgoonie/claudekit-cli/issues/17) [#8](https://github.com/mrgoonie/claudekit-cli/issues/8)
* **plugin:** fallback copies from .claude/skills/ not plugins/ck/skills/ ([9fd03da](https://github.com/mrgoonie/claudekit-cli/commit/9fd03da16d4b065365aa0faca00cc634b8df4617))
* **plugin:** harden installer with env sanitization and stale file cleanup ([8b6d538](https://github.com/mrgoonie/claudekit-cli/commit/8b6d538f80bdba7d4b28f724fb672f054f54223d))
* **plugin:** kit-scoped uninstall guard and race condition fix ([2a3e726](https://github.com/mrgoonie/claudekit-cli/commit/2a3e726a672794c47bc1e7a7f217c401a1316d57))
* **plugin:** resolve verification bug, deferred filter bug, and PR review nits ([0f1b795](https://github.com/mrgoonie/claudekit-cli/commit/0f1b795263288ae768c45de28bb2baf7f02258a7))
* **plugin:** use delete operator to strip CLAUDE env vars ([fdbce85](https://github.com/mrgoonie/claudekit-cli/commit/fdbce850e3575de4464fdc2df17b6bdc028cdd0f))
* **portable:** comment out effort field in Codex TOML output ([71fec9c](https://github.com/mrgoonie/claudekit-cli/commit/71fec9c74040f438da3dccf8ad9ff26252f01edb))
* prepare calls install.sh, validate uses read-only lint, actionable error messages ([10402bf](https://github.com/mrgoonie/claudekit-cli/commit/10402bfd64056dd2c81929f8e8cdcbcfd8a1e96d))
* process metadata.json deletions in ck migrate ([ae2968f](https://github.com/mrgoonie/claudekit-cli/commit/ae2968fc2fe8dd672c2b6921b6b89f21c82a1e5d)), closes [#469](https://github.com/mrgoonie/claudekit-cli/issues/469)
* prune stale hook entries from settings.json using metadata.json deletions ([403c7cd](https://github.com/mrgoonie/claudekit-cli/commit/403c7cdc10b016066a99e9dcaeffc1586098adf9)), closes [#464](https://github.com/mrgoonie/claudekit-cli/issues/464)
* relativize API paths, decouple useEffect from i18n, compound PhaseCard key ([ddd15bf](https://github.com/mrgoonie/claudekit-cli/commit/ddd15bf6ed4afd9600c2323cbc031e5ba2031993))
* remove redundant null coalescing, add CWD-first discovery tests ([677c4df](https://github.com/mrgoonie/claudekit-cli/commit/677c4df3cb646b05f9220fc59ce37ad8030434e2))
* remove unused env var handling from tests, warn on cleanup failure ([9e1a290](https://github.com/mrgoonie/claudekit-cli/commit/9e1a2906e693f29fd312c3b9c2498f8995c1fd94))
* resolve CI typecheck failure and update structural tests for multi-line guard ([ef6f0ed](https://github.com/mrgoonie/claudekit-cli/commit/ef6f0ed32a6b3dca71d0282c526edebdd939caac))
* restrict metadata deletions to claude-code provider only ([6652950](https://github.com/mrgoonie/claudekit-cli/commit/6652950b9c3d4d57fb713df0b081c28bc4323d5e))
* return null for out-of-scope sourceOrigins, update empty-state hint text ([5a849eb](https://github.com/mrgoonie/claudekit-cli/commit/5a849eb3103f3a8b1368677e07344f606d8d1f42))
* revert plugin auto-install and standalone cleanup (reverts [#427](https://github.com/mrgoonie/claudekit-cli/issues/427), [#452](https://github.com/mrgoonie/claudekit-cli/issues/452)) ([b1494ab](https://github.com/mrgoonie/claudekit-cli/commit/b1494aba10433577cd615230be28593505c60b84)), closes [claudekit/claudekit-engineer#513](https://github.com/claudekit/claudekit-engineer/issues/513)
* scope-aware collision annotation and type-safe empty responses ([#450](https://github.com/mrgoonie/claudekit-cli/issues/450)) ([df90bca](https://github.com/mrgoonie/claudekit-cli/commit/df90bcabaaad8d29ef89e6265e872970affe9e2e))
* snapshot diff before/after lint to avoid false-positive on pre-existing unstaged work ([4c71873](https://github.com/mrgoonie/claudekit-cli/commit/4c71873e3cb3d846aa4cf700cc249bba67c7e15c))
* **test:** apply biome formatting to lifecycle integration tests ([cd74e53](https://github.com/mrgoonie/claudekit-cli/commit/cd74e534555b1c46e1e06bbb83eb9337143baca0))
* **test:** eliminate cross-suite module mock leakage ([bed3016](https://github.com/mrgoonie/claudekit-cli/commit/bed30161fcdfc86ef9cd71f13743192909811ef7))
* **test:** guard listFilesRecursive against missing engineer directory ([2755a93](https://github.com/mrgoonie/claudekit-cli/commit/2755a93e41307ea78fc6e94ecd2d6366be36c0fd))
* **test:** remove ineffective biome suppression comments ([b828b25](https://github.com/mrgoonie/claudekit-cli/commit/b828b250bb393bb0ef06467438facf0ab29585f2))
* **test:** resolve biome lint errors in plan contract tests ([fad83c8](https://github.com/mrgoonie/claudekit-cli/commit/fad83c80813592cd25362d2b623e712aa9065924))
* **test:** resolve TypeScript errors in plan lifecycle integration tests ([68edb4a](https://github.com/mrgoonie/claudekit-cli/commit/68edb4a8c5dcb072e4cc17dc2642306df98f16df))
* **test:** resolve Windows-specific test failures in path-resolver and hooks-merger ([866f5fa](https://github.com/mrgoonie/claudekit-cli/commit/866f5fa1728873a2d0579d2c30bf14e888fb0438))
* **test:** skip cross-repo tests when engineer repo unavailable ([98de10d](https://github.com/mrgoonie/claudekit-cli/commit/98de10d472679c398712af9e22423cecb1cc8718))
* **test:** stabilize plugin-installer tests on Windows path env ([a8a0624](https://github.com/mrgoonie/claudekit-cli/commit/a8a06244e6fcd228544322b2b0d691aaf53f4a3d))
* **test:** use dynamic date in rate-limiter tests ([628df4a](https://github.com/mrgoonie/claudekit-cli/commit/628df4a63fe147311babb777ec27abc626a1f8f6))
* trim migrate help examples to 3 (satisfies help registry test) ([60332a5](https://github.com/mrgoonie/claudekit-cli/commit/60332a59d94692fd48ba02016a232f19f23331f0))
* **ui:** apply biome formatting after prop removal ([3bf710b](https://github.com/mrgoonie/claudekit-cli/commit/3bf710ba920cc64376c3229111ac5cd9bbd392ef))
* **ui:** bump tsconfig target to ES2021 for replaceAll support ([2861bac](https://github.com/mrgoonie/claudekit-cli/commit/2861bac0dfad5018762fa52543b9aa9cfe780d73))
* **ui:** clicking selected provider in "Selected" filter now deselects instead of opening sidebar ([6648bc2](https://github.com/mrgoonie/claudekit-cli/commit/6648bc2bba85a65dce9756e0ffccf4ab88f4d95b))
* **ui:** collapse Skip tab sub-sections by default ([62473db](https://github.com/mrgoonie/claudekit-cli/commit/62473db63767bb8b5eeed4ddae12473193a443dc))
* **ui:** default migrate scope to Global instead of Project ([62dcc15](https://github.com/mrgoonie/claudekit-cli/commit/62dcc15fb26fd6ff22495a849860e2594478f4a4))
* **ui:** don't auto-select detected providers on migrate page load ([a5cfef9](https://github.com/mrgoonie/claudekit-cli/commit/a5cfef92e862d449c563320b2ce8594c63e9d127))
* **ui:** make selected provider button reliably deselect ([3ed6597](https://github.com/mrgoonie/claudekit-cli/commit/3ed6597b2e042b6f5011f6326b2be85c540b9668))
* **ui:** remove redundant type comparison in conflict branch ([fe923e8](https://github.com/mrgoonie/claudekit-cli/commit/fe923e8ca8bf03a7b26659986a0ea603e925ab30))
* **ui:** reset TypeSubSection expand state on tab switch ([6763830](https://github.com/mrgoonie/claudekit-cli/commit/6763830c8f5d3e300a835d4aff3deff1476fc559))
* **ui:** restore smart provider auto-selection with fallback ([1aa2ec6](https://github.com/mrgoonie/claudekit-cli/commit/1aa2ec638ce239c701a76ddc21e47abb68fc0ca4))
* upgrade deletion cleanup failure log from debug to warning ([e6f7b0d](https://github.com/mrgoonie/claudekit-cli/commit/e6f7b0dc8cba4300be6b850466f959d74eecbc35))
* use global claude dir for cleanup and fix env teardown ([2fbfc4a](https://github.com/mrgoonie/claudekit-cli/commit/2fbfc4a047a4e51661821eb5b33ce9c49888a53d))
* use join() in resolveSourceOrigin tests for Windows path separator compatibility ([2bf9273](https://github.com/mrgoonie/claudekit-cli/commit/2bf9273fdd14b0337876fdddc42ab29911d48622))
* use logger.info instead of nonexistent logger.warn ([6018006](https://github.com/mrgoonie/claudekit-cli/commit/6018006836876194013b3327ba785099c220f019))
* use node one-liner for prepare script (Windows compat) ([b368de0](https://github.com/mrgoonie/claudekit-cli/commit/b368de0df5e0034e0a8903a62cd4315cdb9a08b8))
* use node wrapper for prepare script (Windows bun lacks shell redirects) ([f6f6783](https://github.com/mrgoonie/claudekit-cli/commit/f6f6783dd9f9bba4afa4804eb0e93565fa5b1eca))
* use platform separator in resolveSourceOrigin, remove dead SourceOrigin type ([574aa32](https://github.com/mrgoonie/claudekit-cli/commit/574aa32bacd6f94831d9d9cccba4581c0afce2b3))
* use project biome v1.9.4 formatting for test file ([7e787d3](https://github.com/mrgoonie/claudekit-cli/commit/7e787d38ad69c077fb176c1f6edc2047f6ce2fa3))
* use Set-based merge for collision annotation idempotency ([#450](https://github.com/mrgoonie/claudekit-cli/issues/450)) ([2980f68](https://github.com/mrgoonie/claudekit-cli/commit/2980f68bb605321db01f9dbae339c6ad4f32ecf1))
* **watch:** address Claude review findings ([cd691ab](https://github.com/mrgoonie/claudekit-cli/commit/cd691abaad24de5969a6844340a9721c9eb9b533))
* **watch:** correct issue filtering and polling behavior ([6de2878](https://github.com/mrgoonie/claudekit-cli/commit/6de2878c672a1c518e3e62669649c43e77fa9060))
* **watch:** remove heartbeat that caused ECOMPROMISED lock error ([d971812](https://github.com/mrgoonie/claudekit-cli/commit/d971812a839c46fbcb96d276310020dccccace3d))

### ♻️ Code Refactoring

* **content:** migrate from better-sqlite3 to bun:sqlite ([ea3a964](https://github.com/mrgoonie/claudekit-cli/commit/ea3a9648010fb887f33484dfe3fa4a85b2650a79))
* extract migration result utils for testability ([#450](https://github.com/mrgoonie/claudekit-cli/issues/450)) ([3735b39](https://github.com/mrgoonie/claudekit-cli/commit/3735b393189580f5460d53d258f0882eec2d8d2c))
* memoize activeActions, remove redundant type cast ([6779170](https://github.com/mrgoonie/claudekit-cli/commit/67791700666272131265f2b70c4c625588cfee92))
* move versionsMatch to domains/versioning, add outro to Layer 2 exit ([b98ca21](https://github.com/mrgoonie/claudekit-cli/commit/b98ca21202ba128dfd5eb6ebc01ff31f497ef215))
* **plan-command:** use named types, split progressBar guards, remove dead code ([263ca4e](https://github.com/mrgoonie/claudekit-cli/commit/263ca4e9b54acb6e5e2689cb2b1c7d28bb411c25))
* **plan-parser:** eliminate double frontmatter parse with parsePhasesFromBody ([0b1d15a](https://github.com/mrgoonie/claudekit-cli/commit/0b1d15a75aa990238297c171d3c4bf9cab2521a3))
* **plan-parser:** extract scanPlanDir to shared domain, fix action heuristic ([c1d3264](https://github.com/mrgoonie/claudekit-cli/commit/c1d32641c3fd254e3bcb8201b216c06bd5f23194))
* use versionsMatch in selection-handler, add version-skip tests ([e9a559f](https://github.com/mrgoonie/claudekit-cli/commit/e9a559f9f5660edb53cb3207682a930920d1aaaa))
* **watch:** enhance infrastructure for approval workflow ([2f84033](https://github.com/mrgoonie/claudekit-cli/commit/2f84033288ebee33e938cbbe8eb6cad5f8c3fbb5))

### 📚 Documentation

* **migrate:** document hooks flag combinations ([e5876b1](https://github.com/mrgoonie/claudekit-cli/commit/e5876b161ab0acd7cf8a8845eb56c407bd1276ac))
* rewrite ck-watch/ck-content docs from source, feature in README ([2559de3](https://github.com/mrgoonie/claudekit-cli/commit/2559de36fc270e38a1b9d36c6aa63d009247a113))
* split ck-command-flow-guide into focused daemon docs ([d0f07cf](https://github.com/mrgoonie/claudekit-cli/commit/d0f07cf6d45acf85d7cde662592a39c0003d7d53))
* trim and consolidate documentation files ([6ab1ec6](https://github.com/mrgoonie/claudekit-cli/commit/6ab1ec6131bf4d24d2f1e61c81a1bd5a68baa109))
* update architecture and roadmap for api command group ([9e347f5](https://github.com/mrgoonie/claudekit-cli/commit/9e347f5f2ae88d32fb8cb4851735ee7a00e1156e))
* update docs for plugin installer integration ([3665f54](https://github.com/mrgoonie/claudekit-cli/commit/3665f54ca762a8abaab099fa19e9c4097e7f68ce))
* update documentation and configs for watch auto-implementation ([1dd1398](https://github.com/mrgoonie/claudekit-cli/commit/1dd13980a3f264f1235e7342baf3bef76c392256))
* update project documentation for api command group ([e71a4a0](https://github.com/mrgoonie/claudekit-cli/commit/e71a4a02abe98fa747fb9517b67fbbc973ea2d9c))
* **watch,content:** rewrite documentation from source code ([1d6b84d](https://github.com/mrgoonie/claudekit-cli/commit/1d6b84d1561c7cf17bd4cfa9573d033821e49ac1))
* **watch:** update ck watch documentation with new features ([1272c63](https://github.com/mrgoonie/claudekit-cli/commit/1272c63100466cd0991a85b674d21467973d0bde))

### ✅ Tests

* add plan contract & integration tests ([ce5429d](https://github.com/mrgoonie/claudekit-cli/commit/ce5429d38f981e38ce44a96a977097c06e8f8c1f))
* **cli:** add bin/ck.js integrity guards to prevent hardcoded path recurrence ([57371cc](https://github.com/mrgoonie/claudekit-cli/commit/57371cc366122d1bf0f19b531a37bead220bb62d)), closes [#499](https://github.com/mrgoonie/claudekit-cli/issues/499)
* **detect:** clarify codex test name to reflect detection cleanup context ([4fa0f78](https://github.com/mrgoonie/claudekit-cli/commit/4fa0f78f43f84d74621da287ab79465518473229))
* **migrate:** add hooks settings merger and discovery tests ([fbaefdb](https://github.com/mrgoonie/claudekit-cli/commit/fbaefdb2c7dd791f0c54f48e003550cb97890f85))
* **migrate:** update provider registry counts for droid ([8a10ba4](https://github.com/mrgoonie/claudekit-cli/commit/8a10ba4fe0372134350725df9934e282e2b6f3ce))
* **plan-parser:** add generateAnchors tests and fix validator tmp dir ([0292bc4](https://github.com/mrgoonie/claudekit-cli/commit/0292bc412b45c6c3063f17ca0499a8549ab131fe))
* **plan-parser:** add missing format tests, security tests, and buildPlanSummary coverage ([b569b35](https://github.com/mrgoonie/claudekit-cli/commit/b569b35ef74eecb69e5f96575615d9424e0ab2df))
* **portable:** add model taxonomy tests and update converter expectations ([5162eec](https://github.com/mrgoonie/claudekit-cli/commit/5162eecdcba4e2d58b093fb5ff0fc98ba93e4057))
* **portable:** update taxonomy tests for Gemini CLI and config overrides ([660bec2](https://github.com/mrgoonie/claudekit-cli/commit/660bec2920a61458198d6b5f8aed70a24074287e))
* **watch:** add comprehensive tests for approval and implementation ([c5af065](https://github.com/mrgoonie/claudekit-cli/commit/c5af065dc9fd8449229b798d6e41a11e6f4bd3a8))

## [3.36.0-dev.35](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.34...v3.36.0-dev.35) (2026-03-28)

### 🐞 Bug Fixes

* **test:** resolve Windows-specific test failures in path-resolver and hooks-merger ([866f5fa](https://github.com/mrgoonie/claudekit-cli/commit/866f5fa1728873a2d0579d2c30bf14e888fb0438))

## [3.36.0-dev.34](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.33...v3.36.0-dev.34) (2026-03-27)

### 🚀 Features

* **migrate:** add Codex hooks support to ck migrate ([64deafc](https://github.com/mrgoonie/claudekit-cli/commit/64deafc95ed2bb18b48622f23838a94210a9dbc4)), closes [#505](https://github.com/mrgoonie/claudekit-cli/issues/505)

### 🐞 Bug Fixes

* **migrate:** update stale comments and add missing Codex hooks tests ([3c509d5](https://github.com/mrgoonie/claudekit-cli/commit/3c509d52dcf9ebbed98e630778b3ebfa416c0f92))

## [3.36.0-dev.33](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.32...v3.36.0-dev.33) (2026-03-27)

### 🐞 Bug Fixes

* **build:** strip // [@bun](https://github.com/bun) marker from dist/index.js to fix UTF-8 rendering ([b0c1adb](https://github.com/mrgoonie/claudekit-cli/commit/b0c1adbd5c8987a534e1c4bbf45f6b96766bceae)), closes [#499](https://github.com/mrgoonie/claudekit-cli/issues/499)

## [3.36.0-dev.32](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.31...v3.36.0-dev.32) (2026-03-27)

### 🚀 Features

* support CLAUDE_CONFIG_DIR env var in getGlobalKitDir() ([75e9966](https://github.com/mrgoonie/claudekit-cli/commit/75e99667c2646b5c416de5b569e8473321d04023)), closes [#490](https://github.com/mrgoonie/claudekit-cli/issues/490)

## [3.36.0-dev.31](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.30...v3.36.0-dev.31) (2026-03-27)

### 🐞 Bug Fixes

* **cli:** use spawnSync for bun runtime to fix Unicode rendering ([31361d0](https://github.com/mrgoonie/claudekit-cli/commit/31361d01dc7cf1653c2abfacf56528f83e4bb135)), closes [#499](https://github.com/mrgoonie/claudekit-cli/issues/499)

## [3.36.0-dev.30](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.29...v3.36.0-dev.30) (2026-03-27)

### 🐞 Bug Fixes

* **cli:** add bun runtime detection for dev releases without platform binaries ([47743f3](https://github.com/mrgoonie/claudekit-cli/commit/47743f3b00c1155517961e11d624583a3ac3d10f)), closes [#499](https://github.com/mrgoonie/claudekit-cli/issues/499)
* **cli:** add timeout, caching, and actionable error messages to bun fallback ([4acdde3](https://github.com/mrgoonie/claudekit-cli/commit/4acdde30fa9223cebbecc63b462f3a6a56a2930f)), closes [#499](https://github.com/mrgoonie/claudekit-cli/issues/499)

## [3.36.0-dev.29](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.28...v3.36.0-dev.29) (2026-03-27)

### 🐞 Bug Fixes

* **cli:** restore cross-platform wrapper script in bin/ck.js ([7d5e877](https://github.com/mrgoonie/claudekit-cli/commit/7d5e8774d41de11d45b322578df5550944a7c8de)), closes [#499](https://github.com/mrgoonie/claudekit-cli/issues/499)

### ✅ Tests

* **cli:** add bin/ck.js integrity guards to prevent hardcoded path recurrence ([57371cc](https://github.com/mrgoonie/claudekit-cli/commit/57371cc366122d1bf0f19b531a37bead220bb62d)), closes [#499](https://github.com/mrgoonie/claudekit-cli/issues/499)

## [3.36.0-dev.28](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.27...v3.36.0-dev.28) (2026-03-27)

### ⚠ BREAKING CHANGES

* **content:** none

### 🚀 Features

* **api:** implement ck api command group with claudekit-api client ([d06dbb3](https://github.com/mrgoonie/claudekit-cli/commit/d06dbb3d43b87a17e2f34d77753dc0576e49e639))
* **content:** add content command to help system ([60acd5c](https://github.com/mrgoonie/claudekit-cli/commit/60acd5cee5f0bbe1374c08f7a91968adb3b47ce0))
* **content:** auto-install xurl during X platform setup ([521388b](https://github.com/mrgoonie/claudekit-cli/commit/521388be48b12794d4048d6b44c54d048c04cb6a))
* **content:** implement multi-channel engine with git monitoring and social publishing ([6b13567](https://github.com/mrgoonie/claudekit-cli/commit/6b135670ff42f96eb2336ea05bf655bf9b3b1284))
* **content:** replace Facebook OAuth login with page token onboarding ([f54a9f0](https://github.com/mrgoonie/claudekit-cli/commit/f54a9f069da21250867dbf2533615367df4e00c8))
* **help:** add watch command help documentation and registry ([d2f6c56](https://github.com/mrgoonie/claudekit-cli/commit/d2f6c561d83b0b6b82adf7df464813c5bc8d699d))
* **watch:** add maintainer filtering, state TTL, worktree isolation, rate persistence ([2036b2c](https://github.com/mrgoonie/claudekit-cli/commit/2036b2c9a7e81585f33fda7d8870ec982611d4cb))
* **watch:** add multi-repo support with repo discovery and plan directory resolution ([00fa025](https://github.com/mrgoonie/claudekit-cli/commit/00fa025d9069cbd60aafcda68d7e605945f4f319))
* **watch:** implement approval detection and auto-implementation ([924c47b](https://github.com/mrgoonie/claudekit-cli/commit/924c47bccc421e408677d053120b1d1dbe6cbfd5))
* **watch:** implement ck watch command for GitHub Issues automation ([f36249e](https://github.com/mrgoonie/claudekit-cli/commit/f36249e4c8aa2274e0e9f6faca1878adfe1013cd))

### 🐞 Bug Fixes

* **build:** externalize better-sqlite3 from bundle ([ae72e4f](https://github.com/mrgoonie/claudekit-cli/commit/ae72e4f8691a38866ff2b1826c11af5925d34e27))
* **content:** address Claude review findings ([629c9fc](https://github.com/mrgoonie/claudekit-cli/commit/629c9fc0df853f765970c9089454d4ed4134cc52))
* **content:** continue daemon after setup wizard completes ([ff46fdd](https://github.com/mrgoonie/claudekit-cli/commit/ff46fdd5174964ae4e5fdb70988c4d4d3b76c5b1))
* **content:** correct xurl auth command to oauth1 ([1b9a0b7](https://github.com/mrgoonie/claudekit-cli/commit/1b9a0b7ff662851cbad5d877831a269e9a43e6b6))
* **content:** fix daemon exit and setup gate ([622ce7d](https://github.com/mrgoonie/claudekit-cli/commit/622ce7de0896ca6e9676a6de9cd6d7391d1759d7))
* **content:** fix repo detection and auto-route to setup wizard ([23c1ae2](https://github.com/mrgoonie/claudekit-cli/commit/23c1ae26b1bc0be37f73e161c2e33182c276d0b8))
* **content:** improve git fetch resilience with SSH/HTTPS fallback ([d861c0e](https://github.com/mrgoonie/claudekit-cli/commit/d861c0e88bfc9a03789c66153a0d403f9aac38d3))
* **content:** improve scan logging and extend first-run lookback ([98b430e](https://github.com/mrgoonie/claudekit-cli/commit/98b430ee74f5090a987c13ccb3a3d96f52a50686))
* **content:** resolve edge cases across content daemon pipeline ([8156e33](https://github.com/mrgoonie/claudekit-cli/commit/8156e333a08dd4fb7d1ba1a691f25364f1cf85ac))
* **content:** update help registry tests for content command ([a039490](https://github.com/mrgoonie/claudekit-cli/commit/a039490c6ec484e86ec4a30feece77cc848f318f))
* **content:** use correct xurl install methods ([a5c32c2](https://github.com/mrgoonie/claudekit-cli/commit/a5c32c20ad3dbe139b1f2fdd0f0bd8e5a73ac75f))
* **content:** use single command with action routing ([92cbbec](https://github.com/mrgoonie/claudekit-cli/commit/92cbbecd8a76c788b327a5b1f59b064fa2d6118b))
* **content:** use xurl auth status for credential check ([db3f0a4](https://github.com/mrgoonie/claudekit-cli/commit/db3f0a45dfb898b30db944605decf7ffb426e29f))
* **test:** use dynamic date in rate-limiter tests ([628df4a](https://github.com/mrgoonie/claudekit-cli/commit/628df4a63fe147311babb777ec27abc626a1f8f6))
* **watch:** address Claude review findings ([cd691ab](https://github.com/mrgoonie/claudekit-cli/commit/cd691abaad24de5969a6844340a9721c9eb9b533))
* **watch:** correct issue filtering and polling behavior ([6de2878](https://github.com/mrgoonie/claudekit-cli/commit/6de2878c672a1c518e3e62669649c43e77fa9060))
* **watch:** remove heartbeat that caused ECOMPROMISED lock error ([d971812](https://github.com/mrgoonie/claudekit-cli/commit/d971812a839c46fbcb96d276310020dccccace3d))

### ♻️ Code Refactoring

* **content:** migrate from better-sqlite3 to bun:sqlite ([ea3a964](https://github.com/mrgoonie/claudekit-cli/commit/ea3a9648010fb887f33484dfe3fa4a85b2650a79))
* **watch:** enhance infrastructure for approval workflow ([2f84033](https://github.com/mrgoonie/claudekit-cli/commit/2f84033288ebee33e938cbbe8eb6cad5f8c3fbb5))

### 📚 Documentation

* rewrite ck-watch/ck-content docs from source, feature in README ([2559de3](https://github.com/mrgoonie/claudekit-cli/commit/2559de36fc270e38a1b9d36c6aa63d009247a113))
* split ck-command-flow-guide into focused daemon docs ([d0f07cf](https://github.com/mrgoonie/claudekit-cli/commit/d0f07cf6d45acf85d7cde662592a39c0003d7d53))
* trim and consolidate documentation files ([6ab1ec6](https://github.com/mrgoonie/claudekit-cli/commit/6ab1ec6131bf4d24d2f1e61c81a1bd5a68baa109))
* update architecture and roadmap for api command group ([9e347f5](https://github.com/mrgoonie/claudekit-cli/commit/9e347f5f2ae88d32fb8cb4851735ee7a00e1156e))
* update documentation and configs for watch auto-implementation ([1dd1398](https://github.com/mrgoonie/claudekit-cli/commit/1dd13980a3f264f1235e7342baf3bef76c392256))
* update project documentation for api command group ([e71a4a0](https://github.com/mrgoonie/claudekit-cli/commit/e71a4a02abe98fa747fb9517b67fbbc973ea2d9c))
* **watch,content:** rewrite documentation from source code ([1d6b84d](https://github.com/mrgoonie/claudekit-cli/commit/1d6b84d1561c7cf17bd4cfa9573d033821e49ac1))
* **watch:** update ck watch documentation with new features ([1272c63](https://github.com/mrgoonie/claudekit-cli/commit/1272c63100466cd0991a85b674d21467973d0bde))

### ✅ Tests

* **watch:** add comprehensive tests for approval and implementation ([c5af065](https://github.com/mrgoonie/claudekit-cli/commit/c5af065dc9fd8449229b798d6e41a11e6f4bd3a8))

## [3.36.0-dev.27](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.26...v3.36.0-dev.27) (2026-03-26)

### 🐞 Bug Fixes

* **portable:** comment out effort field in Codex TOML output ([71fec9c](https://github.com/mrgoonie/claudekit-cli/commit/71fec9c74040f438da3dccf8ad9ff26252f01edb))

## [3.36.0-dev.26](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.25...v3.36.0-dev.26) (2026-03-25)

### 🚀 Features

* **dashboard:** add model taxonomy editor with per-provider table grid ([9f26205](https://github.com/mrgoonie/claudekit-cli/commit/9f262051e7a8de28037bb34068a6b0eb0e6a294e))
* **portable:** add central model taxonomy for multi-provider migration ([fab43e1](https://github.com/mrgoonie/claudekit-cli/commit/fab43e1ca833c017b55ae646116ec8c65d92b715))
* **portable:** add Gemini CLI to taxonomy, user-configurable mappings ([047e2ac](https://github.com/mrgoonie/claudekit-cli/commit/047e2ac703540ec51709a6ed6315156a56f0eff5))

### 🐞 Bug Fixes

* **dashboard:** taxonomy editor layout with pixel-based vertical resize ([c06d57b](https://github.com/mrgoonie/claudekit-cli/commit/c06d57b1a17f0806fd8c004b2630ff2c8dc16087))
* **dashboard:** taxonomy editor UX — default open, scrollable, dedicated section ([53c3079](https://github.com/mrgoonie/claudekit-cli/commit/53c3079eaab01b3faf104ed52dd3344f3caf5e0f))

### ✅ Tests

* **portable:** add model taxonomy tests and update converter expectations ([5162eec](https://github.com/mrgoonie/claudekit-cli/commit/5162eecdcba4e2d58b093fb5ff0fc98ba93e4057))
* **portable:** update taxonomy tests for Gemini CLI and config overrides ([660bec2](https://github.com/mrgoonie/claudekit-cli/commit/660bec2920a61458198d6b5f8aed70a24074287e))

## [3.36.0-dev.25](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.24...v3.36.0-dev.25) (2026-03-25)

## [3.36.0-dev.24](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.23...v3.36.0-dev.24) (2026-03-25)

### 🐞 Bug Fixes

* **dashboard:** taxonomy editor layout with pixel-based vertical resize ([1c50f46](https://github.com/mrgoonie/claudekit-cli/commit/1c50f462ef4267eaf7e00a4675e845bcf97b2ae2))

## [3.36.0-dev.23](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.22...v3.36.0-dev.23) (2026-03-19)

### 🚀 Features

* add statuslineColors config toggle in ck config ([64de378](https://github.com/mrgoonie/claudekit-cli/commit/64de378ba055c17e2cf76e8d2f17f5ee07a36707)), closes [#488](https://github.com/mrgoonie/claudekit-cli/issues/488)

### 🐞 Bug Fixes

* align statuslineColors field doc with FieldDoc interface ([8cf08f1](https://github.com/mrgoonie/claudekit-cli/commit/8cf08f1aa66f4d4bf4ec88e31125f2b3a1189aa6))

## [3.36.0-dev.22](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.21...v3.36.0-dev.22) (2026-03-18)

### 🚀 Features

* **config:** add hook diagnostics dashboard ([fa0f36b](https://github.com/mrgoonie/claudekit-cli/commit/fa0f36b360a46773c00ae9f1260e9a54b4352eb4))

### 🐞 Bug Fixes

* **config:** avoid sync hook log existence checks ([080a1c6](https://github.com/mrgoonie/claudekit-cli/commit/080a1c6a6595ad4bc1efeaed96d16677177e1e66))
* **config:** decouple scanner cache from test env ([cb8acba](https://github.com/mrgoonie/claudekit-cli/commit/cb8acbaa1b5a5dd0e5376accf97f9cb04647f6f7))
* **config:** harden hook diagnostics reader and dashboard ([6848e9e](https://github.com/mrgoonie/claudekit-cli/commit/6848e9ef31fd37a78f6a1fd7cb745d1216d5253b))
* **config:** harden hook diagnostics review follow-ups ([7d90497](https://github.com/mrgoonie/claudekit-cli/commit/7d904975d66b17303d5d2a0df8dde76fcd7953d3))
* **config:** tighten hook diagnostics project resolution ([a09d807](https://github.com/mrgoonie/claudekit-cli/commit/a09d807a93c4762423f1286e2468ba232abd9281))
* **config:** tighten hook diagnostics runtime contracts ([1ba66b3](https://github.com/mrgoonie/claudekit-cli/commit/1ba66b39a44af07d6fa465bf7a202a88d28b3fc0))

## [3.36.0-dev.21](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.20...v3.36.0-dev.21) (2026-03-18)

### 🐞 Bug Fixes

* call promptKitUpdateFn when CLI is newer than stable latest ([a9793aa](https://github.com/mrgoonie/claudekit-cli/commit/a9793aa567dc5a7ada93cd280504416951c47090)), closes [#485](https://github.com/mrgoonie/claudekit-cli/issues/485)

## [3.36.0-dev.20](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.19...v3.36.0-dev.20) (2026-03-16)

### 🚀 Features

* enforce quality gate locally via git hooks ([6cc9fe5](https://github.com/mrgoonie/claudekit-cli/commit/6cc9fe52c714efccb4decccb8ec1b4816bd335d8)), closes [#483](https://github.com/mrgoonie/claudekit-cli/issues/483)

### 🐞 Bug Fixes

* address code review feedback — lint-first order, env var docs, path docs ([f160f2b](https://github.com/mrgoonie/claudekit-cli/commit/f160f2b328a18b4be2ccca369bbf547513a318ef))
* clarify diff snapshot comment, inline REPO_ROOT in install.sh ([b020e38](https://github.com/mrgoonie/claudekit-cli/commit/b020e383230bde50056ce6120b1dcb317df030b1))
* log prepare errors, lint-first in pre-push, document diff edge case ([e1b2b3b](https://github.com/mrgoonie/claudekit-cli/commit/e1b2b3b4c7a7c79490fc64fb931e60febc4d0bb7))
* prepare calls install.sh, validate uses read-only lint, actionable error messages ([10402bf](https://github.com/mrgoonie/claudekit-cli/commit/10402bfd64056dd2c81929f8e8cdcbcfd8a1e96d))
* snapshot diff before/after lint to avoid false-positive on pre-existing unstaged work ([4c71873](https://github.com/mrgoonie/claudekit-cli/commit/4c71873e3cb3d846aa4cf700cc249bba67c7e15c))
* use node one-liner for prepare script (Windows compat) ([b368de0](https://github.com/mrgoonie/claudekit-cli/commit/b368de0df5e0034e0a8903a62cd4315cdb9a08b8))
* use node wrapper for prepare script (Windows bun lacks shell redirects) ([f6f6783](https://github.com/mrgoonie/claudekit-cli/commit/f6f6783dd9f9bba4afa4804eb0e93565fa5b1eca))

## [3.36.0-dev.19](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.18...v3.36.0-dev.19) (2026-03-16)

### 🚀 Features

* skip kit reinstall when version unchanged during --yes mode ([8769af5](https://github.com/mrgoonie/claudekit-cli/commit/8769af53a327ed006e66f0580edb867b53f1b098)), closes [#479](https://github.com/mrgoonie/claudekit-cli/issues/479)

### 🐞 Bug Fixes

* add verbose logging in catch block, remove outro from selection-handler ([96a920c](https://github.com/mrgoonie/claudekit-cli/commit/96a920c46063a45f61d4d159e24f84723ff9390d))
* extract releaseTag variable for TypeScript narrowing, remove brittle slice tests ([bb8c357](https://github.com/mrgoonie/claudekit-cli/commit/bb8c357614c045f153ffe4866e692ef81d686b98))
* guard multi-kit early-exit, replace outro with logger, add clarifying comments ([97f4710](https://github.com/mrgoonie/claudekit-cli/commit/97f47101440d33600a548aa69341a0ef35cdf3d1))
* resolve CI typecheck failure and update structural tests for multi-line guard ([ef6f0ed](https://github.com/mrgoonie/claudekit-cli/commit/ef6f0ed32a6b3dca71d0282c526edebdd939caac))

### ♻️ Code Refactoring

* move versionsMatch to domains/versioning, add outro to Layer 2 exit ([b98ca21](https://github.com/mrgoonie/claudekit-cli/commit/b98ca21202ba128dfd5eb6ebc01ff31f497ef215))
* use versionsMatch in selection-handler, add version-skip tests ([e9a559f](https://github.com/mrgoonie/claudekit-cli/commit/e9a559f9f5660edb53cb3207682a930920d1aaaa))

## [3.36.0-dev.18](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.17...v3.36.0-dev.18) (2026-03-16)

### 🐞 Bug Fixes

* **detect:** document .agents/skills exclusion from detect arrays as design decision ([0f31dda](https://github.com/mrgoonie/claudekit-cli/commit/0f31ddabd9650614bf775f4313d043610e5e775d)), closes [#477](https://github.com/mrgoonie/claudekit-cli/issues/477)
* **detect:** memoize hasBinary cache, add tests for consolidated .agents/skills paths ([6b78ff5](https://github.com/mrgoonie/claudekit-cli/commit/6b78ff553ea750502acb9e9035cd2aa5e19e889e))
* **detect:** remove binary detection to preserve project-awareness, restore amp AGENT.md ([598ec47](https://github.com/mrgoonie/claudekit-cli/commit/598ec479e38d2128f905c94952c9b0cce44bb68a))
* **detect:** use spawnSync to prevent shell injection, check ~/Applications, prioritize config over binary ([660ee82](https://github.com/mrgoonie/claudekit-cli/commit/660ee82e8e4a4bf8b4a5965678476f0fc0da7150))
* **migrate:** consolidate .agents/skills/ paths and strengthen provider detection ([cae9bb4](https://github.com/mrgoonie/claudekit-cli/commit/cae9bb4b3dd8177dce43a40e123b463c75e10137)), closes [#477](https://github.com/mrgoonie/claudekit-cli/issues/477)

### ✅ Tests

* **detect:** clarify codex test name to reflect detection cleanup context ([4fa0f78](https://github.com/mrgoonie/claudekit-cli/commit/4fa0f78f43f84d74621da287ab79465518473229))

## [3.36.0-dev.17](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.16...v3.36.0-dev.17) (2026-03-16)

### 🐞 Bug Fixes

* **migrate:** add path traversal guard and blank line normalization for legacy cleanup ([0140205](https://github.com/mrgoonie/claudekit-cli/commit/0140205a8c475e6fd013ca3a2134fa3fb60ec5c8))
* **migrate:** clean legacy codex config.toml entries and port cleanup to dashboard ([e0441c1](https://github.com/mrgoonie/claudekit-cli/commit/e0441c18d353e94d40e1f765a638bc52467bfa65)), closes [#480](https://github.com/mrgoonie/claudekit-cli/issues/480)
* **migrate:** derive scope from provider-specific actions and continue Phase 2 on Phase 1 error ([328c4b1](https://github.com/mrgoonie/claudekit-cli/commit/328c4b1d2a5a6d693d19b7719e8120c4a4ddde09))
* **migrate:** iterate all scopes per provider in dashboard cleanup ([422b551](https://github.com/mrgoonie/claudekit-cli/commit/422b5516fb2320ab7c8cedd736b042f3fbea8b44))

## [3.36.0-dev.16](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.15...v3.36.0-dev.16) (2026-03-16)

### 🐞 Bug Fixes

* **migrate:** add file lock, registry lock, and tests for codex config cleanup ([60482e6](https://github.com/mrgoonie/claudekit-cli/commit/60482e6c287bf93f1d7b14b9e37943f65876171e))
* **migrate:** clean up stale codex config.toml entries for deleted agent files ([a2dcb6e](https://github.com/mrgoonie/claudekit-cli/commit/a2dcb6e7db3495b90607f8173bb7a686ec6efeac))
* **migrate:** eliminate TOCTOU race and improve cross-platform path matching ([3d98161](https://github.com/mrgoonie/claudekit-cli/commit/3d98161794532a9fec5ac9604a182bfd07b61a99))
* **migrate:** handle all-stale case and batch registry cleanup ([9fbf53a](https://github.com/mrgoonie/claudekit-cli/commit/9fbf53a9cbc4ee90dd94fa3cb0bfd6cede84c484))
* **migrate:** use locked removeInstallationsByFilter for registry cleanup ([2c79edc](https://github.com/mrgoonie/claudekit-cli/commit/2c79edc7bfbe2f5b6dc729afa5e58fcc7520dc14))

## [3.36.0-dev.15](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.14...v3.36.0-dev.15) (2026-03-16)

### 🐞 Bug Fixes

* deduplicate shell hook skip warning in dashboard migration ([bc11c23](https://github.com/mrgoonie/claudekit-cli/commit/bc11c235f3363dbb1c813fde916e9f47e72e52f2)), closes [#474](https://github.com/mrgoonie/claudekit-cli/issues/474)

## [3.36.0-dev.14](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.13...v3.36.0-dev.14) (2026-03-16)

### 🚀 Features

* ck migrate UX overhaul — source transparency, unified discovery, path previews ([12d1149](https://github.com/mrgoonie/claudekit-cli/commit/12d114909ee3422ccc5c4d0f9368b1aa79097673)), closes [#472](https://github.com/mrgoonie/claudekit-cli/issues/472)

### 🐞 Bug Fixes

* extract getGlobalConfigSourcePath to prevent CWD-first from breaking config source map ([4ef6d96](https://github.com/mrgoonie/claudekit-cli/commit/4ef6d965f38f514e2126ed9f24563f97fb145392))
* format long assertion line for biome line-length compliance ([2eb9efa](https://github.com/mrgoonie/claudekit-cli/commit/2eb9efa3730b2dfdf5caf8419b07e4b20ecde0ed))
* pass resolved source paths to discoverRules/discoverConfig to prevent TOCTOU ([1cc332b](https://github.com/mrgoonie/claudekit-cli/commit/1cc332b3b0756ac0c015abc253ada8aa61bceb38))
* remove redundant null coalescing, add CWD-first discovery tests ([677c4df](https://github.com/mrgoonie/claudekit-cli/commit/677c4df3cb646b05f9220fc59ce37ad8030434e2))
* return null for out-of-scope sourceOrigins, update empty-state hint text ([5a849eb](https://github.com/mrgoonie/claudekit-cli/commit/5a849eb3103f3a8b1368677e07344f606d8d1f42))
* use join() in resolveSourceOrigin tests for Windows path separator compatibility ([2bf9273](https://github.com/mrgoonie/claudekit-cli/commit/2bf9273fdd14b0337876fdddc42ab29911d48622))
* use platform separator in resolveSourceOrigin, remove dead SourceOrigin type ([574aa32](https://github.com/mrgoonie/claudekit-cli/commit/574aa32bacd6f94831d9d9cccba4581c0afce2b3))

## [3.36.0-dev.13](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.12...v3.36.0-dev.13) (2026-03-16)

### 🚀 Features

* **update:** show kit version transition during kit content updates ([9b81142](https://github.com/mrgoonie/claudekit-cli/commit/9b811429029d2c26730edca2b60b31ec68908463)), closes [#467](https://github.com/mrgoonie/claudekit-cli/issues/467)

### 🐞 Bug Fixes

* add error guard around checksum populate loop ([28ddb38](https://github.com/mrgoonie/claudekit-cli/commit/28ddb3819fb5bbef8717c401a69a6880ff0330ee))
* address code review feedback (attempt 1/5) ([86eb8fc](https://github.com/mrgoonie/claudekit-cli/commit/86eb8fc75661b50df55ab0769934d7bd28ae48c8))
* apply biome formatting to reconciler test file ([f2d9610](https://github.com/mrgoonie/claudekit-cli/commit/f2d96106e5293f567b9cfe39ceceddfdd62d18b0))
* apply biome formatting to test file ([7dbca89](https://github.com/mrgoonie/claudekit-cli/commit/7dbca89d55a4a37ab5404a8b624657a511efeb83))
* clarify Case B skip reason string to reflect checksum backfill ([332c6ea](https://github.com/mrgoonie/claudekit-cli/commit/332c6eab44d40bcf99b16b36f09e408f71bbbcf7))
* derive source metadata from kit source path, not user's installed metadata ([6691703](https://github.com/mrgoonie/claudekit-cli/commit/6691703ed7d72d630f27974c33864baed4101a55))
* handle exists=false target state in Case B and add inline docs ([2d97a8f](https://github.com/mrgoonie/claudekit-cli/commit/2d97a8f908b9e4f1ebafd185d2f4584cd31e64d1))
* harden hook path extraction regex and add edge case tests ([faf3b94](https://github.com/mrgoonie/claudekit-cli/commit/faf3b945eaea1e1862d6713b30dbdfe7b728cce5))
* heal stale targets during v2→v3 registry migration instead of permanent skip ([8cc30b4](https://github.com/mrgoonie/claudekit-cli/commit/8cc30b48db480f858b9719793e88204057592f87)), closes [#466](https://github.com/mrgoonie/claudekit-cli/issues/466)
* process metadata.json deletions in ck migrate ([ae2968f](https://github.com/mrgoonie/claudekit-cli/commit/ae2968fc2fe8dd672c2b6921b6b89f21c82a1e5d)), closes [#469](https://github.com/mrgoonie/claudekit-cli/issues/469)
* prune stale hook entries from settings.json using metadata.json deletions ([403c7cd](https://github.com/mrgoonie/claudekit-cli/commit/403c7cdc10b016066a99e9dcaeffc1586098adf9)), closes [#464](https://github.com/mrgoonie/claudekit-cli/issues/464)
* restrict metadata deletions to claude-code provider only ([6652950](https://github.com/mrgoonie/claudekit-cli/commit/6652950b9c3d4d57fb713df0b081c28bc4323d5e))
* upgrade deletion cleanup failure log from debug to warning ([e6f7b0d](https://github.com/mrgoonie/claudekit-cli/commit/e6f7b0dc8cba4300be6b850466f959d74eecbc35))

## [3.36.0-dev.12](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.11...v3.36.0-dev.12) (2026-03-07)

### 🐞 Bug Fixes

* **test:** apply biome formatting to lifecycle integration tests ([cd74e53](https://github.com/mrgoonie/claudekit-cli/commit/cd74e534555b1c46e1e06bbb83eb9337143baca0))
* **test:** guard listFilesRecursive against missing engineer directory ([2755a93](https://github.com/mrgoonie/claudekit-cli/commit/2755a93e41307ea78fc6e94ecd2d6366be36c0fd))
* **test:** remove ineffective biome suppression comments ([b828b25](https://github.com/mrgoonie/claudekit-cli/commit/b828b250bb393bb0ef06467438facf0ab29585f2))
* **test:** resolve biome lint errors in plan contract tests ([fad83c8](https://github.com/mrgoonie/claudekit-cli/commit/fad83c80813592cd25362d2b623e712aa9065924))
* **test:** resolve TypeScript errors in plan lifecycle integration tests ([68edb4a](https://github.com/mrgoonie/claudekit-cli/commit/68edb4a8c5dcb072e4cc17dc2642306df98f16df))
* **test:** skip cross-repo tests when engineer repo unavailable ([98de10d](https://github.com/mrgoonie/claudekit-cli/commit/98de10d472679c398712af9e22423cecb1cc8718))

### ✅ Tests

* add plan contract & integration tests ([ce5429d](https://github.com/mrgoonie/claudekit-cli/commit/ce5429d38f981e38ce44a96a977097c06e8f8c1f))

## [3.36.0-dev.11](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.10...v3.36.0-dev.11) (2026-03-04)

### 🚀 Features

* add plan-parser domain with ck plan command suite and kanban dashboard ([8618961](https://github.com/mrgoonie/claudekit-cli/commit/86189617b5ef29681d4f80b3236543f3c4cc6aff))
* **plan:** add write commands — create, check, uncheck, add-phase ([6870ae8](https://github.com/mrgoonie/claudekit-cli/commit/6870ae88c2a050777cc8ccd4d8bc4bc1830e67e6))

### 🐞 Bug Fixes

* **dashboard:** memoize i18n context, simplify phase keys, document kanban route ([f4ee125](https://github.com/mrgoonie/claudekit-cli/commit/f4ee125b6c164b3f100afb7501bef48e0d8c8d19))
* **kanban-ui:** add empty state, responsive layout, and type safety ([7c51f04](https://github.com/mrgoonie/claudekit-cli/commit/7c51f046681e6967e8dddae3936cdcf43e2871d7))
* **kanban-ui:** clear stale phases before re-fetching new plan ([02186af](https://github.com/mrgoonie/claudekit-cli/commit/02186af9b639e2d6761a92ff1b68c530b0bb53af))
* **kanban-ui:** map HTTP errors to user-friendly i18n messages ([ae5a716](https://github.com/mrgoonie/claudekit-cli/commit/ae5a716289f20705543f986e1004f4214252af5b))
* **kanban-ui:** normalize Windows backslashes in file path display ([433a3c5](https://github.com/mrgoonie/claudekit-cli/commit/433a3c57ec5d4b4d886dd3b4a7b0402bf497b94c))
* **plan-command:** add shutdown timeout and use ASCII-safe table separators ([7704b48](https://github.com/mrgoonie/claudekit-cli/commit/7704b483f1e2f785753b003dbd2a32d62c8a2e2f))
* **plan-command:** add try/catch for readFileSync and NaN guard for progressBar ([efdf8ba](https://github.com/mrgoonie/claudekit-cli/commit/efdf8baaec55eb5c08be440de1f610ee3e5e8b6f))
* **plan-command:** address code review feedback ([758a70e](https://github.com/mrgoonie/claudekit-cli/commit/758a70e19545d66e9932cf9403d26347076cc954))
* **plan-command:** improve action detection, scanPlanDir docs, and SIGINT clarity ([73a584b](https://github.com/mrgoonie/claudekit-cli/commit/73a584b14f54691a1746cac0a1e66aeaec880a80))
* **plan-command:** improve CLI robustness and cross-platform support ([2b66a43](https://github.com/mrgoonie/claudekit-cli/commit/2b66a43ec41f09c97570cb06429122cf58388467))
* **plan-command:** use flatMap for resilient multi-plan JSON output ([2214544](https://github.com/mrgoonie/claudekit-cli/commit/22145447454b1bb009a63a955d026662ed0f3ebc))
* **plan-parser,plan-routes:** resolve F4 file path and harden API security ([42c9ac5](https://github.com/mrgoonie/claudekit-cli/commit/42c9ac5a409954ec8f2ee0958bfdfbec30b8db48))
* **plan-parser:** acronym-aware filenameToTitle and fix ParseOptionsSchema ([285f5b4](https://github.com/mrgoonie/claudekit-cli/commit/285f5b42fbb190966f10b4ea4631bb2d948c67b4))
* **plan-parser:** eliminate unsafe casts, double frontmatter parse, and post-hoc anchor mutation ([8623535](https://github.com/mrgoonie/claudekit-cli/commit/862353590f72291acf7df5ca71b14420b71716e4))
* **plan-parser:** prevent path leaks in validator, clean up public API surface ([3de184a](https://github.com/mrgoonie/claudekit-cli/commit/3de184ab38bb9c281dae47068f08c6caa4192ee2))
* **plan-parser:** resolve CJS/TS parity divergences in table parser ([be4d33c](https://github.com/mrgoonie/claudekit-cli/commit/be4d33cffdffe076fb4757ff2905c0e5e42505f7))
* **plan-parser:** stop dropping valid phases named "Task" or "Description" ([80037a4](https://github.com/mrgoonie/claudekit-cli/commit/80037a4f484661e5650e5d923b20b906707e663e))
* **plan-routes:** explicit TOCTOU comment, strip paths from error messages, use Dirent API ([38a0620](https://github.com/mrgoonie/claudekit-cli/commit/38a0620eb52306b7ec22381c05f8ca8bd45eb21f))
* **plan-routes:** harden API security with symlink-safe path validation ([5717890](https://github.com/mrgoonie/claudekit-cli/commit/5717890d05bd29fcb4d5f1430328e67e5629401c))
* **plan-routes:** move JSDoc above imports and clarify isWithinCwd phases ([478235c](https://github.com/mrgoonie/claudekit-cli/commit/478235c401800167f25200eb6b926e39abd80406))
* **plan-routes:** use path.sep for cross-platform CWD boundary check ([5526b03](https://github.com/mrgoonie/claudekit-cli/commit/5526b03fb9058f9fe6887fafc69f05fd20524fdb))
* **plan-validator:** improve issue line numbers and import ordering ([b0902ae](https://github.com/mrgoonie/claudekit-cli/commit/b0902ae25153840ee5b84cc1165c6faa6df843dc))
* **plan:** address all review findings across domain, CLI, and UI layers ([fc71230](https://github.com/mrgoonie/claudekit-cli/commit/fc712305ef82d0eb782b2ea8b90c4d5cb0df3d6f))
* relativize API paths, decouple useEffect from i18n, compound PhaseCard key ([ddd15bf](https://github.com/mrgoonie/claudekit-cli/commit/ddd15bf6ed4afd9600c2323cbc031e5ba2031993))
* **ui:** bump tsconfig target to ES2021 for replaceAll support ([2861bac](https://github.com/mrgoonie/claudekit-cli/commit/2861bac0dfad5018762fa52543b9aa9cfe780d73))

### ♻️ Code Refactoring

* **plan-command:** use named types, split progressBar guards, remove dead code ([263ca4e](https://github.com/mrgoonie/claudekit-cli/commit/263ca4e9b54acb6e5e2689cb2b1c7d28bb411c25))
* **plan-parser:** eliminate double frontmatter parse with parsePhasesFromBody ([0b1d15a](https://github.com/mrgoonie/claudekit-cli/commit/0b1d15a75aa990238297c171d3c4bf9cab2521a3))
* **plan-parser:** extract scanPlanDir to shared domain, fix action heuristic ([c1d3264](https://github.com/mrgoonie/claudekit-cli/commit/c1d32641c3fd254e3bcb8201b216c06bd5f23194))

### ✅ Tests

* **plan-parser:** add generateAnchors tests and fix validator tmp dir ([0292bc4](https://github.com/mrgoonie/claudekit-cli/commit/0292bc412b45c6c3063f17ca0499a8549ab131fe))
* **plan-parser:** add missing format tests, security tests, and buildPlanSummary coverage ([b569b35](https://github.com/mrgoonie/claudekit-cli/commit/b569b35ef74eecb69e5f96575615d9424e0ab2df))

## [3.36.0-dev.10](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.9...v3.36.0-dev.10) (2026-03-03)

### 🐞 Bug Fixes

* detect provider path collisions in multi-provider migrate flow ([#450](https://github.com/mrgoonie/claudekit-cli/issues/450)) ([71e62df](https://github.com/mrgoonie/claudekit-cli/commit/71e62df94c5e6ec064924e4a90c2c51cb6b5740d))
* enforce directory boundary in collision path matching ([#450](https://github.com/mrgoonie/claudekit-cli/issues/450)) ([f32b291](https://github.com/mrgoonie/claudekit-cli/commit/f32b2918f1d498a7f0338181d276a398e4724e4b))
* scope-aware collision annotation and type-safe empty responses ([#450](https://github.com/mrgoonie/claudekit-cli/issues/450)) ([df90bca](https://github.com/mrgoonie/claudekit-cli/commit/df90bcabaaad8d29ef89e6265e872970affe9e2e))
* use Set-based merge for collision annotation idempotency ([#450](https://github.com/mrgoonie/claudekit-cli/issues/450)) ([2980f68](https://github.com/mrgoonie/claudekit-cli/commit/2980f68bb605321db01f9dbae339c6ad4f32ecf1))

### ♻️ Code Refactoring

* extract migration result utils for testability ([#450](https://github.com/mrgoonie/claudekit-cli/issues/450)) ([3735b39](https://github.com/mrgoonie/claudekit-cli/commit/3735b393189580f5460d53d258f0882eec2d8d2c))

## [3.36.0-dev.9](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.8...v3.36.0-dev.9) (2026-03-02)

### 🐞 Bug Fixes

* add .claude/ path replacement for all non-Claude providers ([749e948](https://github.com/mrgoonie/claudekit-cli/commit/749e9480b470af5f70b1afd32d85f30000f4abd0))
* convert OpenCode agent tools from string to boolean object ([d95bbb5](https://github.com/mrgoonie/claudekit-cli/commit/d95bbb54f89e3241699b85c83596ed6cbc3ee4d2)), closes [#459](https://github.com/mrgoonie/claudekit-cli/issues/459)
* correct Cline format (markdown not JSON) and Amp config path (AGENT.md) ([8459003](https://github.com/mrgoonie/claudekit-cli/commit/84590039c4b1488fccfe094c4499c4df360c88ad))
* correct OpenCode tool map and skills path from docs verification ([6fa5e39](https://github.com/mrgoonie/claudekit-cli/commit/6fa5e399d3eef699e766871744735ae63faddac7))

## [3.36.0-dev.8](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.7...v3.36.0-dev.8) (2026-03-02)

### 🚀 Features

* **skills:** support agentskills.io `metadata.version` and `metadata.author` fields ([0feb2d7](https://github.com/mrgoonie/claudekit-cli/commit/0feb2d7ca0ffdcffe00e4da16486bd558c9beae6))

## [3.36.0-dev.7](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.6...v3.36.0-dev.7) (2026-03-01)

### 🚀 Features

* **migrate:** improve dashboard plan review UX and CLI help ([b92698c](https://github.com/mrgoonie/claudekit-cli/commit/b92698c486484cc36df8752a0261fd116cb57868)), closes [#456](https://github.com/mrgoonie/claudekit-cli/issues/456)
* **ui:** add action tabs + type sub-sections to migration plan review ([7da1da2](https://github.com/mrgoonie/claudekit-cli/commit/7da1da26389e7c18cf76401bb60d93e6d952e43f))

### 🐞 Bug Fixes

* address PR review feedback — lint, tab sync, type safety, padding ([91037d3](https://github.com/mrgoonie/claudekit-cli/commit/91037d3448b79544f636164c0fc824f1056ea3ab))
* trim migrate help examples to 3 (satisfies help registry test) ([60332a5](https://github.com/mrgoonie/claudekit-cli/commit/60332a59d94692fd48ba02016a232f19f23331f0))
* **ui:** apply biome formatting after prop removal ([3bf710b](https://github.com/mrgoonie/claudekit-cli/commit/3bf710ba920cc64376c3229111ac5cd9bbd392ef))
* **ui:** collapse Skip tab sub-sections by default ([62473db](https://github.com/mrgoonie/claudekit-cli/commit/62473db63767bb8b5eeed4ddae12473193a443dc))
* **ui:** default migrate scope to Global instead of Project ([62dcc15](https://github.com/mrgoonie/claudekit-cli/commit/62dcc15fb26fd6ff22495a849860e2594478f4a4))
* **ui:** don't auto-select detected providers on migrate page load ([a5cfef9](https://github.com/mrgoonie/claudekit-cli/commit/a5cfef92e862d449c563320b2ce8594c63e9d127))
* **ui:** remove redundant type comparison in conflict branch ([fe923e8](https://github.com/mrgoonie/claudekit-cli/commit/fe923e8ca8bf03a7b26659986a0ea603e925ab30))
* **ui:** reset TypeSubSection expand state on tab switch ([6763830](https://github.com/mrgoonie/claudekit-cli/commit/6763830c8f5d3e300a835d4aff3deff1476fc559))

### ♻️ Code Refactoring

* memoize activeActions, remove redundant type cast ([6779170](https://github.com/mrgoonie/claudekit-cli/commit/67791700666272131265f2b70c4c625588cfee92))

## [3.36.0-dev.6](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.5...v3.36.0-dev.6) (2026-02-26)

### 🚀 Features

* **migrate:** add droid hooks migration support ([e2e0e84](https://github.com/mrgoonie/claudekit-cli/commit/e2e0e84f2fe994fd9fbc4d2b3fe7a351b1d625d7))
* **migrate:** add hooks migration with settings.json auto-registration ([b73714f](https://github.com/mrgoonie/claudekit-cli/commit/b73714f4fd2b0ef294d71d245ad657708ab3dce7))

### 🐞 Bug Fixes

* **migrate:** harden droid hooks compatibility paths ([43eeb56](https://github.com/mrgoonie/claudekit-cli/commit/43eeb56b5e53f99c438c125433ab4fe4f5e9c89e))
* **migrate:** make hooks capability explicit per provider ([0d86b8d](https://github.com/mrgoonie/claudekit-cli/commit/0d86b8dc117bd981e094d378dcac8d5bd715df82))
* **migrate:** restore legacy scope fallback semantics ([3a356c6](https://github.com/mrgoonie/claudekit-cli/commit/3a356c6846e24aa55766e2c9e335808e241c6c6f))
* **ui:** restore smart provider auto-selection with fallback ([1aa2ec6](https://github.com/mrgoonie/claudekit-cli/commit/1aa2ec638ce239c701a76ddc21e47abb68fc0ca4))

### 📚 Documentation

* **migrate:** document hooks flag combinations ([e5876b1](https://github.com/mrgoonie/claudekit-cli/commit/e5876b161ab0acd7cf8a8845eb56c407bd1276ac))

### ✅ Tests

* **migrate:** add hooks settings merger and discovery tests ([fbaefdb](https://github.com/mrgoonie/claudekit-cli/commit/fbaefdb2c7dd791f0c54f48e003550cb97890f85))
* **migrate:** update provider registry counts for droid ([8a10ba4](https://github.com/mrgoonie/claudekit-cli/commit/8a10ba4fe0372134350725df9934e282e2b6f3ce))

## [3.36.0-dev.5](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.4...v3.36.0-dev.5) (2026-02-25)

### 🐞 Bug Fixes

* **ui:** make selected provider button reliably deselect ([3ed6597](https://github.com/mrgoonie/claudekit-cli/commit/3ed6597b2e042b6f5011f6326b2be85c540b9668))

## [3.36.0-dev.4](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.3...v3.36.0-dev.4) (2026-02-25)

### 🐞 Bug Fixes

* **ui:** clicking selected provider in "Selected" filter now deselects instead of opening sidebar ([6648bc2](https://github.com/mrgoonie/claudekit-cli/commit/6648bc2bba85a65dce9756e0ffccf4ab88f4d95b))

## [3.36.0-dev.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.2...v3.36.0-dev.3) (2026-02-25)

### 🐞 Bug Fixes

* revert plugin auto-install and standalone cleanup (reverts [#427](https://github.com/mrgoonie/claudekit-cli/issues/427), [#452](https://github.com/mrgoonie/claudekit-cli/issues/452)) ([b1494ab](https://github.com/mrgoonie/claudekit-cli/commit/b1494aba10433577cd615230be28593505c60b84)), closes [claudekit/claudekit-engineer#513](https://github.com/claudekit/claudekit-engineer/issues/513)

## [3.36.0-dev.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.36.0-dev.1...v3.36.0-dev.2) (2026-02-25)

### 🐞 Bug Fixes

* add standalone skill overlap cleanup after plugin install ([604afce](https://github.com/mrgoonie/claudekit-cli/commit/604afce969c0d2d2747febe54f65b173c9c37f5b)), closes [claudekit/claudekit-engineer#513](https://github.com/claudekit/claudekit-engineer/issues/513)
* address code review feedback for standalone skill cleanup ([a5cc205](https://github.com/mrgoonie/claudekit-cli/commit/a5cc205c643c1d5e3d5943b8679af7d5d7962d34))
* format single-element arrays for biome compliance ([097e71e](https://github.com/mrgoonie/claudekit-cli/commit/097e71ee4bf0a6190060723d3ea1afd99b85a56d))
* make pluginSkillsDir explicit param and parallelize dir scan ([b8d0b6e](https://github.com/mrgoonie/claudekit-cli/commit/b8d0b6e970351942f610eac4706ea648f748dc5b))
* remove unused env var handling from tests, warn on cleanup failure ([9e1a290](https://github.com/mrgoonie/claudekit-cli/commit/9e1a2906e693f29fd312c3b9c2498f8995c1fd94))
* use global claude dir for cleanup and fix env teardown ([2fbfc4a](https://github.com/mrgoonie/claudekit-cli/commit/2fbfc4a047a4e51661821eb5b33ce9c49888a53d))
* use logger.info instead of nonexistent logger.warn ([6018006](https://github.com/mrgoonie/claudekit-cli/commit/6018006836876194013b3327ba785099c220f019))
* use project biome v1.9.4 formatting for test file ([7e787d3](https://github.com/mrgoonie/claudekit-cli/commit/7e787d38ad69c077fb176c1f6edc2047f6ce2fa3))

## [3.36.0-dev.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.1-dev.1...v3.36.0-dev.1) (2026-02-25)

### 🚀 Features

* **init:** auto-install CK plugin for ck:* skill namespace ([235e63d](https://github.com/mrgoonie/claudekit-cli/commit/235e63d3ba96e1e0d714dfbad2df5ab4183da064)), closes [#493](https://github.com/mrgoonie/claudekit-cli/issues/493)
* **plugin:** add skills fallback and sync mode support ([d9416fa](https://github.com/mrgoonie/claudekit-cli/commit/d9416fa23628538ffb5bb9e020a8459422c93970))
* **plugin:** implement plugin-only migration with verified install ([96303c6](https://github.com/mrgoonie/claudekit-cli/commit/96303c61dd96033d1d7420610bdc75d62b962657))
* **plugin:** implement plugin-only migration with verified install ([ca9e378](https://github.com/mrgoonie/claudekit-cli/commit/ca9e378ba974d700df544e313bf2bac1d58cb34c))

### 🐞 Bug Fixes

* **ci:** fail fast on hung test diagnostics ([7413410](https://github.com/mrgoonie/claudekit-cli/commit/741341092a8377d1b67c4e2990a6a5ea4ac25e3b))
* **plugin:** address all PR review findings with comprehensive test suite ([387ac71](https://github.com/mrgoonie/claudekit-cli/commit/387ac716218568dc07e8049998912c9c063eff6b))
* **plugin:** address review findings — Windows, cleanup, progress ([44189b8](https://github.com/mrgoonie/claudekit-cli/commit/44189b89725787ac3e399180e4bf4701c56fafb8)), closes [#13](https://github.com/mrgoonie/claudekit-cli/issues/13) [#16](https://github.com/mrgoonie/claudekit-cli/issues/16) [#17](https://github.com/mrgoonie/claudekit-cli/issues/17) [#8](https://github.com/mrgoonie/claudekit-cli/issues/8)
* **plugin:** fallback copies from .claude/skills/ not plugins/ck/skills/ ([9fd03da](https://github.com/mrgoonie/claudekit-cli/commit/9fd03da16d4b065365aa0faca00cc634b8df4617))
* **plugin:** harden installer with env sanitization and stale file cleanup ([8b6d538](https://github.com/mrgoonie/claudekit-cli/commit/8b6d538f80bdba7d4b28f724fb672f054f54223d))
* **plugin:** kit-scoped uninstall guard and race condition fix ([2a3e726](https://github.com/mrgoonie/claudekit-cli/commit/2a3e726a672794c47bc1e7a7f217c401a1316d57))
* **plugin:** resolve verification bug, deferred filter bug, and PR review nits ([0f1b795](https://github.com/mrgoonie/claudekit-cli/commit/0f1b795263288ae768c45de28bb2baf7f02258a7))
* **plugin:** use delete operator to strip CLAUDE env vars ([fdbce85](https://github.com/mrgoonie/claudekit-cli/commit/fdbce850e3575de4464fdc2df17b6bdc028cdd0f))
* **test:** eliminate cross-suite module mock leakage ([bed3016](https://github.com/mrgoonie/claudekit-cli/commit/bed30161fcdfc86ef9cd71f13743192909811ef7))
* **test:** stabilize plugin-installer tests on Windows path env ([a8a0624](https://github.com/mrgoonie/claudekit-cli/commit/a8a06244e6fcd228544322b2b0d691aaf53f4a3d))

### 📚 Documentation

* update docs for plugin installer integration ([3665f54](https://github.com/mrgoonie/claudekit-cli/commit/3665f54ca762a8abaab099fa19e9c4097e7f68ce))

## [3.35.1-dev.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0...v3.35.1-dev.1) (2026-02-24)

### 🐞 Bug Fixes

* **ci:** decouple Discord notification from semantic-release exit code ([c6fc986](https://github.com/mrgoonie/claudekit-cli/commit/c6fc986713cfeba56b2672b170472c5f9ec1bb16))

## [3.35.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.34.5...v3.35.0) (2026-02-24)

### 🚀 Features

* add ck agents and ck commands for cross-provider portability ([3545ee8](https://github.com/mrgoonie/claudekit-cli/commit/3545ee86f047c6187e43d198cba22dfdb902c816)), closes [#391](https://github.com/mrgoonie/claudekit-cli/issues/391)
* add ck agents and ck commands for cross-provider portability ([#392](https://github.com/mrgoonie/claudekit-cli/issues/392)) ([26425da](https://github.com/mrgoonie/claudekit-cli/commit/26425da6163dda4277c130716acff4733048b6ed)), closes [#391](https://github.com/mrgoonie/claudekit-cli/issues/391)
* add ck port for one-shot cross-provider migration ([fe6de21](https://github.com/mrgoonie/claudekit-cli/commit/fe6de214aa3e731c16fae06c5e326025a144a6fc))
* **codex:** generate proper TOML multi-agent configs instead of flat AGENTS.md ([dc35790](https://github.com/mrgoonie/claudekit-cli/commit/dc3579090ea4569449081caa859218f4d8db8d43)), closes [claudekit-engineer#494](https://github.com/mrgoonie/claudekit-engineer/issues/494)
* **config:** add editable Claude settings JSON panel in System tab ([4b22e9b](https://github.com/mrgoonie/claudekit-cli/commit/4b22e9b5bdc3d308a2bfbc13111c87795227092b))
* **config:** expand adaptive editor and terminal launchers ([9f17116](https://github.com/mrgoonie/claudekit-cli/commit/9f171166d80311c1c0ff747b9f46573ad6a3eae4))
* **dashboard:** embed UI assets in compiled binary via Bun.embeddedFiles ([65bf092](https://github.com/mrgoonie/claudekit-cli/commit/65bf092816a0f54f99fae0388efe1cd674a51653))
* **dashboard:** overhaul migration summary with grouped results, search, and smart columns ([2571fec](https://github.com/mrgoonie/claudekit-cli/commit/2571fecdc3bc68557d14780f550cefffa1c4531d)), closes [#443](https://github.com/mrgoonie/claudekit-cli/issues/443)
* **doctor:** add hook runtime diagnostics checks ([#390](https://github.com/mrgoonie/claudekit-cli/issues/390)) ([5ca27b5](https://github.com/mrgoonie/claudekit-cli/commit/5ca27b5c12163ce7fa575732aa78964ad7dd3c2f)), closes [#384](https://github.com/mrgoonie/claudekit-cli/issues/384)
* **help:** improve command discoverability in ck help ([3c4f016](https://github.com/mrgoonie/claudekit-cli/commit/3c4f01663e71c39ce33dee5f45eabf13082e8aaa))
* improve ck migrate UX/DX -- dry-run, rollback, scope resolver, overwrite warnings ([1b46397](https://github.com/mrgoonie/claudekit-cli/commit/1b46397bc50de79f0e803effda9a346661dc87b6)), closes [#404](https://github.com/mrgoonie/claudekit-cli/issues/404) [#405](https://github.com/mrgoonie/claudekit-cli/issues/405) [#406](https://github.com/mrgoonie/claudekit-cli/issues/406) [#407](https://github.com/mrgoonie/claudekit-cli/issues/407) [#408](https://github.com/mrgoonie/claudekit-cli/issues/408) [#409](https://github.com/mrgoonie/claudekit-cli/issues/409) [#404](https://github.com/mrgoonie/claudekit-cli/issues/404) [#405](https://github.com/mrgoonie/claudekit-cli/issues/405) [#406](https://github.com/mrgoonie/claudekit-cli/issues/406) [#407](https://github.com/mrgoonie/claudekit-cli/issues/407) [#408](https://github.com/mrgoonie/claudekit-cli/issues/408) [#409](https://github.com/mrgoonie/claudekit-cli/issues/409) [#403](https://github.com/mrgoonie/claudekit-cli/issues/403)
* **migrate:** add --force flag to override skip decisions ([df94d3c](https://github.com/mrgoonie/claudekit-cli/commit/df94d3cd14bda5592868b129ace0765249adb1aa))
* **migrate:** add idempotent reconciliation pipeline with checksum tracking ([e8954b1](https://github.com/mrgoonie/claudekit-cli/commit/e8954b1a3ecaace0f1e186fcf8d760a184238ab0)), closes [#412](https://github.com/mrgoonie/claudekit-cli/issues/412)
* **migrate:** improve provider-aware migration summary flow ([c9c0098](https://github.com/mrgoonie/claudekit-cli/commit/c9c00988c5d7270ff9b35be305e4d7588dd67fdb))
* **migrate:** replace skills dashboard with migrate hub ([ef450ec](https://github.com/mrgoonie/claudekit-cli/commit/ef450ec554d5409d05998518f4fe16e9b3ee38a8))
* **portable:** add config/rules porting infrastructure ([2e17d4e](https://github.com/mrgoonie/claudekit-cli/commit/2e17d4e0b7c93cae3e7a198b01ca443fb68566e2))
* **portable:** add subagent capability flag to ProviderConfig ([#395](https://github.com/mrgoonie/claudekit-cli/issues/395)) ([98f19ab](https://github.com/mrgoonie/claudekit-cli/commit/98f19ab3f88895f3a5ad96c2c086e686c081567d))
* **port:** extend ck port with config and rules porting ([16dc8ee](https://github.com/mrgoonie/claudekit-cli/commit/16dc8eeb5e19aac6332ca8cb5b9d19f44380c213))
* **ui:** improve migrate dashboard decision hierarchy ([9b5a7af](https://github.com/mrgoonie/claudekit-cli/commit/9b5a7af71509d23d63e97e29693f38d8c24914d2))
* **ui:** redesign migrate dashboard for stronger UX ([53afd10](https://github.com/mrgoonie/claudekit-cli/commit/53afd102485d32563fcc61e1d629855126ba82f3))
* **ui:** upgrade migrate dashboard to skills-grade UX ([407c13a](https://github.com/mrgoonie/claudekit-cli/commit/407c13ad8413b64edc74fc1abdb27079f330af73))

### 🐞 Bug Fixes

* **actions:** harden linux launch and add internal route tests ([6aaf7b6](https://github.com/mrgoonie/claudekit-cli/commit/6aaf7b6f9c3b7e5dfb4f237cc58123b7d4b5e4bf))
* **actions:** tighten executable token checks and spawn cwd guards ([09ab211](https://github.com/mrgoonie/claudekit-cli/commit/09ab211527e8f9ab0fc488922e1047c1f190017a))
* **actions:** validate system editor command and normalize base path checks ([7cba1c0](https://github.com/mrgoonie/claudekit-cli/commit/7cba1c020b1a8bd90a7e73892e6330ceacd9162a))
* address 7 review issues for cross-provider portability ([b4421ab](https://github.com/mrgoonie/claudekit-cli/commit/b4421abd72e7a657b935f647df6ab7bbafb0b1b8))
* address all PR [#444](https://github.com/mrgoonie/claudekit-cli/issues/444) review feedback (10 items) ([9708391](https://github.com/mrgoonie/claudekit-cli/commit/9708391080c38583878272469f58ab7a1a509b72))
* address CI lint failure and PR review feedback ([9aa5709](https://github.com/mrgoonie/claudekit-cli/commit/9aa5709d10e33d62ab8fbe864882ff0f042f3e2e))
* address code review feedback (attempt 1/5) ([de976de](https://github.com/mrgoonie/claudekit-cli/commit/de976de1856cd45917f6f6febfdd5aea6146c23a))
* address code review feedback (attempt 2/5) ([af602f8](https://github.com/mrgoonie/claudekit-cli/commit/af602f88f364d874f8bd4695fb6672ef594b4dd6))
* address code review feedback (attempt 3/5) ([1cbca04](https://github.com/mrgoonie/claudekit-cli/commit/1cbca0486afd807d06d63ca1fd4955dc4e0fc0ad))
* address code review feedback for PM detection ([b40c65d](https://github.com/mrgoonie/claudekit-cli/commit/b40c65dd45b2d984fb0d422378922374fd7d3d23))
* address PR [#420](https://github.com/mrgoonie/claudekit-cli/issues/420) review items ([30a8a3d](https://github.com/mrgoonie/claudekit-cli/commit/30a8a3d783a8fa0832f9e420806c21afa374af72))
* address PR [#420](https://github.com/mrgoonie/claudekit-cli/issues/420) review round 2 and codebase review findings ([92e430c](https://github.com/mrgoonie/claudekit-cli/commit/92e430c9e8787cbd278c30116a0e701ce73ad44e))
* address PR review — interactive prompt, CRLF normalization, tests ([1824a8f](https://github.com/mrgoonie/claudekit-cli/commit/1824a8f75d9368d14aad4d86de76d7b04c8125dd)), closes [#422](https://github.com/mrgoonie/claudekit-cli/issues/422)
* address PR review feedback — lint, tests, and defensive improvements ([14ef4f1](https://github.com/mrgoonie/claudekit-cli/commit/14ef4f19073e7e57c31cbf23ae038ff0b77f875e))
* **agents:** normalize heading for merge-single uninstall matching ([7911688](https://github.com/mrgoonie/claudekit-cli/commit/7911688a3737a186f06dded6a9b1377ad8933656))
* **ci:** isolate portable registry mocks and add migrate architecture docs ([4ddb062](https://github.com/mrgoonie/claudekit-cli/commit/4ddb0627e9bb3e6b59464074f2471627962c32ce))
* **cli-output:** respect quiet mode and robust terminal detection ([ca6cb20](https://github.com/mrgoonie/claudekit-cli/commit/ca6cb20d458fa7030e7c37ceb84588f6dc551df3))
* **codex:** add file lock, rollback, and converter hardening for TOML installer ([4af3574](https://github.com/mrgoonie/claudekit-cli/commit/4af3574f893c5ba2cd8b483593dadcd4f4a2e0b3))
* **codex:** add multi-sentinel collapse, CRLF detection, diagnostics API, and review fixes ([c00fd97](https://github.com/mrgoonie/claudekit-cli/commit/c00fd973f32ff14873abd046aa31eef3eb453a16))
* **codex:** address AI review feedback — ensureDir, skip-success, task comment, tests ([cbd625b](https://github.com/mrgoonie/claudekit-cli/commit/cbd625b23b54fddc642de36239c57c9349eafea7))
* **codex:** correct provider mappings for skills, rules, and exec order ([9e3088e](https://github.com/mrgoonie/claudekit-cli/commit/9e3088e1b2751f3d307c3c3232774c2f8297ca8e)), closes [#418](https://github.com/mrgoonie/claudekit-cli/issues/418)
* **codex:** use correct sandbox_mode "read-only" per Codex spec ([a83f8bf](https://github.com/mrgoonie/claudekit-cli/commit/a83f8bf528fc63b828e222d5837ee1478326daeb))
* **config-ui:** address review findings and check state races ([57410cc](https://github.com/mrgoonie/claudekit-cli/commit/57410cc0a2233ce57910faf53c87397869853ff5))
* **config-ui:** fix cli version display and update filters ([52ea0e0](https://github.com/mrgoonie/claudekit-cli/commit/52ea0e03ab303acb2336a76fbff7e54686b5b527))
* **config-ui:** resolve CI lint and harden dashboard filters ([602fa95](https://github.com/mrgoonie/claudekit-cli/commit/602fa95c5b16db8f77d5dc907c9c9cd63c9ce621))
* **config:** harden action launch validation and UX ([b440337](https://github.com/mrgoonie/claudekit-cli/commit/b4403379ef590e304c8e673754730d4aa2aa6922))
* **dashboard:** add missing hook docs for descriptive-name and context-tracking ([dee2ac9](https://github.com/mrgoonie/claudekit-cli/commit/dee2ac98ea9852f53d0c65153986d95f4cfeaaa5))
* **dashboard:** address review edge cases for embedded UI serving ([71ba828](https://github.com/mrgoonie/claudekit-cli/commit/71ba82863b33b3f17d11cbf12d1ee6046573c0c4))
* **dashboard:** align migration summary with dashboard UI patterns ([e7aa02c](https://github.com/mrgoonie/claudekit-cli/commit/e7aa02c9e0308b3456423630f4bc89c0f162a352))
* **dashboard:** default page now correctly shows global config ([c8e5ff3](https://github.com/mrgoonie/claudekit-cli/commit/c8e5ff3b4c14581078fff1e307b440a9d81538eb))
* **dashboard:** disable drawSelection to fix focused selection color ([acac253](https://github.com/mrgoonie/claudekit-cli/commit/acac253cfc861c8260d89b5db47be31f5da0714e))
* **dashboard:** override browser native selection color in config editor ([6d6ce47](https://github.com/mrgoonie/claudekit-cli/commit/6d6ce472d718b5d9b9d3b59c23ecd11eb32b86aa))
* **dashboard:** share HTTP server with Vite HMR to prevent refresh loop ([c5cbd7c](https://github.com/mrgoonie/claudekit-cli/commit/c5cbd7cf83c4266b3286a27e3c169909d3c5ee6f))
* deduplicate heading regex in splitManagedContent ([bd34dea](https://github.com/mrgoonie/claudekit-cli/commit/bd34dea739cf84ba9f7f7fa61fff45ab6c8c801b))
* detect package manager from binary install path ([e29efaa](https://github.com/mrgoonie/claudekit-cli/commit/e29efaa4b5f729b2700986c223deb3bfe8f9932f)), closes [#385](https://github.com/mrgoonie/claudekit-cli/issues/385)
* **dev:** remove watch loop from dashboard dev script ([e7aeb18](https://github.com/mrgoonie/claudekit-cli/commit/e7aeb18a81cce3646e6519fa3c3fb1285690c32d))
* **env:** trim home path and unset env vars safely in tests ([a93eabf](https://github.com/mrgoonie/claudekit-cli/commit/a93eabfa96701ba88a23afe2cb81ea049a0f527e))
* fetch global config for project page override detection ([082601d](https://github.com/mrgoonie/claudekit-cli/commit/082601d62410d3ba18f86bb1029aad0e50b2ce69))
* fetch global config for project page override detection ([ff2e5d1](https://github.com/mrgoonie/claudekit-cli/commit/ff2e5d1ba781c3ede72cebb8f5ad6478149eda58))
* flatten nested commands for providers that don't support folder nesting ([0dd9e91](https://github.com/mrgoonie/claudekit-cli/commit/0dd9e91cda407a11993b336023cffb7e72dcc692)), closes [#399](https://github.com/mrgoonie/claudekit-cli/issues/399)
* implement plan-based migration execution in dashboard UI ([b56b875](https://github.com/mrgoonie/claudekit-cli/commit/b56b875bb57fa1bf449b925a273d764c24dc568d))
* **installer:** conditional team hooks injection based on CC version ([#382](https://github.com/mrgoonie/claudekit-cli/issues/382)) ([72bf0aa](https://github.com/mrgoonie/claudekit-cli/commit/72bf0aadc5e3824b7caf7c5301dc8bc0ae9bcf2a)), closes [#464](https://github.com/mrgoonie/claudekit-cli/issues/464)
* **installer:** skip optional installs in test environment ([ded8407](https://github.com/mrgoonie/claudekit-cli/commit/ded8407a38a3292f9c9b2b5c67b195839b7f2610))
* **lint:** replace template literals with string literals in tests ([87fe402](https://github.com/mrgoonie/claudekit-cli/commit/87fe4020d87b9acd1268cc50163e31d1da725b5c))
* **migrate:** add commands support for Antigravity and Windsurf ([3f5f7e7](https://github.com/mrgoonie/claudekit-cli/commit/3f5f7e77417061705f203d79f10e54a6d13e0099)), closes [#394](https://github.com/mrgoonie/claudekit-cli/issues/394)
* **migrate:** address code review findings from parallel edge case audit ([27443dd](https://github.com/mrgoonie/claudekit-cli/commit/27443ddef69fbb9d4f29adaf7eb1b27991b8149c))
* **migrate:** address PR review feedback — budget tracking and dead config ([234c2d3](https://github.com/mrgoonie/claudekit-cli/commit/234c2d3911b1f82a25e55c42a65a28e25208bdc1))
* **migrate:** address round 2 review — skipped consistency and threshold fix ([f078def](https://github.com/mrgoonie/claudekit-cli/commit/f078def5c98154cbf9c5957f5b018981a19d4460))
* **migrate:** align unreadable target-state behavior ([9c5358f](https://github.com/mrgoonie/claudekit-cli/commit/9c5358fdfd665554882270574078416c7ab3c47b))
* **migrate:** harden edge-case handling and summary accessibility ([85f9b2f](https://github.com/mrgoonie/claudekit-cli/commit/85f9b2f30291e931c6d62a72dddd3f9b64a0161c))
* **migrate:** harden idempotent reconciliation edge cases ([9c85174](https://github.com/mrgoonie/claudekit-cli/commit/9c85174567f23f1427b7b024a05abd75a1775692))
* **migrate:** preserve skills fallback with planned execution ([92cc9e8](https://github.com/mrgoonie/claudekit-cli/commit/92cc9e8fb6472ee9f41ba250e3f8b6640a6b5af7))
* **migrate:** prevent direct-copy frontmatter crashes ([2451fa2](https://github.com/mrgoonie/claudekit-cli/commit/2451fa2380e5de211071a1ad4bc87f33dbfdb904))
* **migrate:** remove initialValues pre-selecting all detected providers ([c140ecd](https://github.com/mrgoonie/claudekit-cli/commit/c140ecd19b25ad19265d4903ad91602a371f3518)), closes [#446](https://github.com/mrgoonie/claudekit-cli/issues/446)
* **migrate:** restore legacy compatibility and modal accessibility ([9ecdcd1](https://github.com/mrgoonie/claudekit-cli/commit/9ecdcd15f3508d11a7d74c1a7a08614d514c0878))
* **migrate:** rollback failed installs and harden review UX ([550d9d8](https://github.com/mrgoonie/claudekit-cli/commit/550d9d8b09fb146e2211903020596200aa43349c))
* **migrate:** skip skill directory entries in reconcile target states ([b41b0b2](https://github.com/mrgoonie/claudekit-cli/commit/b41b0b286153018fc3a433ee157f409670f11337)), closes [#441](https://github.com/mrgoonie/claudekit-cli/issues/441)
* **migrate:** Windsurf char limit truncation and Copilot path-specific rules ([6bf3099](https://github.com/mrgoonie/claudekit-cli/commit/6bf309934b74fddc2a8bc51ba0e4a12ed2c7a5e2)), closes [#423](https://github.com/mrgoonie/claudekit-cli/issues/423)
* normalize path separators in codex test for Windows compatibility ([d4f40b0](https://github.com/mrgoonie/claudekit-cli/commit/d4f40b0c2e7b245565d52d66f3a48c71e7b386be))
* **paths:** preserve nested namespaces and add regression tests ([c92d5e6](https://github.com/mrgoonie/claudekit-cli/commit/c92d5e656470ae7d31ab8d72d56abdbee96fc783))
* **pm-detection:** harden edge cases in detection logic ([e2356e3](https://github.com/mrgoonie/claudekit-cli/commit/e2356e33b2db385f4a8d8de5f4709f0ff946975c))
* **portable-registry:** avoid migration lock TOCTOU race ([e6cc0b2](https://github.com/mrgoonie/claudekit-cli/commit/e6cc0b2165c171d0f28766c4a0276f8c0eebc39c))
* **portable:** add UNC path detection and missing translation key ([6d18d25](https://github.com/mrgoonie/claudekit-cli/commit/6d18d2594e172532fd3e9f1182f63bc512e15040))
* **portable:** address review feedback for install/uninstall flows ([323d09d](https://github.com/mrgoonie/claudekit-cli/commit/323d09df670bd412ba7297a06a9f91bd723961d7))
* **portable:** block encoded path traversal and parallelize installs ([53aeb2c](https://github.com/mrgoonie/claudekit-cli/commit/53aeb2c990cf9190d18b85824549f5df2388c1c3))
* **portable:** fence-aware parsing, section-level checksums, duplicate warnings ([69113aa](https://github.com/mrgoonie/claudekit-cli/commit/69113aa707da4d4a73444b58dacf0f7515caf41b)), closes [#415](https://github.com/mrgoonie/claudekit-cli/issues/415)
* **portable:** harden converters with error handling and proper escaping ([ab9e357](https://github.com/mrgoonie/claudekit-cli/commit/ab9e35724566373264ccda86cccbc95312acb013))
* **portable:** harden install paths and registry writes ([08e3c2b](https://github.com/mrgoonie/claudekit-cli/commit/08e3c2bc34a3a3eaf1d79540f9eaf00e3202dfeb))
* **portable:** harden merge-single cross-kind preservation ([bb40c61](https://github.com/mrgoonie/claudekit-cli/commit/bb40c61e25f410c8956f0e93401e0de700cb63da))
* **portable:** harden migration install/conversion flows ([2b4ae4e](https://github.com/mrgoonie/claudekit-cli/commit/2b4ae4ec8754dd85b217120abe0ac094c678be84))
* **portable:** increase registry lock timeout and add input validation ([68dee58](https://github.com/mrgoonie/claudekit-cli/commit/68dee58d166e35ec3ae14f1701f34739ba3de8e1))
* **portable:** make merge-single installs rule-aware and safe ([e8dd22f](https://github.com/mrgoonie/claudekit-cli/commit/e8dd22fdd1adbdb287d3aae745eacafcbc224f67))
* **portable:** point Codex global rules to file path, not directory ([fd28da8](https://github.com/mrgoonie/claudekit-cli/commit/fd28da83c8a919b815ad25a15a11dcfa3cd1f832))
* **portable:** preserve config preamble in merge-single installer ([5dd7a98](https://github.com/mrgoonie/claudekit-cli/commit/5dd7a987b72a22ebdfae54fdc4a109a40271a008))
* **portable:** preserve real paths in md-strip slash command removal ([375b30d](https://github.com/mrgoonie/claudekit-cli/commit/375b30d95c796eb0b90713e04344bc3759d39152))
* **portable:** prevent cross-kind section loss in shared files ([#415](https://github.com/mrgoonie/claudekit-cli/issues/415)) ([7181dd5](https://github.com/mrgoonie/claudekit-cli/commit/7181dd506e436fee42a5569aebd9c8cc78e1d0eb))
* **port:** honor config/rules flag combinations ([3307f01](https://github.com/mrgoonie/claudekit-cli/commit/3307f015618394cdbab6700aadbea80b439e1fc3))
* **port:** replace --no-config/--no-rules with --skip-config/--skip-rules ([b2fd451](https://github.com/mrgoonie/claudekit-cli/commit/b2fd451f97a32e4e8dc27c26fdf2f0c4a56e56bb))
* **release:** add hotfix commit type and conventionalcommits preset ([215aa56](https://github.com/mrgoonie/claudekit-cli/commit/215aa562df406249ec8829309ed9d00cc476cfc8))
* **release:** skip merge commits from main to prevent premature dev versions ([253aa16](https://github.com/mrgoonie/claudekit-cli/commit/253aa16624f6383decf93071b03adb21fb827fa8))
* restore ClaudeKit bot identity in Discord notifications ([2dce365](https://github.com/mrgoonie/claudekit-cli/commit/2dce365930286607eb35424cb50d590b3b3fd732))
* **security:** add prototype pollution protection to config manager ([8601a0a](https://github.com/mrgoonie/claudekit-cli/commit/8601a0aa800e5ac228408bae5eb070177e29f9a3))
* sort import statements to satisfy biome linter ([6d6d5f0](https://github.com/mrgoonie/claudekit-cli/commit/6d6d5f0819817c5aba5f2358c0d900db89c85542))
* sync hook schemas — add descriptive-name and context-tracking ([a436c7f](https://github.com/mrgoonie/claudekit-cli/commit/a436c7f73f3d3175f407b0d0e16ae75cb25fa0a3))
* **system-routes:** validate channel and semver update checks ([ca88675](https://github.com/mrgoonie/claudekit-cli/commit/ca88675b3a1e80a89dc398a681b224e22e356869))
* **terminal:** avoid CI_SAFE_MODE in unicode detection ([181361a](https://github.com/mrgoonie/claudekit-cli/commit/181361a7f092d88bbc443c15069e38a94740b2e6))
* **test:** make CLI integration suite opt-in ([488ae65](https://github.com/mrgoonie/claudekit-cli/commit/488ae65bddb41f65aff2a8050322342a859d9150))
* **test:** make CLI integration suite opt-in ([c6254ac](https://github.com/mrgoonie/claudekit-cli/commit/c6254ac83bad23e900756817a6b7ac2c12838daf))
* **tests:** make path tests cross-platform compatible for Windows CI ([67b3f05](https://github.com/mrgoonie/claudekit-cli/commit/67b3f0503aa854aa6f325363be722860ee742f8b))
* **test:** update help assertions for expanded command set ([3555679](https://github.com/mrgoonie/claudekit-cli/commit/35556793b20c33bbfddefd784036be46764a87f6))
* **test:** update second provider-registry test for Codex rules path ([7b1d935](https://github.com/mrgoonie/claudekit-cli/commit/7b1d935545ee4f6d370b67ce2f9bf1829f646c68))
* **ui:** address review feedback for config json editor sizing ([e721048](https://github.com/mrgoonie/claudekit-cli/commit/e721048191f89bb66f754ad794477d053de75d9a))
* **ui:** address review follow-ups for dashboard accessibility ([d6e566a](https://github.com/mrgoonie/claudekit-cli/commit/d6e566af6b16942e96fe0a0b1f05a6cbd96fcd6b))
* **ui:** reduce config editor json panel font size ([4342d63](https://github.com/mrgoonie/claudekit-cli/commit/4342d63fc16eea6e1a0fea61d680f6240e49c634))
* **ui:** unblock checks for migrate dashboard polish ([d5e6dbe](https://github.com/mrgoonie/claudekit-cli/commit/d5e6dbe233c8e8bce8835bd1a101ac459777f8ce))
* **uninstall:** honor scope and add safe force flows ([bbdef16](https://github.com/mrgoonie/claudekit-cli/commit/bbdef16190e95ee05d73fe34c03bad1bfc5ac8dd))
* update CLAUDE.md on re-init instead of skipping when file exists ([835b8ce](https://github.com/mrgoonie/claudekit-cli/commit/835b8ce91216a4c399a6362e047a98228fb1ab33)), closes [#421](https://github.com/mrgoonie/claudekit-cli/issues/421)
* **update-cli:** platform-aware elevation hint for permission errors ([08502c9](https://github.com/mrgoonie/claudekit-cli/commit/08502c973b387072bde709a3eebf9a7a61f93291))
* **update:** harden Windows update verification and PM detection ([df566bc](https://github.com/mrgoonie/claudekit-cli/commit/df566bc4572cc1ffe1c8b3e6a07041dfbcdb33ca))

### ♻️ Code Refactoring

* **cli:** unify CLI package constant usage ([fd9feef](https://github.com/mrgoonie/claudekit-cli/commit/fd9feef3dfda79cfd0b9403664fdc4c4a087860e))
* consolidate config routes — remove legacy config-routes ([3fbd0e8](https://github.com/mrgoonie/claudekit-cli/commit/3fbd0e83057c6336cc03616c3bbb974f38f7a42d))
* **env:** add shared CI and home-directory helpers ([55f5d2a](https://github.com/mrgoonie/claudekit-cli/commit/55f5d2abbb270740d0cd1357b03f4c6ee02b6e2a))
* **env:** reuse shared expensive-operation checks ([a046777](https://github.com/mrgoonie/claudekit-cli/commit/a046777b02171f3de6f62173dfe53adcef6c545d))
* **health:** harden network and install diagnostics ([1944f98](https://github.com/mrgoonie/claudekit-cli/commit/1944f98fbdc492800f50bdcc0ebfb679cf2f6ccc))
* **health:** remove hardcoded CLI install hints ([32d770f](https://github.com/mrgoonie/claudekit-cli/commit/32d770fdbdc897d48bbd9f7dced46e2e21fcee3b))
* **health:** reuse shared env resolution helpers ([65230d9](https://github.com/mrgoonie/claudekit-cli/commit/65230d92599608e65f9673b926f31406b5c6584b))
* **install:** centralize PM target and timeout constants ([d3d6bb8](https://github.com/mrgoonie/claudekit-cli/commit/d3d6bb89baa584d5dd25b68c59c33ae01c8667e6))
* **install:** remove duplicated PM detection literals ([912abc9](https://github.com/mrgoonie/claudekit-cli/commit/912abc91a9420c7e790cbb1caab62b5b137bef30))
* **install:** remove redundant PM target package constant ([d0c2fb8](https://github.com/mrgoonie/claudekit-cli/commit/d0c2fb8b4640f69023ce0978ce9881c801636145))
* **install:** standardize PM command timeouts ([057d05c](https://github.com/mrgoonie/claudekit-cli/commit/057d05c5dbc6e19a600a9c2f15200e89579d0c00))
* migrate web server routes from ConfigManager to CkConfigManager ([637dce9](https://github.com/mrgoonie/claudekit-cli/commit/637dce9c4ef597f56f91a796ef02835c8040cc06))
* **migrate:** use ReconcileAction["type"] for typePriority key ([19e42db](https://github.com/mrgoonie/claudekit-cli/commit/19e42dbf1410f250814c4452806876d6a0a32254))
* **network:** unify CLI user-agent constant usage ([399be9f](https://github.com/mrgoonie/claudekit-cli/commit/399be9f119465dadc5818a1c9ae5b44c10371990))
* **pkg:** harden manager detection and npm timeouts ([b587240](https://github.com/mrgoonie/claudekit-cli/commit/b587240f538602a7af5af92a68a4dc3fd38418b6))
* rename ck port to ck migrate for terminology consistency ([b3e08a7](https://github.com/mrgoonie/claudekit-cli/commit/b3e08a7e330051742418b159d5c2f4cbec111a70)), closes [#401](https://github.com/mrgoonie/claudekit-cli/issues/401)
* **shared:** add centralized CLI metadata constants ([62f98fa](https://github.com/mrgoonie/claudekit-cli/commit/62f98fad123ac2d77812a932aa8e2499f084a893))
* **shared:** normalize env parsing and user-agent constants ([ac670a6](https://github.com/mrgoonie/claudekit-cli/commit/ac670a60b3ecbf4d92261f34da17caca925919b2))
* **shared:** remove misleading CLI user-agent alias ([53e9787](https://github.com/mrgoonie/claudekit-cli/commit/53e9787361d797cf2e5d25d9943a905f9aa9e526))

### 📚 Documentation

* add idempotent migration architecture to CLAUDE.md and docs ([d5b4bd7](https://github.com/mrgoonie/claudekit-cli/commit/d5b4bd774d0c22640a93c677fa374005fb8d23b1))
* add release workflow conflict resolution guide ([c639eae](https://github.com/mrgoonie/claudekit-cli/commit/c639eae34d761d22e8a339608c2a3c95b6d22c41))
* add sync point comment for hook schema maintenance ([1a16b4f](https://github.com/mrgoonie/claudekit-cli/commit/1a16b4fd7c3e8805b1e420dfa3b9b394272d3848))
* update commit convention with hotfix, perf, refactor types ([0562ade](https://github.com/mrgoonie/claudekit-cli/commit/0562aded0d566cbd64183a29c322b5ce71cb8b18))

### ✅ Tests

* add coverage for projectConfigExists and hook schema sync ([bfc8bc4](https://github.com/mrgoonie/claudekit-cli/commit/bfc8bc4ab81f2a59d7463c524cd6468e11d32740))
* **pm-detection:** add edge case coverage ([e246958](https://github.com/mrgoonie/claudekit-cli/commit/e246958a836b3c63d0e634b838c7fb8eb85b80f6))
* **portable:** add tests for config/rules converters and discovery ([d462f24](https://github.com/mrgoonie/claudekit-cli/commit/d462f2451e62401d8b87030411f83eb62753ed66))
* **settings:** expect cross-platform hook path variables ([efc666c](https://github.com/mrgoonie/claudekit-cli/commit/efc666cbbd0cab16539b9a39a933e0bd4819b545))
* **web-server:** assert openBrowser false does not launch browser ([611240f](https://github.com/mrgoonie/claudekit-cli/commit/611240ff219cc2f9c47cb87a0a5dfda4260b6b87))

## [3.35.0-dev.30](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.29...v3.35.0-dev.30) (2026-02-24)

### 🚀 Features

* **dashboard:** overhaul migration summary with grouped results, search, and smart columns ([2571fec](https://github.com/mrgoonie/claudekit-cli/commit/2571fecdc3bc68557d14780f550cefffa1c4531d)), closes [#443](https://github.com/mrgoonie/claudekit-cli/issues/443)
* **migrate:** improve provider-aware migration summary flow ([c9c0098](https://github.com/mrgoonie/claudekit-cli/commit/c9c00988c5d7270ff9b35be305e4d7588dd67fdb))

### 🐞 Bug Fixes

* address all PR [#444](https://github.com/mrgoonie/claudekit-cli/issues/444) review feedback (10 items) ([9708391](https://github.com/mrgoonie/claudekit-cli/commit/9708391080c38583878272469f58ab7a1a509b72))
* **dashboard:** align migration summary with dashboard UI patterns ([e7aa02c](https://github.com/mrgoonie/claudekit-cli/commit/e7aa02c9e0308b3456423630f4bc89c0f162a352))
* **dashboard:** share HTTP server with Vite HMR to prevent refresh loop ([c5cbd7c](https://github.com/mrgoonie/claudekit-cli/commit/c5cbd7cf83c4266b3286a27e3c169909d3c5ee6f))
* **migrate:** harden edge-case handling and summary accessibility ([85f9b2f](https://github.com/mrgoonie/claudekit-cli/commit/85f9b2f30291e931c6d62a72dddd3f9b64a0161c))
* **migrate:** restore legacy compatibility and modal accessibility ([9ecdcd1](https://github.com/mrgoonie/claudekit-cli/commit/9ecdcd15f3508d11a7d74c1a7a08614d514c0878))

### ✅ Tests

* **web-server:** assert openBrowser false does not launch browser ([611240f](https://github.com/mrgoonie/claudekit-cli/commit/611240ff219cc2f9c47cb87a0a5dfda4260b6b87))

## [3.35.0-dev.29](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.28...v3.35.0-dev.29) (2026-02-23)

### 🐞 Bug Fixes

* address code review feedback (attempt 1/5) ([de976de](https://github.com/mrgoonie/claudekit-cli/commit/de976de1856cd45917f6f6febfdd5aea6146c23a))
* address code review feedback (attempt 2/5) ([af602f8](https://github.com/mrgoonie/claudekit-cli/commit/af602f88f364d874f8bd4695fb6672ef594b4dd6))
* address code review feedback (attempt 3/5) ([1cbca04](https://github.com/mrgoonie/claudekit-cli/commit/1cbca0486afd807d06d63ca1fd4955dc4e0fc0ad))
* **update:** harden Windows update verification and PM detection ([df566bc](https://github.com/mrgoonie/claudekit-cli/commit/df566bc4572cc1ffe1c8b3e6a07041dfbcdb33ca))

## [3.35.0-dev.28](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.27...v3.35.0-dev.28) (2026-02-23)

### 🐞 Bug Fixes

* **migrate:** remove initialValues pre-selecting all detected providers ([c140ecd](https://github.com/mrgoonie/claudekit-cli/commit/c140ecd19b25ad19265d4903ad91602a371f3518)), closes [#446](https://github.com/mrgoonie/claudekit-cli/issues/446)

## [3.35.0-dev.27](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.26...v3.35.0-dev.27) (2026-02-22)

### 🚀 Features

* **config:** add editable Claude settings JSON panel in System tab ([4b22e9b](https://github.com/mrgoonie/claudekit-cli/commit/4b22e9b5bdc3d308a2bfbc13111c87795227092b))

## [3.35.0-dev.26](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.25...v3.35.0-dev.26) (2026-02-22)

### 🚀 Features

* **dashboard:** embed UI assets in compiled binary via Bun.embeddedFiles ([65bf092](https://github.com/mrgoonie/claudekit-cli/commit/65bf092816a0f54f99fae0388efe1cd674a51653))

### 🐞 Bug Fixes

* **dashboard:** address review edge cases for embedded UI serving ([71ba828](https://github.com/mrgoonie/claudekit-cli/commit/71ba82863b33b3f17d11cbf12d1ee6046573c0c4))

## [3.35.0-dev.25](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.24...v3.35.0-dev.25) (2026-02-22)

### 🔥 Hotfixes

* fix hook command path quoting for paths with spaces ([e2146d9](https://github.com/mrgoonie/claudekit-cli/commit/e2146d97d575275aad868c629ae2cb0ec2aedcea))
* harden ck update registry edge cases ([7cccb3f](https://github.com/mrgoonie/claudekit-cli/commit/7cccb3f390d24448d8d828ad87b34f4a4987d2c8))
* resolve ETARGET error when user's npm registry differs from public registry ([29267db](https://github.com/mrgoonie/claudekit-cli/commit/29267db7c4dcd07cb51da16c8890ff12b677008c)), closes [#438](https://github.com/mrgoonie/claudekit-cli/issues/438)
* strengthen --fresh to full reset (settings.json + CLAUDE.md) ([576faff](https://github.com/mrgoonie/claudekit-cli/commit/576faffd376187315a59861e6736858b94d41210))
* use $HOME universally and fix review bugs ([106e0fe](https://github.com/mrgoonie/claudekit-cli/commit/106e0fe0faf8b5086bae80e17e8308b91e0b9156))

## [3.35.0-dev.24](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.23...v3.35.0-dev.24) (2026-02-22)

### 🐞 Bug Fixes

* **migrate:** align unreadable target-state behavior ([9c5358f](https://github.com/mrgoonie/claudekit-cli/commit/9c5358fdfd665554882270574078416c7ab3c47b))
* **migrate:** skip skill directory entries in reconcile target states ([b41b0b2](https://github.com/mrgoonie/claudekit-cli/commit/b41b0b286153018fc3a433ee157f409670f11337)), closes [#441](https://github.com/mrgoonie/claudekit-cli/issues/441)

### ✅ Tests

* **settings:** expect cross-platform hook path variables ([efc666c](https://github.com/mrgoonie/claudekit-cli/commit/efc666cbbd0cab16539b9a39a933e0bd4819b545))

## [3.35.0-dev.23](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.22...v3.35.0-dev.23) (2026-02-21)

### 🚀 Features

* **codex:** generate proper TOML multi-agent configs instead of flat AGENTS.md ([dc35790](https://github.com/mrgoonie/claudekit-cli/commit/dc3579090ea4569449081caa859218f4d8db8d43)), closes [claudekit-engineer#494](https://github.com/mrgoonie/claudekit-engineer/issues/494)

### 🔥 Hotfixes

* add Discord 25-field embed limit guard ([790cf16](https://github.com/mrgoonie/claudekit-cli/commit/790cf16c82854f3af546aaba3889b8cf2be3e09a))
* address CI lint failures and reviewer feedback ([807515a](https://github.com/mrgoonie/claudekit-cli/commit/807515a4e9e4ae7fdcc4b500f31006d3081a50e3))
* fix Discord notification triple-posting and missing production releases ([b731a5f](https://github.com/mrgoonie/claudekit-cli/commit/b731a5fd3a041007900d3be907e2b000949af68e)), closes [#431](https://github.com/mrgoonie/claudekit-cli/issues/431)
* fix Discord notification UX consistency issues ([2a5c29e](https://github.com/mrgoonie/claudekit-cli/commit/2a5c29eeefdca6bdea67a517f69d49b13caed56e))
* **merger:** migrate deprecated hook matchers during settings merge ([300a9bf](https://github.com/mrgoonie/claudekit-cli/commit/300a9bf8c0431b19df2c31fc389eca9778ed4184))
* prevent double error log on timeout ([9cbb519](https://github.com/mrgoonie/claudekit-cli/commit/9cbb51995f7de96bbfdce8b01ef646cb4065f6cc))

### 🐞 Bug Fixes

* **codex:** add file lock, rollback, and converter hardening for TOML installer ([4af3574](https://github.com/mrgoonie/claudekit-cli/commit/4af3574f893c5ba2cd8b483593dadcd4f4a2e0b3))
* **codex:** add multi-sentinel collapse, CRLF detection, diagnostics API, and review fixes ([c00fd97](https://github.com/mrgoonie/claudekit-cli/commit/c00fd973f32ff14873abd046aa31eef3eb453a16))
* **codex:** address AI review feedback — ensureDir, skip-success, task comment, tests ([cbd625b](https://github.com/mrgoonie/claudekit-cli/commit/cbd625b23b54fddc642de36239c57c9349eafea7))
* **codex:** use correct sandbox_mode "read-only" per Codex spec ([a83f8bf](https://github.com/mrgoonie/claudekit-cli/commit/a83f8bf528fc63b828e222d5837ee1478326daeb))
* **release:** add hotfix commit type and conventionalcommits preset ([95f29e6](https://github.com/mrgoonie/claudekit-cli/commit/95f29e641d86f06b2cf22a65a86ed26ec8098d0c))
* restore ClaudeKit bot identity in Discord notifications ([2dce365](https://github.com/mrgoonie/claudekit-cli/commit/2dce365930286607eb35424cb50d590b3b3fd732))
* **test:** make CLI integration suite opt-in ([488ae65](https://github.com/mrgoonie/claudekit-cli/commit/488ae65bddb41f65aff2a8050322342a859d9150))
* **test:** make CLI integration suite opt-in ([c6254ac](https://github.com/mrgoonie/claudekit-cli/commit/c6254ac83bad23e900756817a6b7ac2c12838daf))

### 📚 Documentation

* update commit convention with hotfix, perf, refactor types ([0562ade](https://github.com/mrgoonie/claudekit-cli/commit/0562aded0d566cbd64183a29c322b5ce71cb8b18))

## [3.35.0-dev.22](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.21...v3.35.0-dev.22) (2026-02-21)

### 🐞 Bug Fixes

* **release:** add hotfix commit type and conventionalcommits preset ([215aa56](https://github.com/mrgoonie/claudekit-cli/commit/215aa562df406249ec8829309ed9d00cc476cfc8))

## [3.34.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.34.1...v3.34.2) (2026-02-21)

### 🔥 Hotfixes

* **merger:** migrate deprecated hook matchers during settings merge ([300a9bf](https://github.com/mrgoonie/claudekit-cli/commit/300a9bf8c0431b19df2c31fc389eca9778ed4184))

## [3.34.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.34.0...v3.34.1) (2026-02-21)

### 🐞 Bug Fixes

* **release:** add hotfix commit type and conventionalcommits preset ([95f29e6](https://github.com/mrgoonie/claudekit-cli/commit/95f29e641d86f06b2cf22a65a86ed26ec8098d0c))

# [3.35.0-dev.21](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.20...v3.35.0-dev.21) (2026-02-20)


### Bug Fixes

* **migrate:** address code review findings from parallel edge case audit ([27443dd](https://github.com/mrgoonie/claudekit-cli/commit/27443ddef69fbb9d4f29adaf7eb1b27991b8149c))
* **migrate:** address PR review feedback — budget tracking and dead config ([234c2d3](https://github.com/mrgoonie/claudekit-cli/commit/234c2d3911b1f82a25e55c42a65a28e25208bdc1))
* **migrate:** address round 2 review — skipped consistency and threshold fix ([f078def](https://github.com/mrgoonie/claudekit-cli/commit/f078def5c98154cbf9c5957f5b018981a19d4460))
* **migrate:** Windsurf char limit truncation and Copilot path-specific rules ([6bf3099](https://github.com/mrgoonie/claudekit-cli/commit/6bf309934b74fddc2a8bc51ba0e4a12ed2c7a5e2)), closes [#423](https://github.com/mrgoonie/claudekit-cli/issues/423)

# [3.35.0-dev.20](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.19...v3.35.0-dev.20) (2026-02-20)


### Bug Fixes

* **ui:** address review feedback for config json editor sizing ([e721048](https://github.com/mrgoonie/claudekit-cli/commit/e721048191f89bb66f754ad794477d053de75d9a))
* **ui:** reduce config editor json panel font size ([4342d63](https://github.com/mrgoonie/claudekit-cli/commit/4342d63fc16eea6e1a0fea61d680f6240e49c634))

# [3.35.0-dev.19](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.18...v3.35.0-dev.19) (2026-02-20)


### Bug Fixes

* implement plan-based migration execution in dashboard UI ([b56b875](https://github.com/mrgoonie/claudekit-cli/commit/b56b875bb57fa1bf449b925a273d764c24dc568d))

# [3.35.0-dev.18](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.17...v3.35.0-dev.18) (2026-02-19)


### Bug Fixes

* address PR review — interactive prompt, CRLF normalization, tests ([1824a8f](https://github.com/mrgoonie/claudekit-cli/commit/1824a8f75d9368d14aad4d86de76d7b04c8125dd)), closes [#422](https://github.com/mrgoonie/claudekit-cli/issues/422)
* update CLAUDE.md on re-init instead of skipping when file exists ([835b8ce](https://github.com/mrgoonie/claudekit-cli/commit/835b8ce91216a4c399a6362e047a98228fb1ab33)), closes [#421](https://github.com/mrgoonie/claudekit-cli/issues/421)

# [3.35.0-dev.17](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.16...v3.35.0-dev.17) (2026-02-18)


### Bug Fixes

* address PR [#420](https://github.com/mrgoonie/claudekit-cli/issues/420) review items ([30a8a3d](https://github.com/mrgoonie/claudekit-cli/commit/30a8a3d783a8fa0832f9e420806c21afa374af72))
* address PR [#420](https://github.com/mrgoonie/claudekit-cli/issues/420) review round 2 and codebase review findings ([92e430c](https://github.com/mrgoonie/claudekit-cli/commit/92e430c9e8787cbd278c30116a0e701ce73ad44e))
* **cli-output:** respect quiet mode and robust terminal detection ([ca6cb20](https://github.com/mrgoonie/claudekit-cli/commit/ca6cb20d458fa7030e7c37ceb84588f6dc551df3))
* **env:** trim home path and unset env vars safely in tests ([a93eabf](https://github.com/mrgoonie/claudekit-cli/commit/a93eabfa96701ba88a23afe2cb81ea049a0f527e))
* **installer:** skip optional installs in test environment ([ded8407](https://github.com/mrgoonie/claudekit-cli/commit/ded8407a38a3292f9c9b2b5c67b195839b7f2610))
* **system-routes:** validate channel and semver update checks ([ca88675](https://github.com/mrgoonie/claudekit-cli/commit/ca88675b3a1e80a89dc398a681b224e22e356869))
* **terminal:** avoid CI_SAFE_MODE in unicode detection ([181361a](https://github.com/mrgoonie/claudekit-cli/commit/181361a7f092d88bbc443c15069e38a94740b2e6))

# [3.35.0-dev.16](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.15...v3.35.0-dev.16) (2026-02-17)


### Bug Fixes

* **codex:** correct provider mappings for skills, rules, and exec order ([9e3088e](https://github.com/mrgoonie/claudekit-cli/commit/9e3088e1b2751f3d307c3c3232774c2f8297ca8e)), closes [#418](https://github.com/mrgoonie/claudekit-cli/issues/418)
* **test:** update second provider-registry test for Codex rules path ([7b1d935](https://github.com/mrgoonie/claudekit-cli/commit/7b1d935545ee4f6d370b67ce2f9bf1829f646c68))

# [3.35.0-dev.15](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.14...v3.35.0-dev.15) (2026-02-16)


### Features

* **migrate:** add --force flag to override skip decisions ([df94d3c](https://github.com/mrgoonie/claudekit-cli/commit/df94d3cd14bda5592868b129ace0765249adb1aa))

# [3.35.0-dev.14](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.13...v3.35.0-dev.14) (2026-02-16)


### Bug Fixes

* deduplicate heading regex in splitManagedContent ([bd34dea](https://github.com/mrgoonie/claudekit-cli/commit/bd34dea739cf84ba9f7f7fa61fff45ab6c8c801b))
* **portable:** fence-aware parsing, section-level checksums, duplicate warnings ([69113aa](https://github.com/mrgoonie/claudekit-cli/commit/69113aa707da4d4a73444b58dacf0f7515caf41b)), closes [#415](https://github.com/mrgoonie/claudekit-cli/issues/415)
* **portable:** harden merge-single cross-kind preservation ([bb40c61](https://github.com/mrgoonie/claudekit-cli/commit/bb40c61e25f410c8956f0e93401e0de700cb63da))
* **portable:** prevent cross-kind section loss in shared files ([#415](https://github.com/mrgoonie/claudekit-cli/issues/415)) ([7181dd5](https://github.com/mrgoonie/claudekit-cli/commit/7181dd506e436fee42a5569aebd9c8cc78e1d0eb))

# [3.35.0-dev.13](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.12...v3.35.0-dev.13) (2026-02-15)


### Bug Fixes

* **actions:** harden linux launch and add internal route tests ([6aaf7b6](https://github.com/mrgoonie/claudekit-cli/commit/6aaf7b6f9c3b7e5dfb4f237cc58123b7d4b5e4bf))
* **actions:** tighten executable token checks and spawn cwd guards ([09ab211](https://github.com/mrgoonie/claudekit-cli/commit/09ab211527e8f9ab0fc488922e1047c1f190017a))
* **actions:** validate system editor command and normalize base path checks ([7cba1c0](https://github.com/mrgoonie/claudekit-cli/commit/7cba1c020b1a8bd90a7e73892e6330ceacd9162a))
* **config:** harden action launch validation and UX ([b440337](https://github.com/mrgoonie/claudekit-cli/commit/b4403379ef590e304c8e673754730d4aa2aa6922))


### Features

* **config:** expand adaptive editor and terminal launchers ([9f17116](https://github.com/mrgoonie/claudekit-cli/commit/9f171166d80311c1c0ff747b9f46573ad6a3eae4))

# [3.35.0-dev.12](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.11...v3.35.0-dev.12) (2026-02-15)


### Bug Fixes

* **ci:** isolate portable registry mocks and add migrate architecture docs ([4ddb062](https://github.com/mrgoonie/claudekit-cli/commit/4ddb0627e9bb3e6b59464074f2471627962c32ce))
* **migrate:** harden idempotent reconciliation edge cases ([9c85174](https://github.com/mrgoonie/claudekit-cli/commit/9c85174567f23f1427b7b024a05abd75a1775692))
* **migrate:** preserve skills fallback with planned execution ([92cc9e8](https://github.com/mrgoonie/claudekit-cli/commit/92cc9e8fb6472ee9f41ba250e3f8b6640a6b5af7))
* **migrate:** rollback failed installs and harden review UX ([550d9d8](https://github.com/mrgoonie/claudekit-cli/commit/550d9d8b09fb146e2211903020596200aa43349c))
* **portable-registry:** avoid migration lock TOCTOU race ([e6cc0b2](https://github.com/mrgoonie/claudekit-cli/commit/e6cc0b2165c171d0f28766c4a0276f8c0eebc39c))


### Features

* **migrate:** add idempotent reconciliation pipeline with checksum tracking ([e8954b1](https://github.com/mrgoonie/claudekit-cli/commit/e8954b1a3ecaace0f1e186fcf8d760a184238ab0)), closes [#412](https://github.com/mrgoonie/claudekit-cli/issues/412)

# [3.35.0-dev.11](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.10...v3.35.0-dev.11) (2026-02-14)


### Bug Fixes

* **config-ui:** address review findings and check state races ([57410cc](https://github.com/mrgoonie/claudekit-cli/commit/57410cc0a2233ce57910faf53c87397869853ff5))
* **config-ui:** fix cli version display and update filters ([52ea0e0](https://github.com/mrgoonie/claudekit-cli/commit/52ea0e03ab303acb2336a76fbff7e54686b5b527))
* **config-ui:** resolve CI lint and harden dashboard filters ([602fa95](https://github.com/mrgoonie/claudekit-cli/commit/602fa95c5b16db8f77d5dc907c9c9cd63c9ce621))

# [3.35.0-dev.10](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.9...v3.35.0-dev.10) (2026-02-14)


### Bug Fixes

* address CI lint failure and PR review feedback ([9aa5709](https://github.com/mrgoonie/claudekit-cli/commit/9aa5709d10e33d62ab8fbe864882ff0f042f3e2e))


### Features

* improve ck migrate UX/DX -- dry-run, rollback, scope resolver, overwrite warnings ([1b46397](https://github.com/mrgoonie/claudekit-cli/commit/1b46397bc50de79f0e803effda9a346661dc87b6)), closes [#404](https://github.com/mrgoonie/claudekit-cli/issues/404) [#405](https://github.com/mrgoonie/claudekit-cli/issues/405) [#406](https://github.com/mrgoonie/claudekit-cli/issues/406) [#407](https://github.com/mrgoonie/claudekit-cli/issues/407) [#408](https://github.com/mrgoonie/claudekit-cli/issues/408) [#409](https://github.com/mrgoonie/claudekit-cli/issues/409) [#404](https://github.com/mrgoonie/claudekit-cli/issues/404) [#405](https://github.com/mrgoonie/claudekit-cli/issues/405) [#406](https://github.com/mrgoonie/claudekit-cli/issues/406) [#407](https://github.com/mrgoonie/claudekit-cli/issues/407) [#408](https://github.com/mrgoonie/claudekit-cli/issues/408) [#409](https://github.com/mrgoonie/claudekit-cli/issues/409) [#403](https://github.com/mrgoonie/claudekit-cli/issues/403)

# [3.35.0-dev.9](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.8...v3.35.0-dev.9) (2026-02-13)


### Bug Fixes

* sort import statements to satisfy biome linter ([6d6d5f0](https://github.com/mrgoonie/claudekit-cli/commit/6d6d5f0819817c5aba5f2358c0d900db89c85542))

# [3.35.0-dev.8](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.7...v3.35.0-dev.8) (2026-02-13)


### Bug Fixes

* flatten nested commands for providers that don't support folder nesting ([0dd9e91](https://github.com/mrgoonie/claudekit-cli/commit/0dd9e91cda407a11993b336023cffb7e72dcc692)), closes [#399](https://github.com/mrgoonie/claudekit-cli/issues/399)

# [3.35.0-dev.7](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.6...v3.35.0-dev.7) (2026-02-13)


### Bug Fixes

* **test:** update help assertions for expanded command set ([3555679](https://github.com/mrgoonie/claudekit-cli/commit/35556793b20c33bbfddefd784036be46764a87f6))


### Features

* **help:** improve command discoverability in ck help ([3c4f016](https://github.com/mrgoonie/claudekit-cli/commit/3c4f01663e71c39ce33dee5f45eabf13082e8aaa))

# [3.35.0-dev.6](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.5...v3.35.0-dev.6) (2026-02-13)


### Bug Fixes

* **lint:** replace template literals with string literals in tests ([87fe402](https://github.com/mrgoonie/claudekit-cli/commit/87fe4020d87b9acd1268cc50163e31d1da725b5c))


### Features

* **portable:** add subagent capability flag to ProviderConfig ([#395](https://github.com/mrgoonie/claudekit-cli/issues/395)) ([98f19ab](https://github.com/mrgoonie/claudekit-cli/commit/98f19ab3f88895f3a5ad96c2c086e686c081567d))

# [3.35.0-dev.5](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.4...v3.35.0-dev.5) (2026-02-13)


### Bug Fixes

* **migrate:** add commands support for Antigravity and Windsurf ([3f5f7e7](https://github.com/mrgoonie/claudekit-cli/commit/3f5f7e77417061705f203d79f10e54a6d13e0099)), closes [#394](https://github.com/mrgoonie/claudekit-cli/issues/394)

# [3.35.0-dev.4](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.3...v3.35.0-dev.4) (2026-02-12)


### Features

* **ui:** redesign migrate dashboard for stronger UX ([53afd10](https://github.com/mrgoonie/claudekit-cli/commit/53afd102485d32563fcc61e1d629855126ba82f3))

# [3.35.0-dev.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.2...v3.35.0-dev.3) (2026-02-12)


### Bug Fixes

* **ui:** address review follow-ups for dashboard accessibility ([d6e566a](https://github.com/mrgoonie/claudekit-cli/commit/d6e566af6b16942e96fe0a0b1f05a6cbd96fcd6b))
* **ui:** unblock checks for migrate dashboard polish ([d5e6dbe](https://github.com/mrgoonie/claudekit-cli/commit/d5e6dbe233c8e8bce8835bd1a101ac459777f8ce))


### Features

* **ui:** improve migrate dashboard decision hierarchy ([9b5a7af](https://github.com/mrgoonie/claudekit-cli/commit/9b5a7af71509d23d63e97e29693f38d8c24914d2))

# [3.35.0-dev.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.35.0-dev.1...v3.35.0-dev.2) (2026-02-12)


### Bug Fixes

* address 7 review issues for cross-provider portability ([b4421ab](https://github.com/mrgoonie/claudekit-cli/commit/b4421abd72e7a657b935f647df6ab7bbafb0b1b8))
* address PR review feedback — lint, tests, and defensive improvements ([14ef4f1](https://github.com/mrgoonie/claudekit-cli/commit/14ef4f19073e7e57c31cbf23ae038ff0b77f875e))
* **agents:** normalize heading for merge-single uninstall matching ([7911688](https://github.com/mrgoonie/claudekit-cli/commit/7911688a3737a186f06dded6a9b1377ad8933656))
* **dev:** remove watch loop from dashboard dev script ([e7aeb18](https://github.com/mrgoonie/claudekit-cli/commit/e7aeb18a81cce3646e6519fa3c3fb1285690c32d))
* **migrate:** prevent direct-copy frontmatter crashes ([2451fa2](https://github.com/mrgoonie/claudekit-cli/commit/2451fa2380e5de211071a1ad4bc87f33dbfdb904))
* normalize path separators in codex test for Windows compatibility ([d4f40b0](https://github.com/mrgoonie/claudekit-cli/commit/d4f40b0c2e7b245565d52d66f3a48c71e7b386be))
* **paths:** preserve nested namespaces and add regression tests ([c92d5e6](https://github.com/mrgoonie/claudekit-cli/commit/c92d5e656470ae7d31ab8d72d56abdbee96fc783))
* **portable:** add UNC path detection and missing translation key ([6d18d25](https://github.com/mrgoonie/claudekit-cli/commit/6d18d2594e172532fd3e9f1182f63bc512e15040))
* **portable:** address review feedback for install/uninstall flows ([323d09d](https://github.com/mrgoonie/claudekit-cli/commit/323d09df670bd412ba7297a06a9f91bd723961d7))
* **portable:** block encoded path traversal and parallelize installs ([53aeb2c](https://github.com/mrgoonie/claudekit-cli/commit/53aeb2c990cf9190d18b85824549f5df2388c1c3))
* **portable:** harden converters with error handling and proper escaping ([ab9e357](https://github.com/mrgoonie/claudekit-cli/commit/ab9e35724566373264ccda86cccbc95312acb013))
* **portable:** harden install paths and registry writes ([08e3c2b](https://github.com/mrgoonie/claudekit-cli/commit/08e3c2bc34a3a3eaf1d79540f9eaf00e3202dfeb))
* **portable:** harden migration install/conversion flows ([2b4ae4e](https://github.com/mrgoonie/claudekit-cli/commit/2b4ae4ec8754dd85b217120abe0ac094c678be84))
* **portable:** increase registry lock timeout and add input validation ([68dee58](https://github.com/mrgoonie/claudekit-cli/commit/68dee58d166e35ec3ae14f1701f34739ba3de8e1))
* **portable:** make merge-single installs rule-aware and safe ([e8dd22f](https://github.com/mrgoonie/claudekit-cli/commit/e8dd22fdd1adbdb287d3aae745eacafcbc224f67))
* **portable:** point Codex global rules to file path, not directory ([fd28da8](https://github.com/mrgoonie/claudekit-cli/commit/fd28da83c8a919b815ad25a15a11dcfa3cd1f832))
* **portable:** preserve config preamble in merge-single installer ([5dd7a98](https://github.com/mrgoonie/claudekit-cli/commit/5dd7a987b72a22ebdfae54fdc4a109a40271a008))
* **portable:** preserve real paths in md-strip slash command removal ([375b30d](https://github.com/mrgoonie/claudekit-cli/commit/375b30d95c796eb0b90713e04344bc3759d39152))
* **port:** honor config/rules flag combinations ([3307f01](https://github.com/mrgoonie/claudekit-cli/commit/3307f015618394cdbab6700aadbea80b439e1fc3))
* **port:** replace --no-config/--no-rules with --skip-config/--skip-rules ([b2fd451](https://github.com/mrgoonie/claudekit-cli/commit/b2fd451f97a32e4e8dc27c26fdf2f0c4a56e56bb))
* **uninstall:** honor scope and add safe force flows ([bbdef16](https://github.com/mrgoonie/claudekit-cli/commit/bbdef16190e95ee05d73fe34c03bad1bfc5ac8dd))


### Features

* add ck agents and ck commands for cross-provider portability ([3545ee8](https://github.com/mrgoonie/claudekit-cli/commit/3545ee86f047c6187e43d198cba22dfdb902c816)), closes [#391](https://github.com/mrgoonie/claudekit-cli/issues/391)
* add ck agents and ck commands for cross-provider portability ([#392](https://github.com/mrgoonie/claudekit-cli/issues/392)) ([26425da](https://github.com/mrgoonie/claudekit-cli/commit/26425da6163dda4277c130716acff4733048b6ed)), closes [#391](https://github.com/mrgoonie/claudekit-cli/issues/391)
* add ck port for one-shot cross-provider migration ([fe6de21](https://github.com/mrgoonie/claudekit-cli/commit/fe6de214aa3e731c16fae06c5e326025a144a6fc))
* **migrate:** replace skills dashboard with migrate hub ([ef450ec](https://github.com/mrgoonie/claudekit-cli/commit/ef450ec554d5409d05998518f4fe16e9b3ee38a8))
* **portable:** add config/rules porting infrastructure ([2e17d4e](https://github.com/mrgoonie/claudekit-cli/commit/2e17d4e0b7c93cae3e7a198b01ca443fb68566e2))
* **port:** extend ck port with config and rules porting ([16dc8ee](https://github.com/mrgoonie/claudekit-cli/commit/16dc8eeb5e19aac6332ca8cb5b9d19f44380c213))
* **ui:** upgrade migrate dashboard to skills-grade UX ([407c13a](https://github.com/mrgoonie/claudekit-cli/commit/407c13ad8413b64edc74fc1abdb27079f330af73))

# [3.35.0-dev.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.34.1-dev.5...v3.35.0-dev.1) (2026-02-11)


### Features

* **doctor:** add hook runtime diagnostics checks ([#390](https://github.com/mrgoonie/claudekit-cli/issues/390)) ([5ca27b5](https://github.com/mrgoonie/claudekit-cli/commit/5ca27b5c12163ce7fa575732aa78964ad7dd3c2f)), closes [#384](https://github.com/mrgoonie/claudekit-cli/issues/384)

## [3.34.1-dev.5](https://github.com/mrgoonie/claudekit-cli/compare/v3.34.1-dev.4...v3.34.1-dev.5) (2026-02-11)


### Bug Fixes

* address code review feedback for PM detection ([b40c65d](https://github.com/mrgoonie/claudekit-cli/commit/b40c65dd45b2d984fb0d422378922374fd7d3d23))
* detect package manager from binary install path ([e29efaa](https://github.com/mrgoonie/claudekit-cli/commit/e29efaa4b5f729b2700986c223deb3bfe8f9932f)), closes [#385](https://github.com/mrgoonie/claudekit-cli/issues/385)
* **pm-detection:** harden edge cases in detection logic ([e2356e3](https://github.com/mrgoonie/claudekit-cli/commit/e2356e33b2db385f4a8d8de5f4709f0ff946975c))
* **update-cli:** platform-aware elevation hint for permission errors ([08502c9](https://github.com/mrgoonie/claudekit-cli/commit/08502c973b387072bde709a3eebf9a7a61f93291))

## [3.34.1-dev.4](https://github.com/mrgoonie/claudekit-cli/compare/v3.34.1-dev.3...v3.34.1-dev.4) (2026-02-07)


### Bug Fixes

* **installer:** conditional team hooks injection based on CC version ([#382](https://github.com/mrgoonie/claudekit-cli/issues/382)) ([72bf0aa](https://github.com/mrgoonie/claudekit-cli/commit/72bf0aadc5e3824b7caf7c5301dc8bc0ae9bcf2a)), closes [#464](https://github.com/mrgoonie/claudekit-cli/issues/464)

## [3.34.1-dev.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.34.1-dev.2...v3.34.1-dev.3) (2026-02-06)


### Bug Fixes

* **dashboard:** add missing hook docs for descriptive-name and context-tracking ([dee2ac9](https://github.com/mrgoonie/claudekit-cli/commit/dee2ac98ea9852f53d0c65153986d95f4cfeaaa5))
* **dashboard:** default page now correctly shows global config ([c8e5ff3](https://github.com/mrgoonie/claudekit-cli/commit/c8e5ff3b4c14581078fff1e307b440a9d81538eb))
* **dashboard:** disable drawSelection to fix focused selection color ([acac253](https://github.com/mrgoonie/claudekit-cli/commit/acac253cfc861c8260d89b5db47be31f5da0714e))
* **dashboard:** override browser native selection color in config editor ([6d6ce47](https://github.com/mrgoonie/claudekit-cli/commit/6d6ce472d718b5d9b9d3b59c23ecd11eb32b86aa))

## [3.34.1-dev.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.34.1-dev.1...v3.34.1-dev.2) (2026-02-06)


### Bug Fixes

* fetch global config for project page override detection ([082601d](https://github.com/mrgoonie/claudekit-cli/commit/082601d62410d3ba18f86bb1029aad0e50b2ce69))
* fetch global config for project page override detection ([ff2e5d1](https://github.com/mrgoonie/claudekit-cli/commit/ff2e5d1ba781c3ede72cebb8f5ad6478149eda58))
* **security:** add prototype pollution protection to config manager ([8601a0a](https://github.com/mrgoonie/claudekit-cli/commit/8601a0aa800e5ac228408bae5eb070177e29f9a3))
* sync hook schemas — add descriptive-name and context-tracking ([a436c7f](https://github.com/mrgoonie/claudekit-cli/commit/a436c7f73f3d3175f407b0d0e16ae75cb25fa0a3))
* **tests:** make path tests cross-platform compatible for Windows CI ([67b3f05](https://github.com/mrgoonie/claudekit-cli/commit/67b3f0503aa854aa6f325363be722860ee742f8b))

## [3.34.1-dev.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.34.0...v3.34.1-dev.1) (2026-02-04)


### Bug Fixes

* **release:** skip merge commits from main to prevent premature dev versions ([253aa16](https://github.com/mrgoonie/claudekit-cli/commit/253aa16624f6383decf93071b03adb21fb827fa8))

# [3.34.0-dev.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.34.0-dev.1...v3.34.0-dev.2) (2026-02-04)


### Bug Fixes

* **release:** skip merge commits from main to prevent premature dev versions ([253aa16](https://github.com/mrgoonie/claudekit-cli/commit/253aa16624f6383decf93071b03adb21fb827fa8))

# [3.34.0-dev.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0...v3.34.0-dev.1) (2026-02-04)


### Bug Fixes

* **api:** expand tilde in project path and allow projects without .claude dir ([9bbf312](https://github.com/mrgoonie/claudekit-cli/commit/9bbf312211a9eeeae5512834dbe7f7830d960672))
* **api:** use buildInitCommand for kit updates with proper flags ([6d60b7a](https://github.com/mrgoonie/claudekit-cli/commit/6d60b7a3b6d4433f8f66d932c5daf9fa37b6bd35))
* **api:** use PackageManagerDetector for update command ([b7d3706](https://github.com/mrgoonie/claudekit-cli/commit/b7d370630511ccb4bea62c1fb6e7dd513e730ea2))
* bundle dashboard UI in npm package + add ui:build script ([dd00178](https://github.com/mrgoonie/claudekit-cli/commit/dd00178bcca393fc60dc391ae7d120a1482a4b18)), closes [#363](https://github.com/mrgoonie/claudekit-cli/issues/363)
* **ci:** resolve all CI failures across Linux and Windows ([3aa681c](https://github.com/mrgoonie/claudekit-cli/commit/3aa681ccf6ad052ed1f38b7024fef0ac2f0d1be6))
* **cli:** add SIGINT handlers and download timeouts ([dcd33a4](https://github.com/mrgoonie/claudekit-cli/commit/dcd33a475e1a7674cba13932cedfc1a787039c0f))
* **cli:** improve error recovery and version validation ([d7f3ec4](https://github.com/mrgoonie/claudekit-cli/commit/d7f3ec4011bef093da9e7d897f5ef92700a12bcb))
* **config-api:** save engineer kit config to correct path ([aaa077c](https://github.com/mrgoonie/claudekit-cli/commit/aaa077c67cf0d0b9d0ae093cc6046b28ceb442b1))
* **config-ui:** enable Vite HMR in dashboard dev mode ([8afbb13](https://github.com/mrgoonie/claudekit-cli/commit/8afbb133c24842a85e2be2e2c5066aa6bed674a0))
* **config-ui:** fix Tailwind content scanning in middleware mode ([24f3b5f](https://github.com/mrgoonie/claudekit-cli/commit/24f3b5f5daf984f973228374cca8978465009292))
* **config-ui:** flex-based viewport fill for dashboard layout ([a86c74b](https://github.com/mrgoonie/claudekit-cli/commit/a86c74bcb8999225de8ccbeb4caaae73621ecceb))
* **config-ui:** make collapse button work with resizable sidebar ([be88b68](https://github.com/mrgoonie/claudekit-cli/commit/be88b68d0750937fb378b8df2dd311cf0ffda5fd))
* **config-ui:** remove duplicate sidebar Skills and fix i18n ([dff2d3a](https://github.com/mrgoonie/claudekit-cli/commit/dff2d3af452e44b494d8160b1cca24ee143579b6))
* **config-ui:** resolve Tailwind CSS in Vite middleware mode ([72ecff0](https://github.com/mrgoonie/claudekit-cli/commit/72ecff01fdcc52bbe5f67cab0c33c2d3321e0664))
* **config:** address code review edge cases + add tests ([a408480](https://github.com/mrgoonie/claudekit-cli/commit/a4084804f96a4857e63b508e58be7710b55c9d5d)), closes [#362](https://github.com/mrgoonie/claudekit-cli/issues/362)
* **config:** ck config launches dashboard, fix legacy ConfigManager ([ba1283b](https://github.com/mrgoonie/claudekit-cli/commit/ba1283be9f349e1bf6a975545ed761df4440a416)), closes [#361](https://github.com/mrgoonie/claudekit-cli/issues/361)
* **dashboard:** allow dotfiles in static serving for global installs ([f7123cf](https://github.com/mrgoonie/claudekit-cli/commit/f7123cffcb2cc8c4e8bc473520a979b15915ae63))
* **dashboard:** correct UI dist path resolution for global install ([c1db65d](https://github.com/mrgoonie/claudekit-cli/commit/c1db65d26cbb1e76460789b1b000e057b0a4d9be)), closes [#365](https://github.com/mrgoonie/claudekit-cli/issues/365)
* **dx:** add --watch to dashboard:dev for backend auto-restart ([35afdcf](https://github.com/mrgoonie/claudekit-cli/commit/35afdcf700c6205388c71bce65557ff0755ccbb1))
* **dx:** skip browser open on server restart during watch mode ([3b8f71e](https://github.com/mrgoonie/claudekit-cli/commit/3b8f71ea6bec7439dbea7952923a3db06bb2f284))
* extend codingLevel max from 3 to 5 to match engineer kit ([8e0cbdf](https://github.com/mrgoonie/claudekit-cli/commit/8e0cbdf89eeb9394e6a473ec3bf99b6e3fc1c111))
* **init:** use correct metadata path for local install deletions ([ab12e9d](https://github.com/mrgoonie/claudekit-cli/commit/ab12e9d6147a980632ce636b25528521b8bda79b)), closes [#376](https://github.com/mrgoonie/claudekit-cli/issues/376)
* **init:** use correct metadata path for local install deletions ([#377](https://github.com/mrgoonie/claudekit-cli/issues/377)) ([c390ef5](https://github.com/mrgoonie/claudekit-cli/commit/c390ef5fb7637eda02cb35b8c1ad8ca425ebcc54)), closes [#376](https://github.com/mrgoonie/claudekit-cli/issues/376)
* **pm:** prioritize bun in package manager detection order ([b93818f](https://github.com/mrgoonie/claudekit-cli/commit/b93818f850bc9e0652d66568b4d03bc390d6f900))
* **registry:** add migration for legacy object format ([494d117](https://github.com/mrgoonie/claudekit-cli/commit/494d117fa402774701395b1f8d2c33b67002df2e))
* remove stale skill entries from --prefix content transformer ([b4e1f04](https://github.com/mrgoonie/claudekit-cli/commit/b4e1f047614126834c72675087352edc5bb875ac))
* restore corrupted agent PNGs and use text=auto in gitattributes ([e092f6b](https://github.com/mrgoonie/claudekit-cli/commit/e092f6b4e95bf2c25e494677a6f8fa3906a48bc8)), closes [#370](https://github.com/mrgoonie/claudekit-cli/issues/370)
* restore corrupted PNG logos and prevent future binary corruption ([df156e2](https://github.com/mrgoonie/claudekit-cli/commit/df156e2f446c91653a25d42af99e81e4d26219a2))
* **router:** redirect root to /config/global instead of project dashboard ([06519b7](https://github.com/mrgoonie/claudekit-cli/commit/06519b7bcec0ee17a58ade31875617a27ff0f7ae))
* **routes:** use base64url encoding for discovered project IDs ([7fb575c](https://github.com/mrgoonie/claudekit-cli/commit/7fb575cd698ea95c97a9266369dd141365f01932))
* **scanner:** extract project paths from jsonl cwd field ([96d99b6](https://github.com/mrgoonie/claudekit-cli/commit/96d99b6b67097d1e2d093a38d41f3f3840b87fb2))
* **security:** add symlink and UNC path protection ([29036aa](https://github.com/mrgoonie/claudekit-cli/commit/29036aae8ba62493c040f8cf64cd58d9022a7b3f))
* **security:** address critical review items from PR [#360](https://github.com/mrgoonie/claudekit-cli/issues/360) ([da595df](https://github.com/mrgoonie/claudekit-cli/commit/da595df3a4e013eb512673b49b59dfdb41bb8bc8))
* **security:** address PR review findings - injection, parsing, i18n ([9633017](https://github.com/mrgoonie/claudekit-cli/commit/96330178a5e187959b04d27ffd026d265175c481))
* **security:** harden web server routes ([ad21b86](https://github.com/mrgoonie/claudekit-cli/commit/ad21b86c74048804c6cb0ce121a0d8dbe17f007f))
* **sessions:** resolve project paths to Claude's dash-encoded format ([1273e17](https://github.com/mrgoonie/claudekit-cli/commit/1273e17ba375eb3ba9af1ee28e877488c6ab5ba0))
* **skills:** resolve UI refresh jarring and skill ID/name mismatch ([eae2e65](https://github.com/mrgoonie/claudekit-cli/commit/eae2e65b5a39f93bea95f3dc7c20bf848054e902))
* **skills:** use cross-platform path separator in skill discovery ([0d1e00c](https://github.com/mrgoonie/claudekit-cli/commit/0d1e00c409afd9da37945037e0069c7b7ba71597))
* **skills:** use directory name as canonical skill ID to prevent duplicates ([19f18ff](https://github.com/mrgoonie/claudekit-cli/commit/19f18ffc3c28c9b6b550551ab33a1484e79aa8d5))
* **ui:** add ErrorBoundary and root element check ([559ad48](https://github.com/mrgoonie/claudekit-cli/commit/559ad484220170d8d9c59332ef75c7a7f6d8e5d3))
* **ui:** correct AGENT_ICON_MAP type signature for lobehub icons ([072188a](https://github.com/mrgoonie/claudekit-cli/commit/072188a7e1275a80800fe7fd0a11ea8efb4327fe))
* **ui:** exclude skills view from project active highlight in sidebar ([ac61875](https://github.com/mrgoonie/claudekit-cli/commit/ac618756c6923fd7358d061cbc7e899d5123bee5))
* **ui:** filter global installation from projects list ([d180a09](https://github.com/mrgoonie/claudekit-cli/commit/d180a09d7acfb940ae9baa83e6e1d79286857808))
* **ui:** fix category filter, normalize skill names, and improve toolbar layout ([0419a99](https://github.com/mrgoonie/claudekit-cli/commit/0419a998f2c31f302fd4c31271fcc441a19620bc))
* **ui:** fix ConfigEditor state and modal event cleanup ([ca689dd](https://github.com/mrgoonie/claudekit-cli/commit/ca689dda04507ce20bf68d8c1152990c3912c950))
* **ui:** fix project selection race condition ([636da63](https://github.com/mrgoonie/claudekit-cli/commit/636da632ca1653b3640926446e21c6b726ffcc3e))
* **ui:** format sidebar isActiveProject condition for biome lint ([b51912c](https://github.com/mrgoonie/claudekit-cli/commit/b51912c44f5a6fea2bacf4491b3cd67e856fde44))
* **ui:** improve back button visibility and preserve project selection ([24ce933](https://github.com/mrgoonie/claudekit-cli/commit/24ce933fd801627956afd7cf09a988560b3d0a45))
* **ui:** improve Global Skills UX and fix sidebar Skills button ([7dc219e](https://github.com/mrgoonie/claudekit-cli/commit/7dc219e28065f4caf9f7ec4d8969c45a2a0395e1))
* **ui:** improve language toggle to show both options ([687bade](https://github.com/mrgoonie/claudekit-cli/commit/687badef5626292b845badf45546d6a287e5f756))
* **ui:** improve sidebar highlight and add marketplace link ([90bb039](https://github.com/mrgoonie/claudekit-cli/commit/90bb03999cead27da670c1aa5339c84396767841))
* **ui:** make Global Skills card scrollable ([5fd3729](https://github.com/mrgoonie/claudekit-cli/commit/5fd37292171584163a650384210b0ea637acc17e))
* **ui:** move back button inline with page title ([f1c7dfe](https://github.com/mrgoonie/claudekit-cli/commit/f1c7dfef4190efa3ec6632e7caa0f3228d94a8b9))
* **ui:** prevent WebSocket reconnection spam ([55865cd](https://github.com/mrgoonie/claudekit-cli/commit/55865cde210eea66084d152d68892ae1688a9bc7))
* **ui:** reduce collapsed sidebar width and tighten layout padding ([244dc38](https://github.com/mrgoonie/claudekit-cli/commit/244dc383754427f493c2fab47539c9623b90687c))
* **ui:** remove unused variables causing CI build failure ([34616af](https://github.com/mrgoonie/claudekit-cli/commit/34616af40ede23bb9f70e95ff66947bd7037a69b)), closes [#374](https://github.com/mrgoonie/claudekit-cli/issues/374)
* **ui:** reorder header navbar elements ([91ef0a7](https://github.com/mrgoonie/claudekit-cli/commit/91ef0a7873a930bff38f085b66945ebe786e8a3b))
* **ui:** resolve actual project path in config page header ([fa39915](https://github.com/mrgoonie/claudekit-cli/commit/fa39915d5755f310e62d0b808179ad4f0e76089f))
* **ui:** strip leading v from version strings to prevent vv duplication ([6153842](https://github.com/mrgoonie/claudekit-cli/commit/6153842ec1bb77865c96e2944acb604d6af6a580))
* **ui:** update GlobalConfigPage default to match engineer kit ([0bcebcf](https://github.com/mrgoonie/claudekit-cli/commit/0bcebcf9887c722aa77ccbfbc9a2a6f70b88e743))
* update Gemini model IDs to match API names (3.0 → 3-preview) ([2e92097](https://github.com/mrgoonie/claudekit-cli/commit/2e920976b7a04b0af95e6c24ec871af61fe22a1e))
* **web-server:** improve static serving and server shutdown ([82fa7cb](https://github.com/mrgoonie/claudekit-cli/commit/82fa7cb8ee4a118f3c048b7c1207cd9539cc1bf2))


### Features

* **api:** add ck-config API routes ([9257104](https://github.com/mrgoonie/claudekit-cli/commit/92571046225aebe8977e536af7e34a846f402965))
* **api:** add skill, session, and settings routes ([73f6349](https://github.com/mrgoonie/claudekit-cli/commit/73f634969d3c11c560ea4f21dc848085883905a9))
* **api:** add SSE endpoint for streaming update progress ([4f96bf5](https://github.com/mrgoonie/claudekit-cli/commit/4f96bf526eca118bab3271c06090631697440ad8))
* **api:** add system health check and update API endpoints ([98b96a2](https://github.com/mrgoonie/claudekit-cli/commit/98b96a2e0afa691cafe402cb33fe1798f3928d67))
* **api:** add version selector with cached versions endpoint ([58aedb4](https://github.com/mrgoonie/claudekit-cli/commit/58aedb466fdfc37279cd57cc6661ffae5548d634))
* **api:** filter skills to CK-owned using metadata.json and improve install resilience ([077872f](https://github.com/mrgoonie/claudekit-cli/commit/077872f8532deda751438b2abc4d32b061f6c90d))
* **api:** wire skills install/uninstall endpoints to actual logic ([5e25245](https://github.com/mrgoonie/claudekit-cli/commit/5e25245fa07c0ffb6a62151be2412210f5a7f43b))
* **claude-data:** integrate history.jsonl and user preferences for dashboard ([a31fccf](https://github.com/mrgoonie/claudekit-cli/commit/a31fccfbee22c38b0966a128856be065674ba018))
* **cli:** add auto-registration on ck init ([c4a0a1f](https://github.com/mrgoonie/claudekit-cli/commit/c4a0a1f842806e1036fae119dec452db6268bde4))
* **cli:** add projects management commands ([b8fb782](https://github.com/mrgoonie/claudekit-cli/commit/b8fb7821d71e229c6248f5a48da9032bfc5cf6fb))
* **config-ui:** add cross-platform actions endpoint ([4b44355](https://github.com/mrgoonie/claudekit-cli/commit/4b44355d5b1a812f646a3e4cd2636ae469c290de))
* **config-ui:** add parent object docs for config help panel ([41536b6](https://github.com/mrgoonie/claudekit-cli/commit/41536b62729e061e25a8518c7978509a566b1206))
* **config-ui:** add resizable 3-column panels and SchemaForm to project config ([6504167](https://github.com/mrgoonie/claudekit-cli/commit/6504167c358963d6ee21ab4e5ac92d4b3269c13f))
* **config-ui:** add resizable panel infrastructure ([a197795](https://github.com/mrgoonie/claudekit-cli/commit/a19779594c4e3d0d376ee489748d9b8a368e92d5))
* **config-ui:** add resizable sidebar ([9c5c986](https://github.com/mrgoonie/claudekit-cli/commit/9c5c98687269984a9901d4796c7c139ec9e27acb))
* **config-ui:** add save/reset functionality and fix editor scroll ([c2006de](https://github.com/mrgoonie/claudekit-cli/commit/c2006de98fb353eef6bd8d84e4a4005b1ef92679))
* **config-ui:** merge header controls into project dashboard ([a33edaf](https://github.com/mrgoonie/claudekit-cli/commit/a33edafa143083ed8f57aa0ab2145171cfe42ca8))
* **config-ui:** merge Kit Config into Config Editor as 3-column layout ([fad2fb0](https://github.com/mrgoonie/claudekit-cli/commit/fad2fb025663efe3e07db4b5761cde93328251d8))
* **config-ui:** redesign sidebar footer with unified controls ([82cb538](https://github.com/mrgoonie/claudekit-cli/commit/82cb53880b4b1afe286bafaf9d1ae6f2701a4760))
* **config-ui:** replace mock data with real API endpoints ([8d59c97](https://github.com/mrgoonie/claudekit-cli/commit/8d59c97e6bc2121daf71e3c8ba64f1be85931a5d))
* **config-ui:** scrollable sessions with inline expand ([74b0146](https://github.com/mrgoonie/claudekit-cli/commit/74b0146f027d3fc6b4ca184514b16fd436563bb7))
* **config-ui:** wire quick action buttons on dashboard ([4de82e2](https://github.com/mrgoonie/claudekit-cli/commit/4de82e2a804c391e4d6e7c931e1a304651c3dedc))
* **config:** add .ck.json schema and TypeScript types ([9261729](https://github.com/mrgoonie/claudekit-cli/commit/9261729f087bee3fca1832379fd6e5799b840ace))
* **config:** add ck config command for configuration management ([91faba9](https://github.com/mrgoonie/claudekit-cli/commit/91faba901b66889ac650fcbed6c2f2e2d27e7de3))
* **config:** add CkConfigManager for full .ck.json support ([9c4fdb6](https://github.com/mrgoonie/claudekit-cli/commit/9c4fdb6685702d67693f480a999825bb21abee66))
* **config:** add context-tracking hook toggle to config editor ([b03d7b7](https://github.com/mrgoonie/claudekit-cli/commit/b03d7b71211b8b2acb38b5ab5b23ea6b7b5e4c62))
* **config:** add descriptive-name hook toggle to config editor ([b564d3b](https://github.com/mrgoonie/claudekit-cli/commit/b564d3bcc7697f7769fecee4b84b8a8dfe409166)), closes [#372](https://github.com/mrgoonie/claudekit-cli/issues/372)
* **i18n:** add EN/VI translations for enhanced system dashboard ([719bbae](https://github.com/mrgoonie/claudekit-cli/commit/719bbae8a4119c2ddc1540780652fa21c41bc95c))
* **projects:** auto-register and Claude CLI discovery ([eb8aa45](https://github.com/mrgoonie/claudekit-cli/commit/eb8aa4597c699b8cd32058519104f78224de2f6f))
* **registry:** add projects registry with file locking ([4902c1f](https://github.com/mrgoonie/claudekit-cli/commit/4902c1f9e9d81606f05d7a11c20be4b57311df22))
* **services:** add claude-data service for reading Claude metadata ([a43c51a](https://github.com/mrgoonie/claudekit-cli/commit/a43c51a984ae0e98a6d44b9d8951e14f96aaf384))
* **skills:** show source badge and hide install button for source agent ([249a06f](https://github.com/mrgoonie/claudekit-cli/commit/249a06f513d626100c5ded419f8ed456b6e14fda))
* **types:** add skipped fields to InstallResult for skills ([7218b30](https://github.com/mrgoonie/claudekit-cli/commit/7218b30d55cc859f765d87691d7b024be95e68da))
* **ui:** add agent brand icons using @lobehub/icons ([73ee619](https://github.com/mrgoonie/claudekit-cli/commit/73ee6194ab205b5e7fb8d1e3ae85fcc3f3839851))
* **ui:** add batch operations for Check All and Update All ([468fe7a](https://github.com/mrgoonie/claudekit-cli/commit/468fe7acf21958574ace52237fe69faf06940107))
* **ui:** add branding assets and favicon ([b081510](https://github.com/mrgoonie/claudekit-cli/commit/b0815105e59d1fb844f9e6544e7dab4c7591b50b))
* **ui:** add CLI and environment cards for system dashboard ([0914bd9](https://github.com/mrgoonie/claudekit-cli/commit/0914bd9b42b681ca9ff920f6bee23c7f6d187b1e))
* **ui:** add CodeMirror JSON editor with custom theme ([a1a0e2d](https://github.com/mrgoonie/claudekit-cli/commit/a1a0e2d10c6865012f468c9942712744570978dd))
* **ui:** add favicon icons for remaining agents and standardize on Avatar variant ([a57bb85](https://github.com/mrgoonie/claudekit-cli/commit/a57bb85b5a46a69f144096e9a6073ffd99407c95))
* **ui:** add global config route and fix routing issues ([a198375](https://github.com/mrgoonie/claudekit-cli/commit/a1983756636031c6357bf3f023fea586ee56a56f))
* **ui:** add hooks for skills, sessions, and settings ([f2109d9](https://github.com/mrgoonie/claudekit-cli/commit/f2109d9c44dc8f4850b2c0320f6bd3a5aaa1025f))
* **ui:** add Kit Config page with section layout ([ea6b652](https://github.com/mrgoonie/claudekit-cli/commit/ea6b6526c685fd04f19eb495e14ad5e1ebb534da))
* **ui:** add mock data fallback for dev mode ([2e1f793](https://github.com/mrgoonie/claudekit-cli/commit/2e1f7930ca9d52f5b499109ed408857af935fc4e))
* **ui:** add mockup design system and field documentation ([4bff301](https://github.com/mrgoonie/claudekit-cli/commit/4bff30173d087772112ffb50981c77dc20a9f135))
* **ui:** add React dashboard for config management ([cf6f3ad](https://github.com/mrgoonie/claudekit-cli/commit/cf6f3adc2466a84def3270ddf66c1645274cd27e))
* **ui:** add react-router for config editor route ([50a21c4](https://github.com/mrgoonie/claudekit-cli/commit/50a21c4e832e781adf6cdffee915be0e22688d9a))
* **ui:** add schema-driven form components ([1fc5379](https://github.com/mrgoonie/claudekit-cli/commit/1fc5379456909daa20ecece4aa003c5209076a5a))
* **ui:** add Settings section to sidebar above Projects ([df478aa](https://github.com/mrgoonie/claudekit-cli/commit/df478aa922c94aa645563be8e7d053797d03258d))
* **ui:** add Stable/Beta channel toggle with persistence ([91cb8f8](https://github.com/mrgoonie/claudekit-cli/commit/91cb8f89bd2e3fd45610363c95113ab2f0bc6cbc))
* **ui:** add status dots and version diff to system cards ([9c61742](https://github.com/mrgoonie/claudekit-cli/commit/9c6174229ea18b5c551ced13bae5be9e8012b16f))
* **ui:** add Update Now button with SSE progress modal ([44dd0db](https://github.com/mrgoonie/claudekit-cli/commit/44dd0dbb3ec580fc4ea69b89318b96b835c8abcf))
* **ui:** add user onboarding flow with comprehensive test suite ([941f8f2](https://github.com/mrgoonie/claudekit-cli/commit/941f8f2a0da387a1e1f979e928d62e6ae6be4da5))
* **ui:** add Vietnamese i18n localization support ([826ff1c](https://github.com/mrgoonie/claudekit-cli/commit/826ff1c4f57d3f0da2d30cde1ef50c35a1748f20))
* **ui:** add Vietnamese translations for config field docs ([20ccff1](https://github.com/mrgoonie/claudekit-cli/commit/20ccff184b850286d8b4b5056989edbcf39beb53))
* **ui:** enhance metadata tab with ownership, inventory, hooks, freshness, and customization ([6be2514](https://github.com/mrgoonie/claudekit-cli/commit/6be2514f8db52f487595dea3c1b77253863d4572))
* **ui:** enrich skills dashboard with metadata.json intelligence ([0c60113](https://github.com/mrgoonie/claudekit-cli/commit/0c6011361ef3bd9cca0c22dd44e08c2781c72efe))
* **ui:** integrate hooks into dashboard components ([c289a13](https://github.com/mrgoonie/claudekit-cli/commit/c289a131c15132fc6c3f80d0607a5358996e7230))
* **ui:** move controls to sidebar footer ([8fd3b41](https://github.com/mrgoonie/claudekit-cli/commit/8fd3b417a57a6c504470b919f3bd6d6fcfaaca9b))
* **ui:** redesign dashboard with mockup components ([5885334](https://github.com/mrgoonie/claudekit-cli/commit/5885334e18cbe8deaa3facae4cf2b2ebf8b8963d))
* **ui:** redesign skills dashboard with list view, search, and detail panel ([a54e112](https://github.com/mrgoonie/claudekit-cli/commit/a54e112f91f4e9e2d0b848986bbf2f304e3e80a5))
* **ui:** rename Metadata tab to System with i18n support ([8c44ade](https://github.com/mrgoonie/claudekit-cli/commit/8c44ade0a8b3cb69891730cc38d5fe446eee5c0c))
* **ui:** streamline sidebar and add core mission docs ([85c19f9](https://github.com/mrgoonie/claudekit-cli/commit/85c19f9225df1f425dfbb7066b9c34853c438ee6))
* **web-server:** add Express server with WebSocket for config UI ([841514c](https://github.com/mrgoonie/claudekit-cli/commit/841514cfe3c3ff8cfff6d6212835a96a2ceac321))

# [3.33.0-dev.13](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0-dev.12...v3.33.0-dev.13) (2026-02-04)


### Bug Fixes

* **init:** use correct metadata path for local install deletions ([ab12e9d](https://github.com/mrgoonie/claudekit-cli/commit/ab12e9d6147a980632ce636b25528521b8bda79b)), closes [#376](https://github.com/mrgoonie/claudekit-cli/issues/376)
* **init:** use correct metadata path for local install deletions ([#377](https://github.com/mrgoonie/claudekit-cli/issues/377)) ([c390ef5](https://github.com/mrgoonie/claudekit-cli/commit/c390ef5fb7637eda02cb35b8c1ad8ca425ebcc54)), closes [#376](https://github.com/mrgoonie/claudekit-cli/issues/376)

# [3.33.0-dev.12](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0-dev.11...v3.33.0-dev.12) (2026-02-03)


### Bug Fixes

* **ui:** remove unused variables causing CI build failure ([34616af](https://github.com/mrgoonie/claudekit-cli/commit/34616af40ede23bb9f70e95ff66947bd7037a69b)), closes [#374](https://github.com/mrgoonie/claudekit-cli/issues/374)

# [3.33.0-dev.11](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0-dev.10...v3.33.0-dev.11) (2026-02-03)


### Features

* **config:** add context-tracking hook toggle to config editor ([b03d7b7](https://github.com/mrgoonie/claudekit-cli/commit/b03d7b71211b8b2acb38b5ab5b23ea6b7b5e4c62))
* **config:** add descriptive-name hook toggle to config editor ([b564d3b](https://github.com/mrgoonie/claudekit-cli/commit/b564d3bcc7697f7769fecee4b84b8a8dfe409166)), closes [#372](https://github.com/mrgoonie/claudekit-cli/issues/372)

# [3.33.0-dev.10](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0-dev.9...v3.33.0-dev.10) (2026-02-02)


### Bug Fixes

* **ui:** exclude skills view from project active highlight in sidebar ([ac61875](https://github.com/mrgoonie/claudekit-cli/commit/ac618756c6923fd7358d061cbc7e899d5123bee5))
* **ui:** format sidebar isActiveProject condition for biome lint ([b51912c](https://github.com/mrgoonie/claudekit-cli/commit/b51912c44f5a6fea2bacf4491b3cd67e856fde44))

# [3.33.0-dev.9](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0-dev.8...v3.33.0-dev.9) (2026-02-02)


### Bug Fixes

* restore corrupted agent PNGs and use text=auto in gitattributes ([e092f6b](https://github.com/mrgoonie/claudekit-cli/commit/e092f6b4e95bf2c25e494677a6f8fa3906a48bc8)), closes [#370](https://github.com/mrgoonie/claudekit-cli/issues/370)

# [3.33.0-dev.8](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0-dev.7...v3.33.0-dev.8) (2026-02-02)


### Bug Fixes

* restore corrupted PNG logos and prevent future binary corruption ([df156e2](https://github.com/mrgoonie/claudekit-cli/commit/df156e2f446c91653a25d42af99e81e4d26219a2))

# [3.33.0-dev.7](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0-dev.6...v3.33.0-dev.7) (2026-02-02)


### Bug Fixes

* **dashboard:** allow dotfiles in static serving for global installs ([f7123cf](https://github.com/mrgoonie/claudekit-cli/commit/f7123cffcb2cc8c4e8bc473520a979b15915ae63))

# [3.33.0-dev.6](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0-dev.5...v3.33.0-dev.6) (2026-02-02)


### Bug Fixes

* remove stale skill entries from --prefix content transformer ([b4e1f04](https://github.com/mrgoonie/claudekit-cli/commit/b4e1f047614126834c72675087352edc5bb875ac))

# [3.33.0-dev.5](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0-dev.4...v3.33.0-dev.5) (2026-02-02)


### Bug Fixes

* **dashboard:** correct UI dist path resolution for global install ([c1db65d](https://github.com/mrgoonie/claudekit-cli/commit/c1db65d26cbb1e76460789b1b000e057b0a4d9be)), closes [#365](https://github.com/mrgoonie/claudekit-cli/issues/365)

# [3.33.0-dev.4](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0-dev.3...v3.33.0-dev.4) (2026-02-02)


### Bug Fixes

* bundle dashboard UI in npm package + add ui:build script ([dd00178](https://github.com/mrgoonie/claudekit-cli/commit/dd00178bcca393fc60dc391ae7d120a1482a4b18)), closes [#363](https://github.com/mrgoonie/claudekit-cli/issues/363)

# [3.33.0-dev.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0-dev.2...v3.33.0-dev.3) (2026-02-02)


### Bug Fixes

* **config:** address code review edge cases + add tests ([a408480](https://github.com/mrgoonie/claudekit-cli/commit/a4084804f96a4857e63b508e58be7710b55c9d5d)), closes [#362](https://github.com/mrgoonie/claudekit-cli/issues/362)
* **config:** ck config launches dashboard, fix legacy ConfigManager ([ba1283b](https://github.com/mrgoonie/claudekit-cli/commit/ba1283be9f349e1bf6a975545ed761df4440a416)), closes [#361](https://github.com/mrgoonie/claudekit-cli/issues/361)

# [3.33.0-dev.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.33.0-dev.1...v3.33.0-dev.2) (2026-02-01)


### Bug Fixes

* **api:** expand tilde in project path and allow projects without .claude dir ([9bbf312](https://github.com/mrgoonie/claudekit-cli/commit/9bbf312211a9eeeae5512834dbe7f7830d960672))
* **api:** use buildInitCommand for kit updates with proper flags ([6d60b7a](https://github.com/mrgoonie/claudekit-cli/commit/6d60b7a3b6d4433f8f66d932c5daf9fa37b6bd35))
* **api:** use PackageManagerDetector for update command ([b7d3706](https://github.com/mrgoonie/claudekit-cli/commit/b7d370630511ccb4bea62c1fb6e7dd513e730ea2))
* **ci:** resolve all CI failures across Linux and Windows ([3aa681c](https://github.com/mrgoonie/claudekit-cli/commit/3aa681ccf6ad052ed1f38b7024fef0ac2f0d1be6))
* **cli:** add SIGINT handlers and download timeouts ([dcd33a4](https://github.com/mrgoonie/claudekit-cli/commit/dcd33a475e1a7674cba13932cedfc1a787039c0f))
* **cli:** improve error recovery and version validation ([d7f3ec4](https://github.com/mrgoonie/claudekit-cli/commit/d7f3ec4011bef093da9e7d897f5ef92700a12bcb))
* **config-api:** save engineer kit config to correct path ([aaa077c](https://github.com/mrgoonie/claudekit-cli/commit/aaa077c67cf0d0b9d0ae093cc6046b28ceb442b1))
* **config-ui:** enable Vite HMR in dashboard dev mode ([8afbb13](https://github.com/mrgoonie/claudekit-cli/commit/8afbb133c24842a85e2be2e2c5066aa6bed674a0))
* **config-ui:** fix Tailwind content scanning in middleware mode ([24f3b5f](https://github.com/mrgoonie/claudekit-cli/commit/24f3b5f5daf984f973228374cca8978465009292))
* **config-ui:** flex-based viewport fill for dashboard layout ([a86c74b](https://github.com/mrgoonie/claudekit-cli/commit/a86c74bcb8999225de8ccbeb4caaae73621ecceb))
* **config-ui:** make collapse button work with resizable sidebar ([be88b68](https://github.com/mrgoonie/claudekit-cli/commit/be88b68d0750937fb378b8df2dd311cf0ffda5fd))
* **config-ui:** remove duplicate sidebar Skills and fix i18n ([dff2d3a](https://github.com/mrgoonie/claudekit-cli/commit/dff2d3af452e44b494d8160b1cca24ee143579b6))
* **config-ui:** resolve Tailwind CSS in Vite middleware mode ([72ecff0](https://github.com/mrgoonie/claudekit-cli/commit/72ecff01fdcc52bbe5f67cab0c33c2d3321e0664))
* **dx:** add --watch to dashboard:dev for backend auto-restart ([35afdcf](https://github.com/mrgoonie/claudekit-cli/commit/35afdcf700c6205388c71bce65557ff0755ccbb1))
* **dx:** skip browser open on server restart during watch mode ([3b8f71e](https://github.com/mrgoonie/claudekit-cli/commit/3b8f71ea6bec7439dbea7952923a3db06bb2f284))
* extend codingLevel max from 3 to 5 to match engineer kit ([8e0cbdf](https://github.com/mrgoonie/claudekit-cli/commit/8e0cbdf89eeb9394e6a473ec3bf99b6e3fc1c111))
* **pm:** prioritize bun in package manager detection order ([b93818f](https://github.com/mrgoonie/claudekit-cli/commit/b93818f850bc9e0652d66568b4d03bc390d6f900))
* **registry:** add migration for legacy object format ([494d117](https://github.com/mrgoonie/claudekit-cli/commit/494d117fa402774701395b1f8d2c33b67002df2e))
* **router:** redirect root to /config/global instead of project dashboard ([06519b7](https://github.com/mrgoonie/claudekit-cli/commit/06519b7bcec0ee17a58ade31875617a27ff0f7ae))
* **routes:** use base64url encoding for discovered project IDs ([7fb575c](https://github.com/mrgoonie/claudekit-cli/commit/7fb575cd698ea95c97a9266369dd141365f01932))
* **scanner:** extract project paths from jsonl cwd field ([96d99b6](https://github.com/mrgoonie/claudekit-cli/commit/96d99b6b67097d1e2d093a38d41f3f3840b87fb2))
* **security:** add symlink and UNC path protection ([29036aa](https://github.com/mrgoonie/claudekit-cli/commit/29036aae8ba62493c040f8cf64cd58d9022a7b3f))
* **security:** address critical review items from PR [#360](https://github.com/mrgoonie/claudekit-cli/issues/360) ([da595df](https://github.com/mrgoonie/claudekit-cli/commit/da595df3a4e013eb512673b49b59dfdb41bb8bc8))
* **security:** address PR review findings - injection, parsing, i18n ([9633017](https://github.com/mrgoonie/claudekit-cli/commit/96330178a5e187959b04d27ffd026d265175c481))
* **security:** harden web server routes ([ad21b86](https://github.com/mrgoonie/claudekit-cli/commit/ad21b86c74048804c6cb0ce121a0d8dbe17f007f))
* **sessions:** resolve project paths to Claude's dash-encoded format ([1273e17](https://github.com/mrgoonie/claudekit-cli/commit/1273e17ba375eb3ba9af1ee28e877488c6ab5ba0))
* **skills:** resolve UI refresh jarring and skill ID/name mismatch ([eae2e65](https://github.com/mrgoonie/claudekit-cli/commit/eae2e65b5a39f93bea95f3dc7c20bf848054e902))
* **skills:** use cross-platform path separator in skill discovery ([0d1e00c](https://github.com/mrgoonie/claudekit-cli/commit/0d1e00c409afd9da37945037e0069c7b7ba71597))
* **skills:** use directory name as canonical skill ID to prevent duplicates ([19f18ff](https://github.com/mrgoonie/claudekit-cli/commit/19f18ffc3c28c9b6b550551ab33a1484e79aa8d5))
* **ui:** add ErrorBoundary and root element check ([559ad48](https://github.com/mrgoonie/claudekit-cli/commit/559ad484220170d8d9c59332ef75c7a7f6d8e5d3))
* **ui:** correct AGENT_ICON_MAP type signature for lobehub icons ([072188a](https://github.com/mrgoonie/claudekit-cli/commit/072188a7e1275a80800fe7fd0a11ea8efb4327fe))
* **ui:** filter global installation from projects list ([d180a09](https://github.com/mrgoonie/claudekit-cli/commit/d180a09d7acfb940ae9baa83e6e1d79286857808))
* **ui:** fix category filter, normalize skill names, and improve toolbar layout ([0419a99](https://github.com/mrgoonie/claudekit-cli/commit/0419a998f2c31f302fd4c31271fcc441a19620bc))
* **ui:** fix ConfigEditor state and modal event cleanup ([ca689dd](https://github.com/mrgoonie/claudekit-cli/commit/ca689dda04507ce20bf68d8c1152990c3912c950))
* **ui:** fix project selection race condition ([636da63](https://github.com/mrgoonie/claudekit-cli/commit/636da632ca1653b3640926446e21c6b726ffcc3e))
* **ui:** improve back button visibility and preserve project selection ([24ce933](https://github.com/mrgoonie/claudekit-cli/commit/24ce933fd801627956afd7cf09a988560b3d0a45))
* **ui:** improve Global Skills UX and fix sidebar Skills button ([7dc219e](https://github.com/mrgoonie/claudekit-cli/commit/7dc219e28065f4caf9f7ec4d8969c45a2a0395e1))
* **ui:** improve language toggle to show both options ([687bade](https://github.com/mrgoonie/claudekit-cli/commit/687badef5626292b845badf45546d6a287e5f756))
* **ui:** improve sidebar highlight and add marketplace link ([90bb039](https://github.com/mrgoonie/claudekit-cli/commit/90bb03999cead27da670c1aa5339c84396767841))
* **ui:** make Global Skills card scrollable ([5fd3729](https://github.com/mrgoonie/claudekit-cli/commit/5fd37292171584163a650384210b0ea637acc17e))
* **ui:** move back button inline with page title ([f1c7dfe](https://github.com/mrgoonie/claudekit-cli/commit/f1c7dfef4190efa3ec6632e7caa0f3228d94a8b9))
* **ui:** prevent WebSocket reconnection spam ([55865cd](https://github.com/mrgoonie/claudekit-cli/commit/55865cde210eea66084d152d68892ae1688a9bc7))
* **ui:** reduce collapsed sidebar width and tighten layout padding ([244dc38](https://github.com/mrgoonie/claudekit-cli/commit/244dc383754427f493c2fab47539c9623b90687c))
* **ui:** reorder header navbar elements ([91ef0a7](https://github.com/mrgoonie/claudekit-cli/commit/91ef0a7873a930bff38f085b66945ebe786e8a3b))
* **ui:** resolve actual project path in config page header ([fa39915](https://github.com/mrgoonie/claudekit-cli/commit/fa39915d5755f310e62d0b808179ad4f0e76089f))
* **ui:** strip leading v from version strings to prevent vv duplication ([6153842](https://github.com/mrgoonie/claudekit-cli/commit/6153842ec1bb77865c96e2944acb604d6af6a580))
* **ui:** update GlobalConfigPage default to match engineer kit ([0bcebcf](https://github.com/mrgoonie/claudekit-cli/commit/0bcebcf9887c722aa77ccbfbc9a2a6f70b88e743))
* update Gemini model IDs to match API names (3.0 → 3-preview) ([2e92097](https://github.com/mrgoonie/claudekit-cli/commit/2e920976b7a04b0af95e6c24ec871af61fe22a1e))
* **web-server:** improve static serving and server shutdown ([82fa7cb](https://github.com/mrgoonie/claudekit-cli/commit/82fa7cb8ee4a118f3c048b7c1207cd9539cc1bf2))


### Features

* **api:** add ck-config API routes ([9257104](https://github.com/mrgoonie/claudekit-cli/commit/92571046225aebe8977e536af7e34a846f402965))
* **api:** add skill, session, and settings routes ([73f6349](https://github.com/mrgoonie/claudekit-cli/commit/73f634969d3c11c560ea4f21dc848085883905a9))
* **api:** add SSE endpoint for streaming update progress ([4f96bf5](https://github.com/mrgoonie/claudekit-cli/commit/4f96bf526eca118bab3271c06090631697440ad8))
* **api:** add system health check and update API endpoints ([98b96a2](https://github.com/mrgoonie/claudekit-cli/commit/98b96a2e0afa691cafe402cb33fe1798f3928d67))
* **api:** add version selector with cached versions endpoint ([58aedb4](https://github.com/mrgoonie/claudekit-cli/commit/58aedb466fdfc37279cd57cc6661ffae5548d634))
* **api:** filter skills to CK-owned using metadata.json and improve install resilience ([077872f](https://github.com/mrgoonie/claudekit-cli/commit/077872f8532deda751438b2abc4d32b061f6c90d))
* **api:** wire skills install/uninstall endpoints to actual logic ([5e25245](https://github.com/mrgoonie/claudekit-cli/commit/5e25245fa07c0ffb6a62151be2412210f5a7f43b))
* **claude-data:** integrate history.jsonl and user preferences for dashboard ([a31fccf](https://github.com/mrgoonie/claudekit-cli/commit/a31fccfbee22c38b0966a128856be065674ba018))
* **cli:** add auto-registration on ck init ([c4a0a1f](https://github.com/mrgoonie/claudekit-cli/commit/c4a0a1f842806e1036fae119dec452db6268bde4))
* **cli:** add projects management commands ([b8fb782](https://github.com/mrgoonie/claudekit-cli/commit/b8fb7821d71e229c6248f5a48da9032bfc5cf6fb))
* **config-ui:** add cross-platform actions endpoint ([4b44355](https://github.com/mrgoonie/claudekit-cli/commit/4b44355d5b1a812f646a3e4cd2636ae469c290de))
* **config-ui:** add parent object docs for config help panel ([41536b6](https://github.com/mrgoonie/claudekit-cli/commit/41536b62729e061e25a8518c7978509a566b1206))
* **config-ui:** add resizable 3-column panels and SchemaForm to project config ([6504167](https://github.com/mrgoonie/claudekit-cli/commit/6504167c358963d6ee21ab4e5ac92d4b3269c13f))
* **config-ui:** add resizable panel infrastructure ([a197795](https://github.com/mrgoonie/claudekit-cli/commit/a19779594c4e3d0d376ee489748d9b8a368e92d5))
* **config-ui:** add resizable sidebar ([9c5c986](https://github.com/mrgoonie/claudekit-cli/commit/9c5c98687269984a9901d4796c7c139ec9e27acb))
* **config-ui:** add save/reset functionality and fix editor scroll ([c2006de](https://github.com/mrgoonie/claudekit-cli/commit/c2006de98fb353eef6bd8d84e4a4005b1ef92679))
* **config-ui:** merge header controls into project dashboard ([a33edaf](https://github.com/mrgoonie/claudekit-cli/commit/a33edafa143083ed8f57aa0ab2145171cfe42ca8))
* **config-ui:** merge Kit Config into Config Editor as 3-column layout ([fad2fb0](https://github.com/mrgoonie/claudekit-cli/commit/fad2fb025663efe3e07db4b5761cde93328251d8))
* **config-ui:** redesign sidebar footer with unified controls ([82cb538](https://github.com/mrgoonie/claudekit-cli/commit/82cb53880b4b1afe286bafaf9d1ae6f2701a4760))
* **config-ui:** replace mock data with real API endpoints ([8d59c97](https://github.com/mrgoonie/claudekit-cli/commit/8d59c97e6bc2121daf71e3c8ba64f1be85931a5d))
* **config-ui:** scrollable sessions with inline expand ([74b0146](https://github.com/mrgoonie/claudekit-cli/commit/74b0146f027d3fc6b4ca184514b16fd436563bb7))
* **config-ui:** wire quick action buttons on dashboard ([4de82e2](https://github.com/mrgoonie/claudekit-cli/commit/4de82e2a804c391e4d6e7c931e1a304651c3dedc))
* **config:** add .ck.json schema and TypeScript types ([9261729](https://github.com/mrgoonie/claudekit-cli/commit/9261729f087bee3fca1832379fd6e5799b840ace))
* **config:** add ck config command for configuration management ([91faba9](https://github.com/mrgoonie/claudekit-cli/commit/91faba901b66889ac650fcbed6c2f2e2d27e7de3))
* **config:** add CkConfigManager for full .ck.json support ([9c4fdb6](https://github.com/mrgoonie/claudekit-cli/commit/9c4fdb6685702d67693f480a999825bb21abee66))
* **i18n:** add EN/VI translations for enhanced system dashboard ([719bbae](https://github.com/mrgoonie/claudekit-cli/commit/719bbae8a4119c2ddc1540780652fa21c41bc95c))
* **projects:** auto-register and Claude CLI discovery ([eb8aa45](https://github.com/mrgoonie/claudekit-cli/commit/eb8aa4597c699b8cd32058519104f78224de2f6f))
* **registry:** add projects registry with file locking ([4902c1f](https://github.com/mrgoonie/claudekit-cli/commit/4902c1f9e9d81606f05d7a11c20be4b57311df22))
* **services:** add claude-data service for reading Claude metadata ([a43c51a](https://github.com/mrgoonie/claudekit-cli/commit/a43c51a984ae0e98a6d44b9d8951e14f96aaf384))
* **skills:** show source badge and hide install button for source agent ([249a06f](https://github.com/mrgoonie/claudekit-cli/commit/249a06f513d626100c5ded419f8ed456b6e14fda))
* **types:** add skipped fields to InstallResult for skills ([7218b30](https://github.com/mrgoonie/claudekit-cli/commit/7218b30d55cc859f765d87691d7b024be95e68da))
* **ui:** add agent brand icons using @lobehub/icons ([73ee619](https://github.com/mrgoonie/claudekit-cli/commit/73ee6194ab205b5e7fb8d1e3ae85fcc3f3839851))
* **ui:** add batch operations for Check All and Update All ([468fe7a](https://github.com/mrgoonie/claudekit-cli/commit/468fe7acf21958574ace52237fe69faf06940107))
* **ui:** add branding assets and favicon ([b081510](https://github.com/mrgoonie/claudekit-cli/commit/b0815105e59d1fb844f9e6544e7dab4c7591b50b))
* **ui:** add CLI and environment cards for system dashboard ([0914bd9](https://github.com/mrgoonie/claudekit-cli/commit/0914bd9b42b681ca9ff920f6bee23c7f6d187b1e))
* **ui:** add CodeMirror JSON editor with custom theme ([a1a0e2d](https://github.com/mrgoonie/claudekit-cli/commit/a1a0e2d10c6865012f468c9942712744570978dd))
* **ui:** add favicon icons for remaining agents and standardize on Avatar variant ([a57bb85](https://github.com/mrgoonie/claudekit-cli/commit/a57bb85b5a46a69f144096e9a6073ffd99407c95))
* **ui:** add global config route and fix routing issues ([a198375](https://github.com/mrgoonie/claudekit-cli/commit/a1983756636031c6357bf3f023fea586ee56a56f))
* **ui:** add hooks for skills, sessions, and settings ([f2109d9](https://github.com/mrgoonie/claudekit-cli/commit/f2109d9c44dc8f4850b2c0320f6bd3a5aaa1025f))
* **ui:** add Kit Config page with section layout ([ea6b652](https://github.com/mrgoonie/claudekit-cli/commit/ea6b6526c685fd04f19eb495e14ad5e1ebb534da))
* **ui:** add mock data fallback for dev mode ([2e1f793](https://github.com/mrgoonie/claudekit-cli/commit/2e1f7930ca9d52f5b499109ed408857af935fc4e))
* **ui:** add mockup design system and field documentation ([4bff301](https://github.com/mrgoonie/claudekit-cli/commit/4bff30173d087772112ffb50981c77dc20a9f135))
* **ui:** add React dashboard for config management ([cf6f3ad](https://github.com/mrgoonie/claudekit-cli/commit/cf6f3adc2466a84def3270ddf66c1645274cd27e))
* **ui:** add react-router for config editor route ([50a21c4](https://github.com/mrgoonie/claudekit-cli/commit/50a21c4e832e781adf6cdffee915be0e22688d9a))
* **ui:** add schema-driven form components ([1fc5379](https://github.com/mrgoonie/claudekit-cli/commit/1fc5379456909daa20ecece4aa003c5209076a5a))
* **ui:** add Settings section to sidebar above Projects ([df478aa](https://github.com/mrgoonie/claudekit-cli/commit/df478aa922c94aa645563be8e7d053797d03258d))
* **ui:** add Stable/Beta channel toggle with persistence ([91cb8f8](https://github.com/mrgoonie/claudekit-cli/commit/91cb8f89bd2e3fd45610363c95113ab2f0bc6cbc))
* **ui:** add status dots and version diff to system cards ([9c61742](https://github.com/mrgoonie/claudekit-cli/commit/9c6174229ea18b5c551ced13bae5be9e8012b16f))
* **ui:** add Update Now button with SSE progress modal ([44dd0db](https://github.com/mrgoonie/claudekit-cli/commit/44dd0dbb3ec580fc4ea69b89318b96b835c8abcf))
* **ui:** add user onboarding flow with comprehensive test suite ([941f8f2](https://github.com/mrgoonie/claudekit-cli/commit/941f8f2a0da387a1e1f979e928d62e6ae6be4da5))
* **ui:** add Vietnamese i18n localization support ([826ff1c](https://github.com/mrgoonie/claudekit-cli/commit/826ff1c4f57d3f0da2d30cde1ef50c35a1748f20))
* **ui:** add Vietnamese translations for config field docs ([20ccff1](https://github.com/mrgoonie/claudekit-cli/commit/20ccff184b850286d8b4b5056989edbcf39beb53))
* **ui:** enhance metadata tab with ownership, inventory, hooks, freshness, and customization ([6be2514](https://github.com/mrgoonie/claudekit-cli/commit/6be2514f8db52f487595dea3c1b77253863d4572))
* **ui:** enrich skills dashboard with metadata.json intelligence ([0c60113](https://github.com/mrgoonie/claudekit-cli/commit/0c6011361ef3bd9cca0c22dd44e08c2781c72efe))
* **ui:** integrate hooks into dashboard components ([c289a13](https://github.com/mrgoonie/claudekit-cli/commit/c289a131c15132fc6c3f80d0607a5358996e7230))
* **ui:** move controls to sidebar footer ([8fd3b41](https://github.com/mrgoonie/claudekit-cli/commit/8fd3b417a57a6c504470b919f3bd6d6fcfaaca9b))
* **ui:** redesign dashboard with mockup components ([5885334](https://github.com/mrgoonie/claudekit-cli/commit/5885334e18cbe8deaa3facae4cf2b2ebf8b8963d))
* **ui:** redesign skills dashboard with list view, search, and detail panel ([a54e112](https://github.com/mrgoonie/claudekit-cli/commit/a54e112f91f4e9e2d0b848986bbf2f304e3e80a5))
* **ui:** rename Metadata tab to System with i18n support ([8c44ade](https://github.com/mrgoonie/claudekit-cli/commit/8c44ade0a8b3cb69891730cc38d5fe446eee5c0c))
* **ui:** streamline sidebar and add core mission docs ([85c19f9](https://github.com/mrgoonie/claudekit-cli/commit/85c19f9225df1f425dfbb7066b9c34853c438ee6))
* **web-server:** add Express server with WebSocket for config UI ([841514c](https://github.com/mrgoonie/claudekit-cli/commit/841514cfe3c3ff8cfff6d6212835a96a2ceac321))

# [3.33.0-dev.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.32.3-dev.1...v3.33.0-dev.1) (2026-02-01)


### Features

* **skills:** skip redundant self-installation when source equals target ([b5de76b](https://github.com/mrgoonie/claudekit-cli/commit/b5de76bf16bb5143855e0b452c9817bf1e0d9bb7))

## [3.32.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.32.2...v3.32.3) (2026-02-01)


### Bug Fixes

* --prefix flag preserves other kits' commands on multi-kit install ([#353](https://github.com/mrgoonie/claudekit-cli/issues/353)) ([5405942](https://github.com/mrgoonie/claudekit-cli/commit/5405942af11c08194bbc808fe4eb89703ab0cd00))
* revert prefix-applier to wrap all entries into ck/ (including mkt/) ([9d167f9](https://github.com/mrgoonie/claudekit-cli/commit/9d167f99ae841f7670532d8072ed8654152be519))

## [3.32.3-dev.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.32.2...v3.32.3-dev.1) (2026-02-01)


### Bug Fixes

* --prefix flag preserves other kits' commands on multi-kit install ([#353](https://github.com/mrgoonie/claudekit-cli/issues/353)) ([5405942](https://github.com/mrgoonie/claudekit-cli/commit/5405942af11c08194bbc808fe4eb89703ab0cd00))
* revert prefix-applier to wrap all entries into ck/ (including mkt/) ([9d167f9](https://github.com/mrgoonie/claudekit-cli/commit/9d167f99ae841f7670532d8072ed8654152be519))

## [3.32.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.32.1...v3.32.2) (2026-02-01)


### Bug Fixes

* `ck update --yes` now skips kit content update prompt ([#351](https://github.com/mrgoonie/claudekit-cli/issues/351)) ([4afb457](https://github.com/mrgoonie/claudekit-cli/commit/4afb457adaa64f3a404e3b0ff4d77172489c5157)), closes [#350](https://github.com/mrgoonie/claudekit-cli/issues/350)

## [3.32.2-dev.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.32.1...v3.32.2-dev.1) (2026-02-01)


### Bug Fixes

* `ck update --yes` now skips kit content update prompt ([#351](https://github.com/mrgoonie/claudekit-cli/issues/351)) ([4afb457](https://github.com/mrgoonie/claudekit-cli/commit/4afb457adaa64f3a404e3b0ff4d77172489c5157)), closes [#350](https://github.com/mrgoonie/claudekit-cli/issues/350)

## [3.32.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.32.0...v3.32.1) (2026-01-29)


### Bug Fixes

* address PR review - async I/O and symlink security ([9aa85fa](https://github.com/mrgoonie/claudekit-cli/commit/9aa85fac1296f4d8164ddb4ed1445f061fe9b44b))
* address PR review — race condition, signal handlers, tests ([fafbb3b](https://github.com/mrgoonie/claudekit-cli/commit/fafbb3b792f7b91844478eb5489373cc84f1bdc7))
* address second review — remove signal handlers, harden cleanup ([5b622cc](https://github.com/mrgoonie/claudekit-cli/commit/5b622ccbcf8261c1dca41aa1cb0d547e54376b26))
* detect installations without metadata.json ([#344](https://github.com/mrgoonie/claudekit-cli/issues/344)) ([52cc666](https://github.com/mrgoonie/claudekit-cli/commit/52cc66616925853f547c66f33bbec4959eb3861a))
* keep lock in registry during release to prevent cleanup gap ([fa1f0c4](https://github.com/mrgoonie/claudekit-cli/commit/fa1f0c47e411e76801a21030ee6b55b15ed3a98b))
* prevent stale kit-install.lock after process exit ([252883e](https://github.com/mrgoonie/claudekit-cli/commit/252883e29a21e534c664c9136d76f09fb824d443)), closes [#346](https://github.com/mrgoonie/claudekit-cli/issues/346)

## [3.32.1-dev.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.32.0...v3.32.1-dev.1) (2026-01-29)


### Bug Fixes

* address PR review - async I/O and symlink security ([9aa85fa](https://github.com/mrgoonie/claudekit-cli/commit/9aa85fac1296f4d8164ddb4ed1445f061fe9b44b))
* address PR review — race condition, signal handlers, tests ([fafbb3b](https://github.com/mrgoonie/claudekit-cli/commit/fafbb3b792f7b91844478eb5489373cc84f1bdc7))
* address second review — remove signal handlers, harden cleanup ([5b622cc](https://github.com/mrgoonie/claudekit-cli/commit/5b622ccbcf8261c1dca41aa1cb0d547e54376b26))
* detect installations without metadata.json ([#344](https://github.com/mrgoonie/claudekit-cli/issues/344)) ([52cc666](https://github.com/mrgoonie/claudekit-cli/commit/52cc66616925853f547c66f33bbec4959eb3861a))
* keep lock in registry during release to prevent cleanup gap ([fa1f0c4](https://github.com/mrgoonie/claudekit-cli/commit/fa1f0c47e411e76801a21030ee6b55b15ed3a98b))
* prevent stale kit-install.lock after process exit ([252883e](https://github.com/mrgoonie/claudekit-cli/commit/252883e29a21e534c664c9136d76f09fb824d443)), closes [#346](https://github.com/mrgoonie/claudekit-cli/issues/346)

# [3.32.0-dev.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.32.0-dev.2...v3.32.0-dev.3) (2026-01-29)


### Bug Fixes

* address PR review — race condition, signal handlers, tests ([fafbb3b](https://github.com/mrgoonie/claudekit-cli/commit/fafbb3b792f7b91844478eb5489373cc84f1bdc7))
* address second review — remove signal handlers, harden cleanup ([5b622cc](https://github.com/mrgoonie/claudekit-cli/commit/5b622ccbcf8261c1dca41aa1cb0d547e54376b26))
* keep lock in registry during release to prevent cleanup gap ([fa1f0c4](https://github.com/mrgoonie/claudekit-cli/commit/fa1f0c47e411e76801a21030ee6b55b15ed3a98b))
* prevent stale kit-install.lock after process exit ([252883e](https://github.com/mrgoonie/claudekit-cli/commit/252883e29a21e534c664c9136d76f09fb824d443)), closes [#346](https://github.com/mrgoonie/claudekit-cli/issues/346)

# [3.32.0-dev.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.32.0-dev.1...v3.32.0-dev.2) (2026-01-27)


### Bug Fixes

* address PR review - async I/O and symlink security ([9aa85fa](https://github.com/mrgoonie/claudekit-cli/commit/9aa85fac1296f4d8164ddb4ed1445f061fe9b44b))
* detect installations without metadata.json ([#344](https://github.com/mrgoonie/claudekit-cli/issues/344)) ([52cc666](https://github.com/mrgoonie/claudekit-cli/commit/52cc66616925853f547c66f33bbec4959eb3861a))

# [3.32.0-dev.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.31.0...v3.32.0-dev.1) (2026-01-27)


### Bug Fixes

* **skill:** address PR review feedback ([562fd0f](https://github.com/mrgoonie/claudekit-cli/commit/562fd0fa836ccb85b309e7aa7c880dd403eea142))
* suppress update notification for dev prerelease to same base stable ([00464fb](https://github.com/mrgoonie/claudekit-cli/commit/00464fb9efd2a3e59c1f909b18cf442175d1e899)), closes [#342](https://github.com/mrgoonie/claudekit-cli/issues/342)
* **sync:** filter deletion paths before sync validation ([ebc59c1](https://github.com/mrgoonie/claudekit-cli/commit/ebc59c1c9f3c2beba4bb57a8fe641e3758810bce)), closes [#337](https://github.com/mrgoonie/claudekit-cli/issues/337)
* **test:** use path.sep for cross-platform path assertions ([76fc173](https://github.com/mrgoonie/claudekit-cli/commit/76fc17379fa9b171e694f590ecc15f755804d8e9))
* **update-cli:** treat --dev channel switch as upgrade ([6b6fc50](https://github.com/mrgoonie/claudekit-cli/commit/6b6fc502cafbab42cb2f3cefad4bee8793557b29))
* use path.sep for cross-platform path validation in deletion-handler ([c593ce8](https://github.com/mrgoonie/claudekit-cli/commit/c593ce863bdf0c92f972623337e232af3ed748f9))


### Features

* **cli:** add ck skill command for cross-agent skill distribution ([995bfb6](https://github.com/mrgoonie/claudekit-cli/commit/995bfb60b21e7658b238932292a8db2bfc394dd5)), closes [#334](https://github.com/mrgoonie/claudekit-cli/issues/334)
* **cli:** add skill registry and uninstall support ([33ef150](https://github.com/mrgoonie/claudekit-cli/commit/33ef150f4648b1cc82f13c6b05823cbc7cb199f8))
* **deletions:** add glob pattern support via picomatch ([a683f9a](https://github.com/mrgoonie/claudekit-cli/commit/a683f9a3aa5aec415adc5d2c6692113156d79cee))
* **help:** add comprehensive --help for skill command ([780950c](https://github.com/mrgoonie/claudekit-cli/commit/780950cb908f7febce7d174293fd64554f7dc917))
* **skill:** enable multi-select for skill installation ([a2ed1bc](https://github.com/mrgoonie/claudekit-cli/commit/a2ed1bcf1d133558cc885b1b6171d99817a4fa88))

# [3.31.0-dev.8](https://github.com/mrgoonie/claudekit-cli/compare/v3.31.0-dev.7...v3.31.0-dev.8) (2026-01-27)


### Bug Fixes

* suppress update notification for dev prerelease to same base stable ([00464fb](https://github.com/mrgoonie/claudekit-cli/commit/00464fb9efd2a3e59c1f909b18cf442175d1e899)), closes [#342](https://github.com/mrgoonie/claudekit-cli/issues/342)

# [3.31.0-dev.7](https://github.com/mrgoonie/claudekit-cli/compare/v3.31.0-dev.6...v3.31.0-dev.7) (2026-01-27)


### Bug Fixes

* **sync:** filter deletion paths before sync validation ([ebc59c1](https://github.com/mrgoonie/claudekit-cli/commit/ebc59c1c9f3c2beba4bb57a8fe641e3758810bce)), closes [#337](https://github.com/mrgoonie/claudekit-cli/issues/337)

# [3.31.0-dev.6](https://github.com/mrgoonie/claudekit-cli/compare/v3.31.0-dev.5...v3.31.0-dev.6) (2026-01-26)


### Features

* **skill:** enable multi-select for skill installation ([a2ed1bc](https://github.com/mrgoonie/claudekit-cli/commit/a2ed1bcf1d133558cc885b1b6171d99817a4fa88))

# [3.31.0-dev.5](https://github.com/mrgoonie/claudekit-cli/compare/v3.31.0-dev.4...v3.31.0-dev.5) (2026-01-26)


### Features

* **help:** add comprehensive --help for skill command ([780950c](https://github.com/mrgoonie/claudekit-cli/commit/780950cb908f7febce7d174293fd64554f7dc917))

# [3.31.0-dev.4](https://github.com/mrgoonie/claudekit-cli/compare/v3.31.0-dev.3...v3.31.0-dev.4) (2026-01-26)


### Bug Fixes

* **update-cli:** treat --dev channel switch as upgrade ([6b6fc50](https://github.com/mrgoonie/claudekit-cli/commit/6b6fc502cafbab42cb2f3cefad4bee8793557b29))

# [3.31.0-dev.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.31.0-dev.2...v3.31.0-dev.3) (2026-01-26)


### Bug Fixes

* **skill:** address PR review feedback ([562fd0f](https://github.com/mrgoonie/claudekit-cli/commit/562fd0fa836ccb85b309e7aa7c880dd403eea142))
* **test:** use path.sep for cross-platform path assertions ([76fc173](https://github.com/mrgoonie/claudekit-cli/commit/76fc17379fa9b171e694f590ecc15f755804d8e9))
* use path.sep for cross-platform path validation in deletion-handler ([c593ce8](https://github.com/mrgoonie/claudekit-cli/commit/c593ce863bdf0c92f972623337e232af3ed748f9))


### Features

* **cli:** add ck skills command for cross-agent skill distribution ([995bfb6](https://github.com/mrgoonie/claudekit-cli/commit/995bfb60b21e7658b238932292a8db2bfc394dd5)), closes [#334](https://github.com/mrgoonie/claudekit-cli/issues/334)
* **cli:** add skills registry and uninstall support ([33ef150](https://github.com/mrgoonie/claudekit-cli/commit/33ef150f4648b1cc82f13c6b05823cbc7cb199f8))

# [3.31.0-dev.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.31.0-dev.1...v3.31.0-dev.2) (2026-01-25)


### Features

* **deletions:** add glob pattern support via picomatch ([a683f9a](https://github.com/mrgoonie/claudekit-cli/commit/a683f9a3aa5aec415adc5d2c6692113156d79cee))

# [3.31.0-dev.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.30.3...v3.31.0-dev.1) (2026-01-24)


### Bug Fixes

* **ci:** address code review feedback ([466629e](https://github.com/mrgoonie/claudekit-cli/commit/466629ecb475a667b0083109106d60c797629d57))
* **ci:** comprehensive review fixes ([bbd2b01](https://github.com/mrgoonie/claudekit-cli/commit/bbd2b0164d4988f22ad431034084dfafd44f9cb9))
* **ci:** explicitly pass GITHUB_REF_NAME to semantic-release ([925f64a](https://github.com/mrgoonie/claudekit-cli/commit/925f64a07d0dd41c18cc999370e9646ebef80124))


### Features

* **init:** add manifest-based deletion cleanup for archived commands ([32a8eca](https://github.com/mrgoonie/claudekit-cli/commit/32a8ecae78f6c0b1c3a4289b57d7f4f6d3c0f1fa))
* **release:** migrate from JSON to JS config and implement dev release workflow ([aaf40f5](https://github.com/mrgoonie/claudekit-cli/commit/aaf40f5dd98651988430fde6b2da5ab096f22e8c))
* **update:** add --dev flag for dev version updates ([ee2d594](https://github.com/mrgoonie/claudekit-cli/commit/ee2d59448c82d63689a6a74ef7f09e6f72f2ba4f))

## [3.30.3](https://github.com/mrgoonie/claudekit-cli/compare/v3.30.2...v3.30.3) (2026-01-21)


### Bug Fixes

* **doctor:** fix token scope detection and enhance verbose mode ([bcf216c](https://github.com/mrgoonie/claudekit-cli/commit/bcf216c7972ec1ffa3c5ccafb7b7d15afbaee5e9))

## [3.30.2](https://github.com/mrgoonie/claudekit-cli/compare/v3.30.1...v3.30.2) (2026-01-21)


### Bug Fixes

* add .venv and __pycache__ to NEVER_COPY_PATTERNS ([#326](https://github.com/mrgoonie/claudekit-cli/issues/326)) ([d5323c9](https://github.com/mrgoonie/claudekit-cli/commit/d5323c93fbec546f7024967b1d14243dcd814854)), closes [#325](https://github.com/mrgoonie/claudekit-cli/issues/325) [#325](https://github.com/mrgoonie/claudekit-cli/issues/325)
* add error handling for file reads in manifest generation ([98ce4c2](https://github.com/mrgoonie/claudekit-cli/commit/98ce4c296a2d6efbd4b7c7373ca3d3ba852d9837))
* setup wizard skipped when .env exists but required keys missing ([#323](https://github.com/mrgoonie/claudekit-cli/issues/323)) ([212f92b](https://github.com/mrgoonie/claudekit-cli/commit/212f92bdc4386a3c61182a409f6ac4ef4816fcce)), closes [#322](https://github.com/mrgoonie/claudekit-cli/issues/322)
* transform content before checksumming in release manifest ([a1044cc](https://github.com/mrgoonie/claudekit-cli/commit/a1044cca0fdaedbb99a10de146e4bfc7900a21c1)), closes [#328](https://github.com/mrgoonie/claudekit-cli/issues/328)

## [3.30.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.30.0...v3.30.1) (2026-01-21)


### Bug Fixes

* EMFILE error and setup wizard improvements ([#327](https://github.com/mrgoonie/claudekit-cli/issues/327)) ([c3a46fd](https://github.com/mrgoonie/claudekit-cli/commit/c3a46fd181a0c6ed54ee978a37192cf7a63b4371)), closes [#323](https://github.com/mrgoonie/claudekit-cli/issues/323) [#322](https://github.com/mrgoonie/claudekit-cli/issues/322) [#323](https://github.com/mrgoonie/claudekit-cli/issues/323) [#326](https://github.com/mrgoonie/claudekit-cli/issues/326) [#325](https://github.com/mrgoonie/claudekit-cli/issues/325) [#325](https://github.com/mrgoonie/claudekit-cli/issues/325)

# [3.30.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.29.0...v3.30.0) (2026-01-19)


### Features

* setup wizard checks required keys and prompts if missing ([#324](https://github.com/mrgoonie/claudekit-cli/issues/324)) ([39c744d](https://github.com/mrgoonie/claudekit-cli/commit/39c744d258f30ecda0d5a45b7d3a0b1d6a5d30ed)), closes [#323](https://github.com/mrgoonie/claudekit-cli/issues/323) [#322](https://github.com/mrgoonie/claudekit-cli/issues/322) [#323](https://github.com/mrgoonie/claudekit-cli/issues/323)

# [3.29.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.28.0...v3.29.0) (2026-01-19)


### Bug Fixes

* **error-handling:** bulletproof edge cases and PR feedback ([623b1b7](https://github.com/mrgoonie/claudekit-cli/commit/623b1b7c653a75e008e58a8ef94f34923eeabb81)), closes [#320](https://github.com/mrgoonie/claudekit-cli/issues/320) [#320](https://github.com/mrgoonie/claudekit-cli/issues/320)


### Features

* **error-handling:** bulletproof error classification and enhanced ck doctor ([cd5b6f1](https://github.com/mrgoonie/claudekit-cli/commit/cd5b6f1949369431cb1d082d9aa090c42fc4ff6c)), closes [#319](https://github.com/mrgoonie/claudekit-cli/issues/319)

# [3.28.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.27.1...v3.28.0) (2026-01-15)


### Bug Fixes

* correct OpenCode global path to use ~/.config on Windows ([f56db51](https://github.com/mrgoonie/claudekit-cli/commit/f56db512dac40311015f5ae41f578430380cf62d)), closes [#316](https://github.com/mrgoonie/claudekit-cli/issues/316)
* resolve TypeScript errors blocking CI ([2ecff5b](https://github.com/mrgoonie/claudekit-cli/commit/2ecff5b112dd02a55ebf14bc8c3175874684c3bc))


### Features

* **api-key:** implement CLI integration for API key setup ([51b4791](https://github.com/mrgoonie/claudekit-cli/commit/51b4791d6bc874ac0ce85347cf2a168f54e5003e))

## [3.27.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.27.0...v3.27.1) (2026-01-13)


### Bug Fixes

* **init:** handle offline mode (--kit-path, --archive) in merge phase ([8caf9a3](https://github.com/mrgoonie/claudekit-cli/commit/8caf9a3cea484c5df459e33f04fc4f66b8b0e460))

# [3.27.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.26.1...v3.27.0) (2026-01-12)


### Bug Fixes

* **download:** verify download size before reporting success ([abea616](https://github.com/mrgoonie/claudekit-cli/commit/abea6168b420c1a13b429ceb032e571a769e7cf8))
* **init:** skip GitHub API calls for --kit-path and --archive modes ([eb32154](https://github.com/mrgoonie/claudekit-cli/commit/eb32154da383fd3cd1e7d2a1fdb9d49b4a40b20d)), closes [#298](https://github.com/mrgoonie/claudekit-cli/issues/298)
* **ux:** align --fresh prompts with actual behavior ([105131f](https://github.com/mrgoonie/claudekit-cli/commit/105131f18969bc032a3a8e4b2fa988d5032a7cf6))


### Features

* **fresh:** implement ownership-aware file removal ([d7f7862](https://github.com/mrgoonie/claudekit-cli/commit/d7f7862d6af06e5fad303a6768eafa03632d9d6c))

## [3.26.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.26.0...v3.26.1) (2026-01-12)


### Bug Fixes

* add backward compat for workflows/ and remove stray release-manifest ([6550203](https://github.com/mrgoonie/claudekit-cli/commit/6550203b4d218c17d462b2505695b208398b1648))
* add missing newline in .gitignore between secrets/* and release-manifest.json ([fa9b54c](https://github.com/mrgoonie/claudekit-cli/commit/fa9b54c6ea9dac4dae64d549e0acf67ba2342ad6))

# [3.26.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.25.0...v3.26.0) (2026-01-11)


### Bug Fixes

* add pre-flight auth diagnostics to ck init ([7f5c158](https://github.com/mrgoonie/claudekit-cli/commit/7f5c158bb493186c4654951a500c0f94b2726f91)), closes [#305](https://github.com/mrgoonie/claudekit-cli/issues/305)
* add timeout to execAsync calls and skip CI for integration test ([a8efc1a](https://github.com/mrgoonie/claudekit-cli/commit/a8efc1ab3e8625afb2b94117222e8094378ba3a9))
* preserve --beta flag from existing installation in ck update ([f89f7d9](https://github.com/mrgoonie/claudekit-cli/commit/f89f7d9dd6d7191c8da1fee68c8a392b6efe6433)), closes [#307](https://github.com/mrgoonie/claudekit-cli/issues/307)


### Features

* enhance preflight checks with timeout handling and version detection ([97e3492](https://github.com/mrgoonie/claudekit-cli/commit/97e3492c2b836b2e91f85996a4b6a7e5e2c69d92))

# [3.25.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.24.1...v3.25.0) (2026-01-11)


### Bug Fixes

* complete [#298](https://github.com/mrgoonie/claudekit-cli/issues/298) fix for init command + add readMetadataFile tests ([dc0458d](https://github.com/mrgoonie/claudekit-cli/commit/dc0458da606d0f2b2f375e74acecfeae4c9986e0))
* skip GitHub API checks when --kit-path or --archive provided ([245037e](https://github.com/mrgoonie/claudekit-cli/commit/245037e8b6fee7174ec4644a142f198e343ac896)), closes [#298](https://github.com/mrgoonie/claudekit-cli/issues/298)
* **transformer:** use whitelist regex to prevent false positives ([1f5a171](https://github.com/mrgoonie/claudekit-cli/commit/1f5a171e004a07456a10abb2000ffe5b007fcba1)), closes [#301](https://github.com/mrgoonie/claudekit-cli/issues/301)
* **update-cli:** add Zod validation, extract kit selection, improve tests ([0da0599](https://github.com/mrgoonie/claudekit-cli/commit/0da05998be646e00dd1207aaaf934b7133cf86b5))


### Features

* **update:** auto-prompt kit content update after CLI update ([bb65749](https://github.com/mrgoonie/claudekit-cli/commit/bb65749056e0c567532b2fc16db07be109eea537))

## [3.24.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.24.0...v3.24.1) (2026-01-11)


### Bug Fixes

* **update:** preserve --beta flag in init command suggestions ([aab6fc8](https://github.com/mrgoonie/claudekit-cli/commit/aab6fc83bf5c24eaf4df3a8e3041caad735f46ba))

# [3.24.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.23.0...v3.24.0) (2026-01-11)


### Features

* add OpenCode path transformer for platform-specific path resolution ([013a5ea](https://github.com/mrgoonie/claudekit-cli/commit/013a5eae04887dfcb27c96cf5df5b588849c4921))
* **init:** add opencode handler for kit initialization ([6f90920](https://github.com/mrgoonie/claudekit-cli/commit/6f9092063fc3ae47bd529bbd487c01ee23a48e84))
* **opencode:** add global install path resolver for OpenCode ([c5c3077](https://github.com/mrgoonie/claudekit-cli/commit/c5c3077318c026be1ab0352a03709664d12b8b6d))
* **update-cli:** enhance with OpenCode release manifest support ([dcda225](https://github.com/mrgoonie/claudekit-cli/commit/dcda225c1031f58aead088e93d5b48cc05a3fd33))

# [3.23.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.22.1...v3.23.0) (2026-01-08)


### Bug Fixes

* add missing command roots for prefix transformation ([8193202](https://github.com/mrgoonie/claudekit-cli/commit/8193202d2c867310ff6e8855ce3e95a649fef00b))
* transform command references in file contents when --prefix applied ([654f66f](https://github.com/mrgoonie/claudekit-cli/commit/654f66f46ebbb332f9aafb40534ed73a36a9edf2)), closes [#294](https://github.com/mrgoonie/claudekit-cli/issues/294)


### Features

* auto-remove deprecated hooks and MCP servers during merge ([30c8e48](https://github.com/mrgoonie/claudekit-cli/commit/30c8e48ffb536ea4e3552b83214dde98425e2a92))

## [3.22.1](https://github.com/mrgoonie/claudekit-cli/compare/v3.22.0...v3.22.1) (2026-01-05)


### Bug Fixes

* apply skip dirs to skills hash/manifest scanners ([a5a9994](https://github.com/mrgoonie/claudekit-cli/commit/a5a999457c63bc5adb3bf82bc0d7858b52b917cc))
* deduplicate installations and unify HOME detection logic ([70c9c46](https://github.com/mrgoonie/claudekit-cli/commit/70c9c4623ebefdb344f4374f24529f3b498068d2))
* kit-scoped uninstall and HOME directory edge cases ([#287](https://github.com/mrgoonie/claudekit-cli/issues/287)) ([6bf063a](https://github.com/mrgoonie/claudekit-cli/commit/6bf063ab1bb98b95f9933565ff68d54d72ff08cd))
* skip node_modules/.venv in legacy migration scan ([72d69fa](https://github.com/mrgoonie/claudekit-cli/commit/72d69fa336c84334c84edd5715d0b1eb4c3bad02)), closes [#288](https://github.com/mrgoonie/claudekit-cli/issues/288)

# [3.22.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.21.0...v3.22.0) (2026-01-05)


### Bug Fixes

* respect JSON output mode in skills install prompt ([c4ecaae](https://github.com/mrgoonie/claudekit-cli/commit/c4ecaaec4f26b3608e140c73340a455b4b1aa5bb))


### Features

* **ui:** improve skills installation prompt with detailed dependency list ([44e950a](https://github.com/mrgoonie/claudekit-cli/commit/44e950a498e25b17918d9698d1a199f10495a42e))

# [3.21.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.20.0...v3.21.0) (2026-01-04)


### Bug Fixes

* allow --kit all and comma-separated values in schema ([1ba431f](https://github.com/mrgoonie/claudekit-cli/commit/1ba431f846a83ae7e374b87f84d403117f32d607)), closes [#279](https://github.com/mrgoonie/claudekit-cli/issues/279)
* **security:** address 15 edge case vulnerabilities ([e209f42](https://github.com/mrgoonie/claudekit-cli/commit/e209f429d4892acd009c6528ff8fcc30836d1872))
* **types:** add runtime validation for kit type before unsafe casts ([869ae7e](https://github.com/mrgoonie/claudekit-cli/commit/869ae7e3f3a620fc625c4ed480a555bfd7750c77))


### Features

* add --archive and --kit-path flags for offline installation ([88b906a](https://github.com/mrgoonie/claudekit-cli/commit/88b906a938c0dbbefcc77151a9c1fc5131aeb789)), closes [#283](https://github.com/mrgoonie/claudekit-cli/issues/283)

# [3.20.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.19.0...v3.20.0) (2026-01-01)


### Bug Fixes

* prevent EMFILE 'too many open files' on Windows ([07c1e29](https://github.com/mrgoonie/claudekit-cli/commit/07c1e29670ef831eb68accf07d0eb2c5fb0da5a5))


### Features

* add --kit all and comma-separated multi-kit support ([3d4432a](https://github.com/mrgoonie/claudekit-cli/commit/3d4432a97b4fa1666a45af69f0d2c1ea3a55dcab))

# [3.19.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.18.0...v3.19.0) (2026-01-01)


### Features

* multi-select kit prompt for dual-kit purchasers ([0b243f1](https://github.com/mrgoonie/claudekit-cli/commit/0b243f1a5311ac418075bd21a2ce11794547a7dd)), closes [#276](https://github.com/mrgoonie/claudekit-cli/issues/276)

# [3.18.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.17.0...v3.18.0) (2026-01-01)


### Bug Fixes

* race condition and add comprehensive test suite ([a4b2e3f](https://github.com/mrgoonie/claudekit-cli/commit/a4b2e3f77e3cc3129f99d57e14743a154738c28e))


### Features

* auto-detect accessible kits for single-purchaser UX ([306c67d](https://github.com/mrgoonie/claudekit-cli/commit/306c67dbc489a2f839e44078e5507b81826663ce))

# [3.17.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.16.0...v3.17.0) (2025-12-31)


### Bug Fixes

* comprehensive path variable normalization across codebase ([712507f](https://github.com/mrgoonie/claudekit-cli/commit/712507f284a3f7d7016c968b7ca8e1e5d2c72753)), closes [#265](https://github.com/mrgoonie/claudekit-cli/issues/265)
* dedupe existing duplicate hooks in destination during merge ([c7f506c](https://github.com/mrgoonie/claudekit-cli/commit/c7f506c99215d5afdb026a4acaee7e99c8dfb3bd)), closes [#267](https://github.com/mrgoonie/claudekit-cli/issues/267) [#270](https://github.com/mrgoonie/claudekit-cli/issues/270)
* display all installed kits in ck version and preserve root metadata ([265d164](https://github.com/mrgoonie/claudekit-cli/commit/265d1645d30a46a4725dec67a451f29ba8be2311)), closes [#268](https://github.com/mrgoonie/claudekit-cli/issues/268)
* handle null/undefined in normalizeCommand ([5f213e5](https://github.com/mrgoonie/claudekit-cli/commit/5f213e51cfc61cbac83188571a9cb51f10c7391c))
* make settings-processor tests platform-aware ([5d30b8e](https://github.com/mrgoonie/claudekit-cli/commit/5d30b8e34a20ebe23dc67bb24d67c51814fbfc76))
* normalize $CLAUDE_PROJECT_DIR to $HOME in global settings merge ([da5d35e](https://github.com/mrgoonie/claudekit-cli/commit/da5d35e2ef794122ca15754050416d4751e6d6a1)), closes [#265](https://github.com/mrgoonie/claudekit-cli/issues/265)


### Features

* add multi-kit coexistence merge logic (Phase 1) ([bc13c39](https://github.com/mrgoonie/claudekit-cli/commit/bc13c390156dbbe3aa19f91e1637b444db68e2ae))
* **hook-origin:** add origin tracking for kit-scoped uninstall (Phase 2) ([b3cbdbf](https://github.com/mrgoonie/claudekit-cli/commit/b3cbdbf6c1009b086e794cabd6a6b1d6d0f9b867))
* **install:** add timestamp-based dual-kit conflict resolution ([80cb015](https://github.com/mrgoonie/claudekit-cli/commit/80cb0156466562ea4131aa5304cea2bdbbf2fd63))

# [3.16.0](https://github.com/mrgoonie/claudekit-cli/compare/v3.15.3...v3.16.0) (2025-12-29)


### Bug Fixes

* address edge cases from codebase review ([58bd380](https://github.com/mrgoonie/claudekit-cli/commit/58bd38061bdcac3490a114ac4c59edf5586f64a0))
* **auth:** address CI review feedback ([311752c](https://github.com/mrgoonie/claudekit-cli/commit/311752cc1a835f00162af0bdc760f80e564a31c7))
* **path-resolver:** add unique backup directory timestamps ([a023491](https://github.com/mrgoonie/claudekit-cli/commit/a023491cd566f2ebd49988ded4460a106f6b0835))
* **settings:** address 4 edge cases in respect-deletions feature ([18546d3](https://github.com/mrgoonie/claudekit-cli/commit/18546d386c915be644fde276f936491d26d4b698))
* **sync:** address PR review security and robustness issues ([6391c1f](https://github.com/mrgoonie/claudekit-cli/commit/6391c1fb95f36077b858cf245179a31b7b197ed3))
* **sync:** comprehensive security and edge case hardening ([3432af7](https://github.com/mrgoonie/claudekit-cli/commit/3432af717e540ef23dab326ad7ba12f673e47966))
* **sync:** harden edge case handling for security and reliability ([24ad082](https://github.com/mrgoonie/claudekit-cli/commit/24ad082338f547d634081f08f50ce85ba853c2c3))
* **sync:** harden GitHub org security and add lock timeout config ([1465fff](https://github.com/mrgoonie/claudekit-cli/commit/1465fff135ce8aeba33bc8a53f6ecaf0eed5f292))
* **test:** properly clear env vars in CI and skip SSH test ([59c9b8b](https://github.com/mrgoonie/claudekit-cli/commit/59c9b8bc51b1a5bd501c2c673b9aac041e12f9eb))
* **test:** skip gh CLI tests in CI to avoid timeout ([5b97745](https://github.com/mrgoonie/claudekit-cli/commit/5b977455f9a78e434c5972ede4e4ce314fb8aaa3))


### Features

* **auth:** add --use-git flag for git clone authentication ([e48dc2a](https://github.com/mrgoonie/claudekit-cli/commit/e48dc2a23f7ad8eb3489eb268305c8fdf4f86e65)), closes [#261](https://github.com/mrgoonie/claudekit-cli/issues/261)
* **auth:** add multi-method GitHub authentication ([#261](https://github.com/mrgoonie/claudekit-cli/issues/261)) ([8908921](https://github.com/mrgoonie/claudekit-cli/commit/890892163af81d43e3b101c501dfbd6b77455531))
* **cli:** register --sync flag for init command ([908908e](https://github.com/mrgoonie/claudekit-cli/commit/908908e6085d034cf4da48d65b3ba5a1d2aa9ec5))
* **init:** add sync-handler phase for config synchronization ([3e472f5](https://github.com/mrgoonie/claudekit-cli/commit/3e472f5a816e304ba820825f2ce9944e9824df8a))
* **init:** integrate sync mode into init command flow ([a498a25](https://github.com/mrgoonie/claudekit-cli/commit/a498a25493997c569c01bfda0e803fd2c0e98300))
* **settings:** respect user deletions in settings sync ([15ad5a6](https://github.com/mrgoonie/claudekit-cli/commit/15ad5a6553219f9c68a3d52368d2b95a70999891))
* **sync:** add config sync domain with version checking and merge UI ([0037127](https://github.com/mrgoonie/claudekit-cli/commit/0037127de9da2a0ddae12c12a9a00a760ed218cd))
* **sync:** add passive config update notifications after ck init ([11edbda](https://github.com/mrgoonie/claudekit-cli/commit/11edbdadc8a06fcd98f91bfb06776ebca55bf066))
* **types:** add sync flag and SyncContext type support ([f2d6eb0](https://github.com/mrgoonie/claudekit-cli/commit/f2d6eb05cec504c37b5d869038cb1649b1f31185))


### Performance Improvements

* **sync:** optimize binary file detection ([3501857](https://github.com/mrgoonie/claudekit-cli/commit/35018576b8594856e17e22ccfec0cc2c12cde610))

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
