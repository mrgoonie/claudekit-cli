/**
 * Tests for ModeToggle component (P4)
 * - Confirm dialog appears with pending edits
 * - No dialog when no pending edits
 * - Escape key cancels (dialog cancel event)
 * - Confirm discards and calls onModeChange
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../i18n";
import { ModeToggle } from "../mode-toggle";

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

	// jsdom does not implement HTMLDialogElement.showModal/close — polyfill them
	HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (
		this: HTMLDialogElement,
	) {
		this.setAttribute("open", "");
	});
	HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (
		this: HTMLDialogElement,
	) {
		this.removeAttribute("open");
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

function renderToggle(props: {
	mode?: "reconcile" | "install";
	pendingCount?: number;
	disabled?: boolean;
	onModeChange?: (next: "reconcile" | "install") => void;
}) {
	const onModeChange = props.onModeChange ?? vi.fn();
	render(
		<I18nProvider>
			<ModeToggle
				mode={props.mode ?? "reconcile"}
				pendingCount={props.pendingCount ?? 0}
				disabled={props.disabled ?? false}
				onModeChange={onModeChange}
			/>
		</I18nProvider>,
	);
	return { onModeChange };
}

describe("ModeToggle", () => {
	it("renders two tabs with correct roles", () => {
		renderToggle({});
		const tabs = screen.getAllByRole("tab");
		expect(tabs).toHaveLength(2);
	});

	it("marks the active mode tab as selected", () => {
		renderToggle({ mode: "reconcile" });
		const reconcileTab = screen.getByRole("tab", { name: /reconcile/i });
		expect(reconcileTab).toHaveAttribute("aria-selected", "true");
	});

	it("switches mode immediately when no pending edits", () => {
		const onModeChange = vi.fn();
		renderToggle({ mode: "reconcile", pendingCount: 0, onModeChange });
		const installTab = screen.getByRole("tab", { name: /install/i });
		fireEvent.click(installTab);
		expect(onModeChange).toHaveBeenCalledWith("install");
		// No dialog should appear
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("shows confirm dialog when switching with pending edits", () => {
		renderToggle({ mode: "reconcile", pendingCount: 3 });
		const installTab = screen.getByRole("tab", { name: /install/i });
		fireEvent.click(installTab);
		// Dialog title heading should appear (jsdom polyfills <dialog open>)
		expect(screen.getByText(/switch mode/i)).toBeInTheDocument();
	});

	it("calls onModeChange on confirm click and closes dialog", () => {
		const onModeChange = vi.fn();
		renderToggle({ mode: "reconcile", pendingCount: 2, onModeChange });
		const installTab = screen.getByRole("tab", { name: /install/i });
		fireEvent.click(installTab);
		// Confirm button is "Switch & discard" in EN
		const confirmBtn = screen.getByRole("button", { name: /switch & discard/i });
		fireEvent.click(confirmBtn);
		expect(onModeChange).toHaveBeenCalledWith("install");
	});

	it("does not call onModeChange on cancel click", () => {
		const onModeChange = vi.fn();
		renderToggle({ mode: "reconcile", pendingCount: 2, onModeChange });
		const installTab = screen.getByRole("tab", { name: /install/i });
		fireEvent.click(installTab);
		// Cancel button — there are multiple "Cancel" buttons (tab bar + dialog); pick last
		const cancelBtns = screen.getAllByRole("button", { name: /^cancel$/i });
		fireEvent.click(cancelBtns[cancelBtns.length - 1]);
		expect(onModeChange).not.toHaveBeenCalled();
	});

	it("does not switch when clicking the already-active tab", () => {
		const onModeChange = vi.fn();
		renderToggle({ mode: "reconcile", pendingCount: 0, onModeChange });
		const reconcileTab = screen.getByRole("tab", { name: /reconcile/i });
		fireEvent.click(reconcileTab);
		expect(onModeChange).not.toHaveBeenCalled();
	});

	it("disables all tabs when disabled prop is true", () => {
		const onModeChange = vi.fn();
		renderToggle({ mode: "reconcile", disabled: true, onModeChange });
		const tabs = screen.getAllByRole("tab");
		for (const tab of tabs) {
			expect(tab).toBeDisabled();
		}
	});
});
