import { randomBytes } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { centsToWei } from "./money.ts";

export const KITE_TESTNET = {
  network: "kite-testnet", caip2: "eip155:2368", chainId: 2368,
  asset: "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9" as const, assetName: "PYUSD", assetVersion: "1", decimals: 18,
  explorer: "https://testnet.kitescan.ai", facilitator: "https://facilitator.pieverse.io", rpc: "https://rpc-testnet.gokite.ai",
};

export interface PaymentRequirements {
  scheme: "exact"; network: string; asset: string; amount: string; payTo: string; maxTimeoutSeconds: number;
  extra: { name: string; version: string }; quote_id?: string; description?: string; merchantName?: string;
}
export interface PaymentPayload {
  x402Version: 2; resource: { url: string; description: string; mimeType: string }; accepted: PaymentRequirements;
  payload: { signature: string; authorization: { from: string; to: string; value: string; validAfter: string; validBefore: string; nonce: string } };
}

/** Exact 402 body for a quote. amount == quote price in wei (never rounded). */
export function build402(opts: { quoteId: string; priceCents: number; payTo: string; shopName: string; description: string; resourceUrl: string; ttl: number }) {
  const req: PaymentRequirements = {
    scheme: "exact", network: KITE_TESTNET.caip2, asset: KITE_TESTNET.asset, amount: centsToWei(opts.priceCents, KITE_TESTNET.decimals).toString(),
    payTo: opts.payTo, maxTimeoutSeconds: opts.ttl, extra: { name: KITE_TESTNET.assetName, version: KITE_TESTNET.assetVersion },
    quote_id: opts.quoteId, description: opts.description, merchantName: opts.shopName,
  };
  return { x402Version: 2, error: "X-PAYMENT header is required", accepts: [req], resource: { url: opts.resourceUrl, description: opts.description, mimeType: "application/json" }, testnet: true };
}

export const encodePayment = (p: PaymentPayload) => Buffer.from(JSON.stringify(p)).toString("base64");
export function decodePayment(h: string): PaymentPayload | null {
  try { return JSON.parse(Buffer.from(h, "base64").toString("utf8")); } catch { return null; }
}

/** Shopper-side signer abstraction. KiteMcp/kpass signers plug in here; DevSigner is the labeled fallback. */
export interface PaymentSigner {
  readonly kind: "dev-signer" | "kpass" | "kite-mcp" | "mock";
  readonly label: string; // shown honestly in UI/receipts
  address(): Promise<string>;
  /** Throws SessionLimitError when the session/budget refuses. */
  pay(req: PaymentRequirements, resource: { url: string; description: string }): Promise<PaymentPayload>;
}
export class SessionLimitError extends Error { code = "InsufficientBudget"; constructor(public limitCents: number, public requestedCents: number) { super(`InsufficientBudget: ${requestedCents} > ${limitCents}`); } }

