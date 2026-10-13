export type BoardThemeId = 'midnight' | 'sunset' | 'emerald' | 'cyberpunk' | 'coffee';

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  tagline: string;
  // Board outer container styling
  boardBorder: string;
  boardBg: string;
  gridInnerBg: string;
  gridBorder: string;
  // 3x3 sector demarcation lines
  sectorBorder: string;
  cellBorder: string;
  // Cell background states
  cellBgDefault: string;
  cellBgHover: string;
  cellBgSelected: string;
  cellBgSameNumber: string;
  cellBgRowCol: string;
  cellBgCrossBox: string;
  // Cell text coloring
  textGiven: string;
  textUser: string;
  textSameNumber: string;
  // Feedback
  textNotes: string;
  textNotesHighlight: string;
  // Visual palette previews for theme picker
  preview: {
    bg: string;
    border: string;
    cell: string;
    accent: string;
    highlight: string;
  };
}

export const BOARD_THEMES: Record<BoardThemeId, BoardTheme> = {
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    tagline: 'Deep space obsidian with electric amber accents',
    boardBorder: 'border-slate-700/80 shadow-[0_0_30px_rgba(15,23,42,0.6)]',
    boardBg: 'bg-[#070A10]',
    gridInnerBg: 'bg-slate-800',
    gridBorder: 'border-slate-700/80',
    sectorBorder: 'border-slate-300/80',
    cellBorder: 'border-slate-800/80',
    cellBgDefault: 'bg-[#0E1524]',
    cellBgHover: 'hover:bg-[#162035]',
    cellBgSelected: 'bg-amber-400/25 ring-2 ring-inset ring-amber-400 shadow-[inset_0_0_10px_rgba(251,191,36,0.3)] z-20',
    cellBgSameNumber: 'bg-amber-400/20 ring-1.5 ring-inset ring-amber-400/70 z-10',
    cellBgRowCol: 'bg-[#141F32]',
    cellBgCrossBox: 'bg-[#18263D]',
    textGiven: 'text-white font-bold',
    textUser: 'text-amber-300 font-extrabold',
    textSameNumber: 'text-amber-200 font-black drop-shadow-[0_1px_4px_rgba(245,158,11,0.6)] scale-105',
    textNotes: 'text-sky-300 font-medium',
    textNotesHighlight: 'bg-amber-400 text-slate-950 font-black ring-1 ring-amber-300',
    preview: {
      bg: '#070A10',
      border: '#334155',
      cell: '#0E1524',
      accent: '#F59E0B',
      highlight: '#FDE68A',
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    tagline: 'Warm dusky twilight with peach & glowing coral rays',
    boardBorder: 'border-rose-900/60 shadow-[0_0_30px_rgba(225,29,72,0.2)]',
    boardBg: 'bg-[#160B18]',
    gridInnerBg: 'bg-[#2A122E]',
    gridBorder: 'border-rose-900/70',
    sectorBorder: 'border-rose-300/80',
    cellBorder: 'border-rose-950/80',
    cellBgDefault: 'bg-[#230F27]',
    cellBgHover: 'hover:bg-[#34173A]',
    cellBgSelected: 'bg-rose-500/30 ring-2 ring-inset ring-rose-400 shadow-[inset_0_0_10px_rgba(244,63,94,0.35)] z-20',
    cellBgSameNumber: 'bg-amber-500/25 ring-1.5 ring-inset ring-amber-400/80 z-10',
    cellBgRowCol: 'bg-[#2F1534]',
    cellBgCrossBox: 'bg-[#3A1B40]',
    textGiven: 'text-rose-50 font-bold',
    textUser: 'text-amber-300 font-extrabold',
    textSameNumber: 'text-amber-200 font-black drop-shadow-[0_1px_4px_rgba(251,146,60,0.6)] scale-105',
    textNotes: 'text-pink-300 font-medium',
    textNotesHighlight: 'bg-rose-400 text-slate-950 font-black ring-1 ring-rose-300',
    preview: {
      bg: '#160B18',
      border: '#881337',
      cell: '#230F27',
      accent: '#FB7185',
      highlight: '#FBBF24',
    },
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Zen',
    tagline: 'Serene bamboo forest with luminous jade & mint highlights',
    boardBorder: 'border-emerald-900/70 shadow-[0_0_30px_rgba(16,185,129,0.18)]',
    boardBg: 'bg-[#05140F]',
    gridInnerBg: 'bg-[#0A261D]',
    gridBorder: 'border-emerald-900/80',
    sectorBorder: 'border-emerald-300/80',
    cellBorder: 'border-emerald-950/80',
    cellBgDefault: 'bg-[#0B2018]',
    cellBgHover: 'hover:bg-[#123126]',
    cellBgSelected: 'bg-emerald-500/30 ring-2 ring-inset ring-emerald-400 shadow-[inset_0_0_10px_rgba(16,185,129,0.35)] z-20',
    cellBgSameNumber: 'bg-teal-400/25 ring-1.5 ring-inset ring-teal-300/80 z-10',
    cellBgRowCol: 'bg-[#0F2D22]',
    cellBgCrossBox: 'bg-[#153B2D]',
    textGiven: 'text-emerald-50 font-bold',
    textUser: 'text-emerald-300 font-extrabold',
    textSameNumber: 'text-emerald-100 font-black drop-shadow-[0_1px_4px_rgba(52,211,153,0.6)] scale-105',
    textNotes: 'text-teal-300 font-medium',
    textNotesHighlight: 'bg-emerald-400 text-slate-950 font-black ring-1 ring-emerald-300',
    preview: {
      bg: '#05140F',
      border: '#064E3B',
      cell: '#0B2018',
      accent: '#10B981',
      highlight: '#6EE7B7',
    },
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    tagline: 'High-contrast neon grid with electric cyan & ultraviolet',
    boardBorder: 'border-cyan-900/70 shadow-[0_0_30px_rgba(6,182,212,0.25)]',
    boardBg: 'bg-[#060718]',
    gridInnerBg: 'bg-[#0F1032]',
    gridBorder: 'border-indigo-900/80',
    sectorBorder: 'border-cyan-300/80',
    cellBorder: 'border-indigo-950/80',
    cellBgDefault: 'bg-[#0E0F28]',
    cellBgHover: 'hover:bg-[#17193F]',
    cellBgSelected: 'bg-cyan-500/30 ring-2 ring-inset ring-cyan-400 shadow-[inset_0_0_10px_rgba(6,182,212,0.4)] z-20',
    cellBgSameNumber: 'bg-fuchsia-500/25 ring-1.5 ring-inset ring-fuchsia-400/80 z-10',
    cellBgRowCol: 'bg-[#141638]',
    cellBgCrossBox: 'bg-[#1D204E]',
    textGiven: 'text-cyan-50 font-bold',
    textUser: 'text-cyan-300 font-extrabold',
    textSameNumber: 'text-cyan-100 font-black drop-shadow-[0_1px_4px_rgba(34,211,238,0.7)] scale-105',
    textNotes: 'text-fuchsia-300 font-medium',
    textNotesHighlight: 'bg-cyan-400 text-slate-950 font-black ring-1 ring-cyan-300',
    preview: {
      bg: '#060718',
      border: '#164E63',
      cell: '#0E0F28',
      accent: '#06B6D4',
      highlight: '#E879F9',
    },
  },
  coffee: {
    id: 'coffee',
    name: 'Coffee & Vinyl',
    tagline: 'Lo-Fi warm espresso tones inspired by vintage Rhodes chords',
    boardBorder: 'border-amber-950/80 shadow-[0_0_30px_rgba(180,83,9,0.15)]',
    boardBg: 'bg-[#120D0A]',
    gridInnerBg: 'bg-[#221813]',
    gridBorder: 'border-amber-950/90',
    sectorBorder: 'border-amber-200/80',
    cellBorder: 'border-stone-900/80',
    cellBgDefault: 'bg-[#1C1410]',
    cellBgHover: 'hover:bg-[#2A1E18]',
    cellBgSelected: 'bg-amber-600/35 ring-2 ring-inset ring-amber-400 shadow-[inset_0_0_10px_rgba(217,119,6,0.35)] z-20',
    cellBgSameNumber: 'bg-yellow-600/30 ring-1.5 ring-inset ring-yellow-400/80 z-10',
    cellBgRowCol: 'bg-[#251A14]',
    cellBgCrossBox: 'bg-[#31231B]',
    textGiven: 'text-amber-50 font-bold',
    textUser: 'text-amber-300 font-extrabold',
    textSameNumber: 'text-amber-100 font-black drop-shadow-[0_1px_4px_rgba(245,158,11,0.6)] scale-105',
    textNotes: 'text-stone-300 font-medium',
    textNotesHighlight: 'bg-amber-400 text-stone-950 font-black ring-1 ring-amber-300',
    preview: {
      bg: '#120D0A',
      border: '#451A03',
      cell: '#1C1410',
      accent: '#D97706',
      highlight: '#FDE68A',
    },
  },
};

export const BOARD_THEME_LIST: BoardTheme[] = Object.values(BOARD_THEMES);

export const getBoardTheme = (id?: string | null): BoardTheme => {
  if (id && id in BOARD_THEMES) {
    return BOARD_THEMES[id as BoardThemeId];
  }
  return BOARD_THEMES.midnight;
};
