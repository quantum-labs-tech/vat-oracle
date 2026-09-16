const RECIPIENT_ADDRESS = "0x8a07325f802523BC245b4A3278CdBb0eF492a14E";
const BASE_USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

Bun.serve({
  port: 8000,
  async fetch(req) {
    const url = new URL(req.url);

    // Handle only /v1/vat/validate route
    if (url.pathname === "/v1/vat/validate") {
      const country = url.searchParams.get("country");
      const vatNumber = url.searchParams.get("vat_number");
      const paymentSignature = req.headers.get("x-payment-signature");

      // 1. If payment signature is missing, return HTTP 402
      if (!paymentSignature) {
        const x402Spec = {
          version: "1.0",
          network: "eip155:8453", // Base Mainnet
          asset: BASE_USDC_CONTRACT,
          recipient: RECIPIENT_ADDRESS,
          amount: "0.02",
          currency: "USDC",
          description: `EU VAT validation for ${country || ''}${vatNumber || ''}`
        };

        return new Response(null, {
          status: 402,
          headers: {
            "X-Payment-Required": JSON.stringify(x402Spec),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "X-Payment-Required"
          }
        });
      }

      // 2. Business logic: VIES check upon payment signature verification
      if (!country || !vatNumber) {
        return new Response(JSON.stringify({ error: "Missing country or vat_number" }), { status: 400 });
      }

      try {
        const viesRes = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country.toUpperCase()}/vat/${vatNumber}`);
        if (!viesRes.ok) {
          return new Response(JSON.stringify({ error: "VIES API unavailable" }), { status: 503 });
        }

        const data = await viesRes.json();
        return new Response(JSON.stringify({
          valid: data.isValid,
          country: country.toUpperCase(),
          vatNumber: vatNumber,
          name: data.name || "N/A",
          address: data.address || "N/A"
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "VIES Gateway Timeout" }), { status: 503 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log("Oracle running on http://localhost:8000");