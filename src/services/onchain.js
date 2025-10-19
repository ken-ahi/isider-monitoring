// Minimal on-chain data fetchers for Ethereum via Etherscan or Covalent.
// Reads API keys from CRA env vars: REACT_APP_ETHERSCAN_KEY, REACT_APP_COVALENT_KEY

// Etherscan V2 unified endpoint
const ETHERSCAN_API = 'https://api.etherscan.io/v2/api';
const COVALENT_BASE = 'https://api.covalenthq.com/v1';

const etherscanKey = process.env.REACT_APP_ETHERSCAN_KEY;
const covalentKey = process.env.REACT_APP_COVALENT_KEY;

// Helper: fetch JSON with basic error handling
async function fetchJSON(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// Normalize transaction object for UI consumption
function normalizeTokenTx(tx, source) {
  return {
    source,
    hash: tx.hash || tx.transactionHash || tx.tx_hash,
    time: new Date((tx.timeStamp ? Number(tx.timeStamp) * 1000 : (tx.block_signed_at ? Date.parse(tx.block_signed_at) : Date.now()))),
    from: tx.from || tx.from_address,
    to: tx.to || tx.to_address,
    tokenSymbol: tx.tokenSymbol || tx.token_symbol,
    tokenName: tx.tokenName || tx.token_name,
    contractAddress: tx.contractAddress || tx.contract_address,
    value: tx.value, // raw value string (wei-like); UI may format later
    decimals: Number(tx.tokenDecimal || tx.token_decimals || 18),
  };
}

// Etherscan: ERC-20 token transfers for an address
async function fetchEtherscanTokenTransfers(address, { page = 1, offset = 50, sort = 'desc', chainId = 1 } = {}) {
  if (!etherscanKey) throw new Error('Missing REACT_APP_ETHERSCAN_KEY');
  // V2 adds chainid parameter; action/module remain for most account queries
  const url = `${ETHERSCAN_API}?chainid=${chainId}&module=account&action=tokentx&address=${address}&page=${page}&offset=${offset}&sort=${sort}&apikey=${etherscanKey}`;
  const json = await fetchJSON(url);
  // V2 may not return classic status/message for all endpoints; be flexible
  const result = json?.result;
  if (Array.isArray(result)) {
    return result.map((tx) => normalizeTokenTx(tx, 'etherscan'));
  }
  if (json.status === '1' || json.message === 'OK') {
    // some responses still return result as array
    return (result || []).map((tx) => normalizeTokenTx(tx, 'etherscan'));
  }
  // Handle "No transactions found" and other messages
  const msg = json?.message || '';
  if (/No transactions/i.test(msg)) return [];
  const detail = typeof result === 'string' ? result : JSON.stringify(result);
  throw new Error(`Etherscan error (V2): ${msg || 'ERROR'}: ${detail}`);
}

// Covalent: token transfers via transactions endpoint (chainId default 1 for Ethereum mainnet)
async function fetchCovalentTokenTransfers(address, { chainId = 1, pageSize = 50 } = {}) {
  if (!covalentKey) throw new Error('Missing REACT_APP_COVALENT_KEY');
  const url = `${COVALENT_BASE}/${chainId}/address/${address}/transfers_v2/?page-size=${pageSize}`;
  const headers = { Authorization: `Bearer ${covalentKey}` };
  const json = await fetchJSON(url, { headers });
  const items = (json?.data?.items) || [];
  // items is array of tx with transfers; flatten
  const flattened = [];
  for (const item of items) {
    const transfers = item.transfers || [];
    for (const t of transfers) {
      flattened.push(normalizeTokenTx({
        tx_hash: item.tx_hash,
        block_signed_at: item.block_signed_at,
        from_address: t.from_address,
        to_address: t.to_address,
        token_symbol: t.contract_ticker_symbol,
        token_name: t.contract_name,
        contract_address: t.contract_address,
        value: t.delta, // already adjusted by decimals? Covalent uses raw; keep as string
        token_decimals: t.contract_decimals,
      }, 'covalent'));
    }
  }
  return flattened;
}

// Public API: fetch token transfers using available provider
export async function fetchTokenTransfers(address, options) {
  if (covalentKey) {
    try {
      return await fetchCovalentTokenTransfers(address, options);
    } catch (e) {
      // fall back to etherscan
      if (etherscanKey) {
        return await fetchEtherscanTokenTransfers(address, options);
      }
      throw e;
    }
  }
  if (etherscanKey) {
    return await fetchEtherscanTokenTransfers(address, options);
  }
  // No keys present: return empty
  return [];
}

export function hasAnyApiKey() {
  return Boolean(covalentKey || etherscanKey);
}
