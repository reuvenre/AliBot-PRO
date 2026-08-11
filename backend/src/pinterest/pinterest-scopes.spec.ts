import {
  parseGrantedScopes, missingScopes, canPublish, describeMissingScopes,
  REQUIRED_SCOPES, PUBLISH_SCOPE,
} from './pinterest-scopes';

describe('parseGrantedScopes', () => {
  it('reads the space-separated form', () => {
    expect(parseGrantedScopes('boards:read pins:read pins:write'))
      .toEqual(['boards:read', 'pins:read', 'pins:write']);
  });

  it('reads the comma-separated form too', () => {
    // Pinterest has returned both. Betting on one would read zero scopes from the other
    // and declare a healthy connection broken.
    expect(parseGrantedScopes('boards:read,pins:read,pins:write'))
      .toEqual(['boards:read', 'pins:read', 'pins:write']);
  });

  it('survives padding, mixed case and empty input', () => {
    expect(parseGrantedScopes('  BOARDS:READ ,, pins:write ')).toEqual(['boards:read', 'pins:write']);
    expect(parseGrantedScopes('')).toEqual([]);
    expect(parseGrantedScopes(null)).toEqual([]);
    expect(parseGrantedScopes(undefined)).toEqual([]);
  });
});

describe('missingScopes', () => {
  it('names exactly what a read-only grant is missing', () => {
    // THE INCIDENT: boards listed fine, the first pin came back "insufficient permissions".
    expect(missingScopes(['boards:read', 'pins:read'])).toEqual(['boards:write', PUBLISH_SCOPE]);
  });

  it('flags a grant that has pins:write but not boards:write', () => {
    // The counter-intuitive requirement: creating a pin writes to a board, so Pinterest
    // checks the board scope too. This exact combination looked complete and was not.
    expect(missingScopes(['boards:read', 'pins:read', 'pins:write'])).toEqual(['boards:write']);
  });

  it('still lets that grant publish — the boards:write requirement is inferred, not documented', () => {
    // Reported by Pinterest developers rather than stated in a scope table. Worth asking
    // for and worth warning about; not worth refusing somebody's pin over.
    expect(canPublish(['boards:read', 'pins:read', 'pins:write'])).toBe(true);
  });

  it('reports nothing missing for a complete grant', () => {
    expect(missingScopes([...REQUIRED_SCOPES])).toEqual([]);
  });

  it('ignores extra scopes we never asked for', () => {
    expect(missingScopes([...REQUIRED_SCOPES, 'user_accounts:read'])).toEqual([]);
  });

  it('treats an UNKNOWN grant as fine, not as broken', () => {
    // Connections made before the grant was recorded have no scope list. A token that has
    // been publishing for weeks must not be condemned because we lack a record of it.
    expect(missingScopes([])).toEqual([]);
    expect(canPublish([])).toBe(true);
  });
});

describe('canPublish', () => {
  it('is false only when the publish scope is known to be absent', () => {
    expect(canPublish(['boards:read', 'pins:read'])).toBe(false);
    expect(canPublish(['pins:write'])).toBe(true);
  });
});

describe('describeMissingScopes', () => {
  it('says nothing when nothing is missing', () => {
    expect(describeMissingScopes([])).toBe('');
  });

  it('names the missing scopes and gives the one action that fixes it', () => {
    const msg = describeMissingScopes([PUBLISH_SCOPE]);
    expect(msg).toContain('pins:write');
    expect(msg).toContain('התחבר מחדש');
    // An earlier version sent people hunting for a scopes screen in Pinterest's portal.
    // There isn't one — scopes are fixed at authorization time — and the wrong instruction
    // cost a round trip. Nothing here may point at the portal.
    expect(msg).not.toContain('developers.pinterest.com');
  });
});
