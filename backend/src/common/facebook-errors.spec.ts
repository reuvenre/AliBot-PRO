import { facebookError, facebookErrorText } from './facebook-errors';

const graph = (code: number, message: string) => ({ response: { data: { error: { code, message } } } });

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

  it('survives a non-Graph error such as a socket timeout', () => {
    expect(facebookError(new Error('ETIMEDOUT')).message).toBe('ETIMEDOUT');
  });

  it('prefixes the code so a report stays traceable', () => {
    expect(facebookErrorText(graph(190, 'x'))).toMatch(/^\(#190\)/);
  });
});
