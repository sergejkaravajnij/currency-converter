const UPSTREAM_RATES_URL = "https://currency-calculator-api.karavajny-family.workers.dev/api/rates";

export const onRequestGet = async (): Promise<Response> => {
  try {
    const upstream = await fetch(UPSTREAM_RATES_URL);
    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "public, max-age=300");
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json({ error: "Rates are temporarily unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
};
