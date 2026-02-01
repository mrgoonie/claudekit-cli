/**
 * Projects registry manager
 * Handles CRUD operations for ~/.claudekit/projects.json
 */
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { copyFile, mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import {
	DEFAULT_PROJECTS_REGISTRY,
	type ProjectsRegistry,
	ProjectsRegistrySchema,
	type RegisteredProject,
} from "@/types";
import type { AddProjectOptions, ProjectFilter, UpdateProjectOptions } from "./types.js";

export class ProjectsRegistryManager {
	private static registry: ProjectsRegistry | null = null;
	private static registryLoadedAt: number | null = null;
	private static lockFile: FileHandle | null = null;
	private static readonly CACHE_TTL_MS = 5000;
	private static readonly LOCK_RETRY_MS = 100;
	private static readonly LOCK_MAX_RETRIES = 50;

	/**
	 * Acquire file lock for registry operations
	 * Uses advisory locking to prevent concurrent writes
	 */
	private static async acquireLock(retries = 0): Promise<void> {
		const lockPath = `${PathResolver.getProjectsRegistryPath()}.lock`;
		const lockDir = dirname(lockPath);

		// Ensure directory exists before creating lock file
		if (!existsSync(lockDir)) {
			await mkdir(lockDir, { recursive: true });
		}

		try {
			// Try to create lock file exclusively (fails if exists)
			ProjectsRegistryManager.lockFile = await open(lockPath, "wx");
		} catch (err) {
			const error = err as NodeJS.ErrnoException;
			if (error.code === "EEXIST") {
				// Check for stale lock (older than 30 seconds)
				if (existsSync(lockPath)) {
					const lockStat = statSync(lockPath);
					const lockAge = Date.now() - lockStat.mtimeMs;
					const STALE_LOCK_MS = 30000; // 30 seconds

					if (lockAge > STALE_LOCK_MS) {
						logger.warning(
							`Stale lock file detected (age: ${Math.round(lockAge / 1000)}s), force-removing`,
						);
						await unlink(lockPath).catch(() => {
							// Ignore if already removed by another process
						});
						// Retry immediately after removing stale lock
						return ProjectsRegistryManager.acquireLock(retries);
					}
				}

				// Lock file exists and is not stale, wait and retry
				if (retries >= ProjectsRegistryManager.LOCK_MAX_RETRIES) {
					throw new Error(
						"Failed to acquire registry lock: maximum retries exceeded. Another process may have crashed while holding the lock.",
					);
				}
				await new Promise((r) => setTimeout(r, ProjectsRegistryManager.LOCK_RETRY_MS));
				return ProjectsRegistryManager.acquireLock(retries + 1);
			}
			throw error;
		}
	}

	/**
	 * Release file lock for registry operations
	 */
	private static async releaseLock(): Promise<void> {
		const lockPath = `${PathResolver.getProjectsRegistryPath()}.lock`;
		try {
			await ProjectsRegistryManager.lockFile?.close();
			await unlink(lockPath).catch(() => {
				// Ignore if lock file already removed
			});
		} finally {
			ProjectsRegistryManager.lockFile = null;
		}
	}

	/**
	 * Load projects registry from disk
	 * Creates default if not exists
	 */
	static async load(forceReload = false): Promise<ProjectsRegistry> {
		const now = Date.now();
		const isStale =
			!ProjectsRegistryManager.registryLoadedAt ||
			now - ProjectsRegistryManager.registryLoadedAt > ProjectsRegistryManager.CACHE_TTL_MS;

		if (!forceReload && !isStale && ProjectsRegistryManager.registry) {
			return ProjectsRegistryManager.registry;
		}

		await ProjectsRegistryManager.acquireLock();
		try {
			const registryPath = PathResolver.getProjectsRegistryPath();

			if (existsSync(registryPath)) {
				const content = await readFile(registryPath, "utf-8");
				const data = JSON.parse(content);

				// Migrate legacy format: projects was object, now array
				if (data.projects && !Array.isArray(data.projects)) {
					logger.info("Migrating projects registry from object to array format");
					data.projects = Object.values(data.projects);
				}

				ProjectsRegistryManager.registry = ProjectsRegistrySchema.parse(data);
				ProjectsRegistryManager.registryLoadedAt = now;
				logger.debug(`Projects registry loaded from ${registryPath}`);
				return ProjectsRegistryManager.registry;
			}

			// Return default empty registry
			ProjectsRegistryManager.registry = { ...DEFAULT_PROJECTS_REGISTRY };
			ProjectsRegistryManager.registryLoadedAt = now;
			return ProjectsRegistryManager.registry;
		} catch (error) {
			const registryPath = PathResolver.getProjectsRegistryPath();

			// Handle different error types
			if (error instanceof SyntaxError) {
				// Corrupted JSON - backup and reset
				const backupPath = `${registryPath}.backup-${Date.now()}`;
				await copyFile(registryPath, backupPath).catch(() => {
					// Ignore backup failure
				});
				logger.error(`Corrupted registry backed up to ${backupPath}`);
				logger.warning("Creating new empty registry");

				// Return default registry
				ProjectsRegistryManager.registry = { ...DEFAULT_PROJECTS_REGISTRY };
				ProjectsRegistryManager.registryLoadedAt = now;
				return ProjectsRegistryManager.registry;
			}

			const nodeError = error as NodeJS.ErrnoException;
			if (nodeError.code === "EACCES") {
				throw new Error(`Permission denied: ${registryPath}`);
			}

			logger.warning(
				`Failed to load projects registry: ${error instanceof Error ? error.message : "Unknown error"}`,
			);

			// Return default empty registry for other errors
			ProjectsRegistryManager.registry = { ...DEFAULT_PROJECTS_REGISTRY };
			ProjectsRegistryManager.registryLoadedAt = now;
			return ProjectsRegistryManager.registry;
		} finally {
			await ProjectsRegistryManager.releaseLock();
		}
	}

	/**
	 * Save projects registry to disk
	 */
	static async save(registry: ProjectsRegistry): Promise<void> {
		await ProjectsRegistryManager.acquireLock();
		try {
			const validRegistry = ProjectsRegistrySchema.parse(registry);
			const registryPath = PathResolver.getProjectsRegistryPath();
			const dir = dirname(registryPath);

			// Ensure directory exists
			if (!existsSync(dir)) {
				await mkdir(dir, { recursive: true });
			}

			await writeFile(registryPath, JSON.stringify(validRegistry, null, 2), "utf-8");
			ProjectsRegistryManager.registry = validRegistry;
			ProjectsRegistryManager.registryLoadedAt = Date.now();
			logger.debug(`Projects registry saved to ${registryPath}`);
		} catch (error) {
			throw new Error(
				`Failed to save projects registry: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		} finally {
			await ProjectsRegistryManager.releaseLock();
		}
	}

	/**
	 * Validate project path for security
	 * @throws Error if path is invalid or unsafe
	 */
	private static validateProjectPath(projectPath: string): string {
		// CRITICAL: Validate BEFORE any transformations to prevent tilde bypass
		// Check for ".." traversal and leading "~" (tilde expansion)
		// Note: Windows 8.3 short names (e.g. RUNNER~1) contain "~" mid-path, which is safe
		if (projectPath.includes("..") || projectPath.startsWith("~")) {
			throw new Error("Invalid path: path traversal patterns not allowed");
		}

		// Resolve to absolute path AFTER validation
		const absolutePath = resolve(projectPath);

		// Verify path exists
		if (!existsSync(absolutePath)) {
			throw new Error(`Path does not exist: ${absolutePath}`);
		}

		// Ensure path is a directory
		const stat = statSync(absolutePath);
		if (!stat.isDirectory()) {
			throw new Error("Path must be a directory");
		}

		return absolutePath;
	}

	/**
	 * Add a project to the registry
	 */
	static async addProject(
		projectPath: string,
		options: AddProjectOptions = {},
	): Promise<RegisteredProject> {
		const registry = await ProjectsRegistryManager.load();

		// Validate path for security
		const absolutePath = ProjectsRegistryManager.validateProjectPath(projectPath);

		// Check if already registered
		const existing = registry.projects.find((p) => p.path === absolutePath);
		if (existing) {
			logger.debug(`Project already registered: ${absolutePath}`);
			return existing;
		}

		// Determine alias
		const alias = options.alias || basename(absolutePath);

		// HIGH PRIORITY FIX: Check alias uniqueness
		const existingWithAlias = registry.projects.find((p) => p.alias === alias);
		if (existingWithAlias) {
			throw new Error(
				`Alias "${alias}" already in use by ${existingWithAlias.path}. Please use a different alias.`,
			);
		}

		const project: RegisteredProject = {
			id: randomUUID(),
			path: absolutePath,
			alias,
			addedAt: new Date().toISOString(),
			pinned: options.pinned,
			tags: options.tags,
		};

		registry.projects.push(project);
		await ProjectsRegistryManager.save(registry);
		logger.debug(`Project registered: ${project.alias} (${absolutePath})`);

		return project;
	}

	/**
	 * Remove a project from the registry
	 * @param identifier - Project ID, alias, or path
	 */
	static async removeProject(identifier: string): Promise<boolean> {
		const registry = await ProjectsRegistryManager.load();
		const index = registry.projects.findIndex(
			(p) => p.id === identifier || p.alias === identifier || p.path === identifier,
		);

		if (index === -1) {
			return false;
		}

		registry.projects.splice(index, 1);
		await ProjectsRegistryManager.save(registry);
		return true;
	}

	/**
	 * Update a project in the registry
	 */
	static async updateProject(
		identifier: string,
		updates: UpdateProjectOptions,
	): Promise<RegisteredProject | null> {
		const registry = await ProjectsRegistryManager.load();
		const project = registry.projects.find(
			(p) => p.id === identifier || p.alias === identifier || p.path === identifier,
		);

		if (!project) {
			return null;
		}

		// Check alias uniqueness if updating alias
		if (updates.alias && updates.alias !== project.alias) {
			const existingWithAlias = registry.projects.find((p) => p.alias === updates.alias);
			if (existingWithAlias) {
				throw new Error(
					`Alias "${updates.alias}" already in use by ${existingWithAlias.path}. Please use a different alias.`,
				);
			}
			project.alias = updates.alias;
		}

		if (updates.tags !== undefined) project.tags = updates.tags;
		if (updates.pinned !== undefined) project.pinned = updates.pinned;

		await ProjectsRegistryManager.save(registry);
		return project;
	}

	/**
	 * Update lastOpened timestamp
	 */
	static async touchProject(identifier: string): Promise<void> {
		const registry = await ProjectsRegistryManager.load();
		const project = registry.projects.find(
			(p) => p.id === identifier || p.alias === identifier || p.path === identifier,
		);

		if (project) {
			project.lastOpened = new Date().toISOString();
			await ProjectsRegistryManager.save(registry);
		}
	}

	/**
	 * Get a project by identifier
	 */
	static async getProject(identifier: string): Promise<RegisteredProject | null> {
		const registry = await ProjectsRegistryManager.load();
		return (
			registry.projects.find(
				(p) => p.id === identifier || p.alias === identifier || p.path === identifier,
			) || null
		);
	}

	/**
	 * List all projects with optional filtering
	 */
	static async listProjects(filter?: ProjectFilter): Promise<RegisteredProject[]> {
		const registry = await ProjectsRegistryManager.load();
		let projects = [...registry.projects];

		if (filter?.pinned !== undefined) {
			projects = projects.filter((p) => p.pinned === filter.pinned);
		}

		if (filter?.tags?.length) {
			projects = projects.filter((p) => filter.tags?.some((tag) => p.tags?.includes(tag)));
		}

		// Sort: pinned first, then by lastOpened (most recent), then by addedAt
		projects.sort((a, b) => {
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;

			const aTime = a.lastOpened || a.addedAt;
			const bTime = b.lastOpened || b.addedAt;
			return new Date(bTime).getTime() - new Date(aTime).getTime();
		});

		return projects;
	}

	/**
	 * Check if a project path is registered
	 */
	static async isRegistered(projectPath: string): Promise<boolean> {
		const absolutePath = resolve(projectPath);
		const registry = await ProjectsRegistryManager.load();
		return registry.projects.some((p) => p.path === absolutePath);
	}

	/**
	 * Clear cached registry (for testing)
	 */
	static clearCache(): void {
		ProjectsRegistryManager.registry = null;
		ProjectsRegistryManager.registryLoadedAt = null;
	}
}
