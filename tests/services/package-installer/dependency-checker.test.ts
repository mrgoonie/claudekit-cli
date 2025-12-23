import { describe, expect, it } from "bun:test";
import {
	DEPENDENCIES,
	checkDependency,
	compareVersions,
	getOSInfo,
} from "@/services/package-installer/dependency-checker.js";

describe("DependencyChecker", () => {
	describe("compareVersions", () => {
		it("should return true when versions are equal", () => {
			expect(compareVersions("1.0.0", "1.0.0")).toBe(true);
			expect(compareVersions("3.11.0", "3.11.0")).toBe(true);
		});

		it("should return true when current is greater (major)", () => {
			expect(compareVersions("2.0.0", "1.0.0")).toBe(true);
			expect(compareVersions("4.0.0", "3.8.0")).toBe(true);
		});

		it("should return true when current is greater (minor)", () => {
			expect(compareVersions("1.1.0", "1.0.0")).toBe(true);
			expect(compareVersions("3.9.0", "3.8.0")).toBe(true);
		});

		it("should return true when current is greater (patch)", () => {
			expect(compareVersions("1.0.1", "1.0.0")).toBe(true);
			expect(compareVersions("3.8.1", "3.8.0")).toBe(true);
		});

		it("should return false when current is less (major)", () => {
			expect(compareVersions("0.9.0", "1.0.0")).toBe(false);
			expect(compareVersions("2.7.0", "3.8.0")).toBe(false);
		});

		it("should return false when current is less (minor)", () => {
			expect(compareVersions("1.0.0", "1.1.0")).toBe(false);
			expect(compareVersions("3.7.0", "3.8.0")).toBe(false);
		});

		it("should return false when current is less (patch)", () => {
			expect(compareVersions("1.0.0", "1.0.1")).toBe(false);
			expect(compareVersions("3.8.0", "3.8.1")).toBe(false);
		});

		it("should handle partial versions", () => {
			expect(compareVersions("1.0", "1.0.0")).toBe(true);
			expect(compareVersions("1.1", "1.0.0")).toBe(true);
			expect(compareVersions("1.0.0", "1.0")).toBe(true);
			expect(compareVersions("0.9", "1.0.0")).toBe(false);
		});
	});

	describe("getOSInfo", () => {
		it("should return platform information", () => {
			const osInfo = getOSInfo();
			expect(osInfo).toHaveProperty("platform");
			expect(osInfo).toHaveProperty("arch");
			expect(osInfo).toHaveProperty("isWindows");
			expect(osInfo).toHaveProperty("isMacOS");
			expect(osInfo).toHaveProperty("isLinux");
			expect(osInfo).toHaveProperty("isWSL");
			expect(osInfo).toHaveProperty("details");
		});

		it("should detect the current platform correctly", () => {
			const osInfo = getOSInfo();
			const platform = process.platform;

			expect(osInfo.platform).toBe(platform);
			expect(osInfo.isWindows).toBe(platform === "win32");
			expect(osInfo.isMacOS).toBe(platform === "darwin");
			expect(osInfo.isLinux).toBe(platform === "linux");
		});
	});

	describe("DEPENDENCIES config", () => {
		it("should have required dependencies", () => {
			expect(DEPENDENCIES).toHaveProperty("python");
			expect(DEPENDENCIES).toHaveProperty("pip");
			expect(DEPENDENCIES).toHaveProperty("nodejs");
			expect(DEPENDENCIES).toHaveProperty("claude");
		});

		it("should have valid version regex patterns", () => {
			expect(DEPENDENCIES.python.versionRegex).toBeInstanceOf(RegExp);
			expect(DEPENDENCIES.nodejs.versionRegex).toBeInstanceOf(RegExp);
			expect(DEPENDENCIES.pip.versionRegex).toBeInstanceOf(RegExp);
			expect(DEPENDENCIES.claude.versionRegex).toBeInstanceOf(RegExp);
		});

		it("should have correct minimum versions", () => {
			expect(DEPENDENCIES.python.minVersion).toBe("3.8.0");
			expect(DEPENDENCIES.nodejs.minVersion).toBe("16.0.0");
		});
	});

	describe("checkDependency", () => {
		it("should check node dependency", async () => {
			const status = await checkDependency(DEPENDENCIES.nodejs);
			expect(status.name).toBe("nodejs");
			// Node should be installed as we are running tests
			expect(status.installed).toBe(true);
			expect(status.meetsRequirements).toBe(true);
			expect(status.version).toBeDefined();
		});
	});
});
