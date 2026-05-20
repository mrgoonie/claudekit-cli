/**
 * Playwright E2E configuration — ClaudeKit CLI dashboard
 *
 * Tests run against the dashboard dev server (Express+Vite) on a dedicated
 * E2E port (3491) to avoid collisions with any other local service on the
 * default 3456-3460 range.
 *
 * Each spec uses Playwright route mocking to intercept /api/migrate/* calls
 * — no real ~/.claudekit or provider directories are read or written.
 *
 * CI wiring is out of scope for this phase (decisions Q7).
 * Run locally: bun run test:e2e
 */

import { defineConfig, devices } from "@playwright/test";

/** Dedicated port for E2E — chosen to avoid 3456-3460 default range */
const E2E_PORT = 3491;
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "**/*.e2e.ts",
	timeout: 60_000,
	expect: { timeout: 15_000 },
	fullyParallel: false, // Serial: specs share one server process
	retries: 0,
	workers: 1,
	reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

	use: {
		baseURL: E2E_BASE_URL,
		headless: true,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	webServer: {
		/**
		 * Start the dashboard dev server on the dedicated E2E port.
		 * --no-open prevents browser auto-launch during tests.
		 * reuseExistingServer:false ensures a clean server instance each run
		 * (avoids reusing a stale or wrong server on that port).
		 *
		 * The server reads HOME from process.env at module load time
		 * (portable-registry.ts:17). Tests use Playwright route mocking
		 * to intercept /api/migrate/* — no real filesystem state is needed.
		 */
		command: `bun run src/index.ts config ui --dev --port ${E2E_PORT} --no-open`,
		url: E2E_BASE_URL,
		reuseExistingServer: false,
		timeout: 120_000,
		stdout: "ignore",
		stderr: "pipe",
	},
});
