import { logger } from "@/shared/logger.js";
import { intro, outro } from "@/shared/safe-prompts.js";
import pc from "picocolors";

const API_URL = "https://claudekit.cc/api/egg";

interface EggResponse {
	message: string;
	code: string;
	discount: string;
	hint: string;
	checkout: string;
	campaign: string;
	expires: string;
	rarity: string;
}

/**
 * Get rarity color based on rarity label
 */
function getRarityColor(rarity: string): (text: string) => string {
	switch (rarity) {
		case "Legendary":
			return pc.magenta;
		case "Epic":
			return pc.yellow;
		case "Rare":
			return pc.blue;
		case "Uncommon":
			return pc.green;
		default:
			return pc.gray;
	}
}

/**
 * Easter Egg command - Roll for a random discount code
 */
export async function easterEggCommand(): Promise<void> {
	intro("🥚 Code Hunt 2025 - Easter Egg");

	try {
		console.log(pc.dim("\n  Rolling for a discount code...\n"));

		const response = await fetch(API_URL);

		if (!response.ok) {
			if (response.status === 429) {
				console.log(pc.yellow("  🐰 Slow down! The eggs aren't going anywhere."));
				console.log(pc.dim("  Wait a minute and try again.\n"));
				outro("🥚 Rate limited");
				return;
			}
			throw new Error(`API returned ${response.status}`);
		}

		const data = (await response.json()) as EggResponse;
		const rarityColor = getRarityColor(data.rarity);

		// Display the result with fun animation-like output
		console.log(`  ✨ ${pc.bold(data.message)}`);
		console.log();
		console.log(`  ${pc.bold("Code:")}     ${pc.green(pc.bold(data.code))}`);
		console.log(`  ${pc.bold("Discount:")} ${pc.cyan(data.discount)} off`);
		console.log(`  ${pc.bold("Rarity:")}   ${rarityColor(data.rarity)}`);
		console.log(`  ${pc.bold("Hint:")}     ${pc.dim(data.hint)}`);
		console.log();
		console.log(`  ${pc.dim("Redeem at:")} ${pc.underline(data.checkout)}`);
		console.log(`  ${pc.dim("Expires:")}   ${data.expires.split("T")[0]}`);
		console.log();

		outro("🎄 Happy Holidays from ClaudeKit!");
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Failed to fetch easter egg");
		console.log(pc.red("\n  Failed to connect to the egg API."));
		console.log(pc.dim("  Make sure you have internet access.\n"));
		process.exit(1);
	}
}
