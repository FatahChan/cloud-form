import { env } from "cloudflare:test";
import { expect, it } from "vitest";
import { sweepPending } from "../src/server/files";

it("sweeps only pending uploads older than a day", async () => {
  await env.FILES.put("pending/form/q/old", "x");
  await env.FILES.put("submissions/sub/kept", "x");
  expect(await sweepPending(env.FILES)).toBe(0);
  expect(await sweepPending(env.FILES, Date.now() + 25 * 60 * 60 * 1000)).toBe(1);
  expect(await env.FILES.head("pending/form/q/old")).toBeNull();
  expect(await env.FILES.head("submissions/sub/kept")).not.toBeNull();
});
