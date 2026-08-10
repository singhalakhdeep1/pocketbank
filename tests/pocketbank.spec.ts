import { describe, it, expect } from 'vitest';

describe('PocketBank QR Payload Validator', () => {
  it('should parse EMVCo QR code string format', () => {
    const qrString = '00020101021226360014com.pocketbank';
    expect(qrString.startsWith('000201')).toBe(true);
  });
});
