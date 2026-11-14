// Prints on-chain testnet balances (public addresses only).
import { loadEnv } from "./_env.mjs"; loadEnv();
import { createPublicClient, http, parseAbi, formatEther } from "viem";
const c = createPublicClient({ transport: http("https://rpc-testnet.gokite.ai") });
const abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const toks = { PYUSD: "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9", "Test USD": "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63" };
for (const [n, k] of [["Nomad payTo", "SHOP_WALLET_ADDRESS_NOMAD"], ["Brightbean payTo", "SHOP_WALLET_ADDRESS_BRIGHTBEAN"], ["Demo shopper", "DEMO_SHOPPER_ADDRESS"]]) {
  const a = process.env[k]; const o = { address: a, KITE: formatEther(await c.getBalance({ address: a })) };
  for (const [t, ta] of Object.entries(toks)) o[t] = formatEther(await c.readContract({ address: ta, abi, functionName: "balanceOf", args: [a] }));
  console.log(n, o);
}
