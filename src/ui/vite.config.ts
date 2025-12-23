import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
	plugins: [react()],
	root: resolve(__dirname),
	base: "/",

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

	server: {
		port: 5173,
		strictPort: false,
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