/** KiteAaSdkSigner fallback: plain EIP-3009 signature from a funded testnet key. NOT a Passport session. */
export class DevSigner implements PaymentSigner {
  readonly kind = "dev-signer" as const;
  readonly label = "dev signer (testnet EOA, no Passport session)";
  private acct;
  /** simulatedSessionCapCents: optional per-tx cap emulating a Passport session; clearly labeled as simulated by callers. */
  constructor(pk: string, private simulatedSessionCapCents?: number) { this.acct = privateKeyToAccount(pk as `0x${string}`); }
  async address() { return this.acct.address; }
  async pay(req: PaymentRequirements, resource: { url: string; description: string }): Promise<PaymentPayload> {
    const cents = Number(BigInt(req.amount) / 10n ** 16n);
    if (this.simulatedSessionCapCents !== undefined && cents > this.simulatedSessionCapCents) throw new SessionLimitError(this.simulatedSessionCapCents, cents);
    const now = Math.floor(Date.now() / 1000);
    const authorization = { from: this.acct.address, to: req.payTo, value: req.amount, validAfter: "0", validBefore: String(now + req.maxTimeoutSeconds), nonce: "0x" + randomBytes(32).toString("hex") };
    const signature = await this.acct.signTypedData({
      domain: { name: req.extra.name, version: req.extra.version, chainId: KITE_TESTNET.chainId, verifyingContract: req.asset as `0x${string}` },
      types: { TransferWithAuthorization: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" }] },
      primaryType: "TransferWithAuthorization",
      message: { from: this.acct.address, to: req.payTo as `0x${string}`, value: BigInt(req.amount), validAfter: BigInt(authorization.validAfter), validBefore: BigInt(authorization.validBefore), nonce: authorization.nonce as `0x${string}` },
    });
    return { x402Version: 2, resource: { ...resource, mimeType: "application/json" }, accepted: req, payload: { signature, authorization } };
  }
}

/** Test-only. Never constructed in production. */
export class MockSigner implements PaymentSigner {
  readonly kind = "mock" as const; readonly label = "mock (tests only)";
  constructor() { if (process.env.NODE_ENV === "production") throw new Error("MockSigner is forbidden in production"); }
  async address() { return "0x000000000000000000000000000000000000dEaD"; }
  async pay(req: PaymentRequirements, resource: { url: string; description: string }): Promise<PaymentPayload> {
    return { x402Version: 2, resource: { ...resource, mimeType: "application/json" }, accepted: req, payload: { signature: "0xmock", authorization: { from: await this.address(), to: req.payTo, value: req.amount, validAfter: "0", validBefore: "9999999999", nonce: "0x" + randomBytes(32).toString("hex") } } };
  }
}

// ---------- Facilitator ----------
export interface Facilitator {
  verify(p: PaymentPayload, req: PaymentRequirements): Promise<{ isValid: boolean; invalidReason?: string; payer?: string }>;
  settle(p: PaymentPayload, req: PaymentRequirements): Promise<{ success: boolean; transaction?: string; payer?: string; errorReason?: string; raw?: unknown }>;
}
export class PieverseFacilitator implements Facilitator {
  constructor(private base = KITE_TESTNET.facilitator) {}
  private async post(path: string, p: PaymentPayload, req: PaymentRequirements, retries = 2): Promise<any> {
    const { quote_id: _q, description: _d, merchantName: _m, ...accepted } = req;
    const body = JSON.stringify({ x402Version: 2, paymentPayload: { ...p, accepted }, paymentRequirements: accepted });
    let last: unknown;
    for (let i = 0; i <= retries; i++) {
      try {
        const r = await fetch(this.base + path, { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(60000) });
        const text = await r.text(); let j: any; try { j = JSON.parse(text); } catch { j = { error: text.slice(0, 200) }; }
        if (r.status >= 500) { last = j; continue; }
        return j;
      } catch (e) { last = { error: String(e) }; }
    }
    return { error: "facilitator_unreachable", detail: last };
  }
  async verify(p: PaymentPayload, req: PaymentRequirements) { return this.post("/v2/verify", p, req); }
  async settle(p: PaymentPayload, req: PaymentRequirements) {
    const j = await this.post("/v2/settle", p, req, 0); // never blindly retry a settle (double-spend risk is nonce-protected, but stay safe)
    return { success: !!j.success, transaction: j.transaction ?? j.txHash, payer: j.payer, errorReason: j.errorReason ?? j.error, raw: j };
  }
}

// ---------- Self-relay settlement (fallback) ----------
import { createPublicClient, createWalletClient, http, parseAbi, defineChain, hexToSignature } from "viem";

const kiteChain = defineChain({ id: 2368, name: "Kite Testnet", nativeCurrency: { name: "KITE", symbol: "KITE", decimals: 18 }, rpcUrls: { default: { http: [KITE_TESTNET.rpc] } } });
const ERC3009 = parseAbi([
  "function transferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce,uint8 v,bytes32 r,bytes32 s)",
  "function authorizationState(address authorizer,bytes32 nonce) view returns (bool)",
]);

/** Submits the signed EIP-3009 authorization on-chain itself (relayer pays gas). Used only when the facilitator cannot settle; labeled "self-relay". */
export class SelfRelayFacilitator implements Facilitator {
  private relayer; constructor(pk: string, private inner: Facilitator) { this.relayer = privateKeyToAccount(pk as `0x${string}`); }
  verify(p: PaymentPayload, r: PaymentRequirements) { return this.inner.verify(p, r); }
  async settle(p: PaymentPayload, r: PaymentRequirements) {
    const a = p.payload.authorization; const pc = createPublicClient({ chain: kiteChain, transport: http() });
    try {
      const used = await pc.readContract({ address: r.asset as `0x${string}`, abi: ERC3009, functionName: "authorizationState", args: [a.from as `0x${string}`, a.nonce as `0x${string}`] });
      if (used) return { success: false, errorReason: "authorization_already_used" };
      const sig = hexToSignature(p.payload.signature as `0x${string}`);
      const wc = createWalletClient({ account: this.relayer, chain: kiteChain, transport: http() });
      const hash = await wc.writeContract({ address: r.asset as `0x${string}`, abi: ERC3009, functionName: "transferWithAuthorization", args: [a.from as `0x${string}`, a.to as `0x${string}`, BigInt(a.value), BigInt(a.validAfter), BigInt(a.validBefore), a.nonce as `0x${string}`, Number(sig.v ?? (sig.yParity + 27)), sig.r, sig.s] });
      const rc = await pc.waitForTransactionReceipt({ hash });
      return rc.status === "success" ? { success: true, transaction: hash, payer: a.from, raw: { via: "self-relay" } } : { success: false, errorReason: "relay_tx_reverted", transaction: hash };
    } catch (e) { return { success: false, errorReason: "relay_error: " + String((e as Error).message).slice(0, 120) }; }
  }
}

/** Try the primary facilitator; if it reports a failed transaction (nothing executed), settle via the secondary. */
export class FallbackFacilitator implements Facilitator {
  constructor(private primary: Facilitator, private secondary: Facilitator) {}
  verify(p: PaymentPayload, r: PaymentRequirements) { return this.primary.verify(p, r); }
  async settle(p: PaymentPayload, r: PaymentRequirements) {
    const a = await this.primary.settle(p, r);
    if (a.success || a.transaction) return { ...a, raw: { ...(a.raw as object), via: "pieverse" } };
    if ((a.raw as any)?.error === "facilitator_unreachable") return a; // unknown state: never double-settle blindly
    const b = await this.secondary.settle(p, r);
    return { ...b, raw: { ...(b.raw as object), via: "self-relay", primary_error: a.errorReason } };
  }
}
