import { beforeEach, describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";

interface LifecycleMockState {
	port: number;
	lastServer: MockHttpServer | null;
	listenError: Error | null;
	serverInitiallyListening: boolean;
	wsConstructorError: Error | null;
	fileWatcherConstructorError: Error | null;
	fileWatcherStartError: Error | null;
	closeError: Error | null;
	wsConstructCalls: number;
	wsCloseCalls: number;
	fileWatcherConstructCalls: number;
	fileWatcherStartCalls: number;
	fileWatcherStopCalls: number;
	listenPorts: number[];
	closeCalls: number;
}

class MockHttpServer extends EventEmitter {
	timeout = 0;
	keepAliveTimeout = 0;
	headersTimeout = 0;
	listening = false;

	setTimeout(ms: number): this {
		this.timeout = ms;
		return this;
	}

	listen(port: number): this {
		state.listenPorts.push(port);

		if (state.listenError) {
			queueMicrotask(() => this.emit("error", state.listenError as Error));
			return this;
		}

		this.listening = true;
		queueMicrotask(() => this.emit("listening"));
		return this;
	}

	close(callback?: (err?: Error) => void): this {
		state.closeCalls += 1;
		this.listening = false;
		callback?.(state.closeError ?? undefined);
		return this;
	}
}

const createDefaultState = (): LifecycleMockState => ({
	port: 4567,
	lastServer: null,
	listenError: null,
	serverInitiallyListening: false,
	wsConstructorError: null,
	fileWatcherConstructorError: null,
	fileWatcherStartError: null,
	closeError: null,
	wsConstructCalls: 0,
	wsCloseCalls: 0,
	fileWatcherConstructCalls: 0,
	fileWatcherStartCalls: 0,
	fileWatcherStopCalls: 0,
	listenPorts: [],
	closeCalls: 0,
});

let state: LifecycleMockState = createDefaultState();

const getPortMock = mock(async () => state.port);
const openMock = mock(async () => {});
const registerRoutesMock = mock(() => {});
const serveStaticMock = mock(() => {});
const createServerMock = mock(() => {
	const server = new MockHttpServer();
	server.listening = state.serverInitiallyListening;
	state.lastServer = server;
	return server;
});

mock.module("node:http", () => ({
	createServer: createServerMock,
}));

mock.module("get-port", () => ({
	default: getPortMock,
}));

mock.module("open", () => ({
	default: openMock,
}));

mock.module("@/domains/web-server/routes/index.js", () => ({
	registerRoutes: registerRoutesMock,
}));

mock.module("@/domains/web-server/static-server.js", () => ({
	serveStatic: serveStaticMock,
}));

mock.module("@/domains/web-server/websocket-manager.js", () => ({
	WebSocketManager: class MockWebSocketManager {
		constructor() {
			state.wsConstructCalls += 1;
			if (state.wsConstructorError) {
				throw state.wsConstructorError;
			}
		}

		close(): void {
			state.wsCloseCalls += 1;
		}
	},
}));

mock.module("@/domains/web-server/file-watcher.js", () => ({
	FileWatcher: class MockFileWatcher {
		constructor() {
			state.fileWatcherConstructCalls += 1;
			if (state.fileWatcherConstructorError) {
				throw state.fileWatcherConstructorError;
			}
		}

		start(): void {
			state.fileWatcherStartCalls += 1;
			if (state.fileWatcherStartError) {
				throw state.fileWatcherStartError;
			}
		}

		stop(): void {
			state.fileWatcherStopCalls += 1;
		}
	},
}));

import { createAppServer, resolveUiRootPath } from "@/domains/web-server/server.js";

describe("web-server lifecycle", () => {
	beforeEach(() => {
		state = createDefaultState();
		getPortMock.mockClear();
		openMock.mockClear();
		registerRoutesMock.mockClear();
		serveStaticMock.mockClear();
		createServerMock.mockClear();
	});

	test("resolveUiRootPath returns decoded filesystem path", () => {
		const uiRoot = resolveUiRootPath();
		expect(uiRoot.includes("%20")).toBe(false);
		expect(/src[\\/]+ui$/.test(uiRoot)).toBe(true);
	});

	test("startup configures timeout values and listens on resolved port", async () => {
		const app = await createAppServer({ openBrowser: false, devMode: false });
		const server = state.lastServer;

		expect(server).not.toBeNull();
		expect(server?.timeout).toBe(30000);
		expect(server?.keepAliveTimeout).toBe(65000);
		expect(server?.headersTimeout).toBe(66000);
		expect(state.listenPorts).toEqual([state.port]);
		expect(registerRoutesMock).toHaveBeenCalledTimes(1);
		expect(serveStaticMock).toHaveBeenCalledTimes(1);

		await app.close();
	});

	test("close is safe when called more than once", async () => {
		const app = await createAppServer({ openBrowser: false, devMode: false });
		expect(app.server.listening).toBe(true);

		await app.close();
		await app.close();

		expect(app.server.listening).toBe(false);
		expect(state.fileWatcherStopCalls).toBe(2);
		expect(state.wsCloseCalls).toBe(2);
		expect(state.closeCalls).toBe(1);
	});

	test("opens browser when enabled", async () => {
		const app = await createAppServer({ openBrowser: true, devMode: false });
		expect(openMock).toHaveBeenCalledTimes(1);
		expect(openMock).toHaveBeenCalledWith(`http://localhost:${state.port}`);
		await app.close();
	});

	test("fails fast on listen error and cleans startup resources", async () => {
		state.listenError = new Error("listen failed");

		await expect(createAppServer({ openBrowser: false, devMode: false })).rejects.toThrow(
			"listen failed",
		);

		expect(state.fileWatcherStartCalls).toBe(1);
		expect(state.fileWatcherStopCalls).toBe(1);
		expect(state.wsCloseCalls).toBe(1);
		expect(state.closeCalls).toBe(0);
		expect(openMock).not.toHaveBeenCalled();
	});

	test("cleans up when file watcher constructor fails during startup", async () => {
		state.serverInitiallyListening = true;
		state.fileWatcherConstructorError = new Error("watcher constructor failed");

		await expect(createAppServer({ openBrowser: false, devMode: false })).rejects.toThrow(
			"watcher constructor failed",
		);

		expect(state.wsConstructCalls).toBe(1);
		expect(state.fileWatcherConstructCalls).toBe(1);
		expect(state.fileWatcherStartCalls).toBe(0);
		expect(state.fileWatcherStopCalls).toBe(0);
		expect(state.wsCloseCalls).toBe(1);
		expect(state.closeCalls).toBe(1);
	});

	test("fails fast when websocket manager constructor throws", async () => {
		state.serverInitiallyListening = true;
		state.wsConstructorError = new Error("ws constructor failed");

		await expect(createAppServer({ openBrowser: false, devMode: false })).rejects.toThrow(
			"ws constructor failed",
		);

		expect(state.wsConstructCalls).toBe(1);
		expect(state.fileWatcherConstructCalls).toBe(0);
		expect(state.wsCloseCalls).toBe(0);
		expect(state.closeCalls).toBe(1);
	});
});
