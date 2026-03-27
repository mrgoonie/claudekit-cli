/**
 * DownloadManager - Facade for download and extraction operations
 *
 * Orchestrates file downloading, archive extraction, and validation
 * by delegating to specialized modules.
 */
import { mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isMacOS } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import { registerTempDir } from "@/shared/temp-cleanup.js";
import { type ArchiveType, DownloadError, ExtractionError, type GitHubReleaseAsset } from "@/types";
import ignore from "ignore";
import { type DownloadFileParams, FileDownloader } from "./download/file-downloader.js";
import { validateExtraction } from "./extraction/extraction-validator.js";
import { TarExtractor } from "./extraction/tar-extractor.js";
import { ZipExtractor } from "./extraction/zip-extractor.js";
import { ExtractionSizeTracker, detectArchiveType, formatBytes } from "./utils/index.js";

/**
 * Threshold (ms) before showing slow extraction warning
 */
const SLOW_EXTRACTION_THRESHOLD_MS = 30_000; // 30 seconds

/**
 * Maximum allowed archive size before extraction (100MB)
 * Prevents zip bomb attacks and excessive disk usage
 */
const MAX_ARCHIVE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Patterns to exclude from extraction
 */
const EXCLUDE_PATTERNS = [
	".git",
	".git/**",
	".github",
	".github/**",
	"node_modules",
	"node_modules/**",
	".DS_Store",
	"Thumbs.db",
	"*.log",
];

/**
 * DownloadManager - Orchestrates download and extraction operations
 */
export class DownloadManager {
	/**
	 * Counter for sub-millisecond uniqueness in temp directory names
	 */
	private static tempDirCounter = 0;

	private readonly fileDownloader = new FileDownloader();
	private readonly tarExtractor = new TarExtractor();
	private readonly zipExtractor = new ZipExtractor();
	private readonly sizeTracker = new ExtractionSizeTracker();

	/**
	 * Instance-level ignore object with combined default and user patterns
	 */
	private ig: ReturnType<typeof ignore>;

	/**
	 * Store user-defined exclude patterns
	 */
	private userExcludePatterns: string[] = [];

	constructor() {
		this.ig = ignore().add(EXCLUDE_PATTERNS);
	}

	/**
	 * Set additional user-defined exclude patterns
	 */
	setExcludePatterns(patterns: string[]): void {
		this.userExcludePatterns = patterns;
		this.ig = ignore().add([...EXCLUDE_PATTERNS, ...this.userExcludePatterns]);

		if (patterns.length > 0) {
			logger.info(`Added ${patterns.length} custom exclude pattern(s)`);
			patterns.forEach((p) => logger.debug(`  - ${p}`));
		}
	}

	/**
	 * Check if file path should be excluded
	 */
	private shouldExclude = (filePath: string): boolean => {
		return this.ig.ignores(filePath);
	};

	/**
	 * Download asset from URL with progress tracking
	 */
	async downloadAsset(asset: GitHubReleaseAsset, destDir: string): Promise<string> {
		return this.fileDownloader.downloadAsset(asset, destDir);
	}

	/**
	 * Download file from URL with progress tracking
	 */
	async downloadFile(params: DownloadFileParams): Promise<string> {
		return this.fileDownloader.downloadFile(params);
	}

	/**
	 * Extract archive to destination
	 */
	async extractArchive(
		archivePath: string,
		destDir: string,
		archiveType?: ArchiveType,
	): Promise<void> {
		// Check archive size before extraction
		const archiveStats = await stat(archivePath);
		if (archiveStats.size > MAX_ARCHIVE_SIZE) {
			throw new ExtractionError(
				`Archive exceeds ${formatBytes(MAX_ARCHIVE_SIZE)} limit: ${formatBytes(archiveStats.size)}`,
			);
		}

		const spinner = createSpinner("Extracting files...").start();

		const slowExtractionWarning = setTimeout(() => {
			spinner.text = "Extracting files... (this may take a while on macOS)";
			if (isMacOS()) {
				logger.debug("Slow extraction detected on macOS - Spotlight indexing may be interfering");
			}
		}, SLOW_EXTRACTION_THRESHOLD_MS);

		try {
			this.sizeTracker.reset();
			const detectedType = archiveType || detectArchiveType(archivePath);
			await mkdir(destDir, { recursive: true });

			if (detectedType === "tar.gz") {
				await this.tarExtractor.extract(archivePath, destDir, this.shouldExclude, this.sizeTracker);
			} else if (detectedType === "zip") {
				await this.zipExtractor.extract(archivePath, destDir, this.shouldExclude, this.sizeTracker);
			} else {
				throw new ExtractionError(`Unsupported archive type: ${detectedType}`);
			}

			clearTimeout(slowExtractionWarning);
			spinner.succeed("Files extracted successfully");
		} catch (error) {
			clearTimeout(slowExtractionWarning);
			spinner.fail("Extraction failed");

			if (isMacOS()) {
				logger.debug(
					"macOS extraction tip: Try disabling Spotlight for the target directory with: sudo mdutil -i off <path>",
				);
			}

			throw new ExtractionError(
				`Failed to extract archive: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Validate extraction results
	 */
	async validateExtraction(extractDir: string): Promise<void> {
		return validateExtraction(extractDir);
	}

	/**
	 * Create temporary download directory with fallback
	 */
	async createTempDir(): Promise<string> {
		const timestamp = Date.now();
		const counter = DownloadManager.tempDirCounter++;

		const primaryTempDir = join(tmpdir(), `claudekit-${timestamp}-${counter}`);
		try {
			await mkdir(primaryTempDir, { recursive: true });
			logger.debug(`Created temp directory: ${primaryTempDir}`);
			registerTempDir(primaryTempDir);
			return primaryTempDir;
		} catch (primaryError) {
			logger.debug(
				`Failed to create temp directory in OS temp: ${primaryError instanceof Error ? primaryError.message : "Unknown error"}`,
			);

			const homeDir = process.env.HOME || process.env.USERPROFILE;
			if (!homeDir) {
				throw new DownloadError(
					`Cannot create temporary directory. Permission denied for ${primaryTempDir} and HOME directory not found.\n\nSolutions:\n  1. Run with elevated permissions\n  2. Set HOME environment variable\n  3. Try running from a different directory`,
				);
			}

			const fallbackTempDir = join(
				homeDir,
				".claudekit",
				"tmp",
				`claudekit-${timestamp}-${counter}`,
			);
			try {
				await mkdir(fallbackTempDir, { recursive: true });
				logger.debug(`Created temp directory (fallback): ${fallbackTempDir}`);
				logger.warning(
					`Using fallback temp directory: ${fallbackTempDir}\n  (OS temp directory was not accessible)`,
				);
				registerTempDir(fallbackTempDir);
				return fallbackTempDir;
			} catch (fallbackError) {
				const errorMsg =
					fallbackError instanceof Error ? fallbackError.message : "Permission denied";
				throw new DownloadError(
					`Cannot create temporary directory.\n\nPrimary location failed: ${primaryTempDir}\nFallback location failed: ${fallbackTempDir}\n\nError: ${errorMsg}\n\nSolutions:\n  1. Check disk space and permissions\n  2. Run with elevated permissions\n  3. Try running from a different directory`,
				);
			}
		}
	}
}
