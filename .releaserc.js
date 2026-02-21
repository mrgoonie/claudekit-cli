/**
 * Semantic Release Configuration
 * Supports both main (stable) and dev (prerelease) branches
 * Note: Config evaluated at module load time (CI only - GITHUB_REF_NAME set by Actions)
 */
const branchName = (process.env.GITHUB_REF_NAME || "").toLowerCase();
if (!branchName) {
	console.warn("⚠️  GITHUB_REF_NAME not set, defaulting to main branch behavior");
}
const isDevBranch = branchName === "dev";

export default {
	branches: ["main", { name: "dev", prerelease: "dev", channel: "dev" }],
	plugins: [
		[
			"@semantic-release/commit-analyzer",
			{
				preset: "conventionalcommits",
				releaseRules: [
					{ type: "feat", release: "minor" },
					{ type: "fix", release: "patch" },
					{ type: "hotfix", release: "patch" },
					{ type: "perf", release: "patch" },
					{ type: "refactor", release: "patch" },
					// Skip merge commits from main to prevent premature version bumps on dev
					{ type: "chore", subject: "*merge*main*", release: false },
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
			isDevBranch
				? {
						// Dev releases: no binary assets, just npm package
						assets: [],
					}
				: {
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
