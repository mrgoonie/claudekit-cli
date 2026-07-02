# Engineer Install Mode Contract

## Purpose

ClaudeKit Engineer can be installed globally as copied files in `~/.claude`, as a
Claude Code plugin, and as a Codex plugin companion. These surfaces must converge
from one persisted intent so `ck init`, `ck update`, and `ck doctor` do not leave
duplicate `/ck:*` skills or stale plugin state active.

## Persisted Preference

The source of truth is:

```json
{
  "kits": {
    "engineer": {
      "installModePreference": "auto"
    }
  }
}
```

Field owner: `metadata.json.kits.engineer.installModePreference`.

Valid values:

- `auto`: prefer plugins when the runtime supports them, with copied skills as
  fallback until plugin verification succeeds.
- `plugin`: require plugin verification for supported runtimes.
- `legacy`: keep copied skills as the active install and remove owned plugin
  state.

Fallbacks:

- During `ck init`, the active `--install-mode auto|plugin|legacy` option is the
  preference for global Engineer installs.
- During `ck update`, a missing field falls back to `auto` for global Engineer
  installs. This preserves backward compatibility while moving old installs
  toward the safer plugin-preferred default.
- Local installs and non-Engineer kits do not own this field.
- Metadata writes preserve an existing preference unless a global Engineer init
  explicitly provides a new one.

## State Inputs

Claude legacy copy:

- `metadata.json.kits.engineer` or legacy root metadata proves a copied install.
- Tracked file checksums decide which plugin-supplied legacy files can be cleaned.
- User-modified files are preserved.

Claude plugin:

- `settings.json.enabledPlugins["ck@claudekit"]` proves registration and enabled
  state.
- `plugins/cache/<marketplace>/ck/<version>/` provides version and stale cache
  evidence.
- A registered plugin plus copied `agents/` or `skills/` files is a mixed active
  source.

Codex plugin:

- `codex --version` decides whether Codex exists.
- `codex plugin --help` decides whether plugins are supported.
- `codex plugin list --json` is preferred; text output is fallback.
- Reported states are `codex-unavailable`, `plugins-unsupported`, `missing`,
  `disabled`, `installed-current`, `installed-stale-version`,
  `installed-stale-source`, and `unknown`.

## Convergence Rules

`auto`:

- Install or refresh the Claude plugin when supported.
- Keep copied skills until the Claude plugin verifies.
- After verification, remove only CK-owned plugin-supplied legacy files.
- Install or refresh the Codex plugin when Codex supports plugins.
- If plugin work fails, keep the copied install usable and log actionable detail.

`plugin`:

- The Claude plugin must verify when Claude Code supports plugins.
- The Codex plugin must verify when Codex supports plugins.
- Unsupported runtimes are skipped; supported-but-failing runtimes are errors.
- Cleanup copied skills only after plugin verification.

`legacy`:

- Copied skills remain the active install.
- Remove owned Claude plugin registration and stale cache.
- Remove owned Codex plugin registration and marketplace entry when Codex
  supports plugins.
- Do not migrate a legacy-preference install to plugin during `ck update`.

## Duplicate-State Regression

The known bad state is copied Engineer skills at version N plus an enabled
`ck@claudekit` plugin at version N-1. This exposes duplicate CK skills to users.

Repair rules:

- `auto` or `plugin` refreshes the plugin to the current payload, verifies it,
  then removes CK-owned copied `agents/` and `skills/` files.
- `legacy` removes the owned plugin state and keeps copied skills.
- If verification fails in `auto`, copied skills stay active and stale plugin
  state is removed or reported.
- If verification fails in `plugin`, the command fails with a clear error.

## Cleanup And Rollback

- No destructive cleanup happens before replacement verification.
- Legacy copied files are backed up under `.claude/backups/ck-legacy-<timestamp>`
  before removal.
- Migration writes a receipt recording source mode, target mode, plugin version,
  backup directory, removed paths, and timestamp.
- Cleanup is limited to CK-owned files or checksum-matching plugin-supplied
  legacy files.
- Re-running a converged command is a no-op unless a version/source refresh is
  required.

## User-Visible Output

`ck init`:

- Names the active target as `legacy install mode`, `Claude Code plugin`, or
  `Codex plugin`.
- In `plugin` mode, fails when a supported plugin runtime cannot verify.
- In `auto` mode, keeps the copied fallback when plugin install fails.

`ck update`:

- Passes `--kit engineer --install-mode <preference>` to the follow-up init.
- Preserves `legacy` preference across version updates.
- Reinstalls global Engineer content when Codex plugin state is missing,
  disabled, stale-version, or stale-source for `auto` and `plugin`.

`ck doctor`:

- Shows persisted preference.
- Shows Claude install mode, Claude plugin registration, legacy copy state, and
  Codex plugin state.
- Warns when preference and live state disagree.
- Warns when copied skills and plugin state can both expose CK skills.
