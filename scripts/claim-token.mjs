// Claims testnet PYUSD for the demo shopper (needs a little testnet KITE for gas). Prints tx hash only.
import { loadEnv } from "./_env.mjs"; loadEnv();
import { createPublicClient, createWalletClient, http, parseAbi, formatEther, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
const chain = defineChain({ id: 2368, name: "Kite Testnet", nativeCurrency: { name: "KITE", symbol: "KITE", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc-testnet.gokite.ai"] } } });
const pc = createPublicClient({ chain, transport: http() });
const acct = privateKeyToAccount((process.env.SHOPPER_PRIVATE_KEY ?? process.env.DEMO_SHOPPER_PRIVATE_KEY));
const wc = createWalletClient({ account: acct, chain, transport: http() });
const A = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
const abi = parseAbi(["function claim()", "function claimTo(address)", "function balanceOf(address) view returns (uint256)"]);
for (const fn of ["claim", "claimTo"]) {
  try {
    const args = fn === "claimTo" ? [acct.address] : [];
    const { request } = await pc.simulateContract({ address: A, abi, functionName: fn, args, account: acct });
    const hash = await wc.writeContract(request);
    await pc.waitForTransactionReceipt({ hash });
    console.log(fn, "tx", hash, "PYUSD balance", formatEther(await pc.readContract({ address: A, abi, functionName: "balanceOf", args: [acct.address] })));
    process.exit(0);
  } catch (e) { console.log(fn, "failed:", String(e.shortMessage ?? e.message).slice(0, 200)); }
}
