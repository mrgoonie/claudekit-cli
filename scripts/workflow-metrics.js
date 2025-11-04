#!/usr/bin/env bun

/**
 * Workflow Performance Metrics
 * Tracks and analyzes development workflow performance
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function getFileLines(filePath) {
	try {
		const content = readFileSync(filePath, "utf-8");
		return content.split("\n").length;
	} catch {
		return 0;
	}
}

function analyzeCodebase() {
	const srcDir = "src";
	const testDir = "tests";

	const sourceFiles = execSync(`find ${srcDir} -name "*.ts"`, { encoding: "utf-8" })
		.trim()
		.split("\n")
		.filter(Boolean);

	const testFiles = execSync(`find ${testDir} -name "*.test.ts"`, { encoding: "utf-8" })
		.trim()
		.split("\n")
		.filter(Boolean);

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

	if (metrics.testToCodeRatio > 3) {
		recommendations.push(
			`🔴 High test-to-code ratio (${metrics.testToCodeRatio.toFixed(1)}:1). Consider test optimization.`,
		);
	} else if (metrics.testToCodeRatio > 2) {
		recommendations.push(
			`🟡 Moderate test-to-code ratio (${metrics.testToCodeRatio.toFixed(1)}:1). Monitor for optimization.`,
		);
	} else {
		recommendations.push(`🟢 Good test-to-code ratio (${metrics.testToCodeRatio.toFixed(1)}:1).`);
	}

	if (metrics.largestFile.lines > 1000) {
		recommendations.push(
			`🔴 Large file detected: ${metrics.largestFile.path} (${metrics.largestFile.lines} lines). Consider splitting.`,
		);
	} else if (metrics.largestFile.lines > 800) {
		recommendations.push(
			`🟡 File getting large: ${metrics.largestFile.path} (${metrics.largestFile.lines} lines).`,
		);
	}

	if (metrics.avgFileSize > 500) {
		recommendations.push(
			`🔴 High average file size: ${metrics.avgFileSize.toFixed(0)} lines. Consider refactoring.`,
		);
	}

	if (metrics.testLines > metrics.codeLines * 1.5) {
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
		if (metrics.testToCodeRatio > 3) score -= 20;
		if (metrics.testToCodeRatio > 2) score -= 10;
		if (metrics.largestFile.lines > 1000) score -= 15;
		if (metrics.largestFile.lines > 800) score -= 8;
		if (metrics.avgFileSize > 500) score -= 10;
		if (metrics.testLines > metrics.codeLines * 1.5) score -= 15;

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
