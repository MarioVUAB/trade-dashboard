import { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, RefreshCw, AlertCircle, DollarSign, BarChart3, Info } from 'lucide-react';
import './App.css';

const API_URL = 'https://trade-dashboard-nu.vercel.app';
const SYMBOLS = ['BTC-USD', 'ETH-USD', 'SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA'];

interface AnalysisResult {
  symbol: string;
  current_price: number;
  rsi: number;
  sma_50: number;
  signal: 'BUY' | 'SELL' | 'HOLD' | 'COMPRA' | 'VENTA' | 'NEUTRA';
  strategy_buy?: string;
  strategy_sell?: string;
  error?: string;
}

function App() {
  const [data, setData] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const results: AnalysisResult[] = [];

    for (const symbol of SYMBOLS) {
      try {
        const response = await fetch(`${API_URL}/analyze/${symbol}`);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const jsonData = await response.json();
        // Ensure symbol is in the data, or add it
        results.push({ ...jsonData, symbol });
      } catch (err) {
        console.error(`Error fetching ${symbol}:`, err);
        results.push({
          symbol,
          current_price: 0,
          rsi: 0,
          sma_50: 0,
          signal: 'HOLD',
          error: 'Failed to fetch'
        });
      }
    }
    setData(results);
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getSignalColor = (signal: string) => {
    if (['BUY', 'COMPRA'].includes(signal)) return 'var(--success)';
    if (['SELL', 'VENTA'].includes(signal)) return 'var(--danger)';
    return 'var(--text-secondary)';
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="logo-section">
          <Activity size={32} color="var(--accent-primary)" />
          <h1>TradeDASH</h1>
        </div>
        <div className="controls-section">
          {lastUpdated && (
            <span className="last-updated">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            className="refresh-btn"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw size={20} className={loading ? 'spin' : ''} />
            {loading ? 'Scanning...' : 'Refresh'}
          </button>
        </div>
      </header>

      <main className="dashboard-grid">
        {data.map((item) => (
          <div key={item.symbol} className="asset-card" style={{ borderColor: item.error ? 'var(--danger)' : 'transparent' }}>
            <div className="card-header">
              <h3>{item.symbol}</h3>
              {['BUY', 'COMPRA'].includes(item.signal) && <TrendingUp color="var(--success)" />}
              {['SELL', 'VENTA'].includes(item.signal) && <TrendingDown color="var(--danger)" />}
              {['HOLD', 'NEUTRA'].includes(item.signal) && <Activity color="var(--text-secondary)" />}
            </div>

            {item.error ? (
              <div className="error-message">
                <AlertCircle size={16} />
                <span>{item.error}</span>
              </div>
            ) : (
              <div className="card-body">
                <div className="metric">
                  <span className="label"><DollarSign size={14} /> Price</span>
                  <span className="value">${item.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="metric">
                  <span className="label"><BarChart3 size={14} /> RSI</span>
                  <span className="value" style={{
                    color: item.rsi > 70 ? 'var(--danger)' : item.rsi < 30 ? 'var(--success)' : 'inherit'
                  }}>
                    {item.rsi?.toFixed(2)}
                  </span>
                </div>
                <div className="metric">
                  <span className="label">SMA 50</span>
                  <span className="value">${item.sma_50?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="signal-badge" style={{ backgroundColor: getSignalColor(item.signal) }}>
                  {item.signal}
                </div>

                <div className="strategy-box">
                  <div className="strategy-item">
                    <span className="strategy-label buy">Strategy Buy:</span>
                    <p className="strategy-desc">{item.strategy_buy || 'No setups found'}</p>
                  </div>
                  <div className="strategy-item">
                    <span className="strategy-label sell">Strategy Sell:</span>
                    <p className="strategy-desc">{item.strategy_sell || 'No setups found'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;
