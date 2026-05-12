import type { ReactNode } from "react";

interface IconProps {
  size?: number;
  color?: string;
}

function Svg({ children, size = 28 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function GlassSmall({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8 9h8l-1 10a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1L8 9z" />
      <path d="M8 9h8" />
      <path d="M10 13h4" />
    </Svg>
  );
}

function GlassTall({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8 4h8l-1 16a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1L8 4z" />
      <path d="M9 11h6" />
    </Svg>
  );
}

function Tumbler({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8 5h8v1l-1 14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2L8 6V5z" />
      <path d="M8 6h8" />
      <path d="M9 13h6" />
      <path d="M16 9h2v3" />
    </Svg>
  );
}

function WaterBottle({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M10 3h4v3l1 2v10a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V8l1-2V3z" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
    </Svg>
  );
}

function Mug({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 7h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7z" />
      <path d="M16 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" />
    </Svg>
  );
}

function MasonJar({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M7 4h10v3H7z" />
      <path d="M8 7h8v13a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7z" />
      <path d="M8 11h8" />
    </Svg>
  );
}

function Pint({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M7 4h10l-1 17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1L7 4z" />
    </Svg>
  );
}

function ShotGlass({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M9 11h6l-1 8a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1l-1-8z" />
    </Svg>
  );
}

function Droplet({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11z" />
    </Svg>
  );
}

function Walk({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="13" cy="4.5" r="1.5" />
      <path d="M13 6l-2 5 3 2v6" />
      <path d="M14 13l3 1 1 4" />
      <path d="M11 11l-3 3 1 5" />
    </Svg>
  );
}

function Run({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="15" cy="4.5" r="1.5" />
      <path d="M15 6l-3 4 3 3-1 5" />
      <path d="M16 14l3 0 1 3" />
      <path d="M12 10l-4 1-2 4" />
    </Svg>
  );
}

function Bike({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <circle cx="14" cy="5" r="1.2" />
      <path d="M6 17l4-7h4l4 7" />
      <path d="M10 10l3-3" />
    </Svg>
  );
}

function Dumbbell({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M3 10v4" />
      <path d="M5 8v8" />
      <path d="M19 8v8" />
      <path d="M21 10v4" />
      <path d="M5 12h14" />
    </Svg>
  );
}

function Yoga({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="4.5" r="1.5" />
      <path d="M12 6v6" />
      <path d="M5 9l7 3 7-3" />
      <path d="M12 12l-4 8" />
      <path d="M12 12l4 8" />
    </Svg>
  );
}

function Stretch({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="4.5" r="1.5" />
      <path d="M12 6v4" />
      <path d="M5 7l7 3 7-3" />
      <path d="M12 10v6" />
      <path d="M9 20l3-4 3 4" />
    </Svg>
  );
}

function Cardio({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M3 13h4l2-5 4 8 2-3h6" />
    </Svg>
  );
}

function Swim({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="17" cy="6" r="1.5" />
      <path d="M3 12c2-1 3 1 5 0s3-1 5 0 3 1 5 0 2-1 3 0" />
      <path d="M3 17c2-1 3 1 5 0s3-1 5 0 3 1 5 0 2-1 3 0" />
      <path d="M9 11l4-3 3 2" />
    </Svg>
  );
}

export type BuiltinIconKey =
  | "glass-small"
  | "glass-tall"
  | "tumbler"
  | "water-bottle"
  | "mug"
  | "mason-jar"
  | "pint"
  | "shot-glass"
  | "droplet"
  | "walk"
  | "run"
  | "bike"
  | "dumbbell"
  | "yoga"
  | "stretch"
  | "cardio"
  | "swim";

export const BUILTIN_ICONS: { key: BuiltinIconKey; label: string }[] = [
  { key: "glass-small", label: "Small glass" },
  { key: "glass-tall", label: "Tall glass" },
  { key: "tumbler", label: "Tumbler" },
  { key: "water-bottle", label: "Water bottle" },
  { key: "mug", label: "Mug" },
  { key: "mason-jar", label: "Mason jar" },
  { key: "pint", label: "Pint" },
  { key: "shot-glass", label: "Shot glass" },
  { key: "droplet", label: "Droplet" },
  { key: "walk", label: "Walk" },
  { key: "run", label: "Run" },
  { key: "bike", label: "Bike" },
  { key: "dumbbell", label: "Weights" },
  { key: "yoga", label: "Yoga" },
  { key: "stretch", label: "Stretch" },
  { key: "cardio", label: "Cardio" },
  { key: "swim", label: "Swim" },
];

export function BuiltinIcon({ name, size = 28 }: { name: string; size?: number }) {
  switch (name) {
    case "glass-small":
      return <GlassSmall size={size} />;
    case "glass-tall":
      return <GlassTall size={size} />;
    case "tumbler":
      return <Tumbler size={size} />;
    case "water-bottle":
      return <WaterBottle size={size} />;
    case "mug":
      return <Mug size={size} />;
    case "mason-jar":
      return <MasonJar size={size} />;
    case "pint":
      return <Pint size={size} />;
    case "shot-glass":
      return <ShotGlass size={size} />;
    case "droplet":
      return <Droplet size={size} />;
    case "walk":
      return <Walk size={size} />;
    case "run":
      return <Run size={size} />;
    case "bike":
      return <Bike size={size} />;
    case "dumbbell":
      return <Dumbbell size={size} />;
    case "yoga":
      return <Yoga size={size} />;
    case "stretch":
      return <Stretch size={size} />;
    case "cardio":
      return <Cardio size={size} />;
    case "swim":
      return <Swim size={size} />;
    default:
      return <Droplet size={size} />;
  }
}
