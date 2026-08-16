import { auditKeyword, auditKeywords } from './brand-keywords';

describe('auditKeyword', () => {
  it('leaves an ordinary category keyword alone', () => {
    expect(auditKeyword('storage box')).toBeNull();
    expect(auditKeyword('tactical flashlight')).toBeNull();
  });

  it('flags a counterfeit-magnet brand as high risk, with a generic replacement', () => {
    const flag = auditKeyword('nike air max shoes')!;
    expect(flag.risk).toBe('high');
    expect(flag.suggestion).toBe('running sneakers');
  });

  it('flags licensed characters — they enforce as hard as any fashion house', () => {
    expect(auditKeyword('pokemon plush')!.risk).toBe('high');
    expect(auditKeyword('lego compatible blocks')!.risk).toBe('high');
  });

  it('marks a brand with a real AliExpress store as watch, not high', () => {
    // Casio/Xiaomi sell genuinely there — the keyword is a judgement call, not a red line.
    expect(auditKeyword('casio watch')!.risk).toBe('watch');
    expect(auditKeyword('xiaomi earbuds')!.risk).toBe('watch');
  });

  it('treats outright copy phrasing as the worst case', () => {
    expect(auditKeyword('replica handbag')!.risk).toBe('high');
    expect(auditKeyword('watch 1:1 quality')!.risk).toBe('high');
    expect(auditKeyword('תיק העתק')!.risk).toBe('high');
  });

  it('warns on "official/authentic" without calling it counterfeit', () => {
    // The listing the owner showed WAS an authorized Brand+ store. The keyword still can't
    // promise the next result will be — that is the whole point of the wording here.
    const flag = auditKeyword('adidas official authentic')!;
    expect(flag.risk).toBe('watch');
    expect(flag.reason).toContain('לא מבטיח');
  });

  it('ignores blanks', () => {
    expect(auditKeyword('')).toBeNull();
    expect(auditKeyword('  ')).toBeNull();
  });
});

describe('auditKeywords', () => {
  it('reports each keyword once, worst first', () => {
    const flags = auditKeywords(['storage box', 'casio watch', 'Nike shoes', 'nike shoes', '']);
    expect(flags.map((f) => f.keyword)).toEqual(['Nike shoes', 'casio watch']);
  });

  it('handles a campaign with no keywords at all', () => {
    expect(auditKeywords(null)).toEqual([]);
    expect(auditKeywords([])).toEqual([]);
  });
});
