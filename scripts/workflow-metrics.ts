#!/usr/bin/env bun

/**
 * Workflow Performance Metrics
 *
 * Analyzes development workflow performance by examining codebase metrics.
 * Provides recommendations for improving code quality and workflow efficiency.
 *
 * @author ClaudeKit CLI
 * @version 1.0.0
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

// Constants for thresholds and limits
const THRESHOLDS = {
	TEST_RATIO_HIGH: 3,
	TEST_RATIO_MODERATE: 2,
	FILE_SIZE_LARGE: 1000,
	FILE_SIZE_WARNING: 800,
	AVG_FILE_SIZE_HIGH: 500,
	TEST_OVERSIZE_RATIO: 1.5,
} as const;

interface FileStats {
	path: string;
	lines: number;
}

interface Metrics {
	filesAnalyzed: number;
	totalLines: number;
	testLines: number;
	codeLines: number;
	testToCodeRatio: number;
	avgFileSize: number;
	largestFile: FileStats;
	smallestFile: FileStats;
}

/**
 * Safely counts lines in a file
 * @param filePath - Path to the file to analyze
 * @returns Number of lines in the file, or 0 if file cannot be read
 */
function getFileLines(filePath: string): number {
	try {
		// Validate file path
		if (typeof filePath !== "string" || !filePath.trim()) {
			throw new Error("Invalid file path");
		}

		// Security check: ensure path doesn't contain dangerous characters
		if (filePath.includes("..") || filePath.includes("~")) {
			throw new Error("Unsafe file path");
		}

		const content = readFileSync(filePath, "utf-8");
		return content.split("\n").length;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.warn(`Warning: Could not read file ${filePath}: ${errorMessage}`);
		return 0;
	}
}

/**
 * Recursively finds files matching a pattern in a directory
 * @param dir - Directory to search
 * @param pattern - File pattern to match ("*.ts" or "*.test.ts")
 * @returns Array of file paths matching the pattern
 */
