import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildPlanSummary } from "./index.js";
import { parseEffortHours, readPhaseMetadata } from "./plan-metadata.js";
import type { TimelineData, TimelinePhase } from "./plan-types.js";

const DAY_MS = 86_400_000;
const MIN_BAR_PCT = 2;

interface PhaseDraft {
	phaseId: string;
	name: string;
	status: TimelinePhase["status"];
	file: string;
	effort?: string;
	startDate: string | null;
	endDate: string | null;
}

function toDate(value?: string | null): Date | null {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date): Date {
	const copy = new Date(date);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function overlaps(a: TimelinePhase, b: TimelinePhase): boolean {
	return a.leftPct < b.leftPct + b.widthPct && b.leftPct < a.leftPct + a.widthPct;
}

function assignLayers(phases: TimelinePhase[]): TimelinePhase[] {
	const layers: TimelinePhase[][] = [];
	return phases.map((phase) => {
		let layerIndex = 0;
		while (layers[layerIndex]?.some((existing) => overlaps(existing, phase))) {
			layerIndex += 1;
		}
		if (!layers[layerIndex]) layers[layerIndex] = [];
		const layeredPhase = { ...phase, layer: layerIndex };
		layers[layerIndex].push(layeredPhase);
		return layeredPhase;
	});
}

export function buildTimelineData(planDir: string): TimelineData {
	const planFile = join(planDir, "plan.md");
	const summary = buildPlanSummary(planFile);
	const today = startOfDay(new Date());

	const drafts = summary.phases
		.filter((phase) => existsSync(phase.file))
		.map((phase) => {
			const meta = readPhaseMetadata(phase.file);
			const startDate = toDate(meta.created) ?? toDate(meta.lastModified) ?? today;
			const endCandidate =
				phase.status === "completed"
					? (toDate(meta.completed) ?? toDate(meta.lastModified) ?? startDate)
					: phase.status === "in-progress"
						? today
						: startDate;
			const endDate = endCandidate.getTime() < startDate.getTime() ? startDate : endCandidate;
			return {
				phaseId: phase.phaseId,
				name: meta.title ?? phase.name,
				status: meta.status ?? phase.status,
				file: phase.file,
				effort: meta.effort,
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
			} satisfies PhaseDraft;
		})
		.sort((left, right) => (left.startDate ?? "").localeCompare(right.startDate ?? ""));

	const phaseStarts = drafts
		.map((phase) => toDate(phase.startDate))
		.filter((date): date is Date => date !== null);
	const phaseEnds = drafts
		.map((phase) => toDate(phase.endDate))
		.filter((date): date is Date => date !== null);

	const earliestStart =
		phaseStarts.length > 0
			? new Date(Math.min(...phaseStarts.map((date) => date.getTime())))
			: today;
	const latestEnd =
		phaseEnds.length > 0 ? new Date(Math.max(...phaseEnds.map((date) => date.getTime()))) : today;

	const rangeStart = startOfDay(new Date(earliestStart.getTime() - DAY_MS * 7));
	const rangeEnd = startOfDay(
		new Date(Math.max(latestEnd.getTime(), today.getTime()) + DAY_MS * 7),
	);
	const rangeDuration = Math.max(1, rangeEnd.getTime() - rangeStart.getTime());

	const phases = drafts.map((phase) => {
		const startDate = toDate(phase.startDate) ?? today;
		const endDate = toDate(phase.endDate) ?? startDate;
		const leftPct = clamp(
			((startDate.getTime() - rangeStart.getTime()) / rangeDuration) * 100,
			0,
			100,
		);
		const widthPct = clamp(
			Math.max(
				((endDate.getTime() - startDate.getTime() + DAY_MS) / rangeDuration) * 100,
				MIN_BAR_PCT,
			),
			MIN_BAR_PCT,
			100 - leftPct,
		);
		return {
			...phase,
			layer: 0,
			leftPct,
			widthPct,
		} satisfies TimelinePhase;
	});

	const layeredPhases = assignLayers(phases);
	const totalEffortHours = layeredPhases.reduce(
		(sum, phase) => sum + parseEffortHours(phase.effort),
		0,
	);
	const avgDurationDays =
		layeredPhases.length === 0
			? 0
			: layeredPhases.reduce((sum, phase) => {
					const startDate = toDate(phase.startDate);
					const endDate = toDate(phase.endDate);
					if (!startDate || !endDate) return sum;
					return (
						sum + Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1)
					);
				}, 0) / layeredPhases.length;

	return {
		rangeStart: rangeStart.toISOString(),
		rangeEnd: rangeEnd.toISOString(),
		today: today.toISOString(),
		todayPct: clamp(((today.getTime() - rangeStart.getTime()) / rangeDuration) * 100, 0, 100),
		layerCount: layeredPhases.reduce((max, phase) => Math.max(max, phase.layer + 1), 0),
		phases: layeredPhases,
		summary: {
			totalEffortHours,
			avgDurationDays,
			completionRate: summary.progressPct,
		},
	};
}
