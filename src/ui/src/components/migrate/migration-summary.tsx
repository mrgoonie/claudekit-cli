/**
 * MigrationSummary — post-execution summary display
 * Shows success/failure counts and detailed results
 */

import type { MigrationResultEntry } from "@/types";
import type React from "react";
import type { MigrationResults } from "../../hooks/useMigrationPlan";
import { useI18n } from "../../i18n";

interface MigrationSummaryProps {
	results: MigrationResults;
	onReset: () => void;
}

function isDisallowedControlCode(codePoint: number): boolean {
	return (
		(codePoint >= 0x00 && codePoint <= 0x08) ||
		(codePoint >= 0x0b && codePoint <= 0x1f) ||
		(codePoint >= 0x7f && codePoint <= 0x9f)
	);
}

function sanitizeDisplayString(value: string): string {
	let output = "";
	for (const char of value) {
		const codePoint = char.codePointAt(0);
		if (codePoint === undefined) continue;
		if (!isDisallowedControlCode(codePoint)) {
			output += char;
		}
	}
	return output;
}

export const MigrationSummary: React.FC<MigrationSummaryProps> = ({ results, onReset }) => {
	const { t } = useI18n();

	return (
		<div className="space-y-4">
			<div className="dash-panel p-5">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold text-dash-text">{t("migrateSummaryTitle")}</h2>
					<button
						type="button"
						onClick={onReset}
						className="dash-focus-ring px-4 py-2 text-sm font-medium rounded-md bg-dash-bg border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
					>
						{t("migrateSummaryNewMigration")}
					</button>
				</div>

				{/* Stats grid */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
					<div className="px-4 py-3 bg-dash-bg border border-dash-border rounded-md">
						<p className="text-xs uppercase tracking-wide text-dash-text-muted">
							{t("migrateInstalled")}
						</p>
						<p className="text-2xl font-semibold text-green-400 mt-1">{results.counts.installed}</p>
					</div>
					<div className="px-4 py-3 bg-dash-bg border border-dash-border rounded-md">
						<p className="text-xs uppercase tracking-wide text-dash-text-muted">
							{t("migrateSkipped")}
						</p>
						<p className="text-2xl font-semibold text-yellow-400 mt-1">{results.counts.skipped}</p>
					</div>
					<div className="px-4 py-3 bg-dash-bg border border-dash-border rounded-md">
						<p className="text-xs uppercase tracking-wide text-dash-text-muted">
							{t("migrateFailed")}
						</p>
						<p className="text-2xl font-semibold text-red-400 mt-1">{results.counts.failed}</p>
					</div>
				</div>

				{/* Warnings */}
				{results.warnings.length > 0 && (
					<div className="mb-4 space-y-2">
						{results.warnings.map((warning, index) => (
							<div
								key={index}
								className="px-3 py-2 border border-yellow-500/30 bg-yellow-500/10 rounded text-xs text-yellow-400"
							>
								{sanitizeDisplayString(warning)}
							</div>
						))}
					</div>
				)}

				{/* Results table */}
				{results.results.length > 0 && (
					<div className="overflow-auto border border-dash-border rounded-md">
						<table className="min-w-full text-xs">
							<thead className="bg-dash-bg text-dash-text-muted uppercase tracking-wide">
								<tr>
									<th className="text-left px-3 py-2">{t("migrateProvider")}</th>
									<th className="text-left px-3 py-2">{t("migrateType")}</th>
									<th className="text-left px-3 py-2">{t("migrateItem")}</th>
									<th className="text-left px-3 py-2">{t("migrateStatus")}</th>
									<th className="text-left px-3 py-2">{t("migratePath")}</th>
									<th className="text-left px-3 py-2">{t("migrateError")}</th>
								</tr>
							</thead>
							<tbody>
								{results.results.map((result, index) => {
									const statusData = getResultStatusLabel(result, t);
									return (
										<tr
											key={`${result.provider}:${result.path}:${index}`}
											className={index % 2 === 1 ? "bg-dash-bg/40" : undefined}
										>
											<td className="px-3 py-2 border-t border-dash-border">
												{sanitizeDisplayString(result.providerDisplayName || result.provider)}
											</td>
											<td className="px-3 py-2 border-t border-dash-border text-dash-text-muted">
												{sanitizeDisplayString((result as { type?: string }).type || "-")}
											</td>
											<td className="px-3 py-2 border-t border-dash-border font-mono">
												{sanitizeDisplayString((result as { item?: string }).item || "-")}
											</td>
											<td
												className={`px-3 py-2 border-t border-dash-border ${statusData.className}`}
											>
												{statusData.label}
											</td>
											<td className="px-3 py-2 border-t border-dash-border text-dash-text-muted font-mono text-[10px]">
												{sanitizeDisplayString(result.path || "-")}
											</td>
											<td className="px-3 py-2 border-t border-dash-border text-red-400">
												{sanitizeDisplayString(result.error || result.skipReason || "-")}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
};

function getResultStatusLabel(
	result: MigrationResultEntry,
	t: {
		(key: "migrateStatusFailed"): string;
		(key: "migrateStatusSkipped"): string;
		(key: "migrateStatusInstalled"): string;
	},
): { label: string; className: string } {
	if (!result.success) {
		return { label: t("migrateStatusFailed"), className: "text-red-400" };
	}
	if (result.skipped) {
		return { label: t("migrateStatusSkipped"), className: "text-yellow-400" };
	}
	return { label: t("migrateStatusInstalled"), className: "text-green-400" };
}
