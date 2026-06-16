import { describe, expect, it } from 'vitest';
import { parseCsv, rowsToCsv } from './csv';

describe('csv utilities', () => {
  it('round-trips values with commas and quotes', () => {
    const csv = rowsToCsv([{ Name: 'Laptop, 15"', Cost: 1200 }]);
    expect(csv).toContain('"Laptop, 15"""');
    expect(parseCsv(csv)).toEqual([{ Name: 'Laptop, 15"', Cost: '1200' }]);
  });

  it('parses multiline CSV rows', () => {
    expect(parseCsv('Name,Notes\r\nAsset,"Line 1\nLine 2"')).toEqual([
      { Name: 'Asset', Notes: 'Line 1\nLine 2' },
    ]);
  });
});
