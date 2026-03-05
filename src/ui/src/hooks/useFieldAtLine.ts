import { useEffect, useState } from "react";

export const useFieldAtLine = (json: string, currentLine: number) => {
	const [activePath, setActivePath] = useState<string | null>(null);

	useEffect(() => {
		const lines = json.split("\n");
		const stack: string[] = [];
		let foundPath: string | null = null;

		// Simple heuristic-based JSON path extractor for standard .ck.json formatting
		for (let i = 0; i <= Math.min(currentLine, lines.length - 1); i++) {
			const line = lines[i].trim();

			// Check for opening braces (entering an object)
			const openMatch = line.match(/"([^"]+)"\s*:\s*{/);
			if (openMatch) {
				stack.push(openMatch[1]);
				if (i === currentLine) foundPath = stack.join(".");
				continue;
			}

			// Check for closing braces (exiting an object)
			if (line === "}" || line === "},") {
				stack.pop();
				continue;
			}

			// Check for property matches
			const propertyMatch = line.match(/"([^"]+)"\s*:/);
			if (propertyMatch) {
				const prop = propertyMatch[1];
				if (i === currentLine) {
					foundPath = stack.length > 0 ? `${stack.join(".")}.${prop}` : prop;
					break;
				}
			}
		}

		setActivePath(foundPath);
	}, [json, currentLine]);

	return activePath;
};
