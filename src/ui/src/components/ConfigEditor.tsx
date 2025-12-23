import { CONFIG_FIELD_DOCS } from "@/services/configFieldDocs";
import type { ConfigData } from "@/types";
import { useState } from "react";

interface ConfigEditorProps {
	config: ConfigData;
	onSave: (scope: "global" | "local", config: Record<string, unknown>) => Promise<void>;
	onBack: () => void;
}

export default function ConfigEditor({ config, onSave, onBack }: ConfigEditorProps) {
	const [scope, setScope] = useState<"global" | "local">("local");
	const [editedConfig, setEditedConfig] = useState(
		JSON.stringify(scope === "global" ? config.global : config.local || {}, null, 2),
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [parseError, setParseError] = useState<string | null>(null);

	const handleScopeChange = (newScope: "global" | "local") => {
		setScope(newScope);
		setEditedConfig(
			JSON.stringify(newScope === "global" ? config.global : config.local || {}, null, 2),
		);
		setParseError(null);
	};

	const handleTextChange = (value: string) => {
		setEditedConfig(value);
		try {
			JSON.parse(value);
			setParseError(null);
		} catch (e) {
			setParseError(e instanceof Error ? e.message : "Invalid JSON");
		}
	};

	const handleSave = async () => {
		if (parseError) return;

		try {
			setSaving(true);
			setError(null);
			const parsed = JSON.parse(editedConfig);
			await onSave(scope, parsed);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to save");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={onBack}
						className="text-dash-text-secondary hover:text-dash-text transition-colors"
					>
						← Back
					</button>
					<h2 className="text-xl font-semibold">Configuration Editor</h2>
				</div>

				<div className="flex items-center gap-4">
					{/* Scope Toggle */}
					<div className="flex rounded-lg border border-dash-border overflow-hidden">
						<button
							type="button"
							onClick={() => handleScopeChange("local")}
							className={`px-4 py-2 text-sm transition-colors ${
								scope === "local"
									? "bg-dash-accent text-white"
									: "bg-dash-surface text-dash-text-secondary hover:bg-dash-surface-hover"
							}`}
						>
							Local
						</button>
						<button
							type="button"
							onClick={() => handleScopeChange("global")}
							className={`px-4 py-2 text-sm transition-colors ${
								scope === "global"
									? "bg-dash-accent text-white"
									: "bg-dash-surface text-dash-text-secondary hover:bg-dash-surface-hover"
							}`}
						>
							Global
						</button>
					</div>

					<button
						type="button"
						onClick={handleSave}
						disabled={!!parseError || saving}
						className={`px-4 py-2 text-sm rounded transition-colors ${
							parseError
								? "bg-gray-500 cursor-not-allowed opacity-50"
								: "bg-dash-accent text-white hover:bg-dash-accent-hover"
						}`}
					>
						{saving ? "Saving..." : "Save"}
					</button>
				</div>
			</div>

			{/* Error Display */}
			{error && (
				<div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded">
					{error}
				</div>
			)}

			{/* Editor */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* JSON Editor */}
				<div className="lg:col-span-2 bg-dash-surface rounded-lg border border-dash-border">
					<div className="px-4 py-3 border-b border-dash-border flex items-center justify-between">
						<h3 className="font-medium">{scope === "global" ? "Global" : "Local"} Configuration</h3>
						{parseError && <span className="text-xs text-red-400">Parse Error: {parseError}</span>}
					</div>
					<div className="p-4">
						<textarea
							value={editedConfig}
							onChange={(e) => handleTextChange(e.target.value)}
							className={`w-full h-96 font-mono text-sm p-4 rounded border bg-dash-bg text-dash-text resize-none focus:outline-none focus:ring-2 ${
								parseError
									? "border-red-500 focus:ring-red-500/50"
									: "border-dash-border focus:ring-dash-accent/50"
							}`}
							spellCheck={false}
						/>
					</div>
				</div>

				{/* Field Documentation */}
				<div className="bg-dash-surface rounded-lg border border-dash-border">
					<div className="px-4 py-3 border-b border-dash-border">
						<h3 className="font-medium">Field Reference</h3>
					</div>
					<div className="p-4 max-h-[28rem] overflow-y-auto space-y-4">
						{Object.entries(CONFIG_FIELD_DOCS).map(([key, doc]) => (
							<div key={key} className="text-sm">
								<code className="text-dash-accent font-mono">{key}</code>
								<p className="text-dash-text-secondary mt-1">{doc.description}</p>
								<div className="flex items-center gap-2 mt-1 text-xs text-dash-text-muted">
									<span>Type: {doc.type}</span>
									{doc.default && <span>Default: {doc.default}</span>}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
