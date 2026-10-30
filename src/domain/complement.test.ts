import { describe, it, expect } from "vitest";
import { isNumberInComplement } from "./complement";

describe("isNumberInComplement (Regra R4)", () => {
  it("deve identificar paridade simples: lado ímpar", () => {
    expect(isNumberInComplement("lado ímpar", 101)).toBe(true);
    expect(isNumberInComplement("lado ímpar", 102)).toBe(false);
  });

  it("deve identificar paridade simples: lado par", () => {
    expect(isNumberInComplement("lado par", 200)).toBe(true);
    expect(isNumberInComplement("lado par", 201)).toBe(false);
  });

  it("deve identificar faixas: de 941 a 3498", () => {
    expect(isNumberInComplement("de 941/942 a 3498/3499", 1200)).toBe(true);
    expect(isNumberInComplement("de 941/942 a 3498/3499", 500)).toBe(false);
    expect(isNumberInComplement("de 941/942 a 3498/3499", 4000)).toBe(false);
  });

  it("deve identificar limite inferior: até 939", () => {
    expect(isNumberInComplement("até 939/940", 500)).toBe(true);
    expect(isNumberInComplement("até 939/940", 1000)).toBe(false);
  });

  it("deve identificar limite superior: de 3500 ao fim", () => {
    expect(isNumberInComplement("de 3500/3501 ao fim", 4000)).toBe(true);
    expect(isNumberInComplement("de 3500/3501 ao fim", 3000)).toBe(false);
  });
});
