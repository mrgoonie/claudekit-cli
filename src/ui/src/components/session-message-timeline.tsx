/**
 * Session message timeline — groups consecutive same-role messages and
 * renders each group's content blocks via ContentBlockRenderer.
 */
import type React from "react";
import type { SessionMessage } from "../hooks/use-sessions";
import { useI18n } from "../i18n";
import ContentBlockRenderer from "./session-content-block-renderer";

// ─── Message Grouping ─────────────────────────────────────────────────────────

interface MessageGroup {
	role: string;
	timestamp: string;
	messages: SessionMessage[];
}

function groupMessages(messages: SessionMessage[]): MessageGroup[] {
	const groups: MessageGroup[] = [];
	for (const msg of messages) {
		const last = groups[groups.length - 1];
		if (last && last.role === msg.role) {
			last.messages.push(msg);
		} else {
			groups.push({
				role: msg.role,
				timestamp: msg.timestamp ?? "",
				messages: [msg],
			});
		}
	}
	return groups;
}

// ─── Message Group Component ──────────────────────────────────────────────────

function MessageGroupComponent({ group }: { group: MessageGroup }) {
	const { t } = useI18n();
	const isUser = group.role === "user";
	const count = group.messages.length;

	return (
		<div
			className={`flex flex-col gap-2 rounded-lg border p-4 ${
				isUser
					? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/60 dark:border-blue-800/40"
					: "bg-dash-surface border-dash-border"
			}`}
		>
			{/* Header: role badge + timestamp + optional count */}
			<div className="flex items-center gap-2">
				<span
					className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
						isUser
							? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
							: "bg-dash-accent-subtle text-dash-accent"
					}`}
				>
					{isUser ? t("sessionUser") : t("sessionAssistant")}
				</span>
				{group.timestamp && (
					<span className="text-[10px] text-dash-text-muted">
						{new Date(group.timestamp).toLocaleTimeString()}
					</span>
				)}
				{count > 1 && (
					<span className="text-[10px] text-dash-text-muted ml-auto">
						{count} {t("sessionGroupMessages")}
					</span>
				)}
			</div>

			{/* Content blocks for each message in the group */}
			{group.messages.map((msg, msgIdx) => (
				<div key={msg.timestamp ?? `msg-${msgIdx}`} className="flex flex-col gap-1.5">
					{msg.contentBlocks.map((block, blockIdx) => (
						<ContentBlockRenderer
							key={`${block.type}-${block.toolUseId ?? blockIdx}`}
							block={block}
							role={group.role}
						/>
					))}
				</div>
			))}
		</div>
	);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export interface TimelineProps {
	messages: SessionMessage[];
}

/** Renders a vertical message timeline with consecutive same-role grouping */
const SessionMessageTimeline: React.FC<TimelineProps> = ({ messages }) => {
	const groups = groupMessages(messages);
	return (
		<div className="flex flex-col gap-3">
			{groups.map((group, idx) => (
				<MessageGroupComponent key={`group-${group.timestamp || idx}`} group={group} />
			))}
		</div>
	);
};

export default SessionMessageTimeline;
