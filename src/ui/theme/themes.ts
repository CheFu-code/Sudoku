/**
 * Color palettes for the app. The theme palette feature lets the player pick
 * one; the selected key is persisted in the settings store.
 */

export interface Theme {
  key: string;
  name: string;
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    /** App + section text. */
    text: string;
    textMuted: string;
    /** Accent used for selection, active tools, given highlights. */
    primary: string;
    /** Subtle tint for the selected cell's row/column/box. */
    highlight: string;
    /** Tint for cells sharing the selected value. */
    sameValue: string;
    /** Selected cell background. */
    selected: string;
    /** Player-entered (non-given) digit color. */
    userValue: string;
    /** Conflicting / mistaken cell. */
    error: string;
    /** Background tint for a mistaken cell. */
    errorBg: string;
    /** Grid lines. */
    gridLine: string;
    gridLineBold: string;
    /** Pencil-note color. */
    note: string;
  };
}

const light: Theme = {
  key: 'light',
  name: 'Classic Light',
  dark: false,
  colors: {
    background: '#F2F3F7',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    textMuted: '#686D78',
    primary: '#2F6BFF',
    highlight: '#E8EBF2',
    sameValue: '#D5DEF7',
    selected: '#2F6BFF',
    userValue: '#2F6BFF',
    error: '#E5484D',
    errorBg: '#FBE0E0',
    gridLine: '#D3D6DE',
    gridLineBold: '#6B7280',
    note: '#6B7280',
  },
};

const dark: Theme = {
  key: 'dark',
  name: 'Midnight',
  dark: true,
  colors: {
    background: '#0E1116',
    surface: '#171B22',
    text: '#F2F3F7',
    textMuted: '#8A8F98',
    primary: '#5B8CFF',
    highlight: '#1E2530',
    sameValue: '#26344F',
    selected: '#3B6FE0',
    userValue: '#7FA6FF',
    error: '#FF6B6E',
    errorBg: '#3A2024',
    gridLine: '#2A2F3A',
    gridLineBold: '#4A515E',
    note: '#9AA1AD',
  },
};

const forest: Theme = {
  key: 'forest',
  name: 'Forest',
  dark: false,
  colors: {
    background: '#F1F5F0',
    surface: '#FFFFFF',
    text: '#1C2B1E',
    textMuted: '#5C6B5E',
    primary: '#2E7D4F',
    highlight: '#E4EEE4',
    sameValue: '#CDE6D2',
    selected: '#2E7D4F',
    userValue: '#2E7D4F',
    error: '#D9534F',
    errorBg: '#F7DAD8',
    gridLine: '#CDD8CC',
    gridLineBold: '#5E6E60',
    note: '#586656',
  },
};

const sunset: Theme = {
  key: 'sunset',
  name: 'Sunset',
  dark: false,
  colors: {
    background: '#FFF4ED',
    surface: '#FFFFFF',
    text: '#3A2417',
    textMuted: '#80654F',
    primary: '#E8703A',
    highlight: '#FDE7DA',
    sameValue: '#FBD3BD',
    selected: '#E8703A',
    userValue: '#D2562A',
    error: '#D9433D',
    errorBg: '#F9D8CF',
    gridLine: '#F0D9CA',
    gridLineBold: '#A6705A',
    note: '#7A5E4D',
  },
};

const ocean: Theme = {
  key: 'ocean',
  name: 'Ocean',
  dark: true,
  colors: {
    background: '#081B2A',
    surface: '#102A3A',
    text: '#EAF7FF',
    textMuted: '#9FB7C9',
    primary: '#4DB6FF',
    highlight: '#143D53',
    sameValue: '#1D5779',
    selected: '#38A6FF',
    userValue: '#80D3FF',
    error: '#FF7A7A',
    errorBg: '#3B2226',
    gridLine: '#1E455C',
    gridLineBold: '#6EA7C8',
    note: '#B6D7E7',
  },
};

const lavender: Theme = {
  key: 'lavender',
  name: 'Lavender',
  dark: false,
  colors: {
    background: '#F4F0FF',
    surface: '#FFFFFF',
    text: '#241A37',
    textMuted: '#665C7A',
    primary: '#7A5CFF',
    highlight: '#EEE7FF',
    sameValue: '#DDD2FF',
    selected: '#7A5CFF',
    userValue: '#6050D8',
    error: '#D94D89',
    errorBg: '#F7DDEB',
    gridLine: '#DCD3F4',
    gridLineBold: '#705EA9',
    note: '#6A5B92',
  },
};

export const THEMES: Theme[] = [light, dark, forest, sunset, ocean, lavender];

export const DEFAULT_THEME_KEY = light.key;

export function getTheme(key: string): Theme {
  return THEMES.find((t) => t.key === key) ?? light;
}
