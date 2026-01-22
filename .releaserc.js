/**
 * Semantic Release Configuration
 * Supports both main (stable) and dev (prerelease) branches
 * Note: Config evaluated at module load time (CI only - GITHUB_REF_NAME set by Actions)
 */
const branchName = (process.env.GITHUB_REF_NAME || "").toLowerCase();
const isDevBranch = branchName === "dev";

export default {
	branches: ["main", { name: "dev", prerelease: "dev", channel: "dev" }],
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
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
