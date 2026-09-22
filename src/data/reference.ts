// 资料层：选项字典与椅位时段（椅位只排一颗牙）

import type { BitePain, ChairSlot } from "./types";
import { todayKey, tomorrowKey, weekdayKey } from "./clock";

export const BITE_PAIN_OPTIONS: { value: BitePain; label: string }[] = [
  { value: "none", label: "无咬合痛" },
  { value: "mild", label: "轻度咬合痛" },
  { value: "severe", label: "明显咬合痛" },
];

export function bitePainLabel(value: BitePain): string {
  return BITE_PAIN_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function buildSlots(): ChairSlot[] {
  const days = [
    { key: todayKey(), tag: "今日" },
    { key: tomorrowKey(), tag: "明日" },
  ];
  const times = [
    { h: "09:00-09:40", short: "09:00" },
    { h: "10:00-10:40", short: "10:00" },
    { h: "11:00-11:40", short: "11:00" },
    { h: "14:00-14:40", short: "14:00" },
    { h: "15:00-15:40", short: "15:00" },
    { h: "16:00-16:40", short: "16:00" },
  ];
  return days.flatMap((day) =>
    times.map((t) => ({
      id: `${day.key} ${t.short}`,
      dateLabel: `${day.key} ${weekdayKey(day.key)}（${day.tag}）`,
      label: t.short,
      timeRange: t.h,
    })),
  );
}

export const CHAIR_SLOTS: ChairSlot[] = buildSlots();

export function slotLabel(slotId: string | null | undefined): string {
  if (!slotId) return "未排班";
  const slot = CHAIR_SLOTS.find((s) => s.id === slotId);
  return slot ? `${slot.dateLabel.split("（")[0]} ${slot.label}` : slotId;
}
