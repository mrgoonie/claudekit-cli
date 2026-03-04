/**
 * Facade: re-exports all typed SQLite query helpers for the content command.
 * Consumers import from this file rather than the individual submodules.
 */

export {
	getUnprocessedEvents,
	insertGitEvent,
	markEventProcessed,
} from "@/commands/content/phases/db-queries-git-events.js";

export type { TaskLogInput } from "@/commands/content/phases/db-queries-content-items.js";
export {
	getContentById,
	getContentQueue,
	getRecentContent,
	insertContentItem,
	insertPublication,
	insertTaskLog,
	updateContentStatus,
} from "@/commands/content/phases/db-queries-content-items.js";
