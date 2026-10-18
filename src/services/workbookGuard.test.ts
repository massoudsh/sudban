import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { guardWorkbook } from "./workbookGuard";

describe("workbook upload boundaries", () => {
  it("accepts bounded ordinary ZIP entries", () => {
    const archive = zipSync({ "sheet.xml": strToU8("<worksheet/>") });
    expect(() => guardWorkbook(Buffer.from(archive))).not.toThrow();
  });
  it("rejects malformed uploads", () => {
    expect(() => guardWorkbook(Buffer.from("not a workbook"))).toThrow();
  });
  it("rejects compressed expansion beyond the upload budget", () => {
    const archive = zipSync({ "sheet.xml": new Uint8Array(9 * 1024 * 1024) });
    expect(() => guardWorkbook(Buffer.from(archive))).toThrow();
  });
  it("rejects excessive archive entries", () => {
    const files = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`${i}.xml`, strToU8("x")]));
    expect(() => guardWorkbook(Buffer.from(zipSync(files)))).toThrow();
  });
});
