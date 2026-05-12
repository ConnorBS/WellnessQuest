"use client";

import { BuiltinIcon } from "@/lib/builtin-icons";
import type { IconKind } from "@/lib/schemas";

interface IconCarrier {
  icon_kind: IconKind;
  icon_key: string | null;
}

export function PresetIcon({ preset, size = 28 }: { preset: IconCarrier; size?: number }) {
  if (preset.icon_kind === "upload" && preset.icon_key) {
    return (
      <img
        src={`/api/v1/uploads/${preset.icon_key}`}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "cover", borderRadius: 6 }}
      />
    );
  }
  if (preset.icon_kind === "builtin" && preset.icon_key) {
    return <BuiltinIcon name={preset.icon_key} size={size} />;
  }
  return <BuiltinIcon name="droplet" size={size} />;
}
