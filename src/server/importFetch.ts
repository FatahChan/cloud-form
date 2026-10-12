import { FILE_KINDS, fileKindFor, type FileKind, type Question } from "../shared/schema";
import { isBlockedImportHost, isBlockedIp, isHttpsFileUrl } from "../shared/import";
import { HttpError } from "./errors";
import { putPending } from "./files";

type FileQuestion = Extract<Question, { type: "file" }>;

export type ImportedFile = {
  q: FileQuestion;
  uploadId: string;
  dest: string;
  filename: string;
  contentType: string;
  size: number;
};

function filenameFrom(url: URL, header: string | null): string {
  if (header) {
    const star = /filename\*=(?:UTF-8''|)([^;]+)/i.exec(header);
    if (star?.[1]) {
      try {
        return decodeURIComponent(star[1].replace(/['"]/g, "").trim()) || "file";
      } catch {
        /* fall through */
      }
    }
    const plain = /filename="?([^";]+)"?/i.exec(header);
    if (plain?.[1]) return plain[1].trim() || "file";
  }
  const last = url.pathname.split("/").filter(Boolean).pop();
  if (!last) return "file";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function mimeType(header: string | null): string {
  if (!header) return "";
  return header.split(";")[0]!.trim().toLowerCase();
}

function kindFor(filename: string, mime: string): FileKind | null {
  const exact = fileKindFor(filename, mime);
  if (exact) return exact;
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  if (!ext) return null;
  const generic = !mime || mime === "application/octet-stream";
  for (const kind of Object.keys(FILE_KINDS) as FileKind[]) {
    const spec = FILE_KINDS[kind];
    if (!spec.ext.some((e) => e === ext)) continue;
    if (generic || spec.mime.some((m) => m === mime)) return kind;
  }
  return null;
}

const DOH_URL = "https://cloudflare-dns.com/dns-query";

async function resolve(hostname: string, type: "A" | "AAAA"): Promise<string[]> {
  const url = `${DOH_URL}?name=${encodeURIComponent(hostname)}&type=${type}`;
  const res = await fetch(url, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`DoH ${res.status}`);
  const body = (await res.json()) as { Status: number; Answer?: { type: number; data: string }[] };
  // NXDOMAIN (3) just means no records of this type; anything else non-zero is a resolver failure.
  if (body.Status !== 0 && body.Status !== 3) throw new Error(`DoH status ${body.Status}`);
  const want = type === "A" ? 1 : 28;
  return (body.Answer ?? []).filter((r) => r.type === want).map((r) => r.data);
}

/**
 * Resolve the host and reject if any A/AAAA record is private, so a public name pointing at an
 * internal address can't be used for SSRF. Fails closed when the resolver is unreachable.
 * ponytail: the fetch below re-resolves, so a rebinding DNS server could still race this check.
 */
async function assertPublicHost(hostname: string, title: string): Promise<void> {
  const h = hostname.replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return;
  let ips: string[];
  try {
    ips = (await Promise.all([resolve(h, "A"), resolve(h, "AAAA")])).flat();
  } catch {
    throw new HttpError(`Could not verify ${title} link`, 400);
  }
  if (ips.length === 0 || ips.some(isBlockedIp)) throw new HttpError(`${title} link is not allowed`, 400);
}

async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new HttpError("File too large", 413);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function fetchImportFile(
  rawUrl: string,
  q: FileQuestion,
  dest: string,
  uploadId: string,
): Promise<ImportedFile> {
  if (!isHttpsFileUrl(rawUrl)) throw new HttpError(`${q.title} must be an https:// link`, 400);
  const url = new URL(rawUrl.trim());
  if (isBlockedImportHost(url.hostname)) throw new HttpError(`${q.title} link is not allowed`, 400);
  await assertPublicHost(url.hostname, q.title);
  const max = q.maxSizeMb * 1024 * 1024;
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(15000) });
  } catch {
    throw new HttpError(`Could not download ${q.title}`, 400);
  }
  if (res.status < 200 || res.status >= 300) throw new HttpError(`Could not download ${q.title}`, 400);
  const len = Number(res.headers.get("content-length"));
  if (Number.isFinite(len) && len > max) throw new HttpError("File too large", 413);
  const bytes = await readCapped(res, max);
  const filename = filenameFrom(url, res.headers.get("content-disposition"));
  const mime = mimeType(res.headers.get("content-type"));
  const kind = kindFor(filename, mime);
  if (!kind || !q.accept.includes(kind)) throw new HttpError("File type not allowed", 415);
  const contentType = mime || FILE_KINDS[kind].mime[0]!;
  await putPending(dest, bytes, contentType, filename);
  return { q, uploadId, dest, filename, contentType, size: bytes.byteLength };
}
