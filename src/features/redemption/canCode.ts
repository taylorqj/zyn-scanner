const CODE_PATTERN = /^[A-Za-z0-9]{6,20}$/;
const ZYN_HOST_PATTERN = /(^|\.)zyn\.com$/;

export type ParsedScan =
  | { kind: 'code'; code: string }
  /** Looks like a can link, but points at a host we have not been told is Zyn's. */
  | { kind: 'untrusted_host'; code: string; host: string }
  | { kind: 'not_a_code' };

/**
 * Pulls the reward code out of whatever a can's QR code (or the manual entry box) contained.
 *
 * Mirrors how zyn.com reads a scanned value: a bare code is used as-is, and for a link the code is
 * the `serialNumber` query parameter (older cans) or the first path segment (short links).
 * Codes are case-sensitive, so the value is never re-cased.
 */
export function parseScannedText(text: string, trustedHosts: readonly string[] = []): ParsedScan {
  const trimmed = text.trim();
  if (CODE_PATTERN.test(trimmed)) return { kind: 'code', code: trimmed };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: 'not_a_code' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { kind: 'not_a_code' };

  const candidate =
    url.searchParams.get('serialNumber')?.trim() ?? url.pathname.split('/').filter(Boolean)[0] ?? '';
  if (!CODE_PATTERN.test(candidate)) return { kind: 'not_a_code' };

  const host = url.hostname.toLowerCase();
  if (ZYN_HOST_PATTERN.test(host) || trustedHosts.includes(host)) {
    return { kind: 'code', code: candidate };
  }
  return { kind: 'untrusted_host', code: candidate, host };
}
