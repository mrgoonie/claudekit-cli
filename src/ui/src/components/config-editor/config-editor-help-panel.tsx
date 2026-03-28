/**
 * ConfigEditorHelpPanel - Right panel with field documentation
 */
import type React from "react";
import { useI18n } from "../../i18n";
import { CONFIG_FIELD_DOCS, type FieldDoc } from "../../services/configFieldDocs";
import { MetaBadge } from "./meta-badge";

export interface ConfigEditorHelpPanelProps {
	width: number;
	fieldDoc: FieldDoc | null;
	activeFieldPath: string | null;
	extraContent?: React.ReactNode;
	overrideBadge?: React.ReactNode;
}

export const ConfigEditorHelpPanel: React.FC<ConfigEditorHelpPanelProps> = ({
	width,
	fieldDoc,
	activeFieldPath,
	extraContent,
	overrideBadge,
}) => {
	const { t, lang } = useI18n();
	const resolvedFieldDoc =
		fieldDoc ??
		(activeFieldPath
			? (CONFIG_FIELD_DOCS[activeFieldPath] ?? {
					path: activeFieldPath,
					type: "unknown",
					default: "n/a",
					description:
						"Help is being resolved for this field. Try editing the value or switching to the JSON view for schema-based details.",
					descriptionVi:
						"Đang tải trợ giúp cho trường này. Hãy thử chỉnh sửa giá trị hoặc chuyển sang chế độ JSON để xem mô tả suy ra từ schema.",
				})
			: null);

	return (
		<div
			style={{ width: `${width}%` }}
			className="bg-dash-surface border border-dash-border rounded-xl flex flex-col shadow-sm overflow-hidden min-w-0"
		>
			<div className="p-3 border-b border-dash-border bg-dash-surface-hover/50 shrink-0">
				<h3 className="text-xs font-bold text-dash-text-secondary uppercase tracking-widest">
					{t("configurationHelp")}
				</h3>
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				{resolvedFieldDoc ? (
					<div className="space-y-5 animate-in fade-in duration-500">
						<header>
							<div className="flex items-center gap-2 mb-1 flex-wrap">
								<span className="text-[10px] bg-dash-accent-subtle text-dash-accent px-1.5 py-0.5 rounded font-mono uppercase font-bold">
									{t("field")}
								</span>
								<h2 className="text-base font-bold text-dash-text mono break-all">
									{resolvedFieldDoc.path}
								</h2>
								{overrideBadge}
							</div>
							<div className="flex flex-wrap gap-2 mt-2">
								<MetaBadge label={t("type")} value={resolvedFieldDoc.type} />
								<MetaBadge label={t("default")} value={resolvedFieldDoc.default} />
							</div>
						</header>

						<section>
							<h4 className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-2">
								{t("description")}
							</h4>
							<p className="text-sm text-dash-text-secondary leading-relaxed italic">
								{lang === "vi" ? resolvedFieldDoc.descriptionVi : resolvedFieldDoc.description}
							</p>
						</section>

						{resolvedFieldDoc.validValues && (
							<section>
								<h4 className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-2">
									{t("validValues")}
								</h4>
								<div className="flex flex-wrap gap-1.5">
									{resolvedFieldDoc.validValues.map((v) => (
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

						{resolvedFieldDoc.effect && (
							<section className="bg-dash-accent-subtle/30 p-3 rounded-lg border border-dash-accent/10">
								<h4 className="text-[10px] font-bold text-dash-accent uppercase tracking-widest mb-1">
									{t("systemEffect")}
								</h4>
								<p className="text-[12px] text-dash-text-secondary leading-normal">
									{lang === "vi" && resolvedFieldDoc.effectVi
										? resolvedFieldDoc.effectVi
										: resolvedFieldDoc.effect}
								</p>
							</section>
						)}

						{resolvedFieldDoc.example && (
							<section>
								<h4 className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest mb-2">
									{t("exampleUsage")}
								</h4>
								<div className="bg-dash-bg p-3 rounded-lg border border-dash-border overflow-hidden">
									<pre className="text-[11px] mono text-dash-text-secondary whitespace-pre overflow-x-auto">
										{resolvedFieldDoc.example}
									</pre>
								</div>
							</section>
						)}

						{extraContent}
					</div>
				) : (
					<div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-4">
						<div className="w-10 h-10 rounded-full bg-dash-bg border border-dash-border flex items-center justify-center text-lg">
							?
						</div>
						<div className="max-w-[180px]">
							<p className="text-sm font-bold text-dash-text mb-1 italic">{t("knowledgeBase")}</p>
							<p className="text-xs text-dash-text-secondary">{t("clickToSeeHelp")}</p>
						</div>
					</div>
				)}
			</div>

			{resolvedFieldDoc && (
				<div className="p-3 bg-dash-surface-hover/20 border-t border-dash-border shrink-0">
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
	);
};
