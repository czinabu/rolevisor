import { describe, expect, it } from "vitest";
import { idleRequest, requestReducer, type RequestEvent, type RequestState } from "./request";

function play(events: RequestEvent<string>[], from: RequestState<string> = idleRequest()) {
  return events.reduce(requestReducer<string>, from);
}

describe("requestReducer", () => {
  it("goes idle, running, done", () => {
    expect(play([{ type: "start" }])).toEqual({ status: "running", data: null, error: "" });
    expect(play([{ type: "start" }, { type: "succeed", data: "a" }])).toEqual({
      status: "done",
      data: "a",
      error: "",
    });
  });

  it("shows the error when a run fails", () => {
    expect(play([{ type: "start" }, { type: "fail", error: "No luck." }])).toEqual({
      status: "failed",
      data: null,
      error: "No luck.",
    });
  });

  it("clears the last answer and error on a fresh start", () => {
    const done = play([{ type: "start" }, { type: "succeed", data: "a" }]);
    expect(play([{ type: "start" }], done).data).toBeNull();
    const failed = play([{ type: "start" }, { type: "fail", error: "No luck." }]);
    expect(play([{ type: "start" }], failed)).toEqual({ status: "running", data: null, error: "" });
  });

  it("keeps the last answer through a refresh that fails", () => {
    const state = play([
      { type: "start" },
      { type: "succeed", data: "a" },
      { type: "start", keep: true },
      { type: "fail", error: "No luck." },
    ]);
    expect(state).toEqual({ status: "failed", data: "a", error: "No luck." });
  });

  it("keeps the answer when a later step fails, and when that error is dismissed", () => {
    const failed = play([{ type: "start" }, { type: "succeed", data: "a" }, { type: "fail", error: "Couldn't save." }]);
    expect(failed).toEqual({ status: "failed", data: "a", error: "Couldn't save." });
    expect(play([{ type: "dismiss" }], failed)).toEqual({ status: "done", data: "a", error: "" });
  });

  it("dismisses an error with no answer back to idle, and leaves other states alone", () => {
    expect(play([{ type: "start" }, { type: "fail", error: "x" }, { type: "dismiss" }])).toBe(idleRequest());
    const running = play([{ type: "start" }]);
    expect(play([{ type: "dismiss" }], running)).toBe(running);
  });

  it("ignores an answer nobody is waiting for", () => {
    expect(play([{ type: "succeed", data: "late" }])).toBe(idleRequest());
    expect(play([{ type: "start" }, { type: "reset" }, { type: "succeed", data: "late" }])).toBe(idleRequest());
  });

  it("is never loading and showing an error at once", () => {
    const state = play([{ type: "start" }, { type: "fail", error: "x" }, { type: "start", keep: true }]);
    expect(state).toEqual({ status: "running", data: null, error: "" });
  });
});
