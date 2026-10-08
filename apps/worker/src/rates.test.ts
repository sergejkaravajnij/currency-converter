import { describe, expect, it } from "vitest";
import { convert, idrToGelFromEcb, ratesFromNbg } from "./rates";

const xml = `<x><CurrencyRate><Code>USD</Code><Quantity>1</Quantity><Rate>2.7</Rate><ValidFromDate>2026-09-23</ValidFromDate></CurrencyRate><CurrencyRate><Code>RUB</Code><Quantity>100</Quantity><Rate>3.2</Rate><ValidFromDate>2026-09-23</ValidFromDate></CurrencyRate><CurrencyRate><Code>EUR</Code><Quantity>1</Quantity><Rate>3</Rate><ValidFromDate>2026-09-23</ValidFromDate></CurrencyRate><CurrencyRate><Code>GBP</Code><Quantity>1</Quantity><Rate>3.5</Rate><ValidFromDate>2026-09-23</ValidFromDate></CurrencyRate><CurrencyRate><Code>PLN</Code><Quantity>10</Quantity><Rate>7</Rate><ValidFromDate>2026-09-23</ValidFromDate></CurrencyRate><CurrencyRate><Code>TRY</Code><Quantity>1</Quantity><Rate>0.08</Rate><ValidFromDate>2026-09-23</ValidFromDate></CurrencyRate></x>`;

describe("rate helpers", () => {
  it("normalizes NBG quantities", () => {
    const rates = ratesFromNbg(xml);
    expect(rates.RUB).toBeCloseTo(0.032);
    expect(rates.PLN).toBeCloseTo(0.7);
    expect(rates.TRY).toBeCloseTo(0.08);
  });
  it("calculates IDR via EUR", () => expect(idrToGelFromEcb("TIME_PERIOD,OBS_VALUE\n2026-09-23,18000", 3)).toBeCloseTo(3 / 18000));
  it("cross converts through GEL", () => expect(convert(10, "USD", "EUR", { USD: 2.7, GEL: 1, RUB: .032, EUR: 3, GBP: 3.5, PLN: .7, TRY: .08, IDR: .00016 })).toBeCloseTo(9));
});
