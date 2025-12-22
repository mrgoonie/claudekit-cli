import { useCallback, useState } from "react";
import { BackupsPanel } from "./components/BackupsPanel";
import { ConfigSection } from "./components/ConfigSection";
import { DiffView } from "./components/DiffView";
import { PreviewPanel } from "./components/PreviewPanel";
import { Button } from "./components/ui/button";
import { Toaster } from "./components/ui/toaster";
import { useConfig } from "./hooks/useConfig";
import { useSchema } from "./hooks/useSchema";
import { useToast } from "./hooks/useToast";
import { useWebSocket } from "./hooks/useWebSocket";
import { schemaToFormSections } from "./lib/schema-utils";

function App() {
	const {
		config,
		loading,
		error,
		saving,
		pendingChanges,
		hasPendingChanges,
		validating,
		updateField,
		save,
		reset,
		reload,
		getValidationError,
		isFieldValid,
	} = useConfig();

	const {
		schema,
		loading: schemaLoading,
		error: schemaError,
	} = useSchema();

	const { toast } = useToast();
	const [saveScope, setSaveScope] = useState<"global" | "local">("local");
	const [backupScope, setBackupScope] = useState<"global" | "local">("global");

	// Handle WebSocket updates
	const handleConfigChange = useCallback(() => {
		reload();
	}, [reload]);

	const handleReconnect = useCallback(() => {
		toast({
			title: "Reconnected",
			description: "WebSocket connection restored",
			variant: "default",
		});
	}, [toast]);

	const { connected } = useWebSocket(handleConfigChange, handleReconnect);

	const handleSave = useCallback(async () => {
		const result = await save(saveScope);
		if (result.success) {
			toast({
				title: "Saved",
				description: `Config saved to ${saveScope}`,
				variant: "success",
			});
		} else {
			toast({
				title: "Error",
				description: result.error ?? "Failed to save config",
				variant: "destructive",
			});
		}
	}, [save, saveScope, toast]);

	if (loading || schemaLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-gray-500">Loading configuration...</div>
			</div>
		);
	}

	if (error || schemaError) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-red-500">Error: {error || schemaError}</div>
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

	// Generate form sections from schema
	const formSections = schema
		? schemaToFormSections(schema.sections, traced, pendingChanges, {
				getValidationError,
				isFieldValid,
			})
		: [];

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
						<Button onClick={handleSave} disabled={!hasPendingChanges || saving}>
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
						{formSections.map((section) => (
							<ConfigSection
								key={section.title}
								title={section.title}
								description={section.description}
								fields={section.fields}
								onFieldChange={updateField}
								validating={validating}
							/>
						))}
						{formSections.length === 0 && (
							<div className="text-gray-500 text-center py-8">
								No configuration schema available
							</div>
						)}
					</div>

					{/* Side Panel */}
					<div className="space-y-6">
						<DiffView original={merged} changes={pendingChanges} />
						<PreviewPanel merged={merged} pendingChanges={pendingChanges} />

						{/* Backups Panel */}
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<label className="text-sm text-gray-600">Backup Scope:</label>
								<select
									value={backupScope}
									onChange={(e) => setBackupScope(e.target.value as "global" | "local")}
									className="border rounded px-2 py-1 text-sm"
								>
									<option value="global">Global</option>
									<option value="local">Local</option>
								</select>
							</div>
							<BackupsPanel scope={backupScope} onRestore={reload} />
						</div>

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
			<Toaster />
		</div>
	);
}

export default App;
