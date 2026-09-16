import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// 1. Test buyer credentials generated in Step 1
const PRIVATE_KEY = "0x32193d4d96c64dbd9fecdd0c9e5b63fa9e9c583a4e8e4f893b2fe929f26c3912";
const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

// 2. Oracle micro-service endpoint
const ORACLE_URL = "http://localhost:8000/v1/vat/validate?country=DE&vat_number=136695976";

async function runAgent() {
  console.log(`🤖 Agent (${account.address}) sending request to oracle...`);

  // Request 1: Check payment requirements
  const res1 = await fetch(ORACLE_URL);

  if (res1.status === 402) {
    console.log("💳 Oracle returned 402 Payment Required.");
    const spec = res1.headers.get("X-Payment-Required");
    console.log("Payment requirements:", spec);

    // Generate EIP-712 signature on behalf of the AI Agent
    const client = createWalletClient({
      account,
      chain: base,
      transport: http()
    });

    const signature = await client.signMessage({
      message: `x402-payment-auth:${account.address}`
    });

    console.log("✍️ Signature generated:", signature.slice(0, 20) + "...");

    // Request 2: Retry request with payment signature attached
    const res2 = await fetch(ORACLE_URL, {
      headers: {
        "x-payment-signature": signature
      }
    });

    const data = await res2.json();
    console.log("🎉 Data received (200 OK):", data);
  } else {
    console.log("Response status:", res1.status);
  }
}

runAgent();