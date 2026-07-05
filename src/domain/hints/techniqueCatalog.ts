/**
 * Teaching content for every solving technique — pure data, no framework
 * imports. Written for a player who has never heard of the technique:
 * `whatItIs` is the stage-one teaser (name + plain-language definition), and
 * `howItWorks` are generic teaching steps shown before the concrete on-board
 * walkthrough. Techniques whose concrete narration already teaches from
 * scratch (singles, brute force) leave `howItWorks` empty.
 */

import type { TechniqueId, TextSegment } from './types';

export interface TechniqueLesson {
  /** 1–2 sentence novice definition, shown at the "what" stage. */
  whatItIs: TextSegment[];
  /** Generic teaching steps prepended to the explanation stage. */
  howItWorks: TextSegment[][];
}

const t = (text: string): TextSegment => ({ text });
const em = (text: string): TextSegment => ({ text, emphasis: true });

/** Shared lesson builder for naked subsets (pair/triple/quad). */
function nakedSubset(name: string, count: string, digitsWord: string): TechniqueLesson {
  return {
    whatItIs: [
      t('A '),
      em(name),
      t(
        ` is ${count} cells in the same row, column or box that between them hold only ${digitsWord} different candidates. Those digits are locked into those cells.`,
      ),
    ],
    howItWorks: [
      [
        t(`Each of the ${count} cells must take one of the ${digitsWord} digits, so together they `),
        em('use all of them up'),
        t(
          `. No other cell in that row, column or box can hold any of those digits, so the candidates can be erased everywhere else in the unit. (The cells don't each need every candidate — together they may only use those ${digitsWord}.)`,
        ),
      ],
    ],
  };
}

/** Shared lesson builder for hidden subsets (pair/triple/quad). */
function hiddenSubset(name: string, count: string, digitsWord: string): TechniqueLesson {
  return {
    whatItIs: [
      t('A '),
      em(name),
      t(
        ` is ${digitsWord} digits that, within one row, column or box, can only go in the same ${count} cells — even though those cells may still show other candidates.`,
      ),
    ],
    howItWorks: [
      [
        t(`The ${digitsWord} digits have nowhere else to go in this unit, so the ${count} cells `),
        em('must be reserved for them'),
        t(
          ' — one digit per cell. Any other candidate written in those cells is impossible and can be erased, leaving the hidden digits exposed.',
        ),
      ],
    ],
  };
}

/** Shared lesson builder for finned fish (X-Wing/Swordfish/Jellyfish + fin). */
function finnedFish(name: string, base: string, linesWord: string): TechniqueLesson {
  return {
    whatItIs: [
      t('A '),
      em(name),
      t(
        ` is a ${base} with a flaw: in one of its ${linesWord} lines the digit spills slightly outside the pattern — but only into cells of a single box, the "fin".`,
      ),
    ],
    howItWorks: [
      [
        t(`If the fin cells are all false, the pattern is a perfect ${base} and its usual eliminations hold. If a fin cell is true, the digit sits in the fin's box. `),
        em('Either way'),
        t(
          ", cells covered by BOTH outcomes — the normal eliminations that also sit in the fin's box — can never hold the digit.",
        ),
      ],
    ],
  };
}

/** Shared lesson for the Unique Rectangle family. */
const uniqueRectangleLesson: TechniqueLesson = {
  whatItIs: [
    t('A '),
    em('Unique Rectangle'),
    t(
      ' exploits the fact that a proper Sudoku has exactly one solution: four cells forming a rectangle across two boxes must not all end up with the same two candidates.',
    ),
  ],
  howItWorks: [
    [
      t('Imagine the four corners held only the same two candidates. You could '),
      em('swap the two digits around the rectangle'),
      t(
        ' and every row, column and box would still be satisfied — the puzzle would have two solutions. A proper Sudoku never allows that.',
      ),
    ],
    [
      t('So the pattern must be broken: the corner(s) holding '),
      em('extra candidates'),
      t(
        ' are forced to resolve toward those extras. That lets us remove candidates (or place a digit) so the deadly rectangle can never complete.',
      ),
    ],
  ],
};

