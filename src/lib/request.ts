/**
 * The life of one "ask and wait" action, like tailoring a resume or building
 * a download. Every such action in the app goes through this one state
 * machine, so a screen can never be both loading and showing an error, and
 * the rules for what happens to the last good answer live in one place.
 *
 *   idle ──start──▶ running ──succeed──▶ done
 *                      │                  │
 *                      └──fail──▶ failed ◀┘ (fail: a later step went wrong)
 *
 *   start is allowed from any state (a retry or a refresh).
 *   dismiss clears a shown error. reset goes back to idle from anywhere.
 */
export type RequestState<T> =
  | { status: "idle"; data: null; error: "" }
  /** Waiting. `data` is the last good answer when the action keeps it on screen meanwhile. */
  | { status: "running"; data: T | null; error: "" }
  | { status: "done"; data: T; error: "" }
  /** `error` is safe to show. `data` is the last good answer, if there was one. */
  | { status: "failed"; data: T | null; error: string };

export type RequestEvent<T> =
  /** `keep` leaves the last good answer on screen while waiting. */
  | { type: "start"; keep?: boolean }
  | { type: "succeed"; data: T }
  | { type: "fail"; error: string }
  | { type: "dismiss" }
  | { type: "reset" };

const IDLE = { status: "idle", data: null, error: "" } as const;

export function idleRequest<T>(): RequestState<T> {
  return IDLE;
}

export function requestReducer<T>(state: RequestState<T>, event: RequestEvent<T>): RequestState<T> {
  switch (event.type) {
    case "start":
      return { status: "running", data: event.keep ? state.data : null, error: "" };
    case "succeed":
      // An answer only counts while someone is waiting for it.
      return state.status === "running" ? { status: "done", data: event.data, error: "" } : state;
    case "fail":
      return { status: "failed", data: state.data, error: event.error };
    case "dismiss":
      if (state.status !== "failed") return state;
      return state.data === null ? IDLE : { status: "done", data: state.data, error: "" };
    case "reset":
      return IDLE;
  }
}
