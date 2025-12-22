import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface PreviewPanelProps {
	merged: Record<string, unknown>;
	pendingChanges: Record<string, unknown>;
}

export function PreviewPanel({ merged, pendingChanges }: PreviewPanelProps) {
	// Apply pending changes to preview
	const preview = { ...merged };
	for (const [key, value] of Object.entries(pendingChanges)) {
		preview[key] = value;
	}

	const previewJson = JSON.stringify(unflatten(preview), null, 2);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">Preview</CardTitle>
			</CardHeader>
			<CardContent>
				<pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-96">
					{previewJson}
				</pre>
			</CardContent>
		</Card>
	);
}

function unflatten(obj: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		const keys = key.split(".");
		let current = result;
		for (let i = 0; i < keys.length - 1; i++) {
			if (!(keys[i] in current)) current[keys[i]] = {};
			current = current[keys[i]] as Record<string, unknown>;
		}
		current[keys[keys.length - 1]] = value;
	}
	return result;
}
