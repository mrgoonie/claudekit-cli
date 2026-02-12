/**
 * Converter registry — dispatches to the correct converter based on format
 */
import type { ConversionFormat, ConversionResult, PortableItem, ProviderType } from "../types.js";
import { convertDirectCopy } from "./direct-copy.js";
import { convertFmStrip } from "./fm-strip.js";
import { convertFmToFm } from "./fm-to-fm.js";
import { convertFmToJson } from "./fm-to-json.js";
import { convertFmToYaml } from "./fm-to-yaml.js";
import { convertMdStrip } from "./md-strip.js";
import { convertMdToMdc } from "./md-to-mdc.js";
import { convertMdToToml } from "./md-to-toml.js";
import { convertToSkillMd } from "./skill-md.js";

/**
 * Convert a portable item to the target provider's format
 */
export function convertItem(
	item: PortableItem,
	format: ConversionFormat,
	provider: ProviderType,
): ConversionResult {
	switch (format) {
		case "direct-copy":
			return convertDirectCopy(item);
		case "fm-to-fm":
			return convertFmToFm(item, provider);
		case "fm-to-yaml":
			return convertFmToYaml(item);
		case "fm-strip":
			return convertFmStrip(item, provider);
		case "fm-to-json":
			return convertFmToJson(item);
		case "md-to-toml":
			return convertMdToToml(item);
		case "skill-md":
			return convertToSkillMd(item);
		case "md-strip":
			return convertMdStrip(item, provider);
		case "md-to-mdc":
			return convertMdToMdc(item, provider);
		default: {
			const _exhaustive: never = format;
			return {
				content: item.body,
				filename: `${item.name}.md`,
				warnings: [`Unknown format: ${_exhaustive}`],
			};
		}
	}
}
