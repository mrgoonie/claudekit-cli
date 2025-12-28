/**
 * Global config editor page - edits ~/.claude/.ck.json
 */
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import JsonEditor from "../components/JsonEditor";
import { useFieldAtLine } from "../hooks/useFieldAtLine";
import { useI18n } from "../i18n";
import { fetchConfig, fetchGlobalMetadata, saveConfig } from "../services/api";
import { CONFIG_FIELD_DOCS } from "../services/configFieldDocs";

// Default config matching engineer kit's .ck.json structure
const DEFAULT_CONFIG = {
	codingLevel: -1,
	privacyBlock: true,
	plan: {
		namingFormat: "{date}-{issue}-{slug}",
		dateFormat: "YYMMDD-HHmm",
		issuePrefix: "GH-",
		reportsDir: "reports",
		resolution: {
			order: ["session", "branch"],
			branchPattern: "(?:feat|fix|chore|refactor|docs)/(?:[^/]+/)?(.+)",
		},
		validation: {
			mode: "prompt",
			minQuestions: 3,
			maxQuestions: 8,
			focusAreas: ["assumptions", "risks", "tradeoffs", "architecture"],
		},
	},
	paths: {
		docs: "docs",
		plans: "plans",
	},
	locale: {
		thinkingLanguage: null,
		responseLanguage: null,
	},
	trust: {
		passphrase: null,
		enabled: false,
	},
	project: {
		type: "auto",
		packageManager: "auto",
		framework: "auto",
	},
	assertions: [],
};

