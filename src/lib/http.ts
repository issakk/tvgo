// Small HTTP and text helpers shared by the config loader, the site clients and the pages.

/** How long a request may take before it is aborted. */
const REQUEST_TIMEOUT = 15000;

/** Why a failed operation failed, as a sentence a page can show. */
export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "未知错误";
}

/** Fetches `url` as text, with a timeout and a message rather than an exception dump. */
export async function fetchText(url: string, timeout = REQUEST_TIMEOUT): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`请求超时：${url}`);
    throw new Error(`${messageOf(error)}（${url}）`);
  } finally {
    clearTimeout(timer);
  }
}

/** Parses JSON, tolerating JSONP wrappers and a little text around the document. */
export function parseLooseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("响应为空");
  try {
    return JSON.parse(trimmed);
  } catch {
    // A JSONP callback or a byte-order mark: keep the document itself.
  }
  const start = trimmed.search(/[[{]/);
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      // Fall through to the error below.
    }
  }
  throw new Error("响应不是 JSON");
}

/** A short, stable id for a string: used for configs, titles and channels. */
export function hashId(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** The host of `url`, or `url` itself when it has none. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** `reference` resolved against `baseUrl` when it is relative. */
export function resolveUrl(reference: string, baseUrl: string): string {
  const value = reference.trim();
  if (!value) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (!baseUrl) return value;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

/** Plain text from a value a site sent: HTML tags and entities removed. */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Whether `url` is a web page the app shows in a web view rather than a media stream. */
export function isWebPageUrl(url: string): boolean {
  return /\.(html?|php|shtml|jsp|aspx|do)(\?|#|$)/i.test(url) || /\/$/.test(url);
}
