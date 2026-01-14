/**
 * GitHub domain - GitHub API integration
 */

export { GitHubClient } from "./github-client.js";
export { AuthManager } from "./github-auth.js";
export { NpmRegistryClient, type NpmPackageInfo, type NpmVersionInfo } from "./npm-registry.js";
export { detectAccessibleKits } from "./kit-access-checker.js";
export * from "./types.js";
