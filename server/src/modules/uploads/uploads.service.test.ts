import { beforeAll, describe, expect, it } from "vitest";

// Configure the bucket env before importing the module under test (it reads env at call time, but
// set it up front for clarity).
beforeAll(() => {
  process.env.S3_BUCKET = "loopin-uploads";
  process.env.AWS_REGION = "ap-southeast-2";
  delete process.env.S3_PUBLIC_BASE_URL;
});

import { isValidPostImageUrl, publicObjectUrlForKey } from "./uploads.service";

const WS = "11111111-1111-1111-1111-111111111111";
const HOST = "https://loopin-uploads.s3.ap-southeast-2.amazonaws.com";
const UUID = "abcdef12-1234-4abc-89ab-abcdef123456";

describe("isValidPostImageUrl", () => {
  it("accepts a well-formed URL under tmp/{workspaceId}/ with a UUID filename", () => {
    expect(isValidPostImageUrl(`${HOST}/tmp/${WS}/${UUID}.jpg`, WS)).toBe(true);
    expect(isValidPostImageUrl(`${HOST}/tmp/${WS}/${UUID}.png`, WS)).toBe(true);
    expect(isValidPostImageUrl(`${HOST}/tmp/${WS}/${UUID}.webp`, WS)).toBe(true);
  });

  it("rejects a different host (SSRF / arbitrary URL injection)", () => {
    expect(isValidPostImageUrl(`https://evil.example.com/tmp/${WS}/${UUID}.jpg`, WS)).toBe(false);
  });

  it("rejects another workspace's prefix", () => {
    const other = "22222222-2222-2222-2222-222222222222";
    expect(isValidPostImageUrl(`${HOST}/tmp/${other}/${UUID}.jpg`, WS)).toBe(false);
  });

  it("rejects path traversal", () => {
    expect(isValidPostImageUrl(`${HOST}/tmp/${WS}/../secret.jpg`, WS)).toBe(false);
  });

  it("rejects a non-image / disallowed extension", () => {
    expect(isValidPostImageUrl(`${HOST}/tmp/${WS}/${UUID}.svg`, WS)).toBe(false);
    expect(isValidPostImageUrl(`${HOST}/tmp/${WS}/${UUID}.exe`, WS)).toBe(false);
  });

  it("rejects a non-UUID filename", () => {
    expect(isValidPostImageUrl(`${HOST}/tmp/${WS}/notuuid.jpg`, WS)).toBe(false);
  });

  it("rejects garbage input", () => {
    expect(isValidPostImageUrl("not a url", WS)).toBe(false);
    expect(isValidPostImageUrl("", WS)).toBe(false);
  });
});

describe("publicObjectUrlForKey", () => {
  it("builds a URL-encoded public URL from an object key", () => {
    const url = publicObjectUrlForKey(`tmp/${WS}/${UUID}.jpg`);
    expect(url).toBe(`${HOST}/tmp/${WS}/${UUID}.jpg`);
  });
});
