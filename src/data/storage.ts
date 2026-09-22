// 资料层：localStorage 持久化与种子数据。
// 只负责状态的读写与初始资料，不含任何判定规则（判定见 domain/rules.ts）。

import type { AppState, Handover } from "./types";
import { toISO } from "../domain/rules";

const STORAGE_KEY = "hxwl-04.coronal-handover.v1";

function daysAgoISO(days: number, base: Date): string {
  return toISO(new Date(base.getTime() - days * 86_400_000));
}

/** 种子资料：覆盖待移交、需加固会诊、超期、已冻结含修订链等场景 */
export function createSeedState(base: Date = new Date()): AppState {
  const slots = [
    { id: "s1", label: "08:30–09:15", toothNo: "#11", handoverId: "h-seed-11" },
    { id: "s2", label: "09:30–10:15", toothNo: "#36", handoverId: "h-seed-36" },
    { id: "s3", label: "10:30–11:15", toothNo: "#46", handoverId: "h-seed-46" },
    { id: "s4", label: "14:00–14:45", toothNo: "#21", handoverId: "h-seed-21" },
    { id: "s5", label: "15:00–15:45", toothNo: null, handoverId: null },
    { id: "s6", label: "16:00–16:45", toothNo: null, handoverId: null },
  ];

  const handovers: Handover[] = [
    {
      id: "h-seed-36",
      toothNo: "#36",
      diagnosis: "慢性根尖周炎，根管封药后",
      status: "pending",
      coronal: { wallCount: 3, sealedOn: daysAgoISO(6, base), bitePain: "none" },
      slotId: "s2",
      frozen: null,
      confirmedOn: null,
      revisions: [],
      createdAt: daysAgoISO(6, base) + "T08:30:00.000Z",
    },
    {
      id: "h-seed-46",
      toothNo: "#46",
      diagnosis: "急性牙髓炎，近中双根管",
      status: "pending",
      // 剩余 1 壁：只能转加固会诊
      coronal: { wallCount: 1, sealedOn: daysAgoISO(9, base), bitePain: "moderate" },
      slotId: "s3",
      frozen: null,
      confirmedOn: null,
      revisions: [],
      createdAt: daysAgoISO(9, base) + "T09:30:00.000Z",
    },
    {
      id: "h-seed-25",
      toothNo: "#25",
      diagnosis: "根尖周脓肿复诊",
      status: "pending",
      // 暂封 20 天：超期，只能转加固会诊
      coronal: { wallCount: 3, sealedOn: daysAgoISO(20, base), bitePain: "mild" },
      slotId: null,
      frozen: null,
      confirmedOn: null,
      revisions: [],
      createdAt: daysAgoISO(20, base) + "T10:30:00.000Z",
    },
    {
      id: "h-seed-21",
      toothNo: "#21",
      diagnosis: "外伤后变色，单根管",
      status: "confirmed",
      coronal: { wallCount: 2, sealedOn: daysAgoISO(8, base), bitePain: "none" },
      slotId: "s4",
      confirmedOn: daysAgoISO(2, base),
      frozen: {
        wallCount: 2,
        sealedOn: daysAgoISO(8, base),
        bitePain: "none",
        frozenOn: daysAgoISO(2, base),
        temporaryDaysAtFreeze: 6,
      },
      revisions: [
        {
          reopenedOn: daysAgoISO(2, base),
          reason: "修复后冷热敏感，复开检查边缘密合",
          snapshot: {
            wallCount: 2,
            sealedOn: daysAgoISO(13, base),
            bitePain: "mild",
            frozenOn: daysAgoISO(9, base),
            temporaryDaysAtFreeze: 11,
          },
          slotId: "s4",
        },
      ],
      createdAt: daysAgoISO(15, base) + "T14:00:00.000Z",
    },
    {
      id: "h-seed-11",
      toothNo: "#11",
      diagnosis: "牙髓炎，冷侧压充填完成",
      status: "consult",
      coronal: { wallCount: 1, sealedOn: daysAgoISO(12, base), bitePain: "severe" },
      slotId: "s1",
      frozen: null,
      confirmedOn: null,
      revisions: [],
      createdAt: daysAgoISO(12, base) + "T08:30:00.000Z",
    },
  ];

  return { version: 1, handovers, slots };
}

function looksValid(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const s = value as AppState;
  return Array.isArray(s.handovers) && Array.isArray(s.slots) && s.version === 1;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (looksValid(parsed)) return parsed;
    }
  } catch {
    // 存储不可用时回退到种子数据
  }
  return createSeedState();
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 忽略写入失败（隐私模式等）
  }
}

export function storageKey(): string {
  return STORAGE_KEY;
}
