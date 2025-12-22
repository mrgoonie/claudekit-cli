import { z } from "zod";

export const ConfigShowOptionsSchema = z.object({
	global: z.boolean().optional().describe("Show only global config"),
	local: z.boolean().optional().describe("Show only local config"),
	json: z.boolean().optional().describe("Output as JSON"),
});

export const ConfigGetOptionsSchema = z.object({
	key: z.string().describe("Config key to get"),
	global: z.boolean().optional(),
});

export const ConfigSetOptionsSchema = z.object({
	key: z.string().describe("Config key to set"),
	value: z.string().describe("Value to set"),
	global: z.boolean().optional().describe("Set in global config"),
});

export const ConfigUnsetOptionsSchema = z.object({
	key: z.string().describe("Config key to unset"),
	global: z.boolean().optional(),
});

export const ConfigResetOptionsSchema = z.object({
	section: z.string().optional().describe("Section to reset (defaults, folders)"),
	global: z.boolean().optional(),
	yes: z.boolean().optional().describe("Skip confirmation"),
});

export const ConfigEditOptionsSchema = z.object({
	global: z.boolean().optional().describe("Edit global config"),
});

export type ConfigShowOptions = z.infer<typeof ConfigShowOptionsSchema>;
export type ConfigGetOptions = z.infer<typeof ConfigGetOptionsSchema>;
export type ConfigSetOptions = z.infer<typeof ConfigSetOptionsSchema>;
export type ConfigUnsetOptions = z.infer<typeof ConfigUnsetOptionsSchema>;
export type ConfigResetOptions = z.infer<typeof ConfigResetOptionsSchema>;
export type ConfigEditOptions = z.infer<typeof ConfigEditOptionsSchema>;
