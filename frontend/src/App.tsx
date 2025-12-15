import { useState, useEffect } from 'react';
import { Activity, RefreshCw, Search, Plus, X, LineChart, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { ChartComponent } from './ChartComponent';
import './App.css';

const API_URL = 'https://trade-dashboard-nu.vercel.app';
// const API_URL = 'http://localhost:8000'; // Backend local CON volumen
const DEFAULT_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA'];

interface AnalysisResult {
  symbol: string;
  current_price: number;
  rsi: number;
  sma_50: number;
  signal: 'BUY' | 'SELL' | 'HOLD' | 'COMPRA' | 'VENTA' | 'NEUTRA' | 'ESPERA';
  strategy_buy?: string;
  strategy_sell?: string;
  history?: any[];
  error?: string;
  trade_setup?: {
    recommendation: string;
    target_entry: number;
    stop_loss: number;
    take_profit: number;
    analysis: string;
  };
  news?: {
    title: string;
    publisher: string;
    link: string;
    time: number;
  }[];
  recommendations?: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  };
}

function getExpertAnalysis(asset: AnalysisResult) {
  // Si ya viene del backend, lo usamos (pero priorizamos simplicidad si el usuario quiere)
  // Para asegurar "palabras simples", recalculamos aquí.

  if (!asset.history || asset.history.length === 0) return null;

  const last = asset.history[asset.history.length - 1];
  const price = asset.current_price;
  const sma = asset.sma_50 || last.sma_50 || price;
  const ema200 = last.ema_200 || sma; // Fallback to SMA if EMA200 not ready
  const upper = last.upper_band || price * 1.05;
  const lower = last.lower_band || price * 0.95;
  const rsi = asset.rsi;
  const volume = last.volume || 0;

  // 1. Determinar Tendencia
  const isBullish = price > sma;
  const isMacroBullish = price > ema200;
  const trendText = isBullish ? "ALCISTA (Corto Plazo)" : "BAJISTA (Corto Plazo)";
  const macroText = isMacroBullish ? "ALCISTA (Largo Plazo)" : "BAJISTA (Largo Plazo)";

  let recommendation = "";
  let color = ""; // success, danger, warning
  let analysis = "";
  let target = 0;
  let stop = 0;
  let profit = 0;

  if (isBullish) {
    // Tendencia Subiendo
    const support = Math.max(sma, lower);
    const distanceToSupport = (price - support) / price;

    if (distanceToSupport <= 0.02) {
      // Estamos cerca del soporte (zona barata)
      recommendation = "¡COMPRAR AHORA!";
      color = "var(--success)"; // Verde
      target = price;
      stop = support * 0.97; // 3% abajo del soporte
      profit = upper;
      analysis = `✅ **Momento Ideal:** La acción está subiendo y el volumen (${(volume / 1000).toFixed(0)}k) respalda el movimiento.\n\nTrend Macro: ${macroText}. Es un excelente momento para entrar.`;
    } else if (rsi > 70) { // RSI alto (Sobrecompra)
      recommendation = "NO COMPRES, ESTÁ CARA";
      color = "var(--danger)"; // Rojo
      target = support;
      stop = support * 0.97;
      profit = upper * 1.05;
      analysis = `⚠️ **Peligro:** Todo el mundo está comprando (RSI: ${rsi.toFixed(1)}) y el precio ha subido demasiado rápido. Es probable que caiga pronto.\n\nAunque la tendencia macro es ${macroText}, es probable que caiga pronto.`;
    } else {
      // En medio
      recommendation = "ESPERAR RETROCESO";
      color = "#fbbf24"; // Amarillo
      target = support;
      stop = support * 0.97;
      profit = upper;
      analysis = `⏳ **Paciencia:** La tendencia a corto plazo es buena, pero el precio actual ($${price.toFixed(2)}) no es el mejor.\n\nTrend Macro: ${macroText}. Lo inteligente es esperar un pequeño bajón.`;
    }
  } else {
    // Tendencia Bajando
    // En bajada, solo buscamos "rebotes" extremos (RSI muy bajo o tocando banda inferior)
    if (price <= lower * 1.01 || rsi < 30) {
      recommendation = "REBOTE RIESGOSO (OPCIONAL)";
      color = "#fbbf24"; // Amarillo
      target = price;
      stop = price * 0.95;
      profit = sma; // Solo hasta la media
      analysis = `😮 **Oportunidad Agresiva:** Ha caído tanto que podría tener un "rebote de gato muerto".\n\nTrend Macro: ${macroText}. Solo para expertos: Compra rápida y salte si no sube.`;
    } else {
      recommendation = "NO COMPRAR / VENDER";
      color = "var(--danger)"; // Rojo
      target = lower;
      stop = lower * 0.95;
      profit = sma;
      analysis = `⛔ **Cuidado:** La acción está perdiendo valor con volumen de ${(volume / 1000).toFixed(0)}k.\n\nTrend Macro: ${macroText}. Mejor mira otra cosa por ahora.`;
    }
  }

  return {
    recommendation,
    target_entry: target,
    stop_loss: stop,
    take_profit: profit,
    analysis,
    color,
    trend: trendText,
    volume: volume
  };
}

