import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("M3-R4 native runtime-import smoke", () => {
  it("loads the complete performance module graph without invoking main", () => {
    const smokeScript = path.resolve("scripts/m3-r4-runtime-import-smoke.ts");
    const output = execFileSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", smokeScript],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output).toContain("M3-R4 runtime-import smoke: PASS");
  });
});
