import yfinance as yf
import pandas_ta as ta
import pandas as pd
import urllib3

import requests

import requests
try:
    from curl_cffi import requests as cffi_requests
except ImportError:
    cffi_requests = None

# Deshabilitar advertencias, por si acaso
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def analyze_symbol(symbol):
    print(f"--- Analizando {symbol} ---")
    result = {"symbol": symbol, "status": "error", "data": None, "signal": "N/A"}
    
    try:
        # Intentar usar curl_cffi session si está disponible
        # y deshabilitar SSL verify
        if cffi_requests:
            print("Using curl_cffi session...")
            session = cffi_requests.Session(impersonate="chrome")
            session.verify = False
            ticker = yf.Ticker(symbol, session=session)
        else:
            print("Using default yfinance session (fallback)...")
            ticker = yf.Ticker(symbol)
            
        df = ticker.history(period="1y", interval="1d")
        
        if df.empty:
            print(f"Error: No se encontraron datos para {symbol} (DataFrame vacío)")
            result["detail"] = "No data found"
            return result

        # Limpieza básica
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Calcular RSI (Relative Strength Index) usa pandas_ta
        df.ta.rsi(length=14, append=True)
        # Calcular SMA 50 y 200
        df.ta.sma(length=50, append=True)
        df.ta.sma(length=200, append=True)

        cols = ['Close', 'RSI_14', 'SMA_50', 'SMA_200']
        existing_cols = [c for c in cols if c in df.columns]
        
        # Guardar últimos 5 registros para retorno
        result["history"] = df[existing_cols].tail().to_dict(orient="records")
        
        latest_price = df['Close'].iloc[-1]
        result["current_price"] = latest_price
        
        if 'RSI_14' in df.columns and not pd.isna(df['RSI_14'].iloc[-1]):
            latest_rsi = df['RSI_14'].iloc[-1]
            result["rsi"] = latest_rsi
            print(f"\nPrecio Actual: {latest_price:.2f}")
            print(f"RSI Actual: {latest_rsi:.2f}")
            
            if latest_rsi < 30:
                result["signal"] = "COMPRA"
                result["signal_desc"] = "Sobreventa"
                print(">> SEÑAL POTENCIAL: COMPRA (Sobreventa)")
            elif latest_rsi > 70:
                print(">> SEÑAL POTENCIAL: VENTA (Sobrecompra)")
                result["signal"] = "VENTA"
                result["signal_desc"] = "Sobrecompra"
            else:
                print(">> SEÑAL: NEUTRA (Mantener)")
                result["signal"] = "NEUTRA"
                result["signal_desc"] = "Mantener"
        else:
             print(f"\nPrecio Actual: {latest_price:.2f} (Insuficientes datos para RSI)")
             result["warning"] = "Insufficient data for RSI"
            
        print("\n")
        result["status"] = "ok"
        return result
        
    except Exception as e:
        print(f"Excepción al descargar {symbol}: {e}")
        result["detail"] = str(e)
        return result

if __name__ == "__main__":
    assets = ["GOOGL", "BTC-USD"]
    for asset in assets:
        analyze_symbol(asset)

