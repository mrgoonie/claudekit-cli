import { renderPanel } from "./panel.js";
import {
	type CliDesignContext,
	type CliDesignContextOptions,
	createCliDesignContext,
} from "./tokens.js";

export interface SourceTargetHeaderOptions {
	context?: CliDesignContext;
	contextOptions?: CliDesignContextOptions;
	sourceLines: string[];
	subtitle?: string;
	targetLines: string[];
	title: string;
}

export function renderSourceTargetHeader(options: SourceTargetHeaderOptions): string[] {
	const context = options.context ?? createCliDesignContext(options.contextOptions);
	return renderPanel({
		context,
		subtitle: options.subtitle,
		title: options.title,
		zones: [
			{ label: "SOURCE", lines: options.sourceLines },
			{ label: "DESTINATION", lines: options.targetLines },
		],
	});
}
