import { privateKeyToAccount } from "viem/accounts";

// Test agent private key (for demonstration purposes)
const ACCOUNT_PRIVATE_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
const account = privateKeyToAccount(ACCOUNT_PRIVATE_KEY);

async function run() {
  const targetUrl = "http://localhost:8000/v1/vat/validate?country=DE&vat_number=136695976";
  
  console.log(`🤖 Agent (${account.address}) sending request to oracle...`);
  
  // 1. Initial request without payment headers
  let response = await fetch(targetUrl);

  // 2. Handle HTTP 402 Payment Required
  if (response.status === 402) {
    const paymentRequiredHeader = response.headers.get("X-Payment-Required");
    if (!paymentRequiredHeader) {
      console.error("❌ Error: Missing X-Payment-Required header");
      return;
    }

    console.log(`💳 Oracle returned 402 Payment Required.`);
    console.log(`Payment requirements: ${paymentRequiredHeader}`);

    // 3. Sign the payment requirements payload (EIP-191 personal_sign)
    const signature = await account.signMessage({
      message: paymentRequiredHeader,
    });
    console.log(`✍️ Signature generated: ${signature.slice(0, 20)}...`);

    // 4. Retry request including payment headers
    response = await fetch(targetUrl, {
      headers: {
        "x-payment-signature": signature,
        "x-payment-wallet": account.address,
      },
    });
  }

  // 5. Output the result from the oracle
  const data = await response.json();
  console.log(`🎉 Data received (${response.status} OK):`, data);
}

run();
