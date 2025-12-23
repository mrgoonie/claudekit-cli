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
		reconnectInterval = 1000,
		maxReconnectAttempts = 10,
	} = options;

	const [isConnected, setIsConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const reconnectTimeoutRef = useRef<number | null>(null);

	const scheduleReconnect = useCallback(() => {
		if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
			console.error("Max reconnection attempts reached");
			return;
		}

		// Exponential backoff
		const delay = reconnectInterval * 2 ** reconnectAttemptsRef.current;
		reconnectAttemptsRef.current += 1;

		reconnectTimeoutRef.current = window.setTimeout(() => {
			connect();
		}, delay);
	}, [reconnectInterval, maxReconnectAttempts]);

	const connect = useCallback(() => {
		// Build WebSocket URL based on current location
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const host = window.location.host;
		const url = `${protocol}//${host}/ws`;

		try {
			const ws = new WebSocket(url);

			ws.onopen = () => {
				setIsConnected(true);
				reconnectAttemptsRef.current = 0;
				onConnect?.();
			};

			ws.onclose = () => {
				setIsConnected(false);
				onDisconnect?.();
				scheduleReconnect();
			};

			ws.onerror = (error) => {
				console.error("WebSocket error:", error);
			};

			ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data) as WSMessage;
					onMessage?.(message);
				} catch (err) {
					console.error("Invalid WebSocket message:", err);
				}
			};

			wsRef.current = ws;
		} catch (error) {
			console.error("Failed to create WebSocket:", error);
			scheduleReconnect();
		}
	}, [onMessage, onConnect, onDisconnect, scheduleReconnect]);

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
		connect();
		return () => disconnect();
	}, [connect, disconnect]);

	return { isConnected, send, disconnect };
}
