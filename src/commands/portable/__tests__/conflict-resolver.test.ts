import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ReconcileAction } from "../reconcile-types.js";

const selectMock = mock(async () => "keep");
const isCancelMock = mock((_value: unknown) => false);

mock.module("@clack/prompts", () => ({
	select: selectMock,
	isCancel: isCancelMock,
}));

const { resolveConflict } = await import("../conflict-resolver.js");

const baseAction: ReconcileAction = {
	action: "conflict",
	item: "example.md",
	type: "command",
	provider: "codex",
	global: false,
	targetPath: "/tmp/example.md",
	reason: "checksums differ",
	diff: "@@ -1 +1 @@\n-old\n+new",
};

describe("resolveConflict", () => {
	beforeEach(() => {
		selectMock.mockClear();
		isCancelMock.mockClear();
		selectMock.mockImplementation(async () => "keep");
		isCancelMock.mockImplementation(() => false);
	});

	it("returns keep immediately in non-interactive mode", async () => {
		const resolution = await resolveConflict(baseAction, { interactive: false, color: false });

		expect(resolution).toEqual({ type: "keep" });
		expect(selectMock).not.toHaveBeenCalled();
	});

	it("returns keep when prompt is cancelled", async () => {
		selectMock.mockImplementation(async () => "overwrite");
		isCancelMock.mockImplementation(() => true);

		const resolution = await resolveConflict(baseAction, { interactive: true, color: false });

		expect(resolution).toEqual({ type: "keep" });
		expect(selectMock).toHaveBeenCalledTimes(1);
	});

	it("bounds repeated show-diff selections and falls back to keep", async () => {
		selectMock.mockImplementation(async () => "show-diff");

		const resolution = await resolveConflict(baseAction, { interactive: true, color: false });

		expect(resolution).toEqual({ type: "keep" });
		expect(selectMock).toHaveBeenCalledTimes(5);
	});

	it("continues prompting after show-diff and accepts a concrete choice", async () => {
		const choices = ["show-diff", "overwrite"];
		selectMock.mockImplementation(async () => choices.shift() ?? "overwrite");

		const resolution = await resolveConflict(baseAction, { interactive: true, color: false });

		expect(resolution).toEqual({ type: "overwrite" });
		expect(selectMock).toHaveBeenCalledTimes(2);
	});
});
