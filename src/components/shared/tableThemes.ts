// ===== TEMI DEL TAVOLO =====
// Scelta personale e puramente estetica: ogni giocatore vede il panno del
// colore che preferisce, salvato in localStorage. Nessuna sincronizzazione:
// zero impatto sul gameplay e sullo stato condiviso.

export interface TableColors {
  // Tonalità del feltro, dal centro al bordo
  feltLight: string;
  feltMid: string;
  feltDark: string;
  feltEdge: string;
  // Sfondo della scena dietro il tavolo
  bgCenter: string;
  bgEdge: string;
}

export interface TableTheme extends TableColors {
  id: string;
  label: string;
  // Variante luminosa del panno (toni medi: le carte crema devono
  // restare leggibili, mai pastello)
  light: TableColors;
}

export type TableBrightness = 'classic' | 'light';

export const TABLE_THEMES: TableTheme[] = [
  {
    id: 'green',
    label: 'Verde classico',
    feltLight: '#1f7343',
    feltMid: '#14522f',
    feltDark: '#0b3a1c',
    feltEdge: '#072812',
    bgCenter: '#0f1f0f',
    bgEdge: '#050a05',
    light: {
      feltLight: '#35a566',
      feltMid: '#27874f',
      feltDark: '#1a6438',
      feltEdge: '#114625',
      bgCenter: '#17291b',
      bgEdge: '#0a130c',
    },
  },
  {
    id: 'blue',
    label: 'Blu casinò',
    feltLight: '#1e5f8a',
    feltMid: '#154568',
    feltDark: '#0c2e48',
    feltEdge: '#071e31',
    bgCenter: '#0c161f',
    bgEdge: '#04080d',
    light: {
      feltLight: '#3389bd',
      feltMid: '#256b9c',
      feltDark: '#184d74',
      feltEdge: '#0f3452',
      bgCenter: '#13212d',
      bgEdge: '#081018',
    },
  },
  {
    id: 'bordeaux',
    label: 'Rosso bordeaux',
    feltLight: '#8a2433',
    feltMid: '#621a25',
    feltDark: '#421118',
    feltEdge: '#2b0a0f',
    bgCenter: '#190d10',
    bgEdge: '#0a0405',
    light: {
      feltLight: '#b53c4f',
      feltMid: '#932b3d',
      feltDark: '#6b1e2c',
      feltEdge: '#47141e',
      bgCenter: '#251317',
      bgEdge: '#100608',
    },
  },
  {
    id: 'brown',
    label: 'Marrone tabacco',
    feltLight: '#7d5c2e',
    feltMid: '#5c421d',
    feltDark: '#3e2c11',
    feltEdge: '#291c08',
    bgCenter: '#19130c',
    bgEdge: '#0a0704',
    light: {
      feltLight: '#a67f45',
      feltMid: '#876334',
      feltDark: '#654823',
      feltEdge: '#443015',
      bgCenter: '#221a10',
      bgEdge: '#0e0a06',
    },
  },
  {
    id: 'black',
    label: 'Nero elegante',
    feltLight: '#3d444c',
    feltMid: '#282d33',
    feltDark: '#171a1e',
    feltEdge: '#0c0e10',
    bgCenter: '#13151a',
    bgEdge: '#050607',
    light: {
      feltLight: '#68727d',
      feltMid: '#515a64',
      feltDark: '#3a4149',
      feltEdge: '#272c32',
      bgCenter: '#1b1e24',
      bgEdge: '#0c0e11',
    },
  },
];

const LS_TABLE_THEME_KEY = 'briscola_table_theme';
const LS_TABLE_BRIGHTNESS_KEY = 'briscola_table_brightness';

export const getSavedTableTheme = (): TableTheme => {
  try {
    const id = localStorage.getItem(LS_TABLE_THEME_KEY);
    return TABLE_THEMES.find(t => t.id === id) || TABLE_THEMES[0];
  } catch {
    return TABLE_THEMES[0];
  }
};

export const saveTableTheme = (id: string): void => {
  try {
    localStorage.setItem(LS_TABLE_THEME_KEY, id);
  } catch {}
};

export const getSavedTableBrightness = (): TableBrightness => {
  try {
    return localStorage.getItem(LS_TABLE_BRIGHTNESS_KEY) === 'light' ? 'light' : 'classic';
  } catch {
    return 'classic';
  }
};

export const saveTableBrightness = (b: TableBrightness): void => {
  try {
    localStorage.setItem(LS_TABLE_BRIGHTNESS_KEY, b);
  } catch {}
};

/** Palette effettiva: tema + luminosità scelta. */
export const resolveTableColors = (theme: TableTheme, brightness: TableBrightness): TableColors =>
  brightness === 'light' ? theme.light : theme;
