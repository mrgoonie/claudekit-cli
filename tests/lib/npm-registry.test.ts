import { afterEach, describe, expect, mock, test } from "bun:test";
import { NpmRegistryClient } from "../../src/lib/npm-registry";

describe("NpmRegistryClient", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
	});

	describe("getPackageInfo", () => {
		test("returns package info on successful response", async () => {
			const mockResponse = {
				name: "test-package",
				version: "1.0.0",
				"dist-tags": {
					latest: "1.0.0",
					beta: "2.0.0-beta.1",
				},
				versions: {
					"1.0.0": { version: "1.0.0", name: "test-package" },
					"2.0.0-beta.1": { version: "2.0.0-beta.1", name: "test-package" },
				},
				time: {
					"1.0.0": "2024-01-01T00:00:00.000Z",
					"2.0.0-beta.1": "2024-02-01T00:00:00.000Z",
				},
			};

			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockResponse),
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.getPackageInfo("test-package");
			expect(result).not.toBeNull();
			expect(result?.name).toBe("test-package");
			expect(result?.["dist-tags"]?.latest).toBe("1.0.0");
			expect(result?.["dist-tags"]?.beta).toBe("2.0.0-beta.1");
		});

		test("returns null for 404 response", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 404,
					statusText: "Not Found",
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.getPackageInfo("nonexistent-package");
			expect(result).toBeNull();
		});

		test("throws error for non-404 errors", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 500,
					statusText: "Internal Server Error",
				} as Response),
			) as unknown as typeof fetch;

			await expect(NpmRegistryClient.getPackageInfo("test-package")).rejects.toThrow(
				"Registry returned 500",
			);
		});

		test("uses custom registry URL when provided", async () => {
			let capturedUrl = "";
			global.fetch = mock((url: string) => {
				capturedUrl = url;
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							name: "test-package",
							"dist-tags": { latest: "1.0.0" },
							versions: {},
							time: {},
						}),
				} as Response);
			}) as unknown as typeof fetch;

			await NpmRegistryClient.getPackageInfo("test-package", "https://custom.registry.com");
			expect(capturedUrl).toBe("https://custom.registry.com/test-package");
		});

		test("handles timeout/abort errors", async () => {
			const abortError = new Error("Aborted");
			abortError.name = "AbortError";
			global.fetch = mock(() => Promise.reject(abortError)) as unknown as typeof fetch;

			await expect(NpmRegistryClient.getPackageInfo("test-package")).rejects.toThrow("timeout");
		});
	});

	describe("getLatestVersion", () => {
		test("returns latest version from dist-tags", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							name: "test-package",
							"dist-tags": { latest: "2.5.0" },
							versions: {},
							time: {},
						}),
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.getLatestVersion("test-package");
			expect(result).toBe("2.5.0");
		});

		test("returns null when package not found", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 404,
					statusText: "Not Found",
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.getLatestVersion("nonexistent");
			expect(result).toBeNull();
		});

		test("returns null when no dist-tags.latest", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							name: "test-package",
							"dist-tags": {},
							versions: {},
							time: {},
						}),
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.getLatestVersion("test-package");
			expect(result).toBeNull();
		});
	});

	describe("getBetaVersion", () => {
		test("returns beta version when available", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							name: "test-package",
							"dist-tags": { latest: "1.0.0", beta: "2.0.0-beta.1" },
							versions: {},
							time: {},
						}),
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.getBetaVersion("test-package");
			expect(result).toBe("2.0.0-beta.1");
		});

		test("returns next version when beta not available", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							name: "test-package",
							"dist-tags": { latest: "1.0.0", next: "2.0.0-rc.1" },
							versions: {},
							time: {},
						}),
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.getBetaVersion("test-package");
			expect(result).toBe("2.0.0-rc.1");
		});

		test("returns null when no beta or next version", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							name: "test-package",
							"dist-tags": { latest: "1.0.0" },
							versions: {},
							time: {},
						}),
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.getBetaVersion("test-package");
			expect(result).toBeNull();
		});
	});

	describe("versionExists", () => {
		test("returns true when version exists", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							name: "test-package",
							"dist-tags": { latest: "1.0.0" },
							versions: {
								"1.0.0": { version: "1.0.0" },
								"1.1.0": { version: "1.1.0" },
							},
							time: {},
						}),
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.versionExists("test-package", "1.1.0");
			expect(result).toBe(true);
		});

		test("returns false when version does not exist", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							name: "test-package",
							"dist-tags": { latest: "1.0.0" },
							versions: {
								"1.0.0": { version: "1.0.0" },
							},
							time: {},
						}),
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.versionExists("test-package", "9.9.9");
			expect(result).toBe(false);
		});

		test("returns false when package not found", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 404,
					statusText: "Not Found",
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.versionExists("nonexistent", "1.0.0");
			expect(result).toBe(false);
		});
	});

	describe("getVersionInfo", () => {
		test("returns version info when found", async () => {
			const versionInfo = {
				version: "1.0.0",
				name: "test-package",
				dist: { tarball: "https://example.com/tarball.tgz", shasum: "abc123" },
			};

			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							name: "test-package",
							"dist-tags": { latest: "1.0.0" },
							versions: {
								"1.0.0": versionInfo,
							},
							time: {},
						}),
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.getVersionInfo("test-package", "1.0.0");
			expect(result).not.toBeNull();
			expect(result?.version).toBe("1.0.0");
			expect(result?.dist?.tarball).toBe("https://example.com/tarball.tgz");
		});

		test("returns null when version not found", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							name: "test-package",
							"dist-tags": { latest: "1.0.0" },
							versions: {
								"1.0.0": { version: "1.0.0" },
							},
							time: {},
						}),
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.getVersionInfo("test-package", "9.9.9");
			expect(result).toBeNull();
		});
	});

	describe("getAllVersions", () => {
		test("returns sorted versions (newest first)", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							name: "test-package",
							"dist-tags": { latest: "1.2.0" },
							versions: {
								"1.0.0": { version: "1.0.0" },
								"1.1.0": { version: "1.1.0" },
								"1.2.0": { version: "1.2.0" },
							},
							time: {
								"1.0.0": "2024-01-01T00:00:00.000Z",
								"1.1.0": "2024-02-01T00:00:00.000Z",
								"1.2.0": "2024-03-01T00:00:00.000Z",
							},
						}),
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.getAllVersions("test-package");
			expect(result).toHaveLength(3);
			expect(result[0]).toBe("1.2.0"); // Newest first
			expect(result[2]).toBe("1.0.0"); // Oldest last
		});

		test("returns empty array when package not found", async () => {
			global.fetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 404,
					statusText: "Not Found",
				} as Response),
			) as unknown as typeof fetch;

			const result = await NpmRegistryClient.getAllVersions("nonexistent");
			expect(result).toEqual([]);
		});
	});
});
