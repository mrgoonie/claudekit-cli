import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fetchCkConfig,
	fetchCkConfigSchema,
	fetchCkConfigScope,
	saveCkConfig,
	updateCkConfigField,
} from "../ck-config-api";

describe("ck-config-api web mode", () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubGlobal("fetch", fetchMock);
	});

	it("fetchCkConfig calls GET /api/ck-config without projectId", async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				config: { privacyBlock: false },
				sources: { privacyBlock: "global" },
				globalPath: "/Users/test/.claude/.ck.json",
				projectPath: null,
			}),
		});

		const result = await fetchCkConfig();

		expect(fetchMock).toHaveBeenCalledWith("/api/ck-config");
		expect(result.config).toEqual({ privacyBlock: false });
		expect(result.projectPath).toBeNull();
	});

	it("fetchCkConfig calls GET /api/ck-config?projectId= when projectId is provided", async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				config: { privacyBlock: true },
				sources: { privacyBlock: "project" },
				globalPath: "/Users/test/.claude/.ck.json",
				projectPath: "/tmp/proj/.claude/.ck.json",
			}),
		});

		const result = await fetchCkConfig("project-alpha");

		expect(fetchMock).toHaveBeenCalledWith("/api/ck-config?projectId=project-alpha");
		expect(result.projectPath).toBe("/tmp/proj/.claude/.ck.json");
	});

	it("fetchCkConfig throws on non-ok response", async () => {
		fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

		await expect(fetchCkConfig()).rejects.toThrow("Failed to fetch ck-config: 500");
	});

	it("fetchCkConfigScope passes scope param to GET /api/ck-config", async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				config: {},
				sources: {},
				globalPath: "/Users/test/.claude/.ck.json",
				projectPath: null,
			}),
		});

		await fetchCkConfigScope("global");

		expect(fetchMock).toHaveBeenCalledWith("/api/ck-config?scope=global");
	});

	it("fetchCkConfigScope includes projectId when provided", async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				config: {},
				sources: {},
				globalPath: "",
				projectPath: "/tmp/proj/.claude/.ck.json",
			}),
		});

		await fetchCkConfigScope("project", "project-alpha");

		expect(fetchMock).toHaveBeenCalledWith("/api/ck-config?scope=project&projectId=project-alpha");
	});

	it("saveCkConfig sends PUT /api/ck-config with request body", async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				success: true,
				path: "/Users/test/.claude/.ck.json",
				scope: "global",
				config: { privacyBlock: false },
			}),
		});

		const result = await saveCkConfig({
			scope: "global",
			config: { privacyBlock: false },
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/ck-config",
			expect.objectContaining({
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ scope: "global", config: { privacyBlock: false } }),
			}),
		);
		expect(result.success).toBe(true);
	});

	it("saveCkConfig throws with server error message on failure", async () => {
		fetchMock.mockResolvedValueOnce({
			ok: false,
			status: 400,
			json: async () => ({ error: "Validation failed" }),
		});

		await expect(saveCkConfig({ scope: "global", config: { invalid: true } })).rejects.toThrow(
			"Validation failed",
		);
	});

	it("fetchCkConfigSchema calls GET /api/ck-config/schema", async () => {
		const schema = { $id: "ck-config", properties: { privacyBlock: { type: "boolean" } } };
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => schema,
		});

		const result = await fetchCkConfigSchema();

		expect(fetchMock).toHaveBeenCalledWith("/api/ck-config/schema");
		expect(result).toHaveProperty("$id");
		expect(result).toHaveProperty("properties");
	});

	it("updateCkConfigField sends PATCH /api/ck-config/field", async () => {
		fetchMock.mockResolvedValueOnce({ ok: true });

		await updateCkConfigField("privacyBlock", false, "global");

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/ck-config/field",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({
					scope: "global",
					projectId: undefined,
					fieldPath: "privacyBlock",
					value: false,
				}),
			}),
		);
	});

	it("updateCkConfigField throws with server error on failure", async () => {
		fetchMock.mockResolvedValueOnce({
			ok: false,
			status: 422,
			json: async () => ({ error: "Invalid field path" }),
		});

		await expect(updateCkConfigField("nonexistent.field", "bad", "global")).rejects.toThrow(
			"Invalid field path",
		);
	});
});
