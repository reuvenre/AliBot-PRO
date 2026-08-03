import { facebookError, facebookErrorText, isTransientFacebookError } from './facebook-errors';

const graph = (code: number, message: string, error_subcode?: number) =>
  ({ response: { data: { error: { code, message, ...(error_subcode ? { error_subcode } : {}) } } } });

describe('facebookError', () => {
  it('replaces the #200 permissions essay with the one action that fixes it', () => {
    // The real message enumerates every branch of the permission model in English and never
    // says which one applies — useless in a Hebrew UI.
    const info = facebookError(graph(200,
      'If posting to a group, requires app being installed in the group, and either '
      + 'publish_to_groups permission with user token, or both pages_read_engagement and '
      + 'pages_manage_posts permission with page token; If posting to a page, requires both '
      + 'pages_read_engagement and pages_manage_posts as an admin',
    ));
    expect(info.message).toContain('Page Access Token');
    expect(info.message).toContain('pages_manage_posts');
    expect(info.message).not.toContain('If posting');
    expect(info.needsUserAction).toBe(true);
  });

  it('flags an expired token as the owner\'s to renew', () => {
    expect(facebookError(graph(190, 'Session has expired')).needsUserAction).toBe(true);
  });

  it('calls #1 "reduce the amount of data" what it is — a transient server blip, not a settings problem', () => {
    // The exact partial-publish from the watchdog: Graph rejected a photo post under load
    // and asked to retry. Nothing on the owner's side is wrong.
    const info = facebookError(graph(1, "Please reduce the amount of data you're asking for, then retry your request"));
    expect(info.needsUserAction).toBe(false);
    expect(info.message).toContain('זמנית');
    expect(info.message).toContain('reduce the amount of data'); // raw kept for traceability
  });

  describe('#190 subcodes each need a different owner action', () => {
    it('says a password change killed every old token, so re-pasting one is pointless', () => {
      // The generic "renew the token" wording had the owner re-paste a token from the very
      // session Facebook invalidated — it fails identically every time.
      const info = facebookError(graph(190,
        'Error validating access token: The session has been invalidated because the user '
        + 'changed their password or Facebook has changed the session for security reasons.',
        460,
      ));
      expect(info.message).toContain('שינוי סיסמה');
      expect(info.message).toContain('להתחבר מחדש');
      expect(info.needsUserAction).toBe(true);
    });

    it('points a de-authorized app at the consent screen, not at a token field', () => {
      expect(facebookError(graph(190, 'App not authorized', 458)).message).toContain('האפליקציה הוסרה');
    });

    it('names the admin problem when the token holder is not a page admin', () => {
      expect(facebookError(graph(190, 'Not an admin', 492)).message).toContain('אינו אדמין');
    });

    it('keeps the generic renew message when no subcode narrows it down', () => {
      expect(facebookError(graph(190, 'Session has expired')).message).toContain('פג תוקף או בוטל');
    });
  });

  it('does not send the owner to Settings for a rate limit', () => {
    // #4 clears on its own; telling the user to change a token would be a wild goose chase.
    const info = facebookError(graph(4, 'Application request limit reached'));
    expect(info.needsUserAction).toBe(false);
    expect(info.message).toContain('בריצה הבאה');
  });

  it('keeps the raw text for codes it does not recognise', () => {
    // Swallowing an unknown failure into a generic message would hide the only clue.
    expect(facebookError(graph(999, 'Some brand new failure')).message).toBe('Some brand new failure');
  });

  it('passes through a non-Graph failure it has no mapping for', () => {
    // Network-level errors carry no code; anything that isn't a recognised timeout keeps
    // its text so an unfamiliar failure stays visible.
    expect(facebookError(new Error('socket hang up')).message).toBe('socket hang up');
  });

  it('prefixes the code so a report stays traceable', () => {
    expect(facebookErrorText(graph(190, 'x'))).toMatch(/^\(#190\)/);
  });

  describe('#10 means different things per surface', () => {
    const err = graph(10, 'Application does not have permission for this action');

    it('points Instagram at the publishing permission it actually needs', () => {
      const info = facebookError(err, 'instagram');
      expect(info.message).toContain('instagram_content_publish');
      // The account granted instagram_manage_events and assumed it covered publishing.
      expect(info.message).toContain('instagram_manage_events');
      expect(info.message).not.toContain('Page Access Token');
    });

    it('keeps the Page-token guidance for Facebook', () => {
      expect(facebookError(err, 'facebook').message).toContain('Page Access Token');
    });
  });

  it('treats a client timeout as transient, not as a settings problem', () => {
    // Graph scrapes the attached link before answering, so a slow round trip is normal —
    // sending the owner to re-issue a token for it would be a wild goose chase.
    const info = facebookError(new Error('timeout of 8000ms exceeded'));
    expect(info.needsUserAction).toBe(false);
    expect(info.message).toContain('לא השיבה בזמן');
  });
});

describe('#100 — Graph\'s generic "invalid parameter"', () => {
  const err100 = (message: string) => ({ response: { data: { error: { code: 100, message } } } });

  it('names the Page ID when Graph says the object cannot be reached', () => {
    const info = facebookError(err100(
      "Unsupported post request. Object with ID '123' does not exist, cannot be loaded due to "
      + 'missing permissions, or does not support this operation.',
    ));
    expect(info.message).toContain('Page ID');
    expect(info.message).toContain('/me/accounts');
    expect(info.needsUserAction).toBe(true);
  });

  it('blames the LINK when Graph says the link is what it rejected', () => {
    // The same code fires for a bad `link`, and sending the owner to re-check a correct
    // Page ID leaves the real culprit untouched.
    const info = facebookError(err100('Invalid parameter: link URL is not properly formatted'));
    expect(info.message).toContain('קישור');
    expect(info.message).not.toContain('/me/accounts');
  });

  it('quotes Facebook verbatim for a flavour it does not recognise', () => {
    // Guessing a cause reads as certainty the code does not have. Say what Facebook said.
    const info = facebookError(err100('Invalid parameter: some future field'));
    expect(info.message).toContain('Invalid parameter: some future field');
    expect(info.message).toContain('Page ID'); // still names the most common cause
  });

  it('applies the same reading to #803', () => {
    expect(facebookError({ response: { data: { error: { code: 803, message: 'does not exist' } } } })
      .message).toContain('Page ID');
  });
});

describe('isTransientFacebookError', () => {
  const graphErr = (code: number, message: string) =>
    ({ response: { data: { error: { code, message } } } });

  it('marks #1 and #2 retryable — Graph rejected explicitly and asked for a retry', () => {
    expect(isTransientFacebookError(graphErr(1, "Please reduce the amount of data you're asking for, then retry your request"))).toBe(true);
    expect(isTransientFacebookError(graphErr(2, 'Service temporarily unavailable'))).toBe(true);
  });

  it('does NOT mark a timeout retryable — Facebook may have already published', () => {
    expect(isTransientFacebookError(Object.assign(new Error('timeout of 20000ms exceeded'), { code: 'ECONNABORTED' }))).toBe(false);
  });

  it('does NOT retry real verdicts: bad token, bad params, rate limits', () => {
    expect(isTransientFacebookError(graphErr(190, 'Session has expired'))).toBe(false);
    expect(isTransientFacebookError(graphErr(100, 'Invalid parameter'))).toBe(false);
    expect(isTransientFacebookError(graphErr(4, 'Application request limit reached'))).toBe(false);
    expect(isTransientFacebookError({})).toBe(false);
  });
});