const GlobalConfigPage: React.FC = () => {
	const { t, lang } = useI18n();
	const navigate = useNavigate();

	const defaultJsonText = useMemo(() => JSON.stringify(DEFAULT_CONFIG, null, 2), []);
	const [jsonText, setJsonText] = useState(defaultJsonText);
	const [isLoading, setIsLoading] = useState(true);

	const [cursorLine, setCursorLine] = useState(0);
	const [syntaxError, setSyntaxError] = useState<string | null>(null);
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
	const [showResetConfirm, setShowResetConfirm] = useState(false);

	// Tab state and metadata
	const [activeTab, setActiveTab] = useState<"config" | "metadata">("config");
	const [metadata, setMetadata] = useState<Record<string, unknown>>({});

	// Load config and metadata from API on mount
	useEffect(() => {
		const loadData = async () => {
			try {
				const [configData, metadataData] = await Promise.all([
					fetchConfig(),
					fetchGlobalMetadata(),
				]);

				if (configData.global && Object.keys(configData.global).length > 0) {
					setJsonText(JSON.stringify(configData.global, null, 2));
				}

				setMetadata(metadataData);
			} catch (err) {
				console.error("Failed to load data:", err);
			} finally {
				setIsLoading(false);
			}
		};
		loadData();
	}, []);

	// Validate JSON syntax
	useEffect(() => {
		try {
			JSON.parse(jsonText);
			setSyntaxError(null);
		} catch (e) {
			setSyntaxError(e instanceof Error ? e.message : "Invalid JSON");
		}
	}, [jsonText]);

	const activeFieldPath = useFieldAtLine(jsonText, cursorLine);
	const fieldDoc = activeFieldPath ? CONFIG_FIELD_DOCS[activeFieldPath] : null;

	const handleSave = async () => {
		if (syntaxError) return;
		setSaveStatus("saving");
		try {
			const config = JSON.parse(jsonText);
			await saveConfig("global", config);
			setSaveStatus("saved");
			setTimeout(() => setSaveStatus("idle"), 2000);
		} catch {
			setSaveStatus("error");
			setTimeout(() => setSaveStatus("idle"), 3000);
		}
	};

	const handleReset = () => {
		setJsonText(defaultJsonText);
		setShowResetConfirm(false);
	};

	return (
		<div className="animate-in fade-in duration-300 w-full h-full flex flex-col transition-colors">
			<div className="flex items-center justify-between mb-6 shrink-0">
				<div>
					<button
						onClick={() => navigate(-1)}
						className="text-xs text-dash-text-muted hover:text-dash-text mb-2 flex items-center gap-1 group transition-colors font-medium"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M15 19l-7-7 7-7"
							/>
						</svg>
						{t("backToDashboard")}
					</button>
					<h1 className="text-2xl font-bold tracking-tight text-dash-text">{t("globalConfig")}</h1>
					<p className="text-xs text-dash-text-muted mono mt-1">~/.claude/.ck.json</p>
				</div>

				<div className="flex items-center gap-3 relative">
					{/* Reset Button with Confirmation */}
					{showResetConfirm ? (
						<div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 animate-in fade-in duration-200">
							<span className="text-xs text-red-500 font-medium">{t("confirmReset")}</span>
							<button
								onClick={handleReset}
								className="px-2 py-1 rounded bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors"
							>
								{t("confirm")}
							</button>
							<button
								onClick={() => setShowResetConfirm(false)}
								className="px-2 py-1 rounded bg-dash-surface text-dash-text-secondary text-xs font-bold hover:bg-dash-surface-hover transition-colors border border-dash-border"
							>
								{t("cancel")}
							</button>
						</div>
					) : (
						<button
							onClick={() => setShowResetConfirm(true)}
							className="px-4 py-2 rounded-lg bg-dash-surface text-xs font-bold text-dash-text-secondary hover:bg-dash-surface-hover transition-colors border border-dash-border"
						>
							{t("resetToDefault")}
						</button>
					)}

					{/* Save Button */}
					<button
						onClick={handleSave}
						disabled={!!syntaxError || saveStatus === "saving"}
						className={`px-4 py-2 rounded-lg text-xs font-bold transition-all tracking-widest uppercase ${
							syntaxError
								? "bg-dash-surface text-dash-text-muted cursor-not-allowed border border-dash-border"
								: saveStatus === "saved"
									? "bg-green-500 text-white shadow-lg shadow-green-500/20"
									: saveStatus === "error"
										? "bg-red-500 text-white"
										: "bg-dash-accent text-dash-bg hover:bg-dash-accent-hover shadow-lg shadow-dash-accent/20"
						}`}
					>
						{saveStatus === "saving"
							? t("saving")
							: saveStatus === "saved"
								? t("saved")
								: saveStatus === "error"
									? t("saveFailed")
									: t("saveChanges")}
					</button>
				</div>
			</div>

			{/* Tab Bar */}
			<div className="flex gap-2 mb-4 border-b border-dash-border">
				<button
					onClick={() => setActiveTab("config")}
					className={`px-4 py-2 text-sm font-bold transition-colors relative ${
						activeTab === "config"
							? "text-dash-accent border-b-2 border-dash-accent"
							: "text-dash-text-muted hover:text-dash-text"
					}`}
				>
					{t("configTab")}
				</button>
				<button
					onClick={() => setActiveTab("metadata")}
					className={`px-4 py-2 text-sm font-bold transition-colors relative ${
						activeTab === "metadata"
							? "text-dash-accent border-b-2 border-dash-accent"
							: "text-dash-text-muted hover:text-dash-text"
					}`}
				>
					{t("metadataTab")}
				</button>
			</div>

			<div className="flex-1 flex gap-6 min-h-0">
				{/* Config Tab - Editor Panel */}
				{activeTab === "config" && (
					<div className="flex-[3] bg-dash-surface border border-dash-border rounded-xl overflow-hidden flex flex-col shadow-sm">
						<div className="flex-1 min-h-0 overflow-auto">
							{isLoading ? (
								<div className="h-full flex items-center justify-center">
									<div className="animate-pulse text-dash-text-muted text-sm">{t("loading")}</div>
								</div>
							) : (
								<JsonEditor
									value={jsonText}
									onChange={setJsonText}
									onCursorLineChange={setCursorLine}
								/>
							)}
						</div>

						<div className="px-4 py-2 bg-dash-surface-hover/30 border-t border-dash-border text-[10px] text-dash-text-muted flex justify-between uppercase tracking-widest font-bold">
							<div className="flex gap-4">
								<span>UTF-8</span>
								<span>JSON</span>
								<span>L:{cursorLine + 1}</span>
							</div>
							<div className="flex items-center gap-2">
								{syntaxError ? (
									<>
										<div className="w-1.5 h-1.5 rounded-full bg-red-500" />
										<span className="text-red-500 normal-case">{syntaxError}</span>
									</>
								) : (
									<>
										<div className="w-1.5 h-1.5 rounded-full bg-dash-accent" />
										{t("syntaxValid")}
									</>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Metadata Tab - Display Panel */}
				{activeTab === "metadata" && (
					<div className="flex-[3] bg-dash-surface border border-dash-border rounded-xl overflow-hidden flex flex-col shadow-sm">
						<div className="flex-1 overflow-auto p-6">
							{isLoading ? (
								<div className="h-full flex items-center justify-center">
									<div className="animate-pulse text-dash-text-muted text-sm">{t("loading")}</div>
								</div>
							) : (
								<MetadataDisplay metadata={metadata} />
							)}
						</div>
					</div>
				)}

				{/* Help Panel - Only show for config tab */}
				{activeTab === "config" && (
					<div className="flex-[2] bg-dash-surface border border-dash-border rounded-xl flex flex-col shadow-sm overflow-hidden">
						<div className="p-4 border-b border-dash-border bg-dash-surface-hover/50 shrink-0">
							<h3 className="text-xs font-bold text-dash-text-secondary uppercase tracking-widest">
								{t("configurationHelp")}
							</h3>
						</div>

						<div className="flex-1 overflow-y-auto p-6">
							{fieldDoc ? (
								<div className="space-y-6 animate-in fade-in duration-500">
									<header>
										<div className="flex items-center gap-2 mb-1">
											<span className="text-[10px] bg-dash-accent-subtle text-dash-accent px-1.5 py-0.5 rounded font-mono uppercase font-bold">
												{t("field")}
											</span>
											<h2 className="text-lg font-bold text-dash-text mono break-all">
												{fieldDoc.path}
											</h2>
										</div>
										<div className="flex flex-wrap gap-2 mt-2">
											<MetaBadge label={t("type")} value={fieldDoc.type} />
											<MetaBadge label={t("default")} value={fieldDoc.default} />
										</div>
									</header>

									<section>
										<h4 className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-2">
											{t("description")}
										</h4>
										<p className="text-sm text-dash-text-secondary leading-relaxed italic">
											{lang === "vi" ? fieldDoc.descriptionVi : fieldDoc.description}
										</p>
									</section>

									{fieldDoc.validValues && (
										<section>
											<h4 className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-2">
												{t("validValues")}
											</h4>
											<div className="flex flex-wrap gap-1.5">
												{fieldDoc.validValues.map((v) => (
													<span
														key={v}
														className="px-2 py-0.5 bg-dash-bg border border-dash-border rounded text-[11px] mono text-dash-text"
													>
														{v}
													</span>
												))}
											</div>
										</section>
									)}

									{fieldDoc.effect && (
										<section className="bg-dash-accent-subtle/30 p-4 rounded-lg border border-dash-accent/10">
											<h4 className="text-[10px] font-bold text-dash-accent uppercase tracking-widest mb-1">
												{t("systemEffect")}
											</h4>
											<p className="text-[12px] text-dash-text-secondary leading-normal">
												{lang === "vi" && fieldDoc.effectVi ? fieldDoc.effectVi : fieldDoc.effect}
											</p>
										</section>
									)}

									{fieldDoc.example && (
										<section>
											<h4 className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-2">
												{t("exampleUsage")}
											</h4>
											<div className="bg-dash-bg p-3 rounded-lg border border-dash-border overflow-hidden">
												<pre className="text-[11px] mono text-dash-text-secondary whitespace-pre overflow-x-auto">
													{fieldDoc.example}
												</pre>
											</div>
										</section>
									)}
								</div>
							) : (
								<div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-4">
									<div className="w-12 h-12 rounded-full bg-dash-bg border border-dash-border flex items-center justify-center text-xl">
										💡
									</div>
									<div className="max-w-[200px]">
										<p className="text-sm font-bold text-dash-text mb-1 italic">
											{t("knowledgeBase")}
										</p>
										<p className="text-xs text-dash-text-secondary">{t("clickToSeeHelp")}</p>
									</div>
								</div>
							)}
						</div>

						{fieldDoc && (
							<div className="p-4 bg-dash-surface-hover/20 border-t border-dash-border shrink-0">
								<p className="text-[10px] text-dash-text-muted font-medium flex items-center gap-1.5 italic">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="w-3 h-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
									{t("extractedFrom")}
								</p>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

// Metadata display component
const MetadataDisplay: React.FC<{ metadata: Record<string, unknown> }> = ({ metadata }) => {
	const { t } = useI18n();

	// Extract metadata from multi-kit or legacy format
	const hasKits = metadata.kits && typeof metadata.kits === "object";
	const kitEntries = hasKits ? Object.entries(metadata.kits as Record<string, unknown>) : [];

	// Legacy format fallback
	const legacyName = metadata.name as string | undefined;
	const legacyVersion = metadata.version as string | undefined;
	const legacyInstalledAt = metadata.installedAt as string | undefined;

	// Check if any kit is installed
	const hasAnyKit = kitEntries.length > 0 || legacyName;

	if (!hasAnyKit) {
		return (
			<div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-4">
				<div className="w-16 h-16 rounded-full bg-dash-bg border border-dash-border flex items-center justify-center text-3xl">
					📦
				</div>
				<div className="max-w-[300px]">
					<p className="text-lg font-bold text-dash-text mb-2">{t("noKitInstalled")}</p>
					<p className="text-sm text-dash-text-secondary">
						Install a ClaudeKit to see metadata information here
					</p>
				</div>
			</div>
		);
	}

	// Multi-kit format display
	if (hasKits && kitEntries.length > 0) {
		return (
			<div className="space-y-6">
				{kitEntries.map(([kitName, kitData]) => {
					const kit = kitData as { version?: string; installedAt?: string; files?: unknown[] };
					return (
						<div
							key={kitName}
							className="bg-dash-bg border border-dash-border rounded-lg p-6 space-y-4"
						>
							<h3 className="text-lg font-bold text-dash-text capitalize">{kitName} Kit</h3>

							<div className="grid grid-cols-2 gap-4">
								<InfoRow label={t("kitVersion")} value={kit.version || "N/A"} />
								<InfoRow
									label={t("installedOn")}
									value={kit.installedAt ? new Date(kit.installedAt).toLocaleDateString() : "N/A"}
								/>
							</div>

							{kit.files && Array.isArray(kit.files) && (
								<div>
									<h4 className="text-xs font-bold text-dash-text-muted uppercase tracking-widest mb-2">
										{t("components")}
									</h4>
									<div className="text-sm text-dash-text-secondary">
										{kit.files.length} files tracked
									</div>
								</div>
							)}
						</div>
					);
				})}
			</div>
		);
	}

	// Legacy format display
	return (
		<div className="space-y-6">
			<div className="bg-dash-bg border border-dash-border rounded-lg p-6 space-y-4">
				<h3 className="text-lg font-bold text-dash-text">{legacyName || "ClaudeKit"}</h3>

				<div className="grid grid-cols-2 gap-4">
					<InfoRow label={t("kitVersion")} value={legacyVersion || "N/A"} />
					<InfoRow
						label={t("installedOn")}
						value={legacyInstalledAt ? new Date(legacyInstalledAt).toLocaleDateString() : "N/A"}
					/>
				</div>
			</div>
		</div>
	);
};

// Helper component for info rows
const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
	<div>
		<div className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-1">
			{label}
		</div>
		<div className="text-sm font-medium text-dash-text">{value}</div>
	</div>
);

const MetaBadge: React.FC<{ label: string; value: string }> = ({ label, value }) => (
	<div className="flex items-center gap-1.5 px-2 py-1 bg-dash-bg border border-dash-border rounded-md">
		<span className="text-[9px] font-bold text-dash-text-muted uppercase">{label}:</span>
		<span className="text-[10px] mono font-bold text-dash-text-secondary">{value}</span>
	</div>
);

export default GlobalConfigPage;
