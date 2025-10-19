
import { useMemo, useState } from 'react';
import { fetchTokenTransfers, hasAnyApiKey } from './services/onchain';

function formatAmount(raw, decimals) {
  try {
    const d = Number(decimals || 18);
    if (!raw) return '0';
    const neg = String(raw).startsWith('-');
    const s = String(raw).replace('-', '');
    const pad = s.padStart(d + 1, '0');
    const int = pad.slice(0, pad.length - d);
    const frac = pad.slice(-d).replace(/0+$/, '');
    const val = frac ? `${int}.${frac}` : int;
    return neg ? `-${val}` : val;
  } catch {
    return String(raw);
  }
}

export default function App() {
  const [addressInput, setAddressInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem('watchlist');
    return saved ? JSON.parse(saved) : [];
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasKeys = useMemo(() => hasAnyApiKey(), []);

  const addAddress = () => {
    const addr = addressInput.trim();
    if (!addr) return;
    const lbl = labelInput.trim();
    const next = [...watchlist, { address: addr, label: lbl }];
    setWatchlist(next);
    localStorage.setItem('watchlist', JSON.stringify(next));
    setAddressInput('');
    setLabelInput('');
  };

  const removeItem = (idx) => {
    const next = watchlist.filter((_, i) => i !== idx);
    setWatchlist(next);
    localStorage.setItem('watchlist', JSON.stringify(next));
  };

  const loadTransfers = async () => {
    setError('');
    setLoading(true);
    setRows([]);
    try {
      const out = [];
      for (const item of watchlist) {
        const txs = await fetchTokenTransfers(item.address, { offset: 50 });
        for (const tx of txs) {
          const fromLc = (tx.from || '').toLowerCase();
          const toLc = (tx.to || '').toLowerCase();
          const addrLc = item.address.toLowerCase();
          const direction = fromLc === addrLc ? 'OUT' : (toLc === addrLc ? 'IN' : 'OTHER');
          out.push({
            owner: item,
            ...tx,
            direction,
          });
        }
      }
      // sort by time desc
      out.sort((a, b) => b.time - a.time);
      setRows(out);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ margin: 0 }}>On-Chain Watch</h1>
      <p style={{ color: '#555', marginTop: 4 }}>
        指定したウォレットアドレスのトークン移動（ERC‑20）を取得・表示します。関連性はユーザー自身で検証してください。違法行為を断定・主張するものではありません。
      </p>

      {!hasKeys && (
        <div style={{ background: '#fff4e5', border: '1px solid #ffd39b', padding: 12, borderRadius: 6, margin: '12px 0' }}>
          APIキーが設定されていません。`.env` に `REACT_APP_ETHERSCAN_KEY` または `REACT_APP_COVALENT_KEY` を設定するとデータを取得できます。
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          style={{ padding: 8, minWidth: 320 }}
          placeholder="ウォレットアドレス (0x...)"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
        />
        <input
          style={{ padding: 8, minWidth: 200 }}
          placeholder="ラベル (任意)"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
        />
        <button onClick={addAddress} disabled={!addressInput.trim()} style={{ padding: '8px 12px' }}>追加</button>
        <button onClick={loadTransfers} disabled={watchlist.length === 0 || loading} style={{ padding: '8px 12px' }}>
          {loading ? '読み込み中...' : '最新のトランスファーを取得'}
        </button>
      </div>

      {watchlist.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>ウォッチリスト</strong>
          <ul>
            {watchlist.map((w, i) => (
              <li key={`${w.address}-${i}`}>
                <code>{w.address}</code>{w.label ? ` — ${w.label}` : ''}
                <button style={{ marginLeft: 8 }} onClick={() => removeItem(i)}>削除</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div style={{ color: '#b00020', marginTop: 12 }}>エラー: {error}</div>
      )}

      <div style={{ marginTop: 16 }}>
        {rows.length > 0 ? (
          <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th>時刻</th>
                <th>方向</th>
                <th>トークン</th>
                <th>数量</th>
                <th>相手先</th>
                <th>元/宛</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const amount = formatAmount(r.value || '0', r.decimals);
                const counterparty = r.direction === 'OUT' ? r.to : (r.direction === 'IN' ? r.from : '');
                const link = `https://etherscan.io/tx/${r.hash}`;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td>{r.time.toLocaleString()}</td>
                    <td>{r.direction}</td>
                    <td>{r.tokenSymbol || r.tokenName || '-'}</td>
                    <td>{amount}</td>
                    <td><code>{counterparty}</code></td>
                    <td>{r.owner.label ? `${r.owner.label}` : ''}</td>
                    <td><a href={link} target="_blank" rel="noreferrer">{r.hash?.slice(0, 10)}...</a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#666' }}>データはまだありません。ウォレットを追加し、取得ボタンを押してください。</p>
        )}
      </div>
    </div>
  );
}
