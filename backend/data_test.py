import json
import time
from curl_cffi import requests as cffi_requests

def calculate_sma(prices, period):
    if len(prices) < period:
        return [None] * len(prices)
    sma = []
    for i in range(len(prices)):
        if i < period - 1:
            sma.append(None)
        else:
            window = prices[i - period + 1 : i + 1]
            sma.append(sum(window) / period)
    return sma

def calculate_rsi(prices, period=14):
    if len(prices) < period + 1:
        return [None] * len(prices)
    
    rsi = [None] * len(prices)
    deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
    
    avg_gain = 0
    avg_loss = 0
    
    # First Average
    for i in range(period):
        if deltas[i] > 0:
            avg_gain += deltas[i]
        else:
            avg_loss += abs(deltas[i])
            
    avg_gain /= period
    avg_loss /= period
    
    if avg_loss == 0:
        rsi[period] = 100
    else:
        rs = avg_gain / avg_loss
        rsi[period] = 100 - (100 / (1 + rs))
        
    # Smoothed Average
    for i in range(period + 1, len(prices)):
        delta = deltas[i-1]
        gain = delta if delta > 0 else 0
        loss = abs(delta) if delta < 0 else 0
        
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        
        if avg_loss == 0:
            rsi[i] = 100
        else:
            rs = avg_gain / avg_loss
            rsi[i] = 100 - (100 / (1 + rs))
            
    return rsi

def analyze_symbol(symbol):
    print(f"--- API Fetch: {symbol} ---")
    result = {"symbol": symbol, "status": "error", "data": None, "signal": "N/A"}
    
    # URL directa a la API de Yahoo Finance (JSON)
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1y&interval=1d"
    
    try:
        # Usar curl_cffi para imitar Chrome y evitar bloqueos (incluso sin proxy en la nube ayuda)
        session = cffi_requests.Session(impersonate="chrome")
        session.verify = False 
        
        print(f"Fetching {url}...")
        resp = session.get(url, timeout=10)
        
        if resp.status_code != 200:
            result["detail"] = f"HTTP Error {resp.status_code}"
            return result
            
        data_json = resp.json()
        
        # Parsear la estructura de Yahoo
        try:
            result_block = data_json["chart"]["result"][0]
            timestamps = result_block["timestamp"]
            quotes = result_block["indicators"]["quote"][0]
            closes = quotes["close"]
            opens = quotes.get("open", closes)
            highs = quotes.get("high", closes)
            lows = quotes.get("low", closes)
        except (KeyError, TypeError, IndexError):
            result["detail"] = "Invalid data format from API"
            return result
            
        # Filtrar Nones (días sin trading)
        clean_data = []
        for i in range(len(timestamps)):
            c = closes[i]
            if c is not None:
                # Use closes for missing fields if necessary (fallback)
                o = opens[i] if opens[i] is not None else c
                h = highs[i] if highs[i] is not None else c
                l = lows[i] if lows[i] is not None else c
                clean_data.append({
                    "time": timestamps[i],
                    "open": o,
                    "high": h,
                    "low": l,
                    "close": c
                })
                
        if not clean_data:
            result["detail"] = "No valid data found"
            return result
            
        # Separar para calculos
        times = [x["time"] for x in clean_data]
        prices = [x["close"] for x in clean_data]
        
        # Calcular Indicadores (Pure Python)
        rsi_vals = calculate_rsi(prices)
        sma_50 = calculate_sma(prices, 50)
        sma_200 = calculate_sma(prices, 200)
        
        # Construir historial completo (1 año) para el gráfico
        history = []
        for i in range(len(prices)):
            rec = {
                "time": time.strftime('%Y-%m-%d', time.localtime(times[i])),
                "open": clean_data[i]["open"],
                "high": clean_data[i]["high"],
                "low": clean_data[i]["low"],
                "close": clean_data[i]["close"],
                "rsi": rsi_vals[i],
                "sma_50": sma_50[i],
                "sma_200": sma_200[i],
                "signal": None
            }
            
            # Determinar señal histórica para el gráfico
            if rsi_vals[i] is not None:
                if rsi_vals[i] < 30:
                    rec["signal"] = "BUY"
                elif rsi_vals[i] > 70:
                    rec["signal"] = "SELL"
            
            history.append(rec)
                
        result["history"] = history
        result["current_price"] = prices[-1]
        
        latest_rsi = rsi_vals[-1]
        
        if latest_rsi is not None:
            result["rsi"] = latest_rsi
            result["sma_50"] = sma_50[-1]
            
            # --- Estrategia Texto (Actual) ---
            buy_reasons = []
            sell_reasons = []
            
            # Análisis RSI
            if latest_rsi < 30:
                buy_reasons.append(f"RSI en {latest_rsi:.2f} indica SOBREVENTA (oportunidad de rebote).")
            elif latest_rsi < 40:
                buy_reasons.append(f"RSI bajo ({latest_rsi:.2f}), buscando zona de compra.")
            
            if latest_rsi > 70:
                sell_reasons.append(f"RSI en {latest_rsi:.2f} indica SOBRECOMPRA (posible corrección).")
            elif latest_rsi > 60:
                sell_reasons.append(f"RSI alto ({latest_rsi:.2f}), vigilando para vender.")

            # Análisis Tendencia (SMA 50)
            current_price = prices[-1]
            if sma_50[-1] and current_price > sma_50[-1]:
                buy_reasons.append(f"Precio (${current_price:.2f}) por ENCIMA de SMA-50 (Tendencia Alcista).")
            elif sma_50[-1] and current_price < sma_50[-1]:
                sell_reasons.append(f"Precio (${current_price:.2f}) por DEBAJO de SMA-50 (Tendencia Bajista).")

            result["strategy_buy"] = " | ".join(buy_reasons) if buy_reasons else "Sin señal clara de compra."
            result["strategy_sell"] = " | ".join(sell_reasons) if sell_reasons else "Sin señal clara de venta."

            # Señal Final Simplificada
            if latest_rsi < 30:
                result["signal"] = "COMPRA"
            elif latest_rsi > 70:
                result["signal"] = "VENTA"
            else:
                result["signal"] = "NEUTRA"

        else:
            result["warning"] = "Insufficient data for RSI"
            
        result["status"] = "ok"
        return result
        
    except Exception as e:
        print(f"Exception: {e}")
        result["detail"] = str(e)
        return result

if __name__ == "__main__":
    # Test local sencillo
    print(json.dumps(analyze_symbol("BTC-USD"), indent=2))

