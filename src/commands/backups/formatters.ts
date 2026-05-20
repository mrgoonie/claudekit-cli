import type { DestructiveOperationBackupSummary } from "@/services/file-operations/destructive-operation-backup-manager.js";

export function formatBytes(sizeBytes: number): string {
	const units = ["B", "KB", "MB", "GB", "TB"];
	let size = sizeBytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatBackupRow(summary: DestructiveOperationBackupSummary): string[] {
	return [
		summary.id,
		summary.valid ? (summary.operation ?? "-") : "invalid",
		summary.valid ? new Date(summary.createdAt as string).toLocaleString() : "-",
		summary.valid ? String(summary.itemCount ?? 0) : "-",
		formatBytes(summary.sizeBytes),
		summary.valid ? "ok" : "invalid",
	];
}
