import {
	type BoxChars,
	type CliDesignContext,
	type CliDesignContextOptions,
	createCliDesignContext,
	visibleWidth as measureWidth,
	padVisible,
	paint,
	truncateMiddle,
	wrapText,
} from "./tokens.js";

export interface PanelZone {
	label: string;
	lines: string[];
}

export interface PanelOptions {
	context?: CliDesignContext;
	contextOptions?: CliDesignContextOptions;
	subtitle?: string;
	title: string;
	zones: PanelZone[];
}

export function renderPanel(options: PanelOptions): string[] {
	const context = options.context ?? createCliDesignContext(options.contextOptions);
	const title = paint(options.title, "heading", context);
	const subtitle = options.subtitle ? paint(options.subtitle, "muted", context) : null;
	if (!context.supportsPanels) {
		return renderPlainPanel(options.zones, title, subtitle, context);
	}
	return renderBoxedPanel(options.zones, title, subtitle, context);
}

function renderPlainPanel(
	zones: PanelZone[],
	title: string,
	subtitle: string | null,
	context: CliDesignContext,
): string[] {
	const lines = [title];
	if (subtitle) lines.push(subtitle);
	lines.push("");
	for (const zone of zones) {
		lines.push(paint(zone.label, "accent", context));
		for (const line of zone.lines) {
			lines.push(...wrapText(line, context.width - 2).map((entry) => `  ${entry}`));
		}
		lines.push("");
	}
	return trimTrailingBlank(lines);
}

function renderBoxedPanel(
	zones: PanelZone[],
	title: string,
	subtitle: string | null,
	context: CliDesignContext,
): string[] {
	const labelWidth = Math.min(12, Math.max(...zones.map((zone) => zone.label.length), 4));
	const innerWidth = context.width - 4;
	const lines: string[] = [renderTopBorder(title, context.box, context.width)];

	if (subtitle) {
		lines.push(renderContentLine(subtitle, innerWidth, context.box));
		lines.push(renderContentLine("", innerWidth, context.box));
	}

	for (const [index, zone] of zones.entries()) {
		for (const line of formatZone(zone, labelWidth, innerWidth, context)) {
			lines.push(renderContentLine(line, innerWidth, context.box));
		}
		if (index < zones.length - 1) {
			lines.push(renderContentLine("", innerWidth, context.box));
		}
	}

	lines.push(renderBottomBorder(context.box, context.width));
	return lines;
}

function formatZone(
	zone: PanelZone,
	labelWidth: number,
	innerWidth: number,
	context: CliDesignContext,
): string[] {
	const availableWidth = Math.max(8, innerWidth - labelWidth - 3);
	const label = paint(zone.label, "accent", context);
	const rendered: string[] = [];

	for (const [index, rawLine] of zone.lines.entries()) {
		const wrappedLines = wrapText(rawLine, availableWidth);
		for (const [wrappedIndex, wrappedLine] of wrappedLines.entries()) {
			const prefix =
				index === 0 && wrappedIndex === 0 ? padVisible(label, labelWidth) : " ".repeat(labelWidth);
			rendered.push(` ${prefix} ${wrappedLine}`);
		}
	}

	return rendered;
}

function renderTopBorder(title: string, box: BoxChars, width: number): string {
	const availableWidth = width - 2;
	const decorationWidth = 3;
	const maxTitleWidth = Math.max(1, availableWidth - decorationWidth - 1);
	const safeTitle =
		measureWidth(title) > maxTitleWidth ? truncateMiddle(title, maxTitleWidth) : title;
	const heading = `${box.h} ${safeTitle} `;
	const fill = Math.max(1, availableWidth - measureWidth(heading));
	return `${box.tl}${heading}${box.h.repeat(fill)}${box.tr}`;
}

function renderBottomBorder(box: BoxChars, width: number): string {
	return `${box.bl}${box.h.repeat(width - 2)}${box.br}`;
}

function renderContentLine(content: string, width: number, box: BoxChars): string {
	return `${box.v} ${padVisible(content, width)} ${box.v}`;
}

function trimTrailingBlank(lines: string[]): string[] {
	const trimmed = [...lines];
	while (trimmed[trimmed.length - 1] === "") {
		trimmed.pop();
	}
	return trimmed;
}
