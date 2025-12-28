/**
 * Global config editor page - edits ~/.claude/.ck.json
 */
import type React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import JsonEditor from "../components/JsonEditor";
import { useFieldAtLine } from "../hooks/useFieldAtLine";
import { useI18n } from "../i18n";
import { CONFIG_FIELD_DOCS } from "../services/configFieldDocs";

const GlobalConfigPage: React.FC = () => {
	const { t, lang } = useI18n();
	const navigate = useNavigate();

	const [jsonText, setJsonText] = useState(
		JSON.stringify(
			{
				codingLevel: 3,
				privacyBlock: true,
				plan: {
					namingFormat: "{date}-{issue}-{slug}",
					dateFormat: "YYMMDD-HHmm",
					issuePrefix: "GH-",
					reportsDir: "reports",
				},
				locale: {
					thinkingLanguage: "en",
					responseLanguage: null,
				},
			},
			null,
			2,
		),
	);

	const [cursorLine, setCursorLine] = useState(0);
	const [syntaxError, setSyntaxError] = useState<string | null>(null);

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
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
						{t("backToDashboard")}
					</button>
					<h1 className="text-2xl font-bold tracking-tight text-dash-text">
						{t("globalConfig")}
					</h1>
					<p className="text-xs text-dash-text-muted mono mt-1">~/.claude/.ck.json</p>
				</div>

				<div className="flex items-center gap-3">
					<button className="px-4 py-2 rounded-lg bg-dash-surface text-xs font-bold text-dash-text-secondary hover:bg-dash-surface-hover transition-colors border border-dash-border">
						{t("discard")}
					</button>
					<button className="px-4 py-2 rounded-lg bg-dash-accent text-xs font-bold text-dash-bg hover:bg-dash-accent-hover transition-all shadow-lg shadow-dash-accent/20 tracking-widest uppercase">
						{t("saveChanges")}
					</button>
				</div>
			</div>

			<div className="flex-1 flex gap-6 min-h-0">
				{/* Editor Panel */}
				<div className="flex-[3] bg-dash-surface border border-dash-border rounded-xl overflow-hidden flex flex-col shadow-sm">
					<div className="flex-1 min-h-0 overflow-hidden">
						<JsonEditor
							value={jsonText}
							onChange={setJsonText}
							onCursorLineChange={setCursorLine}
						/>
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

				{/* Help Panel */}
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
			</div>
		</div>
	);
};

const MetaBadge: React.FC<{ label: string; value: string }> = ({ label, value }) => (
	<div className="flex items-center gap-1.5 px-2 py-1 bg-dash-bg border border-dash-border rounded-md">
		<span className="text-[9px] font-bold text-dash-text-muted uppercase">{label}:</span>
		<span className="text-[10px] mono font-bold text-dash-text-secondary">{value}</span>
	</div>
);

export default GlobalConfigPage;
