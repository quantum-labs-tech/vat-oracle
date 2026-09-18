# Autonomous EU VAT Validation Oracle (x402 Protocol)

Machine-Native microservice providing real-time EU VIES VAT validation on Base L2.

## Endpoint
`GET https://vat-oracle.onrender.com/v1/vat/validate?country={COUNTRY_CODE}&vat_number={VAT_NUMBER}`

## Monetization & Payment Flow (x402)
- **Network**: Base Mainnet (Chain ID `8453`)
- **Asset**: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- **Price**: 0.02 USDC per query
- **Recipient**: `0x8a07325f802523BC245b4A3278CdBb0eF492a14E`

## How to Consume
1. Send initial request without headers.
2. Receive `402 Payment Required` with payment specifications.
3. Broadcast ERC-20 `transfer(recipient, 20000)` on Base L2.
4. Resend initial request with `x-payment-tx-hash: <TX_HASH>` header.