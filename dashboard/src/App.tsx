import { useCallback, useState } from "react";
import { ConfigSection } from "./components/ConfigSection";
import { DiffView } from "./components/DiffView";
import { PreviewPanel } from "./components/PreviewPanel";
import { Button } from "./components/ui/button";
import { useConfig } from "./hooks/useConfig";
import { useWebSocket } from "./hooks/useWebSocket";

function App() {
	const {
		config,
		loading,
		error,
		saving,
		pendingChanges,
		hasPendingChanges,
		updateField,
		save,
		reset,
		reload,
	} = useConfig();

	const [saveScope, setSaveScope] = useState<"global" | "local">("local");

	// Handle WebSocket updates
	const handleConfigChange = useCallback(() => {
		reload();
	}, [reload]);

	const { connected } = useWebSocket(handleConfigChange);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-gray-500">Loading configuration...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-red-500">Error: {error}</div>
			</div>
		);
	}

	if (!config) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-gray-500">No configuration found</div>
			</div>
		);
	}

	const { traced, merged, paths } = config;

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white border-b px-6 py-4">
				<div className="flex items-center justify-between max-w-6xl mx-auto">
					<div>
						<h1 className="text-xl font-bold text-gray-900">ClaudeKit Config</h1>
						<p className="text-sm text-gray-500">
							{connected ? (
								<span className="text-green-600">Connected</span>
							) : (
								<span className="text-yellow-600">Reconnecting...</span>
							)}
						</p>
					</div>
					<div className="flex items-center gap-4">
						<select
							value={saveScope}
							onChange={(e) => setSaveScope(e.target.value as "global" | "local")}
							className="border rounded px-3 py-2 text-sm"
						>
							<option value="local">Save to Local</option>
							<option value="global">Save to Global</option>
						</select>
						<Button variant="outline" onClick={reset} disabled={!hasPendingChanges}>
							Reset
						</Button>
						<Button onClick={() => save(saveScope)} disabled={!hasPendingChanges || saving}>
							{saving ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-6xl mx-auto px-6 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Config Form */}
					<div className="lg:col-span-2 space-y-6">
						<ConfigSection
							title="Defaults"
							fields={[
								{
									key: "defaults.kit",
									label: "Default Kit",
									traced: traced["defaults.kit"],
									pendingValue: pendingChanges["defaults.kit"],
								},
								{
									key: "defaults.dir",
									label: "Default Directory",
									traced: traced["defaults.dir"],
									pendingValue: pendingChanges["defaults.dir"],
								},
							]}
							onFieldChange={updateField}
						/>

						<ConfigSection
							title="Folders"
							fields={[
								{
									key: "folders.docs",
									label: "Documentation Folder",
									traced: traced["folders.docs"],
									pendingValue: pendingChanges["folders.docs"],
								},
								{
									key: "folders.plans",
									label: "Plans Folder",
									traced: traced["folders.plans"],
									pendingValue: pendingChanges["folders.plans"],
								},
							]}
							onFieldChange={updateField}
						/>
					</div>

					{/* Side Panel */}
					<div className="space-y-6">
						<DiffView original={merged} changes={pendingChanges} />
						<PreviewPanel merged={merged} pendingChanges={pendingChanges} />

						{/* Config Paths */}
						<div className="text-sm text-gray-500 space-y-1">
							<p>
								<strong>Global:</strong> {paths.global}
							</p>
							<p>
								<strong>Local:</strong> {paths.local}
							</p>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}

export default App;
