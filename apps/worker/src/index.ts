import { idrToGelFromEcb, ratesFromNbg, type RateSnapshot } from "./rates";

export interface Env {
  RATES: KVNamespace;
  ALLOWED_ORIGINS?: string;
}

const KEY = "latest";
const NBG_URL = "https://services.nbg.gov.ge/rates/service.asmx";
const ECB_IDR_URL = "https://data-api.ecb.europa.eu/service/data/EXR/D.IDR.EUR.SP00.A?format=csvdata&lastNObservations=1";

function cors(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim());
  return allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
}

async function fetchNbg(): Promise<string> {
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetCurrentRates xmlns="http://www.nbg.ge/"><Currencies>USD,RUB,EUR,GBP,PLN,TRY,JPY,CNY,HKD</Currencies></GetCurrentRates></soap:Body></soap:Envelope>`;
  const response = await fetch(NBG_URL, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "http://www.nbg.ge/GetCurrentRates" }, body });
  if (!response.ok) throw new Error(`NBG returned HTTP ${response.status}`);
  return response.text();
}

export async function refreshRates(env: Env, now = new Date()): Promise<RateSnapshot> {
  const [nbgXml, ecbCsv] = await Promise.all([fetchNbg(), fetch(ECB_IDR_URL).then(async (response) => {
    if (!response.ok) throw new Error(`ECB returned HTTP ${response.status}`);
    return response.text();
  })]);
  const nbg = ratesFromNbg(nbgXml);
  const snapshot: RateSnapshot = {
    version: 1, baseCurrency: "GEL", rates: { USD: nbg.USD, GEL: 1, RUB: nbg.RUB, EUR: nbg.EUR, GBP: nbg.GBP, PLN: nbg.PLN, TRY: nbg.TRY, JPY: nbg.JPY, CNY: nbg.CNY, HKD: nbg.HKD, IDR: idrToGelFromEcb(ecbCsv, nbg.EUR) },
    effectiveDate: nbg.effectiveDate, fetchedAt: now.toISOString(), source: "National Bank of Georgia + ECB (IDR)", stale: false,
  };
  await env.RATES.put(KEY, JSON.stringify(snapshot));
  return snapshot;
}

async function refreshRatesWithLogging(env: Env): Promise<void> {
  try {
    const snapshot = await refreshRates(env);
    console.log(JSON.stringify({ event: "rates_refreshed", effectiveDate: snapshot.effectiveDate, fetchedAt: snapshot.fetchedAt }));
  } catch (error) {
    console.error(JSON.stringify({ event: "rates_refresh_failed", message: error instanceof Error ? error.message : "Unknown error" }));
    throw error;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
    if (new URL(request.url).pathname !== "/api/rates" || request.method !== "GET") return new Response("Not found", { status: 404, headers });
    const raw = await env.RATES.get(KEY);
    if (!raw) return Response.json({ error: "Rates are not available yet" }, { status: 503, headers: { ...headers, "Cache-Control": "no-store" } });
    const snapshot = JSON.parse(raw) as RateSnapshot;
    snapshot.stale = Date.now() - Date.parse(snapshot.fetchedAt) > 36 * 60 * 60 * 1000;
    return Response.json(snapshot, { headers: { ...headers, "Cache-Control": "public, max-age=300" } });
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refreshRatesWithLogging(env));
  },
} satisfies ExportedHandler<Env>;
