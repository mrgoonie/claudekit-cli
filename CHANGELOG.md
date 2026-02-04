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
