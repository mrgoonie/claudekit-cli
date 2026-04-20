import {
	type CliDesignContext,
	type CliDesignContextOptions,
	createCliDesignContext,
} from "./tokens.js";

export interface NextStepsFooterOptions {
	commands: string[];
	context?: CliDesignContext;
	contextOptions?: CliDesignContextOptions;
}

export function renderNextStepsFooter(options: NextStepsFooterOptions): string[] {
	const context = options.context ?? createCliDesignContext(options.contextOptions);
	const bullet = context.box.bullet === "+" ? "-" : "•";
	return options.commands.map((command) => `${bullet} ${command}`);
}
