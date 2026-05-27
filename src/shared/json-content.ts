export function stripJsonBom(content: string): string {
	return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

export function parseJsonContent<T = unknown>(content: string): T {
	return JSON.parse(stripJsonBom(content)) as T;
}
