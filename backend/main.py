from fastapi import FastAPI
from data_test import analyze_symbol

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Trade Dashboard API is running"}

@app.get("/analyze/{symbol}")
def get_analysis(symbol: str):
    data = analyze_symbol(symbol)
    return data
