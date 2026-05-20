/**
 * API Command Help
 *
 * Help definition for the 'api' command and all sub-services.
 * Source of truth for flags: src/cli/command-registry.ts lines 409-428.
 */

import type { CommandHelp } from "../help-types.js";

export const apiCommandHelp: CommandHelp = {
	name: "api",
	description: "Interact with ClaudeKit API and proxy services",
	usage: "ck api [action] [service] [path] [options]",
	examples: [
		{
			command: "ck api status",
			description: "Validate your API key and check rate limit status",
		},
		{
			command: "ck api vidcap summary https://youtu.be/abc123",
			description: "Generate an AI summary of a YouTube video",
		},
	],
	optionGroups: [
		{
			title: "Output Options",
			options: [{ flags: "--json", description: "Output raw JSON instead of formatted display" }],
		},
	],
	subcommands: [
		{
			name: "status",
			description: "Validate API key and check rate limit",
			usage: "ck api status [--json]",
			examples: [],
			optionGroups: [
				{
					title: "Output Options",
					options: [
						{ flags: "--json", description: "Output raw JSON instead of formatted display" },
					],
				},
			],
		},
		{
			name: "services",
			description: "List available proxy services",
			usage: "ck api services [--json]",
			examples: [],
			optionGroups: [
				{
					title: "Output Options",
					options: [
						{ flags: "--json", description: "Output raw JSON instead of formatted display" },
					],
				},
			],
		},
		{
			name: "setup",
			description: "Configure and store your ClaudeKit API key",
			usage: "ck api setup [--key <key>] [--force] [--json]",
			examples: [],
			optionGroups: [
				{
					title: "Setup Options",
					options: [
						{ flags: "--key <key>", description: "API key to store" },
						{ flags: "--force", description: "Force re-setup even if key already exists" },
					],
				},
				{
					title: "Output Options",
					options: [
						{ flags: "--json", description: "Output raw JSON instead of formatted display" },
					],
				},
			],
		},
		{
			name: "proxy",
			description: "Generic HTTP proxy to any ClaudeKit-backed service",
			usage: "ck api proxy <service> <path> [options]",
			examples: [],
			optionGroups: [
				{
					title: "Proxy Options",
					options: [
						{
							flags: "--method <method>",
							description: "HTTP method for the request",
							defaultValue: "GET",
						},
						{ flags: "--body <json>", description: "Request body as JSON string" },
						{ flags: "--query <json>", description: "Query params as JSON string" },
					],
				},
				{
					title: "Output Options",
					options: [
						{ flags: "--json", description: "Output raw JSON instead of formatted display" },
					],
				},
			],
		},
		// NOTE: vidcap/reviewweb carry 3rd-level `subcommands` as reference content
		// (surfaced in cli-manifest.json + docs/cli-reference.md).
		// The help interceptor routes at most 2 levels — `ck api vidcap info --help`
		// falls back to `ck api vidcap --help`. Do not assume `--help` works on
		// entries nested under these without extending the router.
		{
			name: "vidcap",
			description: "Video metadata and AI processing via YouTube",
			usage: "ck api vidcap <action> <url|query>",
			examples: [],
			optionGroups: [
				{
					title: "Vidcap Options",
					options: [
						{
							flags: "--locale <locale>",
							description: "Locale for summary/caption output",
							defaultValue: "en",
						},
						{ flags: "--max-results <n>", description: "Max results for search action" },
						{
							flags: "--second <s>",
							description: "Timestamp in seconds for screenshot action",
						},
						{
							flags: "--order <order>",
							description: "Sort order for comments (time/relevance)",
						},
					],
				},
				{
					title: "Output Options",
					options: [
						{ flags: "--json", description: "Output raw JSON instead of formatted display" },
					],
				},
			],
			subcommands: [
				{
					name: "info",
					description: "Fetch video metadata (title, duration, channel)",
					usage: "ck api vidcap info <url>",
					examples: [],
					optionGroups: [
						{
							title: "Output Options",
							options: [{ flags: "--json", description: "Output raw JSON" }],
						},
					],
				},
				{
					name: "search",
					description: "Search YouTube for videos matching a query",
					usage: "ck api vidcap search <query>",
					examples: [],
					optionGroups: [
						{
							title: "Search Options",
							options: [{ flags: "--max-results <n>", description: "Maximum number of results" }],
						},
					],
				},
				{
					name: "summary",
					description: "Generate an AI summary of a video",
					usage: "ck api vidcap summary <url>",
					examples: [],
					optionGroups: [
						{
							title: "Summary Options",
							options: [
								{
									flags: "--locale <locale>",
									description: "Locale for summary text",
									defaultValue: "en",
								},
							],
						},
					],
				},
				{
					name: "caption",
					description: "Extract captions/transcript from a video",
					usage: "ck api vidcap caption <url>",
					examples: [],
					optionGroups: [
						{
							title: "Caption Options",
							options: [
								{
									flags: "--locale <locale>",
									description: "Locale for caption text",
									defaultValue: "en",
								},
							],
						},
					],
				},
				{
					name: "screenshot",
					description: "Capture a frame from a video at a specific timestamp",
					usage: "ck api vidcap screenshot <url>",
					examples: [],
					optionGroups: [
						{
							title: "Screenshot Options",
							options: [{ flags: "--second <s>", description: "Timestamp in seconds" }],
						},
					],
				},
				{
					name: "comments",
					description: "Fetch comments for a video",
					usage: "ck api vidcap comments <url>",
					examples: [],
					optionGroups: [
						{
							title: "Comment Options",
							options: [
								{
									flags: "--order <order>",
									description: "Sort order: time or relevance",
								},
								{ flags: "--max-results <n>", description: "Maximum number of comments" },
							],
						},
					],
				},
				{
					name: "media",
					description: "Download media or extract media URLs from a video",
					usage: "ck api vidcap media <url>",
					examples: [],
					optionGroups: [
						{
							title: "Output Options",
							options: [{ flags: "--json", description: "Output raw JSON" }],
						},
					],
				},
			],
		},
		{
			name: "reviewweb",
			description: "Web scraping and SEO analysis via the ClaudeKit proxy",
			usage: "ck api reviewweb <action> <url|domain|keyword>",
			examples: [],
			optionGroups: [
				{
					title: "Review Options",
					options: [
						{
							flags: "--format <fmt>",
							description: "Summary format: bullet or paragraph",
						},
						{ flags: "--max-length <n>", description: "Maximum summary length in characters" },
						{
							flags: "--instructions <text>",
							description: "Extraction instructions (extract action)",
						},
						{ flags: "--template <json>", description: "JSON template for structured extraction" },
						{
							flags: "--type <type>",
							description: "Link type filter: web/image/file/all",
						},
						{ flags: "--country <code>", description: "Country code for SEO commands" },
					],
				},
				{
					title: "Output Options",
					options: [
						{ flags: "--json", description: "Output raw JSON instead of formatted display" },
					],
				},
			],
			subcommands: [
				{
					name: "scrape",
					description: "Scrape raw HTML content from a URL",
					usage: "ck api reviewweb scrape <url>",
					examples: [],
					optionGroups: [
						{
							title: "Output Options",
							options: [{ flags: "--json", description: "Output raw JSON" }],
						},
					],
				},
				{
					name: "summarize",
					description: "AI-generated summary of a web page",
					usage: "ck api reviewweb summarize <url>",
					examples: [],
					optionGroups: [
						{
							title: "Summary Options",
							options: [
								{ flags: "--format <fmt>", description: "Output format: bullet or paragraph" },
								{ flags: "--max-length <n>", description: "Maximum length in characters" },
							],
						},
					],
				},
				{
					name: "markdown",
					description: "Convert a web page to clean Markdown",
					usage: "ck api reviewweb markdown <url>",
					examples: [],
					optionGroups: [
						{
							title: "Output Options",
							options: [{ flags: "--json", description: "Output raw JSON" }],
						},
					],
				},
				{
					name: "extract",
					description: "Extract structured data from a web page",
					usage: "ck api reviewweb extract <url>",
					examples: [],
					optionGroups: [
						{
							title: "Extraction Options",
							options: [
								{ flags: "--instructions <text>", description: "Extraction instructions" },
								{ flags: "--template <json>", description: "JSON template for output shape" },
							],
						},
					],
				},
				{
					name: "links",
					description: "Extract all links from a web page",
					usage: "ck api reviewweb links <url>",
					examples: [],
					optionGroups: [
						{
							title: "Filter Options",
							options: [
								{
									flags: "--type <type>",
									description: "Link type: web/image/file/all",
									defaultValue: "all",
								},
							],
						},
					],
				},
				{
					name: "screenshot",
					description: "Capture a screenshot of a web page",
					usage: "ck api reviewweb screenshot <url>",
					examples: [],
					optionGroups: [
						{
							title: "Output Options",
							options: [{ flags: "--json", description: "Output raw JSON" }],
						},
					],
				},
				{
					name: "seo-traffic",
					description: "Fetch estimated organic traffic data for a domain",
					usage: "ck api reviewweb seo-traffic <domain>",
					examples: [],
					optionGroups: [
						{
							title: "SEO Options",
							options: [
								{ flags: "--country <code>", description: "Country code for traffic data" },
							],
						},
					],
				},
				{
					name: "seo-keywords",
					description: "Fetch top SEO keywords for a domain or keyword",
					usage: "ck api reviewweb seo-keywords <domain|keyword>",
					examples: [],
					optionGroups: [
						{
							title: "SEO Options",
							options: [
								{ flags: "--country <code>", description: "Country code for keyword data" },
							],
						},
					],
				},
				{
					name: "seo-backlinks",
					description: "Fetch backlink profile for a domain",
					usage: "ck api reviewweb seo-backlinks <domain>",
					examples: [],
					optionGroups: [
						{
							title: "SEO Options",
							options: [
								{ flags: "--country <code>", description: "Country code for backlink data" },
							],
						},
					],
				},
			],
		},
	],
};
