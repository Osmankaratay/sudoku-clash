export interface AvatarOption {
  id: string;
  name: string;
  title: string;
  colorBg: string;
  colorBorder: string;
  textColor: string;
  initials: string;
  iconType: 'fox' | 'owl' | 'wolf' | 'falcon' | 'dragon' | 'lion' | 'panther' | 'viper';
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'avatar-falcon',
    name: 'Falcon',
    title: 'Precision Hawk',
    colorBg: 'bg-amber-500/20',
    colorBorder: 'border-amber-400',
    textColor: 'text-amber-300',
    initials: 'FL',
    iconType: 'falcon',
  },
  {
    id: 'avatar-owl',
    name: 'Athena Owl',
    title: 'Silent Deductor',
    colorBg: 'bg-indigo-500/20',
    colorBorder: 'border-indigo-400',
    textColor: 'text-indigo-300',
    initials: 'OW',
    iconType: 'owl',
  },
  {
    id: 'avatar-wolf',
    name: 'Shadow Wolf',
    title: 'Grid Hunter',
    colorBg: 'bg-cyan-500/20',
    colorBorder: 'border-cyan-400',
    textColor: 'text-cyan-300',
    initials: 'WF',
    iconType: 'wolf',
  },
  {
    id: 'avatar-dragon',
    name: 'Crimson Dragon',
    title: 'Grandmaster Apex',
    colorBg: 'bg-rose-500/20',
    colorBorder: 'border-rose-400',
    textColor: 'text-rose-300',
    initials: 'DG',
    iconType: 'dragon',
  },
  {
    id: 'avatar-fox',
    name: 'Kitsune Fox',
    title: 'Tactical Deceiver',
    colorBg: 'bg-orange-500/20',
    colorBorder: 'border-orange-400',
    textColor: 'text-orange-300',
    initials: 'FX',
    iconType: 'fox',
  },
  {
    id: 'avatar-panther',
    name: 'Midnight Panther',
    title: 'Speed Strategist',
    colorBg: 'bg-purple-500/20',
    colorBorder: 'border-purple-400',
    textColor: 'text-purple-300',
    initials: 'PN',
    iconType: 'panther',
  },
  {
    id: 'avatar-lion',
    name: 'Golden Lion',
    title: 'Imperial Anchor',
    colorBg: 'bg-yellow-500/20',
    colorBorder: 'border-yellow-400',
    textColor: 'text-yellow-300',
    initials: 'LN',
    iconType: 'lion',
  },
  {
    id: 'avatar-viper',
    name: 'Emerald Viper',
    title: 'Cold Analytical',
    colorBg: 'bg-emerald-500/20',
    colorBorder: 'border-emerald-400',
    textColor: 'text-emerald-300',
    initials: 'VP',
    iconType: 'viper',
  },
];

export function getAvatarById(id?: string): AvatarOption {
  const found = AVATAR_OPTIONS.find((a) => a.id === id);
  return found || AVATAR_OPTIONS[0];
}
