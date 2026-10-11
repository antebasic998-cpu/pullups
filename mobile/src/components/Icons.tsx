import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../lib/ThemeContext';

/**
 * Stroke icons (lucide-style paths, same set as the web app) so the app never
 * depends on emoji for navigation or controls.
 */
export interface IconProps {
  size?: number;
  /** Defaults to the theme text colour. */
  color?: string;
  strokeWidth?: number;
  /** Pass the colour to get a solid glyph (the podium crown). */
  fill?: string;
}

function Base({
  size = 18,
  color,
  strokeWidth = 1.9,
  fill = 'none',
  children,
}: IconProps & { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color ?? colors.text}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export const TrophyIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <Path d="M4 22h16" />
    <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </Base>
);

export const AwardIcon = (p: IconProps) => (
  <Base {...p}>
    <Circle cx="12" cy="8" r="6" />
    <Path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11" />
  </Base>
);

export const UsersIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <Circle cx="9" cy="7" r="4" />
    <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Base>
);

export const SlidersIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  </Base>
);

export const PlusIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M12 5v14M5 12h14" />
  </Base>
);

export const MinusIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M5 12h14" />
  </Base>
);

export const XIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M20 6 9 17l-5-5" />
  </Base>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="m6 9 6 6 6-6" />
  </Base>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="m15 18-6-6 6-6" />
  </Base>
);

export function MoreIcon({ size = 20, color }: IconProps) {
  const { colors } = useTheme();
  const c = color ?? colors.text;
  return (
    <Base size={size} color={c} strokeWidth={0} fill={c}>
      <Circle cx="5" cy="12" r="1.6" />
      <Circle cx="12" cy="12" r="1.6" />
      <Circle cx="19" cy="12" r="1.6" />
    </Base>
  );
}

export const UploadIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M12 3v13M7.5 8 12 3.5 16.5 8" />
  </Base>
);

export const PencilIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
  </Base>
);

export const TrashIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Base>
);

export const SearchIcon = (p: IconProps) => (
  <Base {...p}>
    <Circle cx="11" cy="11" r="7" />
    <Path d="m20 20-3.5-3.5" />
  </Base>
);

export const FlameIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </Base>
);

export const CrownIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </Base>
);

export const ScaleIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0L5 7Zm14 0-3 6a3 3 0 0 0 6 0l-3-6Z" />
  </Base>
);

export const CalendarIcon = (p: IconProps) => (
  <Base {...p}>
    <Rect x="3" y="5" width="18" height="16" rx="3" />
    <Path d="M8 3v4M16 3v4M3 11h18" />
  </Base>
);

export const TrendUpIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M3 17l6-6 4 4 8-8" />
    <Path d="M15 7h6v6" />
  </Base>
);

export const TrendDownIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M3 7l6 6 4-4 8 8" />
    <Path d="M21 17h-6v-6" />
  </Base>
);

export const SunIcon = (p: IconProps) => (
  <Base {...p}>
    <Circle cx="12" cy="12" r="4" />
    <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
);

export const MoonIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Base>
);

/** Pull-up bar – the exercise glyph used by the exercise pill. */
export const BarIcon = (p: IconProps) => (
  <Base {...p}>
    <Path d="M3 4h18" />
    <Path d="M8 4v6M16 4v6" />
    <Circle cx="12" cy="12.5" r="2.5" />
    <Path d="M8.5 21v-3.2a3.5 3.5 0 0 1 7 0V21" />
  </Base>
);

export const InfoIcon = (p: IconProps) => (
  <Base {...p}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 11v5M12 8h.01" />
  </Base>
);
