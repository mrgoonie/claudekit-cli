import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
	document.body.innerHTML =
		'<div style="padding:20px;color:red;">Fatal: Root element not found</div>';
	throw new Error("Root element #root not found");
}

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	</React.StrictMode>,
);
