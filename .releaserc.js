/**
 * Semantic Release Configuration — Production (main branch only)
 *
 * Dev releases are handled by release-dev.yml without semantic-release.
 * This config only runs on main via release.yml.
 */

export default {
	branches: ["main"],
	plugins: [
		[
			"@semantic-release/commit-analyzer",
			{
				preset: "conventionalcommits",
				releaseRules: [
					{ type: "feat", release: "minor" },
					{ type: "fix", release: "patch" },
					// Custom type (not in Conventional Commits spec) — works with semantic-release,
					// may need allowlist if commitlint is added later
					{ type: "hotfix", release: "patch" },
					{ type: "perf", release: "patch" },
					{ type: "refactor", release: "patch" },
				],
			},
		],
		[
			"@semantic-release/release-notes-generator",
			{
				preset: "conventionalcommits",
				presetConfig: {
					types: [
						{ type: "feat", section: "🚀 Features" },
						{ type: "hotfix", section: "🔥 Hotfixes" },
						{ type: "fix", section: "🐞 Bug Fixes" },
						{ type: "perf", section: "⚡ Performance Improvements" },
						{ type: "refactor", section: "♻️ Code Refactoring" },
						{ type: "docs", section: "📚 Documentation" },
						{ type: "test", section: "✅ Tests" },
						{ type: "build", section: "🏗️ Build System" },
						{ type: "ci", section: "👷 CI" },
					],
				},
			},
		],
		"@semantic-release/changelog",
		[
			"./scripts/build-binaries-after-version-bump.js",
			{
				rebuildBinaries: true,
			},
		],
		[
			"@semantic-release/npm",
			{
				npmPublish: true,
				tarballDir: "dist",
				pkgRoot: ".",
			},
		],
		[
			"@semantic-release/git",
			{
				assets: ["package.json", "CHANGELOG.md"],
				message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
			},
		],
		[
			"@semantic-release/github",
			{
				// Main releases: include platform binaries
				assets: [
					{ path: "bin/ck-darwin-arm64", label: "ck-darwin-arm64" },
					{ path: "bin/ck-darwin-x64", label: "ck-darwin-x64" },
					{ path: "bin/ck-linux-x64", label: "ck-linux-x64" },
					{ path: "bin/ck-win32-x64.exe", label: "ck-win32-x64.exe" },
				],
			},
		],
	],
};
