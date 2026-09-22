// 资料层：初始演示资料（构造逻辑与判定规则一致，但此处只造数据）

import type { AppState, HandoverForm, RevisionEvent } from "./types";
import { stamp } from "./clock";
import { CHAIR_SLOTS } from "./reference";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `F${String(counter).padStart(3, "0")}`;
}

function registerEvent(
  at: string,
  slotId: string | null,
  changes: RevisionEvent["changes"],
): RevisionEvent {
  return { seq: 1, at, action: "register", slotId, changes };
}

export function createSeedState(): AppState {
  const now = new Date();
  const created = stamp(now);
  const firstSlot = CHAIR_SLOTS[0].id;
  const laterSlot = CHAIR_SLOTS[3].id;

  const forms: HandoverForm[] = [
    {
      id: nextId(),
      status: "pending",
      data: { toothCode: "#36", tempSealDays: 6, wallCount: 3, bitePain: "mild" },
      slotId: firstSlot,
      createdAt: created,
      revisions: [registerEvent(created, firstSlot, undefined)],
    },
    {
      id: nextId(),
      status: "pending",
      data: { toothCode: "#11", tempSealDays: 3, wallCount: 4, bitePain: "none" },
      slotId: laterSlot,
      createdAt: created,
      revisions: [registerEvent(created, laterSlot, undefined)],
    },
    {
      // 牙壁仅 1：只能转加固会诊，不能确认修复
      id: nextId(),
      status: "pending",
      data: { toothCode: "#46", tempSealDays: 5, wallCount: 1, bitePain: "severe" },
      slotId: null,
      createdAt: created,
      revisions: [registerEvent(created, null, undefined)],
    },
    {
      // 暂封 16 天超期：只能转加固会诊
      id: nextId(),
      status: "pending",
      data: { toothCode: "#25", tempSealDays: 16, wallCount: 3, bitePain: "mild" },
      slotId: null,
      createdAt: created,
      revisions: [registerEvent(created, null, undefined)],
    },
  ];

  return { version: 1, forms };
}
