/**
 * InterVu Design Tokens
 * Single source of truth for all colors, spacing, typography, and radius values.
 * Import from here in every component — never hardcode hex values.
 */

export const colors = {
  // Backgrounds
  bgBase:    '#070d10',
  bgSubtle:  '#0b1318',
  bgCard:    '#0e181e',

  // Surfaces
  surface1:  '#111d24',
  surface2:  '#172530',
  surface3:  '#1e303d',

  // Accent — steel blue
  accent:    '#68a9ba',
  accentDim: '#4d8fa2',
  accentMuted: 'rgba(104,169,186,0.12)',
  accentGlow:  'rgba(104,169,186,0.22)',

  // Borders
  borderSubtle:  'rgba(104,169,186,0.08)',
  borderDefault: 'rgba(104,169,186,0.14)',
  borderStrong:  'rgba(104,169,186,0.26)',

  // Text
  textPrimary:   '#e8fbff',
  textSecondary: '#9dc4ce',
  textMuted:     '#5a8898',

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  danger:  '#EF4444',

  // Transparent
  overlay:  'rgba(0,0,0,0.55)',
  overlayBlur: 'rgba(6,10,14,0.7)',
} as const;

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
  '3xl': 40,
} as const;

export const radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  full: 9999,
} as const;

export const typography = {
  fontDisplay: 'Telma',
  fontBody:    'Inter',

  // Sizes
  xs:   11,
  sm:   12,
  base: 14,
  md:   15,
  lg:   17,
  xl:   20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,

  // Weights (mapped to font variants)
  light:    '300',
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  black:    '900',
} as const;

// Gradient helper (for LinearGradient colors prop)
export const gradients = {
  accent:  ['#4d8fa2', '#68a9ba'] as string[],
  text:    ['#e8fbff', '#68a9ba'] as string[],
  success: ['#22C55E', '#16A34A'] as string[],
  hero:    ['rgba(104,169,186,0.15)', 'rgba(104,169,186,0.08)', 'rgba(9,9,11,0)'] as string[],
} as const;