function App() {
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [data, setData] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Asset for Detail View
  const [timeframe, setTimeframe] = useState('1d');
  const [selectedAsset, setSelectedAsset] = useState<AnalysisResult | null>(null);

  // Function to fetch a single asset (used when changing timeframe)
  const fetchSingleAsset = async (symbol: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/analyze/${symbol}?interval=${timeframe}`);
      if (!response.ok) throw new Error('Network error');
      const jsonData = await response.json();
      const newResult = { ...jsonData, symbol };

      // Update in list
      setData(prev => prev.map(item => item.symbol === symbol ? newResult : item));
      setSelectedAsset(newResult);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedAsset) {
      fetchSingleAsset(selectedAsset.symbol);
    }
  }, [timeframe]);


  const fetchData = async (symbolList: string[]) => {
    setLoading(true);
    const results: AnalysisResult[] = [];

    const fetchItem = async (symbol: string) => {
      try {
        const response = await fetch(`${API_URL}/analyze/${symbol}?interval=${timeframe}`);
        if (!response.ok) throw new Error('Network error');
        const jsonData = await response.json();
        return { ...jsonData, symbol };
      } catch (err) {
        console.error(`Error fetching ${symbol}:`, err);
        results.push({
          symbol,
          current_price: 0,
          rsi: 0,
          sma_50: 0,
          signal: 'HOLD',
          error: 'Failed to fetch'
        } as unknown as AnalysisResult); // Cast for safety
      }
    }

    // Execute sequentially to be nice to API
    for (const sym of symbolList) {
      const res = await fetchItem(sym);
      if (res) results.push(res);
    }

    setData(results);

    if (selectedAsset) {
      const updated = results.find(r => r.symbol === selectedAsset.symbol);
      if (updated) setSelectedAsset(updated);
    }

    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchData(symbols);
  }, []); // Run once on mount

  const handleAddSymbol = () => {
    if (!searchTerm) return;
    const cleanSymbol = searchTerm.toUpperCase().trim();
    if (!symbols.includes(cleanSymbol)) {
      const newSymbols = [...symbols, cleanSymbol];
      setSymbols(newSymbols);
      fetchData(newSymbols); // Refresh with new symbol
      setSearchTerm('');
    }
  };

  const handleRemoveSymbol = (e: React.MouseEvent, symbolToRemove: string) => {
    e.stopPropagation();
    const newSymbols = symbols.filter(s => s !== symbolToRemove);
    setSymbols(newSymbols);
    setData(data.filter(d => d.symbol !== symbolToRemove));
    if (selectedAsset?.symbol === symbolToRemove) {
      setSelectedAsset(null);
    }
  };

  const getSignalColor = (signal: string) => {
    if (['BUY', 'COMPRA'].includes(signal)) return 'var(--success)';
    if (['SELL', 'VENTA'].includes(signal)) return 'var(--danger)';
    return 'var(--text-secondary)';
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Activity size={24} color="var(--accent-primary)" />
          <h2>TradeDASH</h2>
        </div>

        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Add Symbol (e.g. AMD)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
          />
          <button onClick={handleAddSymbol} className="add-btn">
            <Plus size={18} />
          </button>
        </div>

        <div className="watchlist-title">
          <span>Watchlist</span>
          <button onClick={() => fetchData(symbols)} disabled={loading} className="refresh-mini">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>

        <div className="watchlist">
          {data.map(item => {
            const analysis = getExpertAnalysis(item);
            // Simplificar señal para la lista
            let badgeIcon = <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#555' }} />;
            let badgeColor = '#555';
            let shortSignal = '...';

            if (analysis) {
              // Correct logic: Only buy if it says COMPRAR and NOT "NO COMPRAR"
              const isBuy = (analysis.recommendation.includes('COMPRAR') && !analysis.recommendation.includes('NO')) || analysis.recommendation.includes('REBOTE');

              if (isBuy) {
                badgeIcon = <TrendingUp size={16} />;
                badgeColor = 'var(--success)';
                shortSignal = 'COMPRA';
              } else if (analysis.recommendation.includes('NO') || analysis.recommendation.includes('VENTA')) {
                badgeIcon = <TrendingDown size={16} />;
                badgeColor = 'var(--danger)';
                shortSignal = 'VENTA';
              } else {
                badgeIcon = <Clock size={16} />;
                badgeColor = '#fbbf24'; // Warning
                shortSignal = 'ESPERA';
              }
            }

            return (
              <div
                key={item.symbol}
                className={`watchlist-item ${selectedAsset?.symbol === item.symbol ? 'active' : ''}`}
                onClick={() => setSelectedAsset(item)}
              >
                <div className="wl-info">
                  <span className="wl-symbol">{item.symbol}</span>
                  <span className="wl-price">
                    {item.current_price ? `$${item.current_price.toFixed(2)}` : '...'}
                  </span>
                </div>
                <div className="wl-meta">
                  <div
                    className="wl-signal"
                    style={{
                      color: badgeColor,
                      background: `${badgeColor}20`, // 20 hex opacity
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '6px'
                    }}
                    title={analysis ? analysis.trend : 'Cargando...'}
                  >
                    {badgeIcon}
                    <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>{shortSignal}</span>
                  </div>
                  <button className="remove-btn" onClick={(e) => handleRemoveSymbol(e, item.symbol)}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {selectedAsset ? (
          <div className="detail-view">
            <header className="detail-header">
              <div>
                <h1>{selectedAsset.symbol}</h1>
                <span className="header-price">
                  ${selectedAsset.current_price?.toLocaleString()}
                </span>
                <span className="last-updated-text">
                  Updated: {lastUpdated?.toLocaleTimeString()}
                </span>

                {/* Timeframe Selector */}
                <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
                  {[{ id: '1d', label: '1D' }, { id: '1wk', label: '1S' }, { id: '1mo', label: '1M' }].map((tf) => (
                    <button
                      key={tf.id}
                      onClick={() => setTimeframe(tf.id)}
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: timeframe === tf.id ? 'var(--accent-primary)' : 'transparent',
                        color: timeframe === tf.id ? 'white' : '#9ca3af',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        transition: 'all 0.2s',
                        fontWeight: '600'
                      }}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="header-badges">
                <div className="badge-large" style={{ backgroundColor: getSignalColor(selectedAsset.signal) }}>
                  {selectedAsset.signal}
                </div>
              </div>
            </header>

            <div className="chart-container-wrapper">
              {selectedAsset.history && selectedAsset.history.length > 0 ? (
                <ChartComponent
                  data={selectedAsset.history}
                  colors={{
                    lineColor: ['BUY', 'COMPRA'].includes(selectedAsset.signal) ? '#10b981' :
                      ['SELL', 'VENTA'].includes(selectedAsset.signal) ? '#ef4444' : '#a1a1aa',
                    areaTopColor: ['BUY', 'COMPRA'].includes(selectedAsset.signal) ? '#10b981' :
                      ['SELL', 'VENTA'].includes(selectedAsset.signal) ? '#ef4444' : '#a1a1aa',
                  }}
                />
              ) : (
                <div className="no-data-chart">
                  <LineChart size={48} />
                  <p>No historical data available</p>
                </div>
              )}
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">RSI (14)</span>
                <span className="stat-value" style={{
                  color: selectedAsset.rsi > 70 ? 'var(--danger)' : selectedAsset.rsi < 30 ? 'var(--success)' : 'inherit'
                }}>
                  {selectedAsset.rsi?.toFixed(2)}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">SMA 50</span>
                <span className="stat-value">${selectedAsset.sma_50?.toLocaleString()}</span>
              </div>
            </div>

            <div className="strategy-detail-box">
              {(() => {
                const analysis = getExpertAnalysis(selectedAsset);
                if (!analysis) return (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                    <p>No hay suficientes datos históricos para generar una recomendación confiable.</p>
                  </div>
                );

                return (
                  <>
                    <div className="trade-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>ANÁLISIS DE EXPERTO</h3>
                        <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Tendencia: <strong style={{ color: 'white' }}>{analysis.trend}</strong></span>
                      </div>
                      <div style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        backgroundColor: analysis.color,
                        color: analysis.color === '#fbbf24' ? 'black' : 'white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}>
                        {analysis.recommendation}
                      </div>
                    </div>

                    <div className="trade-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                      <div className="stat-card" style={{ borderColor: 'var(--accent-primary)', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                        <span className="stat-label" style={{ color: '#9ca3af' }}>PRECIO ENTRADA IDEAL</span>
                        <span className="stat-value" style={{ color: 'var(--accent-primary)', fontSize: '1.2rem' }}>
                          ${analysis.target_entry.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="stat-card" style={{ borderColor: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                        <span className="stat-label" style={{ color: '#9ca3af' }}>STOP LOSS</span>
                        <span className="stat-value" style={{ color: 'var(--danger)', fontSize: '1.2rem' }}>
                          ${analysis.stop_loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="stat-card" style={{ borderColor: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
                        <span className="stat-label" style={{ color: '#9ca3af' }}>OBJETIVO</span>
                        <span className="stat-value" style={{ color: 'var(--success)', fontSize: '1.2rem' }}>
                          ${analysis.take_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="stat-card" style={{ borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.05)' }}>
                        <span className="stat-label" style={{ color: '#9ca3af' }}>VOLUMEN (Hoy)</span>
                        <span className="stat-value" style={{ color: '#8b5cf6', fontSize: '1.2rem' }}>
                          {(analysis.volume > 0) ? (analysis.volume > 1000000 ? (analysis.volume / 1000000).toFixed(1) + 'M' : (analysis.volume / 1000).toFixed(1) + 'K') : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="analysis-text" style={{
                      lineHeight: '1.6',
                      color: '#e5e7eb',
                      fontSize: '1rem',
                      whiteSpace: 'pre-line',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      padding: '1.5rem',
                      borderRadius: '0.75rem',
                      borderLeft: `5px solid ${analysis.color}`
                    }}>
                      {analysis.analysis}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* INSTITUTIONAL RATINGS SECTION */}
            {selectedAsset.recommendations && (
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', color: '#e5e7eb' }}>
                  OPINIÓN INSTITUCIONAL (WALL STREET)
                </h3>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px' }}>
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#d1d5db' }}>
                    Consenso de Analistas
                  </div>
                  <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '0.75rem', background: '#333' }}>
                    {(() => {
                      const r = selectedAsset.recommendations;
                      if (!r) return null;
                      const total = (r.strongBuy + r.buy + r.hold + r.sell + r.strongSell) || 1;
                      return (
                        <>
                          <div style={{ width: `${(r.strongBuy / total) * 100}%`, background: '#15803d' }} title={`Strong Buy: ${r.strongBuy}`} />
                          <div style={{ width: `${(r.buy / total) * 100}%`, background: '#22c55e' }} title={`Buy: ${r.buy}`} />
                          <div style={{ width: `${(r.hold / total) * 100}%`, background: '#eab308' }} title={`Hold: ${r.hold}`} />
                          <div style={{ width: `${(r.sell / total) * 100}%`, background: '#f97316' }} title={`Sell: ${r.sell}`} />
                          <div style={{ width: `${(r.strongSell / total) * 100}%`, background: '#ef4444' }} title={`Strong Sell: ${r.strongSell}`} />
                        </>
                      )
                    })()}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: '#22c55e' }}>● Comprar</span>
                      <span style={{ color: '#eab308' }}>● Mantener</span>
                      <span style={{ color: '#ef4444' }}>● Vender</span>
                    </div>
                    <span>Total Analistas: {(selectedAsset.recommendations.strongBuy + selectedAsset.recommendations.buy + selectedAsset.recommendations.hold + selectedAsset.recommendations.sell + selectedAsset.recommendations.strongSell)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* NEWS SECTION */}
            {selectedAsset.news && selectedAsset.news.length > 0 && (
              <div style={{ marginTop: '2rem', paddingBottom: '3rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', color: '#e5e7eb' }}>
                  NOTICIAS RELACIONADAS
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedAsset.news.map((n, i) => (
                    <a key={i} href={n.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '1rem',
                        borderRadius: '8px',
                        borderLeft: '4px solid var(--accent-primary)',
                        transition: 'background 0.2s',
                        cursor: 'pointer'
                      }}
                      >
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: '500', color: '#f3f4f6' }}>{n.title}</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280' }}>
                          <span>{n.publisher}</span>
                          <span>{new Date(n.time * 1000).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}


          </div>
        ) : (
          <div className="empty-state">
            <Activity size={64} color="var(--border-color)" />
            <h2>Select an asset to view details</h2>
            <p>Choose from the watchlist or add a new symbol.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