export const TECHNIQUE_CATALOG: Record<TechniqueId, TechniqueLesson> = {
  naked_single: {
    whatItIs: [
      t('A '),
      em('Naked Single'),
      t(
        ' is a cell where only one digit can possibly go — every other digit already appears in its row, column or box.',
      ),
    ],
    howItWorks: [],
  },

  hidden_single: {
    whatItIs: [
      t('A '),
      em('Hidden Single'),
      t(
        ' is a digit with only one possible home inside a row, column or box — even if that cell could still hold other digits.',
      ),
    ],
    howItWorks: [],
  },

  naked_pair: nakedSubset('Naked Pair', 'two', 'two'),
  naked_triple: nakedSubset('Naked Triple', 'three', 'three'),
  naked_quad: nakedSubset('Naked Quad', 'four', 'four'),

  hidden_pair: hiddenSubset('Hidden Pair', 'two', 'two'),
  hidden_triple: hiddenSubset('Hidden Triple', 'three', 'three'),
  hidden_quad: hiddenSubset('Hidden Quad', 'four', 'four'),

  pointing_pair: {
    whatItIs: [
      t('A '),
      em('Pointing Pair'),
      t(
        " happens when, inside one box, a digit's only possible cells all sit on the same row or column — the digit \"points\" along that line.",
      ),
    ],
    howItWorks: [
      [
        t('The box must contain the digit somewhere, and every option sits on one line. So the digit '),
        em('will land on that line inside the box'),
        t(
          ' — which means cells on the same line but outside the box can never hold it, and the candidate can be erased there.',
        ),
      ],
    ],
  },

  claiming: {
    whatItIs: [
      t('A '),
      em('Box-Line Reduction'),
      t(
        " happens when, within one row or column, a digit's only possible cells all fall inside the same box.",
      ),
    ],
    howItWorks: [
      [
        t('The line must contain the digit, and all its options sit in one box — so that box '),
        em('claims the digit for its slice of the line'),
        t(
          ". The digit can't appear anywhere else in that box, so the candidate is erased from the box's other cells.",
        ),
      ],
    ],
  },

  x_wing: {
    whatItIs: [
      t('An '),
      em('X-Wing'),
      t(
        ' is a rectangle built from a single digit: in two different rows, that digit can only go in the same two columns, forming four corners.',
      ),
    ],
    howItWorks: [
      [
        t('Look at the two rows. In each, the digit has '),
        em('exactly two possible cells'),
        t(', and those cells line up in the same two columns — four cells forming the corners of a rectangle.'),
      ],
      [
        t('Each row takes one corner, and the two rows can\'t use the same column. So '),
        em('both columns get the digit at a corner'),
        t(
          ' — and every other cell in those two columns can never hold the digit. Those candidates can be erased.',
        ),
      ],
    ],
  },

  swordfish: {
    whatItIs: [
      t('A '),
      em('Swordfish'),
      t(
        ' is the bigger sibling of the X-Wing: one digit is confined to the same three columns across three different rows (or the other way around).',
      ),
    ],
    howItWorks: [
      [
        t("In each of the three rows, the digit's possible cells all fall inside "),
        em('the same three columns'),
        t(' — a 3×3 grid of intersections holds every option.'),
      ],
      [
        t('The three rows place the digit in three '),
        em('different'),
        t(
          ' columns — one each. So all three columns receive their digit inside the pattern, and the digit can be removed from every other cell of those columns.',
        ),
      ],
    ],
  },

  jellyfish: {
    whatItIs: [
      t('A '),
      em('Jellyfish'),
      t(
        ' extends the X-Wing idea to four lines: one digit is confined to the same four columns across four different rows (or the other way around).',
      ),
    ],
    howItWorks: [
      [
        t("In each of the four rows, the digit's possible cells all fall inside "),
        em('the same four columns'),
        t(' — every option lives at one of the 4×4 intersections.'),
      ],
      [
        t('The four rows place the digit in four '),
        em('different'),
        t(
          ' columns — one each. So each of those columns gets its digit inside the pattern, and the candidate can be erased from the rest of those columns.',
        ),
      ],
    ],
  },

  xy_wing: {
    whatItIs: [
      t('An '),
      em('XY-Wing'),
      t(
        ' links three cells that each hold exactly two candidates: a pivot holding X and Y, plus two pincers — one holding X and Z, one holding Y and Z — that both see the pivot.',
      ),
    ],
    howItWorks: [
      [
        t('Try the pivot both ways. If it becomes '),
        em('X'),
        t(', the pincer that shares X loses it and must become Z. If it becomes '),
        em('Y'),
        t(', the other pincer must become Z instead.'),
      ],
      [
        t('Either way, '),
        em('one of the two pincers ends up as Z'),
        t(
          ' — always. So any cell that sees both pincers can never hold Z, and that candidate can be erased.',
        ),
      ],
    ],
  },

  xyz_wing: {
    whatItIs: [
      t('An '),
      em('XYZ-Wing'),
      t(
        ' is like an XY-Wing, except the pivot holds three candidates (X, Y and Z) and each pincer shares Z with it.',
      ),
    ],
    howItWorks: [
      [
        t('Test every option for the pivot: whether it becomes X, Y or Z, '),
        em('at least one of the three pattern cells ends up being Z'),
        t(' — a pincer in the first two cases, the pivot itself in the last.'),
      ],
      [
        t('So a cell that sees '),
        em('all three'),
        t(' pattern cells can never hold Z, and the candidate is removed there.'),
      ],
    ],
  },

  w_wing: {
    whatItIs: [
      t('A '),
      em('W-Wing'),
      t(
        ' uses two separate cells that hold the same two candidates (say X and Y), connected through a strong link on one of those digits.',
      ),
    ],
    howItWorks: [
      [
        t('First, the connector — a '),
        em('strong link'),
        t(
          ': somewhere on the board a row, column or box has only two cells that can hold X, so one of them MUST be X.',
        ),
      ],
      [
        t(
          'Each end of the link sees one of the pair cells. Whichever end turns out to be X forces its neighbouring pair cell to give up X and become Y. So ',
        ),
        em('at least one pair cell is Y'),
        t(' — and any cell that sees both pair cells can never hold Y.'),
      ],
    ],
  },

  skyscraper: {
    whatItIs: [
      t('A '),
      em('Skyscraper'),
      t(
        ' is built from one digit that has exactly two possible cells in each of two rows (or columns), where one pair of ends lines up and the other pair — the "roofs" — does not.',
      ),
    ],
    howItWorks: [
      [
        t('Each of the two lines must place the digit in one of its two cells. The aligned ends share a column, so '),
        em("they can't both be the digit"),
        t(' — at least one line must use its roof end instead.'),
      ],
      [
        t('That guarantees '),
        em('at least one roof is the digit'),
        t(
          '. Any cell that sees both roofs can therefore never hold it, and the candidate can be erased there.',
        ),
      ],
    ],
  },

  two_string_kite: {
    whatItIs: [
      t('A '),
      em('2-String Kite'),
      t(
        " connects one digit's two possible cells in a row (one \"string\") with its two possible cells in a column (the other), tied together through a shared box.",
      ),
    ],
    howItWorks: [
      [
        t('One cell of each string sits inside the same box. Those two ends '),
        em("can't both be the digit"),
        t(' — a box holds each digit only once.'),
      ],
      [
        t('So at least one string must place the digit at its '),
        em('far end'),
        t(
          '. The single cell that sees both far ends can therefore never hold the digit, and loses that candidate.',
        ),
      ],
    ],
  },

  remote_pair: {
    whatItIs: [
      t('A '),
      em('Remote Pair'),
      t(
        ' is a chain of cells that all hold the same two candidates, linked so each cell sees the next. The two digits must alternate along the chain.',
      ),
    ],
    howItWorks: [
      [
        t('Start at one end of the chain. Whatever digit that cell takes, the next cell — which sees it — must take '),
        em('the other digit'),
        t(', the one after that the first again, and so on: the two digits alternate like the colors of a checkerboard.'),
      ],
      [
        t('Cells an '),
        em('odd number of links apart'),
        t(
          ' always hold different digits — between the two of them, both candidates of the pair are used.',
        ),
      ],
      [
        t('So any outside cell that sees two opposite ends of an odd stretch can hold '),
        em('neither digit of the pair'),
        t(' — both candidates can be erased there.'),
      ],
    ],
  },

  empty_rectangle: {
    whatItIs: [
      t('An '),
      em('Empty Rectangle'),
      t(
        " uses a box where one digit's candidates all sit on a single row-plus-column cross, combined with a strong pair of that digit elsewhere.",
      ),
    ],
    howItWorks: [
      [
        t('Inside the box, wherever the digit finally lands, it lies '),
        em('on the cross'),
        t(' — the marked row or the marked column. The rest of the box is empty of that digit.'),
      ],
      [
        t('Elsewhere, a line holds the digit in '),
        em('only two cells'),
        t(
          ", so one of them must be it. Follow both possibilities: each one ends up forbidding the same cell from holding the digit — so that candidate can be erased.",
        ),
      ],
    ],
  },

  unique_rectangle: uniqueRectangleLesson,
  unique_rectangle_2: uniqueRectangleLesson,
  unique_rectangle_3: uniqueRectangleLesson,
  unique_rectangle_4: uniqueRectangleLesson,
  unique_rectangle_5: uniqueRectangleLesson,
  unique_rectangle_6: uniqueRectangleLesson,

  hidden_rectangle: {
    whatItIs: [
      t('A '),
      em('Hidden Rectangle'),
      t(
        ' is a Unique Rectangle buried under extra candidates: one corner holds only the two rectangle digits, and strong links on one of them lock the pattern.',
      ),
    ],
    howItWorks: [
      [
        t('If the corner opposite the clean two-candidate corner took the second rectangle digit, the strong links would force '),
        em('all four corners into the same two digits'),
        t(' — the deadly rectangle a single-solution puzzle can never allow.'),
      ],
      [
        t('So that opposite corner '),
        em("can't hold"),
        t(' the second rectangle digit, and the candidate is erased there.'),
      ],
    ],
  },

  finned_x_wing: finnedFish('Finned X-Wing', 'X-Wing', 'two'),
  finned_swordfish: finnedFish('Finned Swordfish', 'Swordfish', 'three'),
  finned_jellyfish: finnedFish('Finned Jellyfish', 'Jellyfish', 'four'),

  wxyz_wing: {
    whatItIs: [
      t('A '),
      em('WXYZ-Wing'),
      t(
        ' spreads four candidates over four cells — a pivot and three attached cells — arranged so one shared digit Z must land in the pattern.',
      ),
    ],
    howItWorks: [
      [
        t('The four cells hold only four different digits between them. Follow every way the pattern can resolve: '),
        em('at least one of its Z candidates is always true'),
        t(' — there is no arrangement that avoids Z entirely.'),
      ],
      [
        t('So any cell that sees '),
        em('every Z candidate'),
        t(' of the pattern can never hold Z, and loses that candidate.'),
      ],
    ],
  },

  medusa_3d: {
    whatItIs: [
      t('3D '),
      em('Medusa'),
      t(
        ' extends coloring to several digits at once: strong links between cells AND the two candidates inside two-candidate cells are painted in two alternating colors.',
      ),
    ],
    howItWorks: [
      [
        t('Wherever a digit fits in only two cells of a unit — or a cell holds only two candidates — the two options form a '),
        em('strong link'),
        t(': exactly one of them is true. Painting each side a different color and following every link builds one connected two-color web.'),
      ],
      [
        t('One entire color is true and the other false. If a color '),
        em('contradicts itself'),
        t(' (twice in one cell, or twice in a unit for one digit), that whole color is false — and every candidate that conflicts with both colors can be erased.'),
      ],
    ],
  },

  grouped_aic: {
    whatItIs: [
      t('A '),
      em('Grouped Chain'),
      t(
        ' is an Alternating Inference Chain whose links may connect groups of candidates — the two or three cells of a digit inside one box-line slice acting as a single unit.',
      ),
    ],
    howItWorks: [
      [
        t('A group of candidates in a box-line intersection behaves like one chain node: the digit is either '),
        em('somewhere in the group'),
        t(' or nowhere in it. That lets strong and weak links pass through slices no single-cell chain could cross.'),
      ],
      [
        t('The chain still alternates strong and weak links, so '),
        em('at least one endpoint is always true'),
        t(' — and any candidate that conflicts with both endpoints can be erased.'),
      ],
    ],
  },

  als_xy_wing: {
    whatItIs: [
      t('An '),
      em('ALS-XY-Wing'),
      t(
        ' chains three Almost Locked Sets together the way an XY-Wing chains three cells: a middle set connects two outer sets through restricted digits.',
      ),
    ],
    howItWorks: [
      [
        t('Each restricted digit can appear in only one of the two sets it connects. Follow both ways the middle set can resolve: either way, '),
        em('one of the outer sets locks'),
        t(' and must use its copy of the shared digit Z.'),
      ],
      [
        t('So Z is certainly placed in one outer set or the other — and any cell that sees '),
        em('every Z candidate of both outer sets'),
        t(' can never hold Z.'),
      ],
    ],
  },

  als_chain: {
    whatItIs: [
      t('An '),
      em('ALS Chain'),
      t(
        ' strings several Almost Locked Sets together through restricted common digits, carrying the ALS-XZ logic across the board.',
      ),
    ],
    howItWorks: [
      [
        t('Each link digit fits in only one of its two neighbouring sets. Push a choice down the chain: every arrangement ends with '),
        em('one of the end sets locked'),
        t(', forced to use its copy of the shared digit Z.'),
      ],
      [
        t('So Z lands in one end set or the other, and any cell that sees '),
        em('every Z candidate of both ends'),
        t(' loses that candidate.'),
      ],
    ],
  },

  nishio_forcing_chain: {
    whatItIs: [
      t('A '),
      em('Contradiction Chain'),
      t(
        ' (Nishio) tests a single candidate: assume it is true, follow the forced consequences, and watch the puzzle break.',
      ),
    ],
    howItWorks: [
      [
        t('Suppose the candidate '),
        em('were'),
        t(
          ' the value of its cell. Each consequence is forced — a cell down to one option, a unit down to one home for a digit — so the whole line of reasoning is airtight.',
        ),
      ],
      [
        t('The chain ends in an impossibility: a cell with no candidates left, or a unit with nowhere to put a digit. So the assumption was wrong and '),
        em('the candidate can be erased'),
        t('.'),
      ],
    ],
  },

  cell_forcing_chain: {
    whatItIs: [
      t('A '),
      em('Cell Forcing Chain'),
      t(
        " tries every candidate of one cell in turn and follows each line of consequences. Whatever ALL the lines agree on must be true.",
      ),
    ],
    howItWorks: [
      [
        t('The cell must take '),
        em('one'),
        t(
          ' of its candidates — there is no other option. Each candidate starts its own chain of forced moves.',
        ),
      ],
      [
        t('If every chain reaches the '),
        em('same conclusion'),
        t(
          ' — some candidate elsewhere always turns off, or some cell always gets the same digit — that conclusion holds no matter which candidate was true, and can be applied.',
        ),
      ],
    ],
  },

  unit_forcing_chain: {
    whatItIs: [
      t('A '),
      em('Unit Forcing Chain'),
      t(
        ' tries every possible home of one digit within a row, column or box, and follows each line of consequences to a common conclusion.',
      ),
    ],
    howItWorks: [
      [
        t('The unit must place the digit in '),
        em('one'),
        t(' of the marked cells. Each placement starts its own chain of forced moves.'),
      ],
      [
        t('Whatever '),
        em('all the chains agree on'),
        t(' is true regardless of where the digit really lands — so that shared conclusion can be applied.'),
      ],
    ],
  },

  dynamic_forcing_chain: {
    whatItIs: [
      t('A '),
      em('Dynamic Forcing Chain'),
      t(
        ' is a forcing chain that may combine several consequences at once — using locked candidates and pairs mid-chain — to push an assumption to its conclusion.',
      ),
    ],
    howItWorks: [
      [
        t('Like any forcing chain, it assumes a candidate and follows what '),
        em('must'),
        t(
          ' happen. Here the consequences may interact: two eliminations can jointly lock a pair or empty a slice, unlocking further forced moves.',
        ),
      ],
      [
        t('When every branch of the assumption reaches the same conclusion — or the assumption breaks the puzzle — that '),
        em('conclusion is certain'),
        t(' and can be applied.'),
      ],
    ],
  },

  bug1: {
    whatItIs: [
      t('BUG stands for '),
      em('Bivalue Universal Grave'),
      t(
        ': a state where every unsolved cell holds exactly two candidates — except one. A proper puzzle can never be left in a full grave, and that exception is the way out.',
      ),
    ],
    howItWorks: [
      [
        t('If the one cell with three candidates dropped its extra digit, '),
        em('every remaining cell would be a two-way choice'),
        t(
          ' — and the whole grid could be flipped into a second valid solution. A proper Sudoku has exactly one solution, so that state is impossible.',
        ),
      ],
      [
        t('The only escape is for that cell to take its '),
        em('extra digit'),
        t(' — so it can be placed right away.'),
      ],
    ],
  },

  simple_coloring: {
    whatItIs: [
      t('Simple '),
      em('Coloring'),
      t(
        ' follows a single digit through its strong links — units where the digit fits in only two cells — painting the possibilities in two alternating colors.',
      ),
    ],
    howItWorks: [
      [
        t('A '),
        em('strong link'),
        t(
          ' means: in some row, column or box, the digit has only two possible cells — so exactly one of the two must be the digit.',
        ),
      ],
      [
        t('Color one cell of a link blue and its partner green, and keep extending through every strong link you can reach. All blue cells '),
        em('stand or fall together'),
        t(', and likewise all green cells: one entire color is the true one.'),
      ],
      [
        t('If some cell sees both a blue and a green cell, one of those two is certainly the digit — so that cell '),
        em("can't be"),
        t(
          ', and loses the candidate. (And if one color ever collides with itself inside a unit, that whole color is false.)',
        ),
      ],
    ],
  },

  aic: {
    whatItIs: [
      t('An '),
      em('Alternating Inference Chain'),
      t(
        ' links candidates with two kinds of logic: strong links ("one of these two MUST be true") and weak links ("these two can\'t BOTH be true").',
      ),
    ],
    howItWorks: [
      [
        t('A '),
        em('strong link'),
        t(
          ' joins the only two places a digit can go in a row, column or box (or the only two candidates left in a cell): if one is false, the other must be true.',
        ),
      ],
      [
        t('A '),
        em('weak link'),
        t(
          " joins candidates that can't both be true — like the same digit twice in one unit. Alternating strong and weak links lets an \"if… then…\" argument travel across the board.",
        ),
      ],
      [
        t('Follow the chain from either end: assuming the start is false forces the end to be true, and vice versa. So '),
        em('at least one endpoint is always true'),
        t(' — and any candidate that conflicts with both endpoints can be erased.'),
      ],
    ],
  },

  als_xz: {
    whatItIs: [
      t('An '),
      em('ALS-XZ'),
      t(
        ' pairs two Almost Locked Sets — groups of cells in one unit that share exactly one more candidate than they have cells.',
      ),
    ],
    howItWorks: [
      [
        t('An '),
        em('Almost Locked Set'),
        t(
          ' is one candidate away from locking: N cells sharing N+1 digits. Remove any one digit from it and the remaining digits lock into the cells immediately.',
        ),
      ],
      [
        t('The two sets share a '),
        em('restricted digit X'),
        t(
          ": every X in one set sees every X in the other, so X can't appear in both sets. At least one set loses X — and locks.",
        ),
      ],
      [
        t('Whichever set locks must use its copy of the other shared digit '),
        em('Z'),
        t(
          '. So Z is certainly placed in one set or the other — and any cell that sees every Z candidate of both sets can never hold Z.',
        ),
      ],
    ],
  },

  brute_force: {
    whatItIs: [
      t('No named technique applies here. This step uses '),
      em('trial and error'),
      t(' — testing a candidate and following the consequences until one choice proves right.'),
    ],
    howItWorks: [],
  },

  mistake: {
    whatItIs: [
      t('One of your placed digits '),
      em("doesn't fit the solution"),
      t(' — every technique would be reasoning from a broken board until it is removed.'),
    ],
    howItWorks: [],
  },

  missing_note: {
    whatItIs: [
      t("One cell's pencil marks are "),
      em('missing a possibility'),
      t(' — a digit that can still go there. Notes that rule out a true candidate mislead every technique built on them.'),
    ],
    howItWorks: [],
  },
};
