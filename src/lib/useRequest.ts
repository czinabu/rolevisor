"use client";

import { useCallback, useReducer, useRef, type Reducer } from "react";
import { friendlyMessage } from "./errors";
import { idleRequest, requestReducer, type RequestEvent, type RequestState } from "./request";

interface RunOptions {
  /** Leave the last good answer on screen while waiting, and if this run fails. */
  keep?: boolean;
  /** Turns a thrown error into the message to show. Defaults to friendlyMessage. */
  describe?: (error: unknown) => string;
}

/**
 * Runs one "ask and wait" action at a time and tracks it with the state
 * machine in request.ts. Use this instead of separate busy, error, and
 * result flags.
 *
 * Only the latest run counts: if the action is started again or reset while
 * an answer is on its way, the late answer is dropped.
 */
export function useRequest<T>() {
  const [state, dispatch] = useReducer(
    requestReducer as Reducer<RequestState<T>, RequestEvent<T>>,
    idleRequest<T>(),
  );
  const latest = useRef(0);

  /** Resolves to true if the work finished and its answer was used. */
  const run = useCallback(async (work: () => Promise<T>, options: RunOptions = {}) => {
    const id = ++latest.current;
    dispatch({ type: "start", keep: options.keep });
    try {
      const data = await work();
      if (latest.current !== id) return false;
      dispatch({ type: "succeed", data });
      return true;
    } catch (e) {
      if (latest.current === id) {
        dispatch({ type: "fail", error: (options.describe ?? friendlyMessage)(e) });
      }
      return false;
    }
  }, []);

  /** Shows an error for a follow-up step, keeping any answer on screen. */
  const fail = useCallback((error: string) => dispatch({ type: "fail", error }), []);
  const dismiss = useCallback(() => dispatch({ type: "dismiss" }), []);
  /** Back to the start. An answer still on its way is dropped. */
  const reset = useCallback(() => {
    latest.current++;
    dispatch({ type: "reset" });
  }, []);

  return {
    state,
    status: state.status,
    busy: state.status === "running",
    data: state.data,
    error: state.error,
    run,
    fail,
    dismiss,
    reset,
  };
}
