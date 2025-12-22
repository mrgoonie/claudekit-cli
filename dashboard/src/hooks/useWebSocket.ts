import { useCallback, useEffect, useRef, useState } from "react";

interface WsMessage {
	type: "config_changed" | "error" | "connected";
	data?: unknown;
}

export function useWebSocket(
	onConfigChange: (data: unknown) => void,
	onReconnect?: () => void,
) {
	const [connected, setConnected] = useState(false);
	const ws = useRef<WebSocket | null>(null);
	const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const wasConnected = useRef(false);

	const connect = useCallback(() => {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = `${protocol}//${window.location.host}/ws`;

		ws.current = new WebSocket(wsUrl);

		ws.current.onopen = () => {
			const isReconnection = wasConnected.current;
			wasConnected.current = true;
			setConnected(true);
			console.log("WebSocket connected");
			if (isReconnection && onReconnect) {
				onReconnect();
			}
		};

		ws.current.onmessage = (event) => {
			try {
				const message: WsMessage = JSON.parse(event.data);
				if (message.type === "config_changed") {
					onConfigChange(message.data);
				}
			} catch (error) {
				console.error("WebSocket message parse error:", error);
			}
		};

		ws.current.onclose = () => {
			setConnected(false);
			console.log("WebSocket disconnected, reconnecting...");
			reconnectTimeout.current = setTimeout(connect, 3000);
		};

		ws.current.onerror = (error) => {
			console.error("WebSocket error:", error);
		};
	}, [onConfigChange, onReconnect]);

	useEffect(() => {
		connect();
		return () => {
			if (reconnectTimeout.current) {
				clearTimeout(reconnectTimeout.current);
			}
			ws.current?.close();
		};
	}, [connect]);

	return { connected };
}
