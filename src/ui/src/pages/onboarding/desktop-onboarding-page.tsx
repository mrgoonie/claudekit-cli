import type React from "react";
import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useI18n } from "../../i18n";
import type { AppLayoutContext } from "../../layouts/app-layout-context";
import * as tauri from "../../lib/tauri-commands";
import { addProject } from "../../services/api";
import { setDesktopOnboardingCompleted } from "../../services/desktop-onboarding-state";
import { buildDesktopScanTargets, dedupeDiscoveredProjects } from "./desktop-onboarding-utils";
import DesktopProjectSelectionList from "./desktop-project-selection-list";

type Step = "welcome" | "discovering" | "selection" | "done";

function isMissingScanTargetError(reason: unknown): boolean {
	const message = reason instanceof Error ? reason.message : String(reason);
	return message.includes("does not exist");
}

const DesktopOnboardingPage: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { reloadProjects, dismissDesktopOnboarding } = useOutletContext<AppLayoutContext>();
	const [step, setStep] = useState<Step>("welcome");
	const [projects, setProjects] = useState<tauri.ProjectInfo[]>([]);
	const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
	const [error, setError] = useState<string | null>(null);
	const [warning, setWarning] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [targetProjectId, setTargetProjectId] = useState<string | null>(null);
	const [partialFailures, setPartialFailures] = useState(0);

	const selectedCount = selectedPaths.size;
	const discoveredCount = projects.length;
	const finishTarget = useMemo(
		() => (targetProjectId ? `/project/${targetProjectId}` : "/"),
		[targetProjectId],
	);

	const togglePath = (path: string) => {
		setSelectedPaths((current) => {
			const next = new Set(current);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	};

	const startDiscovery = async () => {
		setError(null);
		setWarning(null);
		setPartialFailures(0);
		setStep("discovering");

		try {
			const homeDir = await tauri.getHomeDir();
			const targets = buildDesktopScanTargets(homeDir);
			const scanned = await Promise.allSettled(
				targets.map((target) => tauri.scanForProjects(target.rootPath, target.maxDepth)),
			);
			const failedScans = scanned.filter(
				(result) => result.status === "rejected" && !isMissingScanTargetError(result.reason),
			).length;
			const discovered = dedupeDiscoveredProjects(
				scanned.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
			);

			setProjects(discovered);
			setSelectedPaths(new Set(discovered.map((project) => project.path)));
			if (failedScans > 0) {
				setWarning(
					t("desktopOnboardingScanPartialWarning").replace("{count}", String(failedScans)),
				);
			}
			setStep("selection");
		} catch (scanError) {
			setError(scanError instanceof Error ? scanError.message : t("desktopOnboardingScanFailed"));
			setStep("selection");
		}
	};

	const completeOnboarding = async (paths: string[]) => {
		setSaving(true);
		setError(null);
		setPartialFailures(0);

		try {
			const results = await Promise.allSettled(paths.map((path) => addProject({ path })));
			const added = results.flatMap((result) =>
				result.status === "fulfilled" ? [result.value] : [],
			);
			const failedCount = results.length - added.length;
			if (paths.length > 0 && added.length === 0) {
				throw new Error(t("desktopOnboardingAddFailed"));
			}

			if (paths.length > 0) {
				await reloadProjects?.();
			}
			await setDesktopOnboardingCompleted(true);
			dismissDesktopOnboarding?.();
			setTargetProjectId(added[0]?.id ?? null);
			setPartialFailures(failedCount);
			setStep("done");
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : t("desktopOnboardingAddFailed"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="mx-auto flex h-full w-full max-w-4xl flex-col justify-center px-4 py-8">
			<div className="rounded-[2rem] border border-dash-border bg-dash-surface p-8 shadow-sm">
				<div className="mb-8 text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-dash-accent-subtle text-3xl">
						CK
					</div>
					<p className="mt-4 text-[10px] font-bold uppercase tracking-[0.3em] text-dash-accent">
						{t("desktopOnboardingEyebrow")}
					</p>
					<h1 className="mt-3 text-3xl font-bold text-dash-text">{t("desktopOnboardingTitle")}</h1>
					<p className="mt-3 text-sm leading-relaxed text-dash-text-muted">
						{step === "done"
							? t("desktopOnboardingDoneDescription")
							: t("desktopOnboardingDescription")}
					</p>
				</div>

				{error ? (
					<div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
						{error}
					</div>
				) : null}
				{warning ? (
					<div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
						{warning}
					</div>
				) : null}

				{step === "welcome" ? (
					<div className="space-y-6 text-center">
						<p className="text-sm text-dash-text-muted">{t("desktopOnboardingWelcomeBody")}</p>
						<div className="flex flex-wrap justify-center gap-3">
							<button
								type="button"
								onClick={() => void completeOnboarding([])}
								className="rounded-xl border border-dash-border px-5 py-3 text-sm font-medium text-dash-text-secondary transition hover:bg-dash-bg"
							>
								{t("desktopOnboardingSkip")}
							</button>
							<button
								type="button"
								onClick={() => void startDiscovery()}
								className="rounded-xl bg-dash-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-dash-accent/90"
							>
								{t("desktopOnboardingStart")}
							</button>
						</div>
					</div>
				) : null}

				{step === "discovering" ? (
					<div className="space-y-4 text-center">
						<div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-dash-accent border-t-transparent" />
						<p className="text-sm font-medium text-dash-text">{t("desktopOnboardingScanning")}</p>
						<p className="text-xs text-dash-text-muted">{t("desktopOnboardingScanningHint")}</p>
					</div>
				) : null}

				{step === "selection" ? (
					<div className="space-y-6">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h2 className="text-lg font-semibold text-dash-text">
									{t("desktopOnboardingSelectTitle")}
								</h2>
								<p className="mt-1 text-sm text-dash-text-muted">
									{discoveredCount > 0
										? t("desktopOnboardingSelectDescription")
										: t("desktopOnboardingNoProjects")}
								</p>
							</div>
							<span className="rounded-full border border-dash-border px-3 py-1 text-xs font-semibold text-dash-text-secondary">
								{t("desktopOnboardingSelectedCount").replace("{count}", String(selectedCount))}
							</span>
						</div>

						{discoveredCount > 0 ? (
							<DesktopProjectSelectionList
								projects={projects}
								selectedPaths={selectedPaths}
								onToggle={togglePath}
							/>
						) : null}

						<div className="flex flex-wrap justify-end gap-3">
							<button
								type="button"
								onClick={() => void completeOnboarding([])}
								className="rounded-xl border border-dash-border px-4 py-2 text-sm font-medium text-dash-text-secondary transition hover:bg-dash-bg"
							>
								{t("desktopOnboardingSkip")}
							</button>
							<button
								type="button"
								onClick={() => void completeOnboarding(Array.from(selectedPaths))}
								disabled={saving || (discoveredCount > 0 && selectedCount === 0)}
								className="rounded-xl bg-dash-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-dash-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{saving ? t("desktopOnboardingSaving") : t("desktopOnboardingContinue")}
							</button>
						</div>
					</div>
				) : null}

				{step === "done" ? (
					<div className="space-y-4 text-center">
						<p className="text-lg font-semibold text-dash-text">
							{t("desktopOnboardingDoneTitle")}
						</p>
						{partialFailures > 0 ? (
							<p className="text-sm text-amber-300">
								{t("desktopOnboardingPartialAddWarning")
									.replace("{failed}", String(partialFailures))
									.replace("{total}", String(selectedCount))}
							</p>
						) : null}
						<button
							type="button"
							onClick={() => navigate(finishTarget, { replace: true })}
							className="rounded-xl bg-dash-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-dash-accent/90"
						>
							{t("desktopOnboardingOpenDashboard")}
						</button>
					</div>
				) : null}
			</div>
		</div>
	);
};

export default DesktopOnboardingPage;
