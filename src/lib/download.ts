import cliProgress from 'cli-progress';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import ora from 'ora';
import * as tar from 'tar';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream';
import unzipper from 'unzipper';
import { DownloadError, ExtractionError, type ArchiveType, type GitHubReleaseAsset } from '../types.js';
import { logger } from '../utils/logger.js';

const streamPipeline = promisify(pipeline);

export class DownloadManager {
  /**
   * Download asset from URL with progress tracking
   */
  async downloadAsset(asset: GitHubReleaseAsset, destDir: string): Promise<string> {
    try {
      const destPath = join(destDir, asset.name);

      // Ensure destination directory exists
      await mkdir(destDir, { recursive: true });

      logger.info(`Downloading ${asset.name} (${this.formatBytes(asset.size)})...`);

      // Create progress bar
      const progressBar = new cliProgress.SingleBar({
        format: 'Progress |{bar}| {percentage}% | {value}/{total} MB',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
      });

      const response = await fetch(asset.browser_download_url, {
        headers: {
          'Accept': 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new DownloadError(`Failed to download: ${response.statusText}`);
      }

      const totalSize = asset.size;
      let downloadedSize = 0;

      progressBar.start(Math.round(totalSize / 1024 / 1024), 0);

      const fileStream = createWriteStream(destPath);
      const reader = response.body?.getReader();

      if (!reader) {
        throw new DownloadError('Failed to get response reader');
      }

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          fileStream.write(value);
          downloadedSize += value.length;
          progressBar.update(Math.round(downloadedSize / 1024 / 1024));
        }

        fileStream.end();
        progressBar.stop();

        logger.success(`Downloaded ${asset.name}`);
        return destPath;
      } catch (error) {
        fileStream.close();
        progressBar.stop();
        throw error;
      }
    } catch (error) {
      throw new DownloadError(
        `Failed to download ${asset.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract archive to destination
   */
  async extractArchive(archivePath: string, destDir: string, archiveType?: ArchiveType): Promise<void> {
    const spinner = ora('Extracting files...').start();

    try {
      // Detect archive type from filename if not provided
      const detectedType = archiveType || this.detectArchiveType(archivePath);

      // Ensure destination directory exists
      await mkdir(destDir, { recursive: true });

      if (detectedType === 'tar.gz') {
        await this.extractTarGz(archivePath, destDir);
      } else if (detectedType === 'zip') {
        await this.extractZip(archivePath, destDir);
      } else {
        throw new ExtractionError(`Unsupported archive type: ${detectedType}`);
      }

      spinner.succeed('Files extracted successfully');
    } catch (error) {
      spinner.fail('Extraction failed');
      throw new ExtractionError(
        `Failed to extract archive: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract tar.gz archive
   */
  private async extractTarGz(archivePath: string, destDir: string): Promise<void> {
    await tar.extract({
      file: archivePath,
      cwd: destDir,
      strip: 1, // Strip the root directory from the archive
    });
  }

  /**
   * Extract zip archive
   */
  private async extractZip(archivePath: string, destDir: string): Promise<void> {
    await streamPipeline(
      createReadStream(archivePath),
      unzipper.Extract({ path: destDir })
    );
  }

  /**
   * Detect archive type from filename
   */
  private detectArchiveType(filename: string): ArchiveType {
    if (filename.endsWith('.tar.gz') || filename.endsWith('.tgz')) {
      return 'tar.gz';
    }
    if (filename.endsWith('.zip')) {
      return 'zip';
    }
    throw new ExtractionError(`Cannot detect archive type from filename: ${filename}`);
  }

  /**
   * Create temporary download directory
   */
  async createTempDir(): Promise<string> {
    const tempDir = join(tmpdir(), `claudekit-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
  }
}
