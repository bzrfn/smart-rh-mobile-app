export type SmartRhColorMode = 'light' | 'dark';

export type SmartRhColors = ReturnType<typeof getSmartRhColors>;

export const smartRhRadius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const smartRhSpacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 40,
};

export const smartRhMotion = {
  fast: 120,
  base: 220,
  slow: 320,
};

export function getSmartRhColors(isDark: boolean) {
  if (isDark) {
    return {
      background: '#07111F',
      backgroundSoft: '#0B1728',
      card: '#0F1B2D',
      cardSoft: '#111F33',
      cardMuted: '#0B1728',
      primary: '#5DADE2',
      primaryDark: '#3E86B6',
      primarySoft: 'rgba(93, 173, 226, 0.15)',
      primaryBorder: 'rgba(93, 173, 226, 0.28)',
      onPrimary: '#FFFFFF',
      link: '#7CC4EC',
      linkSoft: 'rgba(124, 196, 236, 0.14)',
      maxAccent: '#5DADE2',
      maxAccentSoft: 'rgba(93, 173, 226, 0.15)',
      spark: '#E0B64A',
      lagoon: '#64C9BC',
      lagoonSoft: 'rgba(100, 201, 188, 0.14)',
      success: '#64C9BC',
      successSoft: 'rgba(100, 201, 188, 0.14)',
      warning: '#E0B64A',
      warningSoft: 'rgba(224, 182, 74, 0.14)',
      danger: '#E58F9B',
      dangerSoft: 'rgba(229, 143, 155, 0.13)',
      text: '#F8FAFC',
      textMuted: '#9FB0C4',
      textSubtle: '#71839B',
      border: '#26364D',
      borderStrong: '#3A4A62',
      placeholder: '#71839B',
      shadow: '#000000',
      white: '#FFFFFF',
    };
  }

  return {
    background: '#F4F7FB',
    backgroundSoft: '#EDF3FA',
    card: '#FFFFFF',
    cardSoft: '#F9FBFD',
    cardMuted: '#EEF4FA',
    primary: '#0A57A4',
    primaryDark: '#084785',
    primarySoft: 'rgba(10, 87, 164, 0.10)',
    primaryBorder: 'rgba(10, 87, 164, 0.18)',
    onPrimary: '#FFFFFF',
    link: '#0A57A4',
    linkSoft: 'rgba(10, 87, 164, 0.10)',
    maxAccent: '#0A57A4',
    maxAccentSoft: 'rgba(10, 87, 164, 0.10)',
    spark: '#B7791F',
    lagoon: '#22B8B0',
    lagoonSoft: 'rgba(34, 184, 176, 0.12)',
    success: '#22B8B0',
    successSoft: 'rgba(34, 184, 176, 0.12)',
    warning: '#A16207',
    warningSoft: 'rgba(251, 191, 36, 0.16)',
    danger: '#B42318',
    dangerSoft: 'rgba(180, 35, 24, 0.08)',
    text: '#0F172A',
    textMuted: '#5B6B81',
    textSubtle: '#8B9AAF',
    border: '#D9E1EC',
    borderStrong: '#C5D0DE',
    placeholder: '#8B9AAF',
    shadow: '#0F172A',
    white: '#FFFFFF',
  };
}

export function getSmartRhShadow(isDark: boolean) {
  return {
    shadowColor: isDark ? '#000000' : '#0F172A',
    shadowOpacity: isDark ? 0.34 : 0.08,
    shadowRadius: isDark ? 18 : 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: isDark ? 6 : 3,
  };
}
