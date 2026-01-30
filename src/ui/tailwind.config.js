import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
	// Use absolute paths so Tailwind works regardless of process CWD
	content: [
		resolve(__dirname, "index.html"),
		resolve(__dirname, "src/**/*.{js,ts,jsx,tsx}"),
	],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				dash: {
					bg: "var(--dash-bg)",
					surface: "var(--dash-surface)",
					"surface-hover": "var(--dash-surface-hover)",
					border: "var(--dash-border)",
					"border-subtle": "var(--dash-border-subtle)",
					text: "var(--dash-text)",
					"text-secondary": "var(--dash-text-secondary)",
					"text-muted": "var(--dash-text-muted)",
					accent: "var(--dash-accent)",
					"accent-hover": "var(--dash-accent-hover)",
					"accent-subtle": "var(--dash-accent-subtle)",
					"accent-glow": "var(--dash-accent-glow)",
				},
			},
			fontFamily: {
				sans: ["Inter", "system-ui", "sans-serif"],
				mono: ["JetBrains Mono", "Menlo", "monospace"],
			},
		},
	},
	plugins: [],
};
