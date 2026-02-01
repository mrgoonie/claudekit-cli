import { useCallback, useEffect, useRef, useState } from "react";

interface WSMessage {
	type: string;
	payload: unknown;
}

interface UseWebSocketOptions {
	onMessage?: (message: WSMessage) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
	reconnectInterval?: number;
	maxReconnectAttempts?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
	const {
		onMessage,
		onConnect,
		onDisconnect,
		reconnectInterval = 2000,
		maxReconnectAttempts = 5,
	} = options;

	const [isConnected, setIsConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const reconnectTimeoutRef = useRef<number | null>(null);
	const isConnectingRef = useRef(false);
	const isMountedRef = useRef(true);

	// Store callbacks in refs to avoid dependency issues
	const onMessageRef = useRef(onMessage);
	const onConnectRef = useRef(onConnect);
	const onDisconnectRef = useRef(onDisconnect);

	useEffect(() => {
		onMessageRef.current = onMessage;
		onConnectRef.current = onConnect;
		onDisconnectRef.current = onDisconnect;
	}, [onMessage, onConnect, onDisconnect]);

	const scheduleReconnect = useCallback(() => {
		if (!isMountedRef.current) return;
		if (reconnectAttemptsRef.current >= maxReconnectAttempts) return;

		// Clear any existing timeout
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
		}

		// Exponential backoff with jitter
		const delay = reconnectInterval * 2 ** reconnectAttemptsRef.current + Math.random() * 500;
		reconnectAttemptsRef.current += 1;

		reconnectTimeoutRef.current = window.setTimeout(() => {
			if (isMountedRef.current) {
				connect();
			}
		}, delay);
	}, [reconnectInterval, maxReconnectAttempts]);

	const connect = useCallback(() => {
		// Prevent multiple simultaneous connection attempts
		if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
			return;
		}

		if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
			console.warn(`WebSocket: Max reconnection attempts (${maxReconnectAttempts}) reached`);
			return;
		}

		isConnectingRef.current = true;

		// Build WebSocket URL based on current location
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const host = window.location.host;
		const url = `${protocol}//${host}/ws`;

		try {
			const ws = new WebSocket(url);

			ws.onopen = () => {
				if (!isMountedRef.current) return;
				isConnectingRef.current = false;
				setIsConnected(true);
				reconnectAttemptsRef.current = 0;
				onConnectRef.current?.();
			};

			ws.onclose = (event) => {
				if (!isMountedRef.current) return;
				isConnectingRef.current = false;
				setIsConnected(false);
				onDisconnectRef.current?.();

				// Only reconnect if it was a clean close (server initiated)
				// or if we haven't tried yet (first attempt after successful connection)
				if (event.wasClean) {
					scheduleReconnect();
				}
			};

			ws.onerror = () => {
				// Error is followed by close event, so just mark as not connecting
				// Don't log to avoid console spam
				isConnectingRef.current = false;
			};

			ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data) as WSMessage;
					onMessageRef.current?.(message);
				} catch {
					// Silent fail for invalid messages
				}
			};

			wsRef.current = ws;
		} catch {
			isConnectingRef.current = false;
			scheduleReconnect();
		}
	}, [maxReconnectAttempts, scheduleReconnect]);

	const send = useCallback((message: WSMessage) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify(message));
		}
	}, []);

	const disconnect = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
		}
		wsRef.current?.close();
		wsRef.current = null;
		setIsConnected(false);
	}, []);

	useEffect(() => {
		isMountedRef.current = true;
		connect();
		return () => {
			isMountedRef.current = false;
			disconnect();
		};
	}, [connect, disconnect]);

	return { isConnected, send, disconnect };
}
