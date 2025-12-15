import json
import time
from datetime import datetime, timedelta
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

def calculate_ema(data, window):
    if len(data) < window:
        return [None] * len(data)
    
    # First value is SMA
    sma_initial = sum(data[:window]) / window
    ema = [None] * (window - 1) + [sma_initial]
    
    multiplier = 2 / (window + 1)
    
    for i in range(window, len(data)):
        val = (data[i] - ema[-1]) * multiplier + ema[-1]
        ema.append(val)
    
    return ema

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
            volumes = quotes.get("volume", [0] * len(closes))
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
                    "close": c,
                    "volume": volumes[i] if volumes[i] is not None else 0
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
        ema_200 = calculate_ema(prices, 200)
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
                "volume": clean_data[i]["volume"],
                "rsi": rsi_vals[i],
                "sma_50": sma_50[i],
                "ema_200": ema_200[i],
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

        # --- PROYECCIÓN A FUTURO (5 Días) ---
        # Proyectamos las bandas para visualizar posibles movimientos
        last_time = times[-1]
        
        # Calcular pendiente de la media (Tendencia de corto plazo)
        slope_sma = 0
        if sma_20[-1] and sma_20[-5]:
            slope_sma = (sma_20[-1] - sma_20[-5]) / 5
            
        # Calcular ancho actual de bandas (Volatilidad)
        last_width = 0
        if upper_band[-1] and lower_band[-1]:
            last_width = upper_band[-1] - lower_band[-1]
            
        last_sma_val = sma_20[-1] if sma_20[-1] else prices[-1]

        # Generar 5 puntos futuros
        for i in range(1, 6):
            future_time = last_time + (i * 86400) # +1 día en segundos
            
            # Proyección lineal simple
            proj_sma = last_sma_val + (slope_sma * i)
            proj_upper = proj_sma + (last_width / 2)
            proj_lower = proj_sma - (last_width / 2)
            
            # Formato de fecha
            date_str = time.strftime('%Y-%m-%d', time.localtime(future_time))
            
            # Añadir entry "fantasma" solo con indicadores
            history.append({
                "time": date_str,
                "open": None,
                "high": None,
                "low": None,
                "close": None,
                "volume": 0,
                "rsi": None,
                "sma_50": None, # Podríamos proyectar también, pero dejemos solo bandas por hoy
                "ema_200": None,
                "upper_band": proj_upper,
                "lower_band": proj_lower,
                "signal": None,
                "is_projection": True # Flag para frontend
            })

        result["history"] = history
        result["current_price"] = prices[-1]
        
        latest_rsi = rsi_vals[-1]
        
        if latest_rsi is not None:
            result["rsi"] = rsi_vals[-1]
            result["sma_50"] = sma_50[-1]
            result["ema_200"] = ema_200[-1] if ema_200[-1] else 0
            result["upper_band"] = upper_band[-1]
            
            # --- Lógica Avanzada de Precios Objetivo (Trade Setup) ---
            current_price = prices[-1]
            
            trend = "NEUTRAL"
            if sma_50[-1]:
                if current_price > sma_50[-1]:
                    trend = "BULLISH" # Alcista
                else:
                    trend = "BEARISH" # Bajista

            # Definir niveles clave
            curr_lower = lower_band[-1] if lower_band[-1] else current_price * 0.95
            curr_upper = upper_band[-1] if upper_band[-1] else current_price * 1.05
            curr_sma50 = sma_50[-1] if sma_50[-1] else current_price

            target_entry = 0.0
            stop_loss = 0.0
            take_profit = 0.0
            recommendation = ""
            analysis_text = ""

            if trend == "BULLISH":
                # En tendencia alcista, buscamos comprar en retrocesos (Soportes: SMA50 o Banda Inferior)
                # El mejor soporte dinámico suele ser la SMA50 o la Banda Inferior, lo que esté más cerca por debajo.
                support_level = max(curr_sma50, curr_lower)
                
                if current_price <= support_level * 1.02: # Estamos cerca del soporte
                   target_entry = current_price # Entrar YA
                   recommendation = "COMPRAR AHORA"
                   analysis_text = f"✅ **ACTUALIDAD:** TENDENCIA ALCISTA SÓLIDA.\n\nEl precio está rebotando en una zona clave (cerca de ${support_level:.2f}). Es el momento ideal para subirte a la tendencia."
                else:
                   target_entry = support_level # Esperar retroceso
                   recommendation = "ESPERAR RETROCESO"
                   analysis_text = f"⏳ **ACTUALIDAD:** ALCISTA PERO EXTENDIDA.\n\nLa acción es fuerte, pero ${current_price:.2f} es un poco caro para entrar ya. \n\n👉 **LA JUGADA:** Ten paciencia. Pon una orden de compra en **${target_entry:.2f}** (tu 'suelo' de seguridad). Si el precio cae ahí, compras barato."

                stop_loss = target_entry * 0.96 # 4% de riesgo
                take_profit = curr_upper # Vender en el techo (Banda Superior)

            else: # BEARISH
                # En tendencia bajista, comprar es riesgoso (Contra-tendencia / Rebote)
                if current_price <= curr_lower * 1.01: # Toca banda inferior
                     target_entry = current_price
                     recommendation = "REBOTE RIESGOSO"
                     analysis_text = f"⚠️ **ACTUALIDAD:** TENDENCIA BAJISTA.\n\nEl precio ha caído mucho y ha tocado el suelo estadístico (${curr_lower:.2f}). Podría haber un rebote rápido ('Gato Muerto'). \n\n👉 **SOLO PARA VALIENTES:** Compra buscando un rebote corto."
                     
                     stop_loss = current_price * 0.97
                     take_profit = curr_sma50 # El techo suele ser la media
                else:
                     target_entry = curr_lower
                     recommendation = "NO TOCAR / VENTA"
                     analysis_text = f"⛔ **ACTUALIDAD:** TENDENCIA BAJISTA.\n\nEl precio sigue cayendo ($309) y está lejos de tocar fondo. \n\n👉 **CONSEJO:** No intentes adivinar el piso. Si tienes acciones, considera salir en rebotes. Si quieres comprar, espera a que toque **${target_entry:.2f}**."
                     
                     stop_loss = target_entry * 0.95
                     take_profit = curr_sma50

            # Formateo final
            result["trade_setup"] = {
                "recommendation": recommendation,
                "target_entry": target_entry,
                "stop_loss": stop_loss,
                "take_profit": take_profit,
                "analysis": analysis_text
            }
            
            # Mantener compatibilidad con frontend anterior por si acaso
            result["strategy_buy"] = analysis_text
            result["strategy_sell"] = f"Meta de Salida: ${take_profit:.2f} | Stop Loss: ${stop_loss:.2f}"

            # Señal Visual Simplificada Final
            if "COMPRAR" in recommendation or recommendation == "REBOTE RIESGOSO":
                result["signal"] = "COMPRA"
            elif "VENTA" in recommendation:
                result["signal"] = "VENTA"
            else:
                result["signal"] = "ESPERA" # Nueva señal neutral activa

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

