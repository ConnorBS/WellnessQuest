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

export type BuiltinIconKey =
  | "glass-small"
  | "glass-tall"
  | "tumbler"
  | "water-bottle"
  | "mug"
  | "mason-jar"
  | "pint"
  | "shot-glass"
  | "droplet";

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
    default:
      return <Droplet size={size} />;
  }
}
