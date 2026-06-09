import { describe, it, expect } from "vitest";
import { OptOut } from "./OptOut.js";

describe("OptOut", () => {
  describe("addToBlocklist()", () => {
    it("err when neither phone nor email provided", () => {
      const r = OptOut.addToBlocklist({ id: "1", operatorId: "op1" });
      expect(r.isErr()).toBe(true);
    });

    it("ok with phone only", () => {
      const r = OptOut.addToBlocklist({
        id: "1",
        operatorId: "op1",
        phoneRaw: "+5511999999999",
      });
      expect(r.isOk()).toBe(true);
      if (r.isOk()) {
        expect(r.value.phoneHash).toHaveLength(64);
        expect(r.value.emailHash).toBeNull();
      }
    });

    it("ok with email only", () => {
      const r = OptOut.addToBlocklist({
        id: "2",
        operatorId: "op1",
        emailRaw: "a@b.com",
      });
      expect(r.isOk()).toBe(true);
      if (r.isOk()) {
        expect(r.value.emailHash).toHaveLength(64);
        expect(r.value.phoneHash).toBeNull();
      }
    });

    it("ok with both phone and email", () => {
      const r = OptOut.addToBlocklist({
        id: "3",
        operatorId: "op1",
        phoneRaw: "+55",
        emailRaw: "x@y.com",
      });
      expect(r.isOk()).toBe(true);
      if (r.isOk()) {
        expect(r.value.phoneHash).toHaveLength(64);
        expect(r.value.emailHash).toHaveLength(64);
      }
    });

    it("getters return correct values", () => {
      const r = OptOut.addToBlocklist({
        id: "id1",
        operatorId: "op2",
        phoneRaw: "123",
      });
      expect(r.isOk()).toBe(true);
      if (r.isOk()) {
        const o = r.value;
        expect(o.id).toBe("id1");
        expect(o.operatorId).toBe("op2");
        expect(o.optedOutAt).toBeInstanceOf(Date);
        expect(o.toJSON()).toMatchObject({ id: "id1", operatorId: "op2" });
      }
    });

    it("reconstitute restores all props", () => {
      const now = new Date();
      const o = OptOut.reconstitute({
        id: "r1",
        operatorId: "op3",
        phoneHash: "abc",
        emailHash: null,
        optedOutAt: now,
      });
      expect(o.id).toBe("r1");
      expect(o.phoneHash).toBe("abc");
      expect(o.emailHash).toBeNull();
    });
  });
});
