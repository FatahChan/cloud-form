import { describe, expect, it } from "vitest";
import { requireOwner } from "../src/server/authz";
import { assertSameOrigin } from "../src/server/csrf";
import { HttpError } from "../src/server/errors";
import type { SessionUser } from "../src/server/session";
import { isBlockedImportHost, isBlockedIp } from "../src/shared/import";

function post(headers: Record<string, string> = {}): Request {
  return new Request("https://forms.example.com/api/forms", { method: "POST", headers });
}

function status(fn: () => void): number | null {
  try {
    fn();
    return null;
  } catch (e) {
    if (e instanceof HttpError) return e.status;
    throw e;
  }
}

describe("isBlockedIp", () => {
  it("blocks private, loopback, link-local, CGNAT and reserved IPv4", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    for (const ip of ["1.1.1.1", "8.8.8.8", "172.32.0.1", "100.128.0.1", "192.169.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it("blocks private IPv6 and IPv4-mapped private addresses", () => {
    for (const ip of [
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "ff02::1",
      "::ffff:127.0.0.1",
      "::ffff:a00:1",
      "[::1]",
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6 and IPv4-mapped public addresses", () => {
    for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "::ffff:808:808"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it("ignores non-IP hostnames", () => {
    expect(isBlockedIp("example.com")).toBe(false);
  });
});

describe("isBlockedImportHost", () => {
  it("blocks local names and private literals", () => {
    for (const h of ["localhost", "LOCALHOST.", "api.localhost", "printer.local", "db.internal", "10.0.0.5", "[::1]"]) {
      expect(isBlockedImportHost(h), h).toBe(true);
    }
  });

  it("blocks private literals however the URL parser normalizes them", () => {
    for (const raw of ["https://2130706433/x", "https://0x7f.1/x", "https://[::ffff:10.0.0.1]/x"]) {
      expect(isBlockedImportHost(new URL(raw).hostname), raw).toBe(true);
    }
  });

  it("allows public hostnames", () => {
    expect(isBlockedImportHost("files.example.com")).toBe(false);
  });
});

describe("assertSameOrigin", () => {
  it("allows a matching Origin", () => {
    expect(status(() => assertSameOrigin(post({ origin: "https://forms.example.com" })))).toBeNull();
  });

  it("rejects a foreign Origin", () => {
    expect(status(() => assertSameOrigin(post({ origin: "https://evil.example" })))).toBe(403);
  });

  it("falls back to Referer when Origin is absent", () => {
    expect(status(() => assertSameOrigin(post({ referer: "https://forms.example.com/admin" })))).toBeNull();
    expect(status(() => assertSameOrigin(post({ referer: "https://evil.example/page" })))).toBe(403);
  });

  it("rejects an opaque null Origin without a same-origin Referer", () => {
    expect(status(() => assertSameOrigin(post({ origin: "null" })))).toBe(403);
  });

  it("allows non-browser clients that send neither header", () => {
    expect(status(() => assertSameOrigin(post()))).toBeNull();
  });
});

describe("requireOwner", () => {
  const base: SessionUser = { id: "u1", email: "a@x.com", name: "A", role: "owner" };

  it("allows the owner", () => {
    expect(status(() => requireOwner(base))).toBeNull();
  });

  it("rejects admins with 403", () => {
    expect(status(() => requireOwner({ ...base, role: "admin" }))).toBe(403);
  });
});
