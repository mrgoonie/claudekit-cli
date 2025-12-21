/**
 * Archive detection and wrapper directory utilities
 */
import { type ArchiveType, ExtractionError } from "@/types";

/**
 * Detect archive type from filename
 * @param filename - Archive filename to analyze
 * @returns Detected archive type
 * @throws {ExtractionError} if archive type cannot be detected
 */
export function detectArchiveType(filename: string): ArchiveType {
	if (filename.endsWith(".tar.gz") || filename.endsWith(".tgz")) {
		return "tar.gz";
	}
	if (filename.endsWith(".zip")) {
		return "zip";
	}
	throw new ExtractionError(`Cannot detect archive type from filename: ${filename}`);
}

/**
 * Check if directory name is a version/release wrapper
 * Examples: claudekit-engineer-v1.0.0, claudekit-engineer-1.0.0, repo-abc1234,
 *           project-v1.0.0-alpha, project-1.2.3-beta.1, repo-v2.0.0-rc.5
 * @param dirName - Directory name to check
 * @returns true if directory is a wrapper that should be stripped
 */
export function isWrapperDirectory(dirName: string): boolean {
	// Match version patterns with optional prerelease: project-v1.0.0, project-1.0.0-alpha, project-v2.0.0-rc.1
	const versionPattern = /^[\w-]+-v?\d+\.\d+\.\d+(-[\w.]+)?$/;
	// Match commit hash patterns: project-abc1234 (7-40 chars for short/full SHA)
	const hashPattern = /^[\w-]+-[a-f0-9]{7,40}$/;

	return versionPattern.test(dirName) || hashPattern.test(dirName);
}
