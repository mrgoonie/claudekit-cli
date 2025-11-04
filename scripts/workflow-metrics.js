#!/usr/bin/env bun

/**
 * Workflow Performance Metrics
 * Tracks and analyzes development workflow performance
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

// Constants for thresholds
const THRESHOLDS = {
	TEST_RATIO_HIGH: 3,
	TEST_RATIO_MODERATE: 2,
	FILE_SIZE_LARGE: 1000,
	FILE_SIZE_WARNING: 800,
	AVG_FILE_SIZE_HIGH: 500,
	TEST_OVERSIZE_RATIO: 1.5,
};

function getFileLines(filePath) {
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
		console.warn(`Warning: Could not read file ${filePath}: ${error.message}`);
		return 0;
	}
}

function findFiles(dir, pattern) {
	try {
		if (!existsSync(dir)) {
			console.warn(`Warning: Directory ${dir} does not exist`);
			return [];
		}

		const files = [];

		function scanDirectory(currentDir) {
			const entries = readdirSync(currentDir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(currentDir, entry.name);

				if (entry.isDirectory()) {
					// Skip node_modules and .git directories
					if (entry.name !== "node_modules" && entry.name !== ".git") {
						scanDirectory(fullPath);
					}
				} else if (entry.isFile()) {
					// Check if file matches pattern
					if (pattern === "*.ts" && extname(entry.name) === ".ts") {
						files.push(fullPath);
					} else if (pattern === "*.test.ts" && entry.name.endsWith(".test.ts")) {
						files.push(fullPath);
					}
				}
			}
		}

		scanDirectory(dir);
		return files;
	} catch (error) {
		console.error(`Error scanning directory ${dir}: ${error.message}`);
		return [];
	}
}

function analyzeCodebase() {
	const srcDir = "src";
	const testDir = "tests";

	// Use safer file discovery
	const sourceFiles = findFiles(srcDir, "*.ts");
	const testFiles = findFiles(testDir, "*.test.ts");

	const allFiles = [...sourceFiles, ...testFiles];
	const fileStats = allFiles.map((path) => ({
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

function generateRecommendations(metrics) {
	const recommendations = [];

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

function main() {
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

		// Performance score (0-100)
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
		console.error("❌ Error analyzing codebase:", error);
		process.exit(1);
	}
}

if (import.meta.main) {
	main();
}
