from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from data_test import analyze_symbol

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Trade Dashboard API is running"}

@app.get("/analyze/{symbol}")
def get_analysis(symbol: str):
    data = analyze_symbol(symbol)
    return data
