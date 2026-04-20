import pc from "picocolors";
import { type CliDesignContext, createCliDesignContext } from "../../ui/ck-cli-design/index.js";

export interface ProgressSink {
	done(message?: string): void;
	tick(label: string): void;
}

export function createMigrateProgressSink(
	total: number,
	context = createCliDesignContext(),
): ProgressSink {
	if (!process.stdout.isTTY || process.env.CI || process.env.TERM === "dumb") {
		return createDotProgressSink();
	}
	return createTtyProgressSink(total, context);
}

function createDotProgressSink(): ProgressSink {
	let current = 0;
	return {
		done(message) {
			if (current > 0) process.stdout.write("\n");
			if (message) console.log(message);
		},
		tick() {
			current += 1;
			process.stdout.write(".");
		},
	};
}

function createTtyProgressSink(total: number, context: CliDesignContext): ProgressSink {
	let current = 0;
	let rendered = false;

	return {
		done(message) {
			if (rendered) {
				process.stdout.write("\r\x1b[K");
			}
			if (message) {
				console.log(context.useColor ? pc.green(message) : message);
			}
		},
		tick(label) {
			current += 1;
			const width = Math.max(10, Math.min(20, context.width - 34));
			const percent = total === 0 ? 100 : Math.round((current / total) * 100);
			const filled = Math.round((percent / 100) * width);
			const empty = width - filled;
			const isUnicode = context.box.bullet !== "+";
			const bar = `${isUnicode ? "█".repeat(filled) : "=".repeat(filled)}${
				isUnicode ? "░".repeat(empty) : "-".repeat(empty)
			}`;
			const heading = context.useColor ? pc.bold(label) : label;
			const line = `  ${heading} ${bar} ${String(percent).padStart(3, " ")}%`;
			process.stdout.write(`\r${line}`);
			rendered = true;
		},
	};
}
