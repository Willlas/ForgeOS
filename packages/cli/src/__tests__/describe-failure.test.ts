import { describe, expect, it } from "vitest";
import { describeFailure, errorMessage } from "../index";

// ---------------------------------------------------------------------------
// describeFailure()
// ---------------------------------------------------------------------------
describe("describeFailure – Error instances", () => {
  it("extracts .message from an Error", () => {
    expect(describeFailure("prefix", new Error("boom"))).toBe("prefix: boom");
  });

  it("falls back to the constructor name for Error with empty message", () => {
    const err = new Error("");
    expect(describeFailure("prefix", err)).toContain("prefix");
  });

  it("includes the full message for custom error subclasses", () => {
    class DomainError extends Error {
      code: number;
      constructor(message: string, code: number) {
        super(message);
        this.code = code;
      }
    }
    const err = new DomainError("connection refused", 42);
    expect(describeFailure("daemon start", err)).toBe(
      "daemon start: connection refused",
    );
  });
});

describe("describeFailure – plain objects (IPC rejections)", () => {
  it("renders [code] message for { code, message } objects", () => {
    const rejection = { code: 6, message: "Unknown or already-consumed approvalId" };
    expect(describeFailure("Workspace apply", rejection)).toBe(
      "Workspace apply: [6] Unknown or already-consumed approvalId",
    );
  });

  it("renders just the message when code is absent", () => {
    const rejection = { message: "session expired" };
    expect(describeFailure("ask", rejection)).toBe("ask: session expired");
  });

  it("serialises a non-string message without leaking [object Object]", () => {
    expect(describeFailure("request", { message: { reason: "offline" } })).toBe(
      'request: {"reason":"offline"}',
    );
    expect(describeFailure("request", { message: { toJSON: () => undefined } })).toBe(
      "request: [Unserializable error object]",
    );
  });

  it("serialises objects without a .message property", () => {
    const rejection = { error: "boom" };
    expect(describeFailure("chat", rejection)).toContain("boom");
    expect(describeFailure("chat", rejection)).not.toContain("[object Object]");
  });

  it("handles circular and unstringifiable error objects", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const unstringifiable = { toJSON: () => { throw new Error("cannot serialize"); } };

    expect(describeFailure("request", circular)).toBe(
      "request: [Unserializable error object]",
    );
    expect(describeFailure("request", unstringifiable)).toBe(
      "request: [Unserializable error object]",
    );
  });
});

describe("describeFailure – primitive inputs", () => {
  it("wraps a plain string", () => {
    expect(describeFailure("prefix", "raw text")).toBe("prefix: raw text");
  });

  it("wraps a number", () => {
    expect(describeFailure("prefix", 42)).toBe("prefix: 42");
  });

  it("wraps null", () => {
    expect(describeFailure("prefix", null)).toBe("prefix: null");
  });

  it("wraps undefined", () => {
    expect(describeFailure("prefix", undefined)).toBe("prefix: undefined");
  });

  it("omits the prefix when it is empty", () => {
    expect(describeFailure("", new Error("bare"))).toBe("bare");
  });
});

describe("describeFailure – never leaks [object Object]", () => {
  const cases: unknown[] = [
    new Error("real error"),
    { code: 3, message: "ipc error" },
    { message: "plain" },
    "string",
    42,
    null,
    undefined,
    { nested: { deep: true } },
  ];

  it.each(cases.map((c, i) => [i, c] as const))(
    "input case %i produces no [object Object]",
    (_i, input) => {
      const result = describeFailure("test", input);
      expect(result).not.toContain("[object Object]");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    },
  );
});

// ---------------------------------------------------------------------------
// errorMessage() (pre-existing helper – regression guard)
// ---------------------------------------------------------------------------
describe("errorMessage – regression guard", () => {
  it("still extracts .message from Error instances", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("preserves message-only formatting for { code, message } objects", () => {
    expect(errorMessage({ code: 6, message: "ipc" })).toBe("ipc");
  });

  it("still handles primitives", () => {
    expect(errorMessage("text")).toBe("text");
    expect(errorMessage(42)).toBe("42");
  });
});
