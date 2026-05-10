import {
	type CliDesignContext,
	type CliDesignContextOptions,
	createCliDesignContext,
	padVisible,
	paint,
	truncateMiddle,
} from "./tokens.js";

export interface PreflightRowOptions {
	context?: CliDesignContext;
	contextOptions?: CliDesignContextOptions;
	count: number;
	destinations: string[];
	icon?: string;
	label: string;
	notes?: string[];
	source?: string;
}

export function renderPreflightRow(options: PreflightRowOptions): string[] {
	const context = options.context ?? createCliDesignContext(options.contextOptions);
	const icon = options.icon ?? context.box.bullet;
	const label = padVisible(options.label, 10);
	const count = String(options.count).padStart(3, " ");
	const prefix = `  [${icon}] ${label} ${count}  `;
	const flowPrefix = `${" ".repeat(prefix.length)}-> `;
	const availableWidth = Math.max(10, context.width - flowPrefix.length);
	const [firstDestination, ...extraDestinations] =
		options.destinations.length > 0
			? options.destinations
			: ["unsupported for selected provider(s)"];

	const source = options.source ? `from ${options.source}` : "from source unavailable";
	const lines = [`${prefix}${truncateMiddle(source, Math.max(10, context.width - prefix.length))}`];
	lines.push(`${flowPrefix}${truncateMiddle(firstDestination, availableWidth)}`);
	for (const destination of extraDestinations) {
		lines.push(`${flowPrefix}${truncateMiddle(destination, availableWidth)}`);
	}
	for (const note of options.notes ?? []) {
		lines.push(`${" ".repeat(prefix.length)}${paint(`(${note})`, "muted", context)}`);
	}
	return lines;
}
