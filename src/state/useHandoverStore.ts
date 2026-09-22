// 页面与资料/判定之间的状态封装：加载、持久化、跨标签同步。
// 不写业务规则，所有判定调用 domain/rules.ts 的纯函数。

import { useCallback, useEffect, useState } from "react";
import type { AppState, BitePain } from "../data/types";
import { loadState, saveState, storageKey } from "../data/storage";
import {
  bookSlot as bookSlotRule,
  completeConsult as completeConsultRule,
  confirmRestoration as confirmRestorationRule,
  createHandover as createHandoverRule,
  referToConsult as referToConsultRule,
  releaseSlot as releaseSlotRule,
  reopenHandover as reopenHandoverRule,
  updateCoronal as updateCoronalRule,
  type CreateInput,
  type OpResult,
} from "../domain/rules";

export type { OpResult } from "../domain/rules";

export function useHandoverStore() {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  // 刷新 / 其它标签改动后保持牙位、椅位、暂封和修订链一致
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey()) setState(loadState());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const apply = useCallback(
    (fn: (s: AppState) => { state: AppState; result: OpResult }): OpResult => {
      let result: OpResult = { ok: true };
      setState((prev) => {
        const next = fn(prev);
        result = next.result;
        return next.state;
      });
      return result;
    },
    [],
  );

  const createHandover = useCallback(
    (input: CreateInput) => apply((s) => createHandoverRule(s, input)),
    [apply],
  );
  const updateCoronal = useCallback(
    (id: string, patch: { wallCount: number; temporaryDays: number; bitePain: BitePain }) =>
      apply((s) => updateCoronalRule(s, id, patch)),
    [apply],
  );
  const referToConsult = useCallback(
    (id: string) => apply((s) => referToConsultRule(s, id)),
    [apply],
  );
  const completeConsult = useCallback(
    (id: string, patch: { wallCount: number; bitePain: BitePain; temporaryDays: number }) =>
      apply((s) => completeConsultRule(s, id, patch)),
    [apply],
  );
  const releaseSlot = useCallback(
    (id: string) => apply((s) => releaseSlotRule(s, id)),
    [apply],
  );
  const bookSlot = useCallback(
    (id: string, slotId: string) => apply((s) => bookSlotRule(s, id, slotId)),
    [apply],
  );
  const confirmRestoration = useCallback(
    (id: string) => apply((s) => confirmRestorationRule(s, id)),
    [apply],
  );
  const reopenHandover = useCallback(
    (id: string, reason: string) => apply((s) => reopenHandoverRule(s, id, reason)),
    [apply],
  );

  return {
    state,
    createHandover,
    updateCoronal,
    referToConsult,
    completeConsult,
    releaseSlot,
    bookSlot,
    confirmRestoration,
    reopenHandover,
  };
}

export type HandoverStore = ReturnType<typeof useHandoverStore>;
