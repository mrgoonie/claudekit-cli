import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		outDir: "dist",
		sourcemap: false,
		minify: true,
	},
	server: {
		proxy: {
			"/api": "http://localhost:3847",
			"/ws": {
				target: "ws://localhost:3847",
				ws: true,
			},
		},
	},
});
