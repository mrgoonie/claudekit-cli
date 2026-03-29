/**
 * Config command types
 */

export interface ConfigCommandOptions {
	global?: boolean;
	local?: boolean;
	json?: boolean;
	port?: number;
	noOpen?: boolean;
	dev?: boolean;
	host?: string;
}

export interface ConfigUIOptions {
	port?: number;
	noOpen?: boolean;
	dev?: boolean;
	host?: string;
}

export interface ConfigContext {
	options: ConfigCommandOptions;
	key?: string;
	value?: string;
}
