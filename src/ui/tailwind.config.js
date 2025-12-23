/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				dash: {
					bg: "var(--dash-bg)",
					surface: "var(--dash-surface)",
					"surface-hover": "var(--dash-surface-hover)",
					border: "var(--dash-border)",
					text: "var(--dash-text)",
					"text-secondary": "var(--dash-text-secondary)",
					"text-muted": "var(--dash-text-muted)",
					accent: "var(--dash-accent)",
					"accent-hover": "var(--dash-accent-hover)",
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
