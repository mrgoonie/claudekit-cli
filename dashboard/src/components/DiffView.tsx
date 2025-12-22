import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface DiffViewProps {
	original: Record<string, unknown>;
	changes: Record<string, unknown>;
}

export function DiffView({ original, changes }: DiffViewProps) {
	if (Object.keys(changes).length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Changes</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-gray-500 text-sm">No pending changes</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">Changes</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-2 font-mono text-sm">
					{Object.entries(changes).map(([key, newValue]) => {
						const oldValue = original[key];
						return (
							<div key={key} className="border-l-4 border-yellow-400 pl-3 py-1">
								<div className="text-gray-600">{key}</div>
								<div className="text-red-600">- {JSON.stringify(oldValue)}</div>
								<div className="text-green-600">+ {JSON.stringify(newValue)}</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
