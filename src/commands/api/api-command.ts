/**
 * API command orchestrator — routes `ck api [action]` to appropriate handler
 */

import pc from "picocolors";
import { reviewwebCommand } from "./reviewweb/reviewweb-command.js";
import { handleApiProxy } from "./subcommands/api-proxy-handler.js";
import { handleApiServices } from "./subcommands/api-services-handler.js";
import { handleApiSetup } from "./subcommands/api-setup-handler.js";
import { handleApiStatus } from "./subcommands/api-status-handler.js";
import { vidcapCommand } from "./vidcap/vidcap-command.js";

interface ApiCommandOptions {
	method?: string;
	body?: string;
	query?: string;
	key?: string;
	force?: boolean;
	json?: boolean;
	locale?: string;
	maxResults?: number;
	second?: string;
	order?: string;
	format?: string;
	maxLength?: number;
	instructions?: string;
	template?: string;
	type?: string;
	country?: string;
}

export async function apiCommand(
	action: string | undefined,
	arg1?: string,
	arg2?: string,
	options?: ApiCommandOptions,
): Promise<void> {
	const opts = options ?? {};

	if (action === "status") return handleApiStatus({ json: opts.json });
	if (action === "services") return handleApiServices({ json: opts.json });
	if (action === "setup") return handleApiSetup({ key: opts.key, force: opts.force });

	if (action === "proxy") {
		if (!arg1) {
			console.error("Usage: ck api proxy <service> <path>");
			process.exitCode = 1;
			return;
		}
		return handleApiProxy(arg1, arg2 ?? "", {
			method: (opts.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE") ?? "GET",
			body: opts.body,
			query: opts.query,
			json: opts.json,
		});
	}

	if (action === "vidcap") {
		return vidcapCommand(arg1, arg2 ?? "", {
			json: opts.json,
			locale: opts.locale,
			maxResults: opts.maxResults,
			second: opts.second,
			order: opts.order as "time" | "relevance" | undefined,
		});
	}

	if (action === "reviewweb") {
		return reviewwebCommand(arg1, arg2 ?? "", {
			json: opts.json,
			format: opts.format as "bullet" | "paragraph" | undefined,
			maxLength: opts.maxLength,
			instructions: opts.instructions,
			template: opts.template,
			type: opts.type as "web" | "image" | "file" | "all" | undefined,
			country: opts.country,
		});
	}

	// Unknown action or no action — show help
	if (action) {
		console.error(`Unknown action: ${action}`);
		console.log();
	}
	showApiHelp();
}

function showApiHelp(): void {
	console.log(pc.bold("ClaudeKit API Commands"));
	console.log();
	console.log("  Core:");
	console.log("    ck api status                           Validate key + rate limit");
	console.log("    ck api services                         List proxy services");
	console.log("    ck api setup                            Configure API key");
	console.log("    ck api proxy <service> <path>           Generic proxy request");
	console.log();
	console.log("  VidCap:");
	console.log("    ck api vidcap info <url>                Video metadata");
	console.log("    ck api vidcap search <query>            YouTube search");
	console.log("    ck api vidcap summary <url>             AI video summary");
	console.log("    ck api vidcap caption <url>             Video transcript");
	console.log("    ck api vidcap screenshot <url>          Video screenshot");
	console.log("    ck api vidcap comments <url>            Video comments");
	console.log("    ck api vidcap media <url>               Media formats");
	console.log();
	console.log("  ReviewWeb:");
	console.log("    ck api reviewweb scrape <url>           Scrape webpage");
	console.log("    ck api reviewweb summarize <url>        AI summarize");
	console.log("    ck api reviewweb markdown <url>         Convert to markdown");
	console.log("    ck api reviewweb extract <url>          Extract structured data");
	console.log("    ck api reviewweb links <url>            Extract links");
	console.log("    ck api reviewweb screenshot <url>       Webpage screenshot");
	console.log("    ck api reviewweb seo-traffic <domain>   SEO traffic");
	console.log("    ck api reviewweb seo-keywords <kw>      SEO keywords");
	console.log("    ck api reviewweb seo-backlinks <domain> SEO backlinks");
	console.log();
}
