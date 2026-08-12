import {
  parseGrantedScopes, missingScopes, canPublish, describeMissingScopes,
  isTierBlockError, tierBlockActive, REQUIRED_SCOPES, PUBLISH_SCOPE, TIER_BLOCK_MESSAGE,
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

describe('isTierBlockError', () => {
  it('recognizes the tier refusal, including with a platform prefix', () => {
    // The fan-out records errors as "Pinterest: <message>" — the marker must survive that.
    expect(isTierBlockError(TIER_BLOCK_MESSAGE)).toBe(true);
    expect(isTierBlockError(`Pinterest: ${TIER_BLOCK_MESSAGE}`)).toBe(true);
  });

  it('does not fire on scope errors or ordinary failures', () => {
    // Auto-pausing a campaign is a big hammer — a missing scope (fixable by reconnect)
    // or a transient API error must never swing it.
    expect(isTierBlockError(describeMissingScopes([PUBLISH_SCOPE], ['pins:read']))).toBe(false);
    expect(isTierBlockError('Pinterest publish failed (500)')).toBe(false);
    expect(isTierBlockError('')).toBe(false);
    expect(isTierBlockError(null)).toBe(false);
  });
});

describe('tierBlockActive', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = 1_800_000_000_000;

  it('stands the fan-out down while the refusal is fresh', () => {
    expect(tierBlockActive(new Date(now - DAY / 2), now)).toBe(true);
  });

  it('allows one probe a day — a permanent stand-down could never discover approval', () => {
    // When Standard access lands, SOMETHING has to attempt a pin to find out. The block
    // expiring daily is that something; suppressing forever would deadlock the recovery.
    expect(tierBlockActive(new Date(now - DAY - 1), now)).toBe(false);
  });

  it('is inert with no recorded block, or garbage in the column', () => {
    expect(tierBlockActive(null, now)).toBe(false);
    expect(tierBlockActive(undefined, now)).toBe(false);
    expect(tierBlockActive('not a date', now)).toBe(false);
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
