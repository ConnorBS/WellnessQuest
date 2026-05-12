"use client";

import { BuiltinIcon } from "@/lib/builtin-icons";
import type { WaterPreset } from "@/lib/schemas";

export function PresetIcon({
  preset,
  size = 28,
}: {
  preset: Pick<WaterPreset, "icon_kind" | "icon_key">;
  size?: number;
}) {
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
