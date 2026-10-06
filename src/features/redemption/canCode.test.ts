import { describe, expect, it } from 'vitest';
import { parseScannedText } from './canCode';

describe('parseScannedText', () => {
  it('reads the code from the serialNumber link older cans use', () => {
    expect(parseScannedText('https://us.zyn.com/ZYNRewards/?serialNumber=2E4CP98V0')).toEqual({
      kind: 'code',
      code: '2E4CP98V0',
    });
  });

  it('reads the code from the first path segment of a zyn.com short link', () => {
    expect(parseScannedText('https://qr.zyn.com/aB3dE6gH9')).toEqual({
      kind: 'code',
      code: 'aB3dE6gH9',
    });
  });

  it('accepts a bare code, keeping its case and dropping surrounding whitespace', () => {
    expect(parseScannedText('  aB3dE6gH9\n')).toEqual({ kind: 'code', code: 'aB3dE6gH9' });
  });

  it('flags a link on an unknown host instead of trusting it', () => {
    expect(parseScannedText('https://example.com/2E4CP98V0')).toEqual({
      kind: 'untrusted_host',
      code: '2E4CP98V0',
      host: 'example.com',
    });
  });

  it('accepts an unknown host once the user has trusted it', () => {
    expect(parseScannedText('https://example.com/2E4CP98V0', ['example.com'])).toEqual({
      kind: 'code',
      code: '2E4CP98V0',
    });
  });

  it('does not mistake a look-alike domain for zyn.com', () => {
    expect(parseScannedText('https://notzyn.com/2E4CP98V0').kind).toBe('untrusted_host');
    expect(parseScannedText('https://zyn.com.evil.test/2E4CP98V0').kind).toBe('untrusted_host');
  });

  it.each([
    ['a zyn.com page that carries no code', 'https://www.zyn.com/us/en/zyn-rewards.html'],
    ['free text', 'hello there, world'],
    ['a non-web link', 'mailto:someone@zyn.com'],
    ['a code with punctuation', 'https://us.zyn.com/ZYNRewards/?serialNumber=2E4C-P98V0'],
    ['an empty string', '   '],
  ])('rejects %s', (_description, text) => {
    expect(parseScannedText(text)).toEqual({ kind: 'not_a_code' });
  });
});
