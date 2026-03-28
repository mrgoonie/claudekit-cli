import { describe, expect, test } from "bun:test";
import { buildApprovalPrompt } from "../../../commands/watch/phases/approval-detector.js";

describe("approval-detector", () => {
	describe("buildApprovalPrompt", () => {
		test("includes owner comment, issue title, and owner name", () => {
			const prompt = buildApprovalPrompt({
				ownerComment: "Go ahead and implement this",
				issueTitle: "Add dark mode",
				repoOwner: "john-doe",
			});

			expect(prompt).toContain("john-doe");
			expect(prompt).toContain("Go ahead and implement this");
			expect(prompt).toContain("Add dark mode");
		});

		test("includes JSON format instruction", () => {
			const prompt = buildApprovalPrompt({
				ownerComment: "Yes",
				issueTitle: "Test issue",
				repoOwner: "owner",
			});

			expect(prompt).toContain('"approved"');
			expect(prompt).toContain('"reason"');
			expect(prompt).toContain("true");
			expect(prompt).toContain("false");
		});

		test("includes approval signals", () => {
			const prompt = buildApprovalPrompt({
				ownerComment: "Test",
				issueTitle: "Test",
				repoOwner: "owner",
			});

			expect(prompt).toContain("yes");
			expect(prompt).toContain("lgtm");
			expect(prompt).toContain("proceed");
			expect(prompt).toContain("approved");
		});

		test("includes rejection signals", () => {
			const prompt = buildApprovalPrompt({
				ownerComment: "Test",
				issueTitle: "Test",
				repoOwner: "owner",
			});

			expect(prompt).toContain("hold on");
			expect(prompt).toContain("wait");
			expect(prompt).toContain("not yet");
			expect(prompt).toContain("cancel");
		});

		test("handles special characters in comment", () => {
			const specialComment = 'LGTM! "Quoted" and <html> tags';
			const prompt = buildApprovalPrompt({
				ownerComment: specialComment,
				issueTitle: "Test",
				repoOwner: "owner",
			});

			expect(prompt).toContain(specialComment);
		});
	});
});
