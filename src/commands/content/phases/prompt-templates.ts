/**
 * Platform-specific prompt templates for Claude CLI content generation.
 * Each template encodes character limits, format rules, and output shape.
 */

import type { Platform } from "../types.js";
import type { ContentContext } from "./context-builder.js";

// ---------------------------------------------------------------------------
// Text post prompt
// ---------------------------------------------------------------------------

/** Build the prompt for generating a single-post text update. */
export function buildTextPrompt(context: ContentContext, platform: Platform): string {
	const charLimit = platform === "x" || platform === "x_thread" ? 280 : 500;

	return `You are a social media content creator.

## Project Context
${context.projectDocsSummary}

## Brand Voice
${context.brandGuidelines}

## Writing Style
${context.writingStyles}

## Content Source
${context.gitEventDetails}

## Platform: ${platform}
${context.platformRules}

## Past Content (avoid repetition)
${context.recentContent}

## Instructions
1. Create a ${platform} post about this development update
2. Start with a compelling hook that creates curiosity
3. Keep it conversational and authentic (avoid AI-sounding language)
4. No generic statements — be specific about what changed and why it matters
5. Plain text only — NO markdown formatting
6. Max ${charLimit} characters
7. Output as JSON: {"text": "...", "hashtags": ["..."], "hook": "...", "cta": "..."}

IMPORTANT: Output ONLY the JSON object, nothing else.`;
}

// ---------------------------------------------------------------------------
// Thread prompt
// ---------------------------------------------------------------------------

/** Build the prompt for generating an X/Twitter thread. */
export function buildThreadPrompt(context: ContentContext, maxParts: number): string {
	return `You are a social media content creator for X/Twitter threads.

## Brand Voice
${context.brandGuidelines}

## Content Source
${context.gitEventDetails}

## Instructions
1. Create a thread of ${maxParts} tweets about this update
2. Each tweet ≤ 280 characters
3. First tweet must hook attention
4. Number each part (1/N format)
5. Plain text only — NO markdown
6. Output as JSON: {"parts": ["tweet1", "tweet2", ...], "hashtags": ["..."], "hook": "first tweet text"}

IMPORTANT: Output ONLY the JSON object, nothing else.`;
}

// ---------------------------------------------------------------------------
// Photo prompt
// ---------------------------------------------------------------------------

/** Build the prompt for generating an accompanying social media image. */
export function buildPhotoPrompt(context: ContentContext, platform: Platform): string {
	const dimensions = platform === "facebook" ? "1200x630" : "1200x675";

	return `Generate an image for this social media post.

## Brand Guidelines
${context.brandGuidelines}

## Post Content
${context.gitEventDetails}

## Requirements
- Dimensions: ${dimensions}
- Style: Professional, modern design
- Include relevant visual elements for a tech/dev update
- Use the /ck:ai-multimodal or /ck:banner-design skill
- Save the image and provide the file path

IMPORTANT: Generate the image and output the path as JSON: {"imagePath": "/path/to/image.png"}`;
}
