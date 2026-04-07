export interface BackupsListOptions {
	json?: boolean;
	limit?: string;
}

export interface BackupsRestoreOptions {
	json?: boolean;
	yes?: boolean;
}

export interface BackupsPruneOptions {
	json?: boolean;
	yes?: boolean;
	all?: boolean;
	keep?: string;
}
