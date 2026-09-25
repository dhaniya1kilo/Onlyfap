import { describe, it, expect } from 'vitest';
import { compactNumber, viewsLabel } from './format';
import { browseSortFromParam, browseSortParam, searchSortFromParam } from '../lib/labels';

describe('view counts', () => {
  it('formats compact numbers', () => {
    expect(compactNumber(999)).toBe(new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(999));
    expect(compactNumber(1200).replace(/\s/g, '')).toBe(new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(1200).replace(/\s/g, ''));
    expect(compactNumber(Number.NaN)).toBe(compactNumber(0));
  });
  it('pluralises views', () => {
    expect(viewsLabel(1).endsWith(' view')).toBe(true);
    expect(viewsLabel(2).endsWith(' views')).toBe(true);
  });
});

describe('sort params', () => {
  it('round-trips browse sorts and defaults to trending', () => {
    expect(browseSortFromParam(null)).toBe('trending');
    expect(browseSortFromParam('bogus')).toBe('trending');
    expect(browseSortFromParam(browseSortParam('most_viewed'))).toBe('most_viewed');
    expect(browseSortFromParam('old')).toBe('old');
  });
  it('parses search sorts and defaults to relevance', () => {
    expect(searchSortFromParam(null)).toBe('relevance');
    expect(searchSortFromParam('new')).toBe('new');
    expect(searchSortFromParam('most-viewed')).toBe('most_viewed');
  });
});
