import { gradePuzzle, TECHNIQUE_RATING, TECHNIQUE_TIER } from './grade';

describe('gradePuzzle', () => {
  it('grades a singles-only puzzle as easy', () => {
    // Full solution with the last cell of each row blanked — every blank is a
    // "last value in row/box", i.e. a naked/hidden single.
    const givens =
      '53467891.67219534.19834256.85976142.42685379.71392485.96153728.28741963.34528617.';
    const result = gradePuzzle(givens);

    expect(result.solvable).toBe(true);
    expect(result.solved).toBe(true);
    expect(result.tier).toBe('easy');
    expect(result.hardestTechnique === 'naked_single' || result.hardestTechnique === 'hidden_single').toBe(true);
  });

  it("grades Arto Inkala's 2012 puzzle as diabolical (beyond the ladder)", () => {
    // The famous "world's hardest" (SE ~11) — needs techniques beyond our
    // detector set, so the ladder stalls and it lands in the top tier.
    const inkala2012 =
      '800000000003600000070090200050007000000045700000100030001000068008500010090000400';
    const result = gradePuzzle(inkala2012);

    expect(result.solvable).toBe(true);
    expect(result.solved).toBe(false);
    expect(result.tier).toBe('diabolical');
  });

  it('reports unsolvable for a contradictory grid', () => {
    // Row 0 holds 1-8 with the last cell empty (so it needs a 9), but a 9 already
    // sits in that same column — the empty cell has zero candidates, so the
    // solver fails fast rather than churning over a near-empty board.
    const bad = '12345678.' + '........9' + '.'.repeat(63);
    const result = gradePuzzle(bad);
    expect(result.solvable).toBe(false);
  });

  it('keeps the tier and rating maps consistent', () => {
    const tierKeys = Object.keys(TECHNIQUE_TIER).sort();
    const ratingKeys = Object.keys(TECHNIQUE_RATING).sort();
    expect(ratingKeys).toEqual(tierKeys);
    expect(TECHNIQUE_TIER.brute_force).toBe('diabolical');
    // Ratings should rise with tier: the hardest single beats the easiest chain? no —
    // just sanity that chains outrate singles.
    expect(TECHNIQUE_RATING.aic).toBeGreaterThan(TECHNIQUE_RATING.naked_single);
  });
});
