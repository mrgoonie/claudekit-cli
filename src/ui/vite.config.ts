/// <reference types="vitest" />
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
	plugins: [react()],
	root: resolve(__dirname),
	base: "/",

	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/test-setup.ts"],
		include: ["src/**/*.{test,spec,vitest}.{ts,tsx}"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["src/components/**", "src/pages/**", "src/data/**"],
		},
	},

	build: {
		outDir: resolve(__dirname, "../../dist/ui"),
		emptyDirOnBuild: true,
		sourcemap: false,
		minify: "esbuild",
		target: "es2020",
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ["react", "react-dom"],
				},
				entryFileNames: "assets/[name]-[hash].js",
				chunkFileNames: "assets/[name]-[hash].js",
				assetFileNames: "assets/[name]-[hash][extname]",
			},
		},
		chunkSizeWarningLimit: 500,
	},

	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
		},
	},

	// Tauri v2: disable clearing the terminal so Tauri's output stays visible
	clearScreen: false,

	// Expose TAURI_* env vars to the webview (e.g. TAURI_PLATFORM, TAURI_ARCH)
	envPrefix: ["VITE_", "TAURI_"],

	server: {
		// Tauri dev server port — must match devUrl in src-tauri/tauri.conf.json.
		// The Express backend already binds :3456; Vite runs in middleware mode
		// embedded in that server, so we keep the existing port here for
		// standalone `bun run ui:dev` usage. Tauri always uses the Express
		// combo server started by beforeDevCommand (dashboard:dev on :3456).
		port: 5173,
		strictPort: true,
		proxy: {
			"/api": {
				target: "http://localhost:3456",
				changeOrigin: true,
			},
			"/ws": {
				target: "ws://localhost:3456",
				ws: true,
			},
		},
	},

	preview: {
		port: 4173,
		proxy: {
			"/api": "http://localhost:3456",
			"/ws": {
				target: "ws://localhost:3456",
				ws: true,
			},
		},
	},
}));
