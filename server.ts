import { createPublicClient, http, verifyMessage } from "viem";
import { base } from "viem/chains";

// Configuration constants for the x402 payment protocol and Base L2 network
const RECIPIENT_ADDRESS = "0x8a07325f802523BC245b4A3278CdBb0eF492a14E";
const BASE_USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Public RPC client for Base L2 network interactions
const publicClient = createPublicClient({
  chain: base,
  transport: http()
});

// In-memory set to prevent transaction replay attacks
const processedTxs = new Set<string>();

Bun.serve({
  port: 8000,
  async fetch(req) {
    const url = new URL(req.url);

    // 1. Health check endpoint for UptimeRobot monitoring and Render keep-alive
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "online", service: "vat-oracle" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Handle primary VAT validation route
    if (url.pathname === "/v1/vat/validate") {
      const country = url.searchParams.get("country");
      const vatNumber = url.searchParams.get("vat_number");
      
      const paymentTxHash = req.headers.get("x-payment-tx-hash");
      const paymentSignature = req.headers.get("x-payment-signature");
      const paymentWallet = req.headers.get("x-payment-wallet");

      // Define x402 payment specification payload
      const x402Spec = {
        version: "1.0",
        network: "eip155:8453", // Base Mainnet
        asset: BASE_USDC_CONTRACT,
        recipient: RECIPIENT_ADDRESS,
        amount: "0.02",
        currency: "USDC",
        description: `EU VAT validation for ${country || ''}${vatNumber || ''}`
      };

      // 2. If neither on-chain transaction hash nor signature is provided, return HTTP 402
      if (!paymentTxHash && (!paymentSignature || !paymentWallet)) {
        return new Response(null, {
          status: 402,
          headers: {
            "X-Payment-Required": JSON.stringify(x402Spec),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "X-Payment-Required, x-payment-tx-hash"
          }
        });
      }

      // 3. Primary Method: On-chain USDC transaction verification on Base
      if (paymentTxHash) {
        if (processedTxs.has(paymentTxHash)) {
          return new Response(JSON.stringify({ error: "Transaction hash already used" }), { status: 400 });
        }

        try {
          const receipt = await publicClient.getTransactionReceipt({ hash: paymentTxHash as `0x${string}` });
          if (receipt.status !== "success") {
            return new Response(JSON.stringify({ error: "On-chain transaction failed" }), { status: 402 });
          }

          // Store transaction hash to prevent replay attacks
          processedTxs.add(paymentTxHash);
        } catch (err) {
          return new Response(JSON.stringify({ error: "Invalid transaction hash or tx not found on Base" }), { status: 400 });
        }
      } 
      // 3. Fallback/Testing Method: EIP-191 cryptographic signature verification
      else if (paymentSignature && paymentWallet) {
        try {
          const isValidSignature = await verifyMessage({
            address: paymentWallet as `0x${string}`,
            message: JSON.stringify(x402Spec),
            signature: paymentSignature as `0x${string}`,
          });

          if (!isValidSignature) {
            return new Response(JSON.stringify({ error: "Invalid payment cryptographic signature" }), { status: 401 });
          }
        } catch (err) {
          return new Response(JSON.stringify({ error: "Signature verification failed" }), { status: 400 });
        }
      }

      // 4. Query EU VIES REST API upon successful payment/signature verification
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