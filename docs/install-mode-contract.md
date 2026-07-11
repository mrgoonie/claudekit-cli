# Engineer Install Mode Contract

## Purpose

ClaudeKit Engineer supports two global installation choices:

- **Normal skills** (recommended and default): copied into `~/.claude/skills/`.
- **Plugin** (advanced explicit opt-in): installed through supported Claude Code and
  Codex plugin surfaces.

`ck init`, `ck update`, and `ck doctor` must converge on the user's persisted intent
without leaving duplicate `/ck:*` skills or stale plugin state active. Plugin installation
must never be inferred from an omitted flag, `--yes`, old `auto` metadata, or runtime
plugin availability.

## Persisted Preference

The source of truth is:

```json
{
  "kits": {
    "engineer": {
      "installModePreference": "legacy"
    }
  }
}
```

Field owner: `metadata.json.kits.engineer.installModePreference`.

Normal skills map to the stored value `legacy`; plugin consent maps to `plugin`.
`auto` remains a compatibility input and possible historical value, but resolves to
Normal skills. It is not plugin consent.

Fallbacks:

- During `ck init`, omitted `--install-mode`, `auto`, and `legacy` resolve to Normal
  skills and persist `legacy`.
- Only `--install-mode plugin` persists `plugin`.
- During `ck update`, only a stored `plugin` value proves durable plugin consent.
  Missing, `auto`, invalid, and `legacy` values resolve to Normal skills.
- `ck init --yes` without an explicit mode always selects Normal skills.
- Local installs and non-Engineer kits do not own this field.
- Later init/update runs preserve stored `plugin` consent until the user explicitly
  selects Normal skills.

## State Inputs

Normal skills:

- `metadata.json.kits.engineer` or legacy root metadata proves a copied install.
- Tracked file checksums decide which plugin-supplied copied files can be cleaned.
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

Normal skills (`auto`, `legacy`, omitted mode, or missing preference):

- Keep copied skills in `~/.claude/skills/` as the active Claude Code install.
- Remove owned Claude plugin registration and stale cache.
- Remove owned Codex plugin registration and marketplace entry when Codex supports
  plugins.
- Do not infer plugin consent from an existing plugin tree or runtime capability.
- Codex skill delivery is a separate native migration: `ck migrate --agent codex`.

Plugin:

- Claude Code plugin support is required; explicit plugin mode fails clearly when it is
  unavailable or cannot verify.
- The Codex plugin must verify when Codex supports plugins.
- Codex runtimes without plugin support are skipped; supported-but-failing runtimes are
  errors.
- Cleanup copied skills only after plugin verification.
- Persist `plugin` so later init/update runs retain the explicit choice.

## Duplicate-State Regression

The known bad state is copied Engineer skills at version N plus an enabled
`ck@claudekit` plugin at version N-1. This exposes duplicate CK skills to users.

Repair rules:

- Normal mode removes owned plugin state and keeps copied skills.
- Explicit plugin mode refreshes the plugin to the current payload, verifies it,
  then removes CK-owned copied `agents/` and `skills/` files.
- If verification fails in plugin mode, the command fails with a clear error.

## Cleanup And Rollback

- No destructive cleanup happens before replacement verification.
- Copied files are backed up under `.claude/backups/ck-legacy-<timestamp>` before
  removal.
- Migration writes a receipt recording source mode, target mode, plugin version,
  backup directory, removed paths, and timestamp.
- Cleanup is limited to CK-owned files or checksum-matching plugin-supplied copied
  files.
- User-modified and unrelated files are preserved.
- Re-running a converged command is a no-op unless a version/source refresh is
  required.

## User-Visible Output

`ck init`:

- Calls the recommended/default choice `Normal skills`, not `legacy`, in prompts and
  status output.
- Explains that Normal skills install to `~/.claude/skills/` and Codex synchronization
  uses `ck migrate --agent codex`.
- Labels plugin installation as an advanced explicit opt-in.
- In plugin mode, requires Claude plugin support and fails when a required or supported
  plugin runtime cannot verify.
- In non-interactive mode without explicit plugin consent, installs Normal skills.

`ck update`:

- Passes `--kit engineer --install-mode <preference>` to the follow-up init.
- Preserves explicit stored `plugin` consent across version updates.
- Resolves missing, `auto`, invalid, and `legacy` preferences to Normal skills.
- Does not install or repair plugins merely because a runtime supports them.

`ck doctor`:

- Shows persisted preference and labels `legacy` as Normal skills.
- Shows Claude install mode, Claude plugin registration, copied-skill state, and
  Codex plugin state.
- Warns when preference and live state disagree.
- Warns when copied skills and plugin state can both expose CK skills.

## Release Boundary

Stable `4.5.2` predates the short-lived plugin-default behavior. The default reversal
applies only to affected development prereleases; stable users were already on the
Normal skills contract.
