/**
 * Tests for InstallPicker component (P4)
 * - Renders groups by type in TYPE_ORDER
 * - Select-all and deselect-all per group
 * - Global select/deselect all
 * - buildDefaultSelectedSet — all items checked by default
 * - buildSyntheticPlan — only selected candidates in output
 * - Directory items labelled with "dir" badge
 * - Already-installed items labelled accordingly
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../i18n";
import type { InstallCandidate } from "../../../types/reconcile-types";
import { InstallPicker, buildDefaultSelectedSet, buildSyntheticPlan } from "../install-picker";

// I18nProvider reads localStorage on init — stub it for jsdom env
beforeEach(() => {
	const store: Record<string, string> = {};
	vi.stubGlobal("localStorage", {
		getItem: (k: string) => store[k] ?? null,
		setItem: (k: string, v: string) => {
			store[k] = v;
		},
		removeItem: (k: string) => {
			delete store[k];
		},
		clear: () => {
			for (const k of Object.keys(store)) delete store[k];
		},
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

function makeCandidate(
	overrides: Partial<InstallCandidate> & { item: string; type: InstallCandidate["type"] },
): InstallCandidate {
	return {
		provider: "codex",
		global: true,
		isDirectoryItem: false,
		sourcePath: `/src/${overrides.item}`,
		alreadyInstalled: false,
		...overrides,
	};
}

const CANDIDATES: InstallCandidate[] = [
	makeCandidate({ item: "planner", type: "agent" }),
	makeCandidate({ item: "researcher", type: "agent", alreadyInstalled: true }),
	makeCandidate({ item: "/ck:plan", type: "command" }),
	makeCandidate({ item: "ck-plan", type: "skill", isDirectoryItem: true }),
];

function renderPicker(
	props: {
		candidates?: InstallCandidate[];
		selected?: Set<string>;
		onSelectionChange?: (s: Set<string>) => void;
		onInstall?: (s: Set<string>) => void;
		isInstalling?: boolean;
	} = {},
) {
	const onSelectionChange = props.onSelectionChange ?? vi.fn();
	const onInstall = props.onInstall ?? vi.fn();
	const candidates = props.candidates ?? CANDIDATES;
	const selected = props.selected ?? buildDefaultSelectedSet(candidates);

	render(
		<I18nProvider>
			<InstallPicker
				candidates={candidates}
				selected={selected}
				onSelectionChange={onSelectionChange}
				onInstall={onInstall}
				isInstalling={props.isInstalling}
			/>
		</I18nProvider>,
	);
	return { onSelectionChange, onInstall, candidates, selected };
}

// Helper: derive the same key logic used in the component
function candidateKey(c: InstallCandidate): string {
	return `${c.provider}::${c.type}::${c.item}::${String(c.global)}`;
}

describe("InstallPicker — rendering", () => {
	it("renders a group section for each type present", () => {
		renderPicker();
		// Agents, Commands, Skills headers should appear
		expect(screen.getByText("Subagents")).toBeInTheDocument();
		expect(screen.getByText("Commands")).toBeInTheDocument();
		expect(screen.getByText("Skills")).toBeInTheDocument();
	});

	it("renders a checkbox for each candidate", () => {
		renderPicker();
		const checkboxes = screen.getAllByRole("checkbox");
		expect(checkboxes).toHaveLength(CANDIDATES.length);
	});

	it("shows dir badge for isDirectoryItem candidates", () => {
		renderPicker();
		// "dir" badge should appear for ck-plan skill
		expect(screen.getByText("dir")).toBeInTheDocument();
	});

	it("shows installed badge for alreadyInstalled candidates", () => {
		renderPicker();
		expect(screen.getByText("installed")).toBeInTheDocument();
	});

	it("shows empty state when no candidates", () => {
		renderPicker({ candidates: [], selected: new Set() });
		expect(screen.getByText(/no installable items/i)).toBeInTheDocument();
	});
});

describe("InstallPicker — selection", () => {
	it("all items checked by default via buildDefaultSelectedSet", () => {
		const selected = buildDefaultSelectedSet(CANDIDATES);
		expect(selected.size).toBe(CANDIDATES.length);
		for (const c of CANDIDATES) {
			expect(selected.has(candidateKey(c))).toBe(true);
		}
	});

	it("toggles a single item on checkbox change", () => {
		const selected = buildDefaultSelectedSet(CANDIDATES);
		const onSelectionChange = vi.fn();
		renderPicker({ selected, onSelectionChange });

		// Uncheck "planner"
		const plannerCheckbox = screen.getByRole("checkbox", { name: /planner from codex/i });
		fireEvent.click(plannerCheckbox);

		expect(onSelectionChange).toHaveBeenCalledOnce();
		const [nextSet] = onSelectionChange.mock.calls[0] as [Set<string>];
		expect(nextSet.has(candidateKey(CANDIDATES[0]))).toBe(false);
		// Other items still selected
		expect(nextSet.size).toBe(CANDIDATES.length - 1);
	});

	it("deselect-all in a group removes only that group's keys", () => {
		const selected = buildDefaultSelectedSet(CANDIDATES);
		const onSelectionChange = vi.fn();
		renderPicker({ selected, onSelectionChange });

		// All "Deselect all" buttons: first is global, then one per type group (agents first)
		// TYPE_ORDER = agent, command, skill — so groups index: 0=global, 1=agents, 2=commands, 3=skills
		const deselectBtns = screen.getAllByRole("button", { name: /deselect all/i });
		// Index 1 = Agents group deselect-all (after the global one at index 0)
		fireEvent.click(deselectBtns[1]);

		expect(onSelectionChange).toHaveBeenCalledOnce();
		const [nextSet] = onSelectionChange.mock.calls[0] as [Set<string>];

		// Agent candidates removed
		const agentCandidates = CANDIDATES.filter((c) => c.type === "agent");
		for (const c of agentCandidates) {
			expect(nextSet.has(candidateKey(c))).toBe(false);
		}
		// Non-agent candidates still selected
		const otherCandidates = CANDIDATES.filter((c) => c.type !== "agent");
		for (const c of otherCandidates) {
			expect(nextSet.has(candidateKey(c))).toBe(true);
		}
	});

	it("global deselect-all clears the entire selection", () => {
		const selected = buildDefaultSelectedSet(CANDIDATES);
		const onSelectionChange = vi.fn();
		renderPicker({ selected, onSelectionChange });

		// Global deselect all button (outside any type group, at top)
		const deselectAllBtns = screen.getAllByRole("button", { name: /deselect all/i });
		// First one is the global control
		fireEvent.click(deselectAllBtns[0]);
		expect(onSelectionChange).toHaveBeenCalledOnce();
		const [nextSet] = onSelectionChange.mock.calls[0] as [Set<string>];
		expect(nextSet.size).toBe(0);
	});

	it("global select-all fills the entire selection", () => {
		const onSelectionChange = vi.fn();
		renderPicker({ selected: new Set(), onSelectionChange });

		const selectAllBtns = screen.getAllByRole("button", { name: /^select all$/i });
		fireEvent.click(selectAllBtns[0]);
		expect(onSelectionChange).toHaveBeenCalledOnce();
		const [nextSet] = onSelectionChange.mock.calls[0] as [Set<string>];
		expect(nextSet.size).toBe(CANDIDATES.length);
	});
});

describe("InstallPicker — CTA", () => {
	it("CTA is disabled when nothing is selected", () => {
		renderPicker({ selected: new Set() });
		const installBtn = screen.getByRole("button", { name: /install 0 selected/i });
		expect(installBtn).toBeDisabled();
	});

	it("CTA shows count of selected items", () => {
		const selected = buildDefaultSelectedSet(CANDIDATES);
		renderPicker({ selected });
		expect(
			screen.getByRole("button", {
				name: new RegExp(`install ${CANDIDATES.length} selected`, "i"),
			}),
		).toBeInTheDocument();
	});

	it("calls onInstall with selected set on CTA click", () => {
		const selected = buildDefaultSelectedSet(CANDIDATES);
		const onInstall = vi.fn();
		renderPicker({ selected, onInstall });
		const installBtn = screen.getByRole("button", {
			name: new RegExp(`install ${CANDIDATES.length} selected`, "i"),
		});
		fireEvent.click(installBtn);
		expect(onInstall).toHaveBeenCalledWith(selected);
	});

	it("shows 'Installing...' text when isInstalling is true", () => {
		const selected = buildDefaultSelectedSet(CANDIDATES);
		renderPicker({ selected, isInstalling: true });
		expect(screen.getByRole("button", { name: /installing/i })).toBeInTheDocument();
	});
});

describe("buildSyntheticPlan", () => {
	it("returns only selected candidates as install actions", () => {
		const allKeys = buildDefaultSelectedSet(CANDIDATES);
		// Deselect the researcher
		const researcherKey = candidateKey(CANDIDATES[1]);
		allKeys.delete(researcherKey);

		const plan = buildSyntheticPlan(CANDIDATES, allKeys);
		expect(plan.actions).toHaveLength(CANDIDATES.length - 1);
		expect(plan.actions.every((a) => a.action === "install")).toBe(true);
		expect(plan.actions.find((a) => a.item === "researcher")).toBeUndefined();
	});

	it("summary.install equals selected count", () => {
		const keys = buildDefaultSelectedSet(CANDIDATES);
		const plan = buildSyntheticPlan(CANDIDATES, keys);
		expect(plan.summary.install).toBe(keys.size);
		expect(plan.summary.update).toBe(0);
		expect(plan.summary.skip).toBe(0);
		expect(plan.hasConflicts).toBe(false);
	});

	it("all actions have reasonCode 'new-item'", () => {
		const keys = buildDefaultSelectedSet(CANDIDATES);
		const plan = buildSyntheticPlan(CANDIDATES, keys);
		for (const action of plan.actions) {
			expect(action.reasonCode).toBe("new-item");
		}
	});

	it("directory items preserve isDirectoryItem flag", () => {
		const keys = buildDefaultSelectedSet(CANDIDATES);
		const plan = buildSyntheticPlan(CANDIDATES, keys);
		const skillAction = plan.actions.find((a) => a.item === "ck-plan");
		expect(skillAction?.isDirectoryItem).toBe(true);
	});

	it("returns empty actions when nothing selected", () => {
		const plan = buildSyntheticPlan(CANDIDATES, new Set());
		expect(plan.actions).toHaveLength(0);
		expect(plan.summary.install).toBe(0);
	});
});
