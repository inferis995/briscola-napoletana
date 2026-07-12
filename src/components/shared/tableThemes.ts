// ===== TEMI DEL TAVOLO =====
// Scelta personale e puramente estetica: ogni giocatore vede il panno del
// colore che preferisce, salvato in localStorage. Nessuna sincronizzazione:
// zero impatto sul gameplay e sullo stato condiviso.

export interface TableTheme {
  id: string;
  label: string;
  // Tonalità del feltro, dal centro al bordo
  feltLight: string;
  feltMid: string;
  feltDark: string;
  feltEdge: string;
  // Sfondo della scena dietro il tavolo
  bgCenter: string;
  bgEdge: string;
}

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
  },
];

const LS_TABLE_THEME_KEY = 'briscola_table_theme';

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
