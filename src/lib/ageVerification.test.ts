import { describe, it, expect } from 'vitest';
import { isGateExempt, readAgeAcceptance, revokeAgeAcceptance, saveAgeAcceptance, selfDeclarationProvider } from './ageVerification';

describe('age gate', () => {
  it('self-declaration is not formal verification', () => {
    expect(selfDeclarationProvider.isFormalVerification).toBe(false);
  });
  it('remembers acceptance until revoked', () => {
    revokeAgeAcceptance();
    expect(readAgeAcceptance()).toBe(null);
    const now = Date.now();
    saveAgeAcceptance({ method: 'self_declaration', formallyVerified: false, acceptedAt: now, expiresAt: now + 60_000 });
    expect(readAgeAcceptance()?.method).toBe('self_declaration');
    revokeAgeAcceptance();
    expect(readAgeAcceptance()).toBe(null);
  });
  it('ignores expired acceptance', () => {
    saveAgeAcceptance({ method: 'self_declaration', formallyVerified: false, acceptedAt: 0, expiresAt: Date.now() - 1 });
    expect(readAgeAcceptance()).toBe(null);
    revokeAgeAcceptance();
  });
  it('keeps legal pages and the exit page reachable', () => {
    expect(isGateExempt('/legal/terms')).toBe(true);
    expect(isGateExempt('/exit')).toBe(true);
    expect(isGateExempt('/')).toBe(false);
    expect(isGateExempt('/content/abc')).toBe(false);
  });
});
