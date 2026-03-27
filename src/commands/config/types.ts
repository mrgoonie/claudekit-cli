/**
 * Config command types
 */

export interface ConfigCommandOptions {
	global?: boolean;
	local?: boolean;
	json?: boolean;
}

export interface ConfigUIOptions {
	port?: number;
	noOpen?: boolean;
	dev?: boolean;
}

export interface ConfigContext {
	options: ConfigCommandOptions;
	key?: string;
	value?: string;
}
