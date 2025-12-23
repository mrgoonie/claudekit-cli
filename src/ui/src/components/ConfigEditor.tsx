import type React from "react";
import { useState } from "react";
import { useFieldAtLine } from "../hooks/useFieldAtLine";
import { CONFIG_FIELD_DOCS } from "../services/configFieldDocs";
import type { Project } from "../types";

interface ConfigEditorProps {
	project: Project;
	onBack: () => void;
}

const ConfigEditor: React.FC<ConfigEditorProps> = ({ project, onBack }) => {
	const [activeTab, setActiveTab] = useState<"merged" | "local" | "global">("merged");
	const [jsonText] = useState(
		JSON.stringify(
			{
				codingLevel: project.id === "p1" ? 3 : project.id === "p2" ? 2 : 1,
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
					thinkingLanguage: "en",
					responseLanguage: null,
				},
				project: {
					type: "auto",
					packageManager: "pnpm",
					framework: "react",
				},
				assertions: ["Follow best practices", "No unused imports"],
			},
			null,
			2,
		),
	);

	const [cursorLine, setCursorLine] = useState(0);
	const activeFieldPath = useFieldAtLine(jsonText, cursorLine);
	const fieldDoc = activeFieldPath ? CONFIG_FIELD_DOCS[activeFieldPath] : null;

	const handleLineClick = (index: number) => {
		setCursorLine(index);
	};

	return (
		<div className="animate-in fade-in duration-300 w-full h-full flex flex-col transition-colors">
			<div className="flex items-center justify-between mb-6 shrink-0">
				<div>
					<button
						onClick={onBack}
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
						Back to Dashboard
					</button>
					<h1 className="text-2xl font-bold tracking-tight text-dash-text">
						Educational Config Editor
					</h1>
				</div>

				<div className="flex items-center gap-3">
					<button className="px-4 py-2 rounded-lg bg-dash-surface text-xs font-bold text-dash-text-secondary hover:bg-dash-surface-hover transition-colors border border-dash-border">
						Discard
					</button>
					<button className="px-4 py-2 rounded-lg bg-dash-accent text-xs font-bold text-dash-bg hover:bg-dash-accent-hover transition-all shadow-lg shadow-dash-accent/20 tracking-widest uppercase">
						Save Changes
					</button>
				</div>
			</div>

			<div className="flex-1 flex gap-6 min-h-0">
				{/* Left Panel: The Editor */}
				<div className="flex-[3] bg-dash-surface border border-dash-border rounded-xl overflow-hidden flex flex-col shadow-sm">
					<div className="flex items-center gap-1 bg-dash-surface-hover/50 px-4 py-2 border-b border-dash-border shrink-0">
						<TabButton
							active={activeTab === "merged"}
							label="Merged View"
							onClick={() => setActiveTab("merged")}
						/>
						<TabButton
							active={activeTab === "local"}
							label="Local (.ck.json)"
							onClick={() => setActiveTab("local")}
						/>
						<TabButton
							active={activeTab === "global"}
							label="Global (~/.claude/)"
							onClick={() => setActiveTab("global")}
						/>
					</div>

					<div className="flex-1 flex min-h-0 relative">
						{/* Simple Mock Editor */}
						<div className="flex-1 overflow-auto bg-dash-surface p-4 font-mono text-sm leading-relaxed scrollbar-hide">
							<div className="relative inline-block w-full">
								{jsonText.split("\n").map((line, i) => (
									<div
										key={i}
										onClick={() => handleLineClick(i)}
										className={`flex cursor-text transition-colors px-2 rounded-sm ${
											cursorLine === i
												? "bg-dash-accent-subtle ring-1 ring-dash-accent/20"
												: "hover:bg-dash-bg/50"
										}`}
									>
										<span className="w-8 text-dash-text-muted select-none mr-4 text-right border-r border-dash-border pr-2 shrink-0">
											{i + 1}
										</span>
										<pre className="whitespace-pre break-all overflow-hidden flex-1">
											<span
												className={
													line.includes(":")
														? "text-dash-accent font-semibold"
														: line.includes('"')
															? "text-dash-text opacity-90"
															: line.match(/\d+/)
																? "text-dash-accent-hover"
																: "text-dash-text-secondary"
												}
											>
												{line}
											</span>
										</pre>
									</div>
								))}
							</div>
						</div>
					</div>

					<div className="px-4 py-2 bg-dash-surface-hover/30 border-t border-dash-border text-[10px] text-dash-text-muted flex justify-between uppercase tracking-widest font-bold">
						<div className="flex gap-4">
							<span>UTF-8</span>
							<span>JSON</span>
							<span>L:{cursorLine + 1}</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-1.5 h-1.5 rounded-full bg-dash-accent" />
							Syntax Valid
						</div>
					</div>
				</div>

				{/* Right Panel: Contextual Documentation */}
				<div className="flex-[2] bg-dash-surface border border-dash-border rounded-xl flex flex-col shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-2 duration-300">
					<div className="p-4 border-b border-dash-border bg-dash-surface-hover/50 shrink-0">
						<h3 className="text-xs font-bold text-dash-text-secondary uppercase tracking-widest">
							Configuration Help
						</h3>
					</div>

					<div className="flex-1 overflow-y-auto p-6">
						{fieldDoc ? (
							<div className="space-y-6 animate-in fade-in duration-500">
								<header>
									<div className="flex items-center gap-2 mb-1">
										<span className="text-[10px] bg-dash-accent-subtle text-dash-accent px-1.5 py-0.5 rounded font-mono uppercase font-bold">
											Field
										</span>
										<h2 className="text-lg font-bold text-dash-text mono break-all">
											{fieldDoc.path}
										</h2>
									</div>
									<div className="flex flex-wrap gap-2 mt-2">
										<MetaBadge label="Type" value={fieldDoc.type} />
										<MetaBadge label="Default" value={fieldDoc.default} />
									</div>
								</header>

								<section>
									<h4 className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-2">
										Description
									</h4>
									<p className="text-sm text-dash-text-secondary leading-relaxed italic">
										{fieldDoc.description}
									</p>
								</section>

								{fieldDoc.validValues && (
									<section>
										<h4 className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-2">
											Valid Values
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
											System Effect
										</h4>
										<p className="text-[12px] text-dash-text-secondary leading-normal">
											{fieldDoc.effect}
										</p>
									</section>
								)}

								{fieldDoc.example && (
									<section>
										<h4 className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-2">
											Example Usage
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
									<p className="text-sm font-bold text-dash-text mb-1 italic">Knowledge Base</p>
									<p className="text-xs text-dash-text-secondary">
										Click on any configuration field to see detailed documentation and usage
										examples.
									</p>
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
								Extracted from ClaudeKit v2.x Specification
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const TabButton: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({
	active,
	label,
	onClick,
}) => (
	<button
		onClick={onClick}
		className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
			active
				? "bg-dash-surface text-dash-text border border-dash-border shadow-sm"
				: "text-dash-text-muted hover:text-dash-text-secondary"
		}`}
	>
		{label}
	</button>
);

const MetaBadge: React.FC<{ label: string; value: string }> = ({ label, value }) => (
	<div className="flex items-center gap-1.5 px-2 py-1 bg-dash-bg border border-dash-border rounded-md">
		<span className="text-[9px] font-bold text-dash-text-muted uppercase">{label}:</span>
		<span className="text-[10px] mono font-bold text-dash-text-secondary">{value}</span>
	</div>
);

export default ConfigEditor;