function findFiles(dir: string, pattern: string): string[] {
	try {
		if (!existsSync(dir)) {
			console.warn(`Warning: Directory ${dir} does not exist`);
			return [];
		}

		const files: string[] = [];

		function scanDirectory(currentDir: string): void {
			const entries = readdirSync(currentDir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(currentDir, entry.name);

				if (entry.isDirectory()) {
					// Skip node_modules and .git directories for security and performance
					if (entry.name !== "node_modules" && entry.name !== ".git") {
						scanDirectory(fullPath);
					}
				} else if (entry.isFile()) {
					// Check if file matches pattern
					if (pattern === "*.ts" && extname(entry.name) === ".ts") {
						// Exclude test files from source files
						if (!entry.name.endsWith(".test.ts")) {
							files.push(fullPath);
						}
					} else if (pattern === "*.test.ts" && entry.name.endsWith(".test.ts")) {
						files.push(fullPath);
					}
				}
			}
		}

		scanDirectory(dir);
		return files;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Error scanning directory ${dir}: ${errorMessage}`);
		return [];
	}
}

/**
 * Analyzes the codebase and generates performance metrics
 * @returns Metrics object containing codebase analysis
 */
function analyzeCodebase(): Metrics {
	const srcDir = "src";
	const testDir = "tests";

	// Use safer file discovery
	const sourceFiles = findFiles(srcDir, "*.ts");
	const testFiles = findFiles(testDir, "*.test.ts");

	const allFiles = [...sourceFiles, ...testFiles];
	const fileStats: FileStats[] = allFiles.map((path) => ({
		path,
		lines: getFileLines(path),
	}));

	const totalLines = fileStats.reduce((sum, file) => sum + file.lines, 0);
	const testLines = testFiles.reduce((sum, path) => sum + getFileLines(path), 0);
	const codeLines = sourceFiles.reduce((sum, path) => sum + getFileLines(path), 0);

	const sortedFiles = fileStats.sort((a, b) => b.lines - a.lines);

	return {
		filesAnalyzed: allFiles.length,
		totalLines,
		testLines,
		codeLines,
		testToCodeRatio: codeLines > 0 ? testLines / codeLines : 0,
		avgFileSize: allFiles.length > 0 ? totalLines / allFiles.length : 0,
		largestFile: sortedFiles[0] || { path: "", lines: 0 },
		smallestFile: sortedFiles[sortedFiles.length - 1] || { path: "", lines: 0 },
	};
}

/**
 * Generates recommendations based on metrics analysis
 * @param metrics - Metrics object from analyzeCodebase
 * @returns Array of recommendation strings
 */
function generateRecommendations(metrics: Metrics): string[] {
	const recommendations: string[] = [];

	if (metrics.testToCodeRatio > THRESHOLDS.TEST_RATIO_HIGH) {
		recommendations.push(
			`🔴 High test-to-code ratio (${metrics.testToCodeRatio.toFixed(1)}:1). Consider test optimization.`,
		);
	} else if (metrics.testToCodeRatio > THRESHOLDS.TEST_RATIO_MODERATE) {
		recommendations.push(
			`🟡 Moderate test-to-code ratio (${metrics.testToCodeRatio.toFixed(1)}:1). Monitor for optimization.`,
		);
	} else {
		recommendations.push(`🟢 Good test-to-code ratio (${metrics.testToCodeRatio.toFixed(1)}:1).`);
	}

	if (metrics.largestFile.lines > THRESHOLDS.FILE_SIZE_LARGE) {
		recommendations.push(
			`🔴 Large file detected: ${metrics.largestFile.path} (${metrics.largestFile.lines} lines). Consider splitting.`,
		);
	} else if (metrics.largestFile.lines > THRESHOLDS.FILE_SIZE_WARNING) {
		recommendations.push(
			`🟡 File getting large: ${metrics.largestFile.path} (${metrics.largestFile.lines} lines).`,
		);
	}

	if (metrics.avgFileSize > THRESHOLDS.AVG_FILE_SIZE_HIGH) {
		recommendations.push(
			`🔴 High average file size: ${metrics.avgFileSize.toFixed(0)} lines. Consider refactoring.`,
		);
	}

	if (metrics.testLines > metrics.codeLines * THRESHOLDS.TEST_OVERSIZE_RATIO) {
		recommendations.push("🔴 Tests significantly larger than code. Review test efficiency.");
	}

	if (recommendations.length === 0) {
		recommendations.push("🟢 Codebase metrics look healthy!");
	}

	return recommendations;
}

/**
 * Main function to run the metrics analysis
 */
function main(): void {
	console.log("📊 Workflow Performance Metrics Analysis");
	console.log("=".repeat(40));

	try {
		const metrics = analyzeCodebase();
		const recommendations = generateRecommendations(metrics);

		console.log(`\n📁 Files Analyzed: ${metrics.filesAnalyzed}`);
		console.log(`📄 Total Lines: ${metrics.totalLines.toLocaleString()}`);
		console.log(`💻 Code Lines: ${metrics.codeLines.toLocaleString()}`);
		console.log(`🧪 Test Lines: ${metrics.testLines.toLocaleString()}`);
		console.log(`📏 Test/Code Ratio: ${metrics.testToCodeRatio.toFixed(2)}:1`);
		console.log(`📊 Avg File Size: ${metrics.avgFileSize.toFixed(0)} lines`);
		console.log(
			`📈 Largest File: ${metrics.largestFile.path} (${metrics.largestFile.lines} lines)`,
		);
		console.log(
			`📉 Smallest File: ${metrics.smallestFile.path} (${metrics.smallestFile.lines} lines)`,
		);

		console.log("\n💡 Recommendations:");
		recommendations.forEach((rec) => console.log(`  ${rec}`));

		// Performance score calculation (0-100)
		let score = 100;
		if (metrics.testToCodeRatio > THRESHOLDS.TEST_RATIO_HIGH) score -= 20;
		if (metrics.testToCodeRatio > THRESHOLDS.TEST_RATIO_MODERATE) score -= 10;
		if (metrics.largestFile.lines > THRESHOLDS.FILE_SIZE_LARGE) score -= 15;
		if (metrics.largestFile.lines > THRESHOLDS.FILE_SIZE_WARNING) score -= 8;
		if (metrics.avgFileSize > THRESHOLDS.AVG_FILE_SIZE_HIGH) score -= 10;
		if (metrics.testLines > metrics.codeLines * THRESHOLDS.TEST_OVERSIZE_RATIO) score -= 15;

		const grade = score >= 90 ? "🟢 A" : score >= 80 ? "🟡 B" : score >= 70 ? "🟠 C" : "🔴 D";
		console.log(`\n🎯 Performance Score: ${grade} (${score}/100)`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("❌ Error analyzing codebase:", errorMessage);
		process.exit(1);
	}
}

// Run the analysis if this script is executed directly
if (import.meta.main) {
	main();
}