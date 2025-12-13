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

def calculate_std_dev(prices, period, sma_values):
    if len(prices) < period:
        return [None] * len(prices)
    std_devs = [None] * len(prices)
    for i in range(period - 1, len(prices)):
        window = prices[i - period + 1 : i + 1]
        mean = sma_values[i]
        if mean is None: 
            continue
        variance = sum([(p - mean) ** 2 for p in window]) / period
        std_devs[i] = variance ** 0.5
    return std_devs

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
        # Bollinger Bands (20 periods, 2 std dev)
        sma_20 = calculate_sma(prices, 20)
        std_devs = calculate_std_dev(prices, 20, sma_20)
        
        upper_band = []
        lower_band = []
        for i in range(len(prices)):
            if sma_20[i] is not None and std_devs[i] is not None:
                upper_band.append(sma_20[i] + (2 * std_devs[i]))
                lower_band.append(sma_20[i] - (2 * std_devs[i]))
            else:
                upper_band.append(None)
                lower_band.append(None)
        
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
                "upper_band": upper_band[i],
                "lower_band": lower_band[i],
                "signal": None
            }
            
            # Determinar señal combinada (RSI + Bollinger)
            # Compra fuerte: RSI < 40 Y Precio toca banda inferior
            # Venta fuerte: RSI > 60 Y Precio toca banda superior
            price = prices[i]
            if rsi_vals[i] is not None and upper_band[i] is not None:
                if rsi_vals[i] < 40 and price <= lower_band[i] * 1.02: # Margen del 2%
                    rec["signal"] = "BUY"
                elif rsi_vals[i] > 60 and price >= upper_band[i] * 0.98: # Margen del 2%
                    rec["signal"] = "SELL"
            
            history.append(rec)
                
        result["history"] = history
        result["current_price"] = prices[-1]
        
        latest_rsi = rsi_vals[-1]
        
        if latest_rsi is not None:
            result["rsi"] = latest_rsi
            result["sma_50"] = sma_50[-1]
            
            # --- Estrategia para Principiantes (Lenguaje Natural Mejorado) ---
            buy_reasons = []
            sell_reasons = []
            
            curr_price = prices[-1]
            curr_lower = lower_band[-1]
            curr_upper = upper_band[-1]

            # Análisis Bollinger
            if curr_lower and curr_price <= curr_lower * 1.01:
                buy_reasons.append("¡Precio REBOTANDO en el soporte! El precio ha tocado la 'Banda Inferior', lo que estadísticamente sugiere que está demasiado barato y debería subir.")
            
            if curr_upper and curr_price >= curr_upper * 0.99:
                sell_reasons.append("¡Techo Alcanzado! El precio está chocando con la 'Banda Superior'. Es difícil que suba más sin descansar antes.")

            # Análisis RSI
            if latest_rsi < 35:
                buy_reasons.append("Además, el momentum indica que todo el mundo ha vendido demasiado (Sobreventa).")
            elif latest_rsi > 65:
                sell_reasons.append("Además, hay euforia en el mercado (Sobrecompra), lo cual es peligroso.")
            
            # Decisión Final Combinada
            if not buy_reasons and not sell_reasons:
                 # Si no hay extremos, mirar tendencia
                 if sma_50[-1] and curr_price > sma_50[-1]:
                     buy_reasons.append("Estamos en zona 'segura' y tendencia alcista, pero no es el punto más bajo. Puedes comprar, pero con precaución.")
                 else:
                     sell_reasons.append("Tendencia bajista y sin señales de reversión claras. Mejor esperar.")

            result["strategy_buy"] = " ".join(buy_reasons) 
            result["strategy_sell"] = " ".join(sell_reasons)
            
            # Señal Visual Simplificada Final
            if "soporte" in result["strategy_buy"] or latest_rsi < 35:
                result["signal"] = "COMPRA"
            elif "Techo" in result["strategy_sell"] or latest_rsi > 65:
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

