// 资料层：localStorage 持久化（读写，不含业务规则）

import type { AppState } from "./types";
import { createSeedState } from "./seeds";

const KEY = "hxwl-04.coronal-handover.v1";

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || !Array.isArray(parsed.forms)) return createSeedState();
    return parsed;
  } catch {
    return createSeedState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 隐私模式等场景下静默失败，不影响当前会话操作
  }
}

export function resetState(): AppState {
  const fresh = createSeedState();
  saveState(fresh);
  return fresh;
}
