export const CURRENCIES = ["USD", "GEL", "RUB", "EUR", "GBP", "PLN", "TRY", "JPY", "CNY", "HKD", "IDR"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];
export type Rates = Record<CurrencyCode, number>;

export interface RateSnapshot {
  version: 1;
  baseCurrency: "GEL";
  rates: Rates;
  effectiveDate: string;
  fetchedAt: string;
  source: "National Bank of Georgia + ECB (IDR)";
  stale: boolean;
}

interface NbgRate { code: string; quantity: number; rate: number; date: string }

const text = (value: string, tag: string) => value.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"))?.[1]?.trim();

export function parseNbgRates(xml: string): NbgRate[] {
  return [...xml.matchAll(/<CurrencyRate>([\s\S]*?)<\/CurrencyRate>/gi)].map((match) => {
    const block = match[1];
    const code = text(block, "Code");
    const quantity = Number(text(block, "Quantity"));
    const rate = Number(text(block, "Rate"));
    const date = text(block, "ValidFromDate") ?? text(block, "Date") ?? "";
    if (!code || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("NBG response contains an invalid currency rate");
    }
    return { code, quantity, rate, date };
  });
}

export function ratesFromNbg(xml: string): Omit<Rates, "IDR"> & { effectiveDate: string } {
  const parsed = parseNbgRates(xml);
  const wanted = new Map(parsed.map((item) => [item.code, item]));
  const values: Partial<Rates> = { GEL: 1 };
  for (const code of CURRENCIES.filter((code) => code !== "GEL" && code !== "IDR")) {
    const item = wanted.get(code);
    if (!item) throw new Error(`NBG response does not contain ${code}`);
    values[code] = item.rate / item.quantity;
  }
  const effectiveDate = parsed[0]?.date;
  if (!effectiveDate) throw new Error("NBG response does not contain a valid date");
  return { ...(values as Omit<Rates, "IDR">), effectiveDate };
}

// ECB's daily series is expressed as IDR per 1 EUR.  Convert it via NBG's GEL/EUR rate.
export function idrToGelFromEcb(csv: string, eurToGel: number): number {
  const rows = csv.trim().split(/\r?\n/);
  const header = rows[0]?.split(",");
  const valueIndex = header?.findIndex((column) => column.trim() === "OBS_VALUE") ?? -1;
  const row = rows[1]?.split(",");
  const idrPerEur = Number(row?.[valueIndex]);
  if (!Number.isFinite(idrPerEur) || idrPerEur <= 0) throw new Error("ECB response does not contain an IDR rate");
  return eurToGel / idrPerEur;
}

export function convert(amount: number, source: CurrencyCode, target: CurrencyCode, rates: Rates): number {
  return amount * rates[source] / rates[target];
}
