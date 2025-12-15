from curl_cffi import requests as cffi_requests
import json

def test_fundamentals(symbol="AAPL"):
    session = cffi_requests.Session(impersonate="chrome")
    session.verify = False
    
    url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}?modules=incomeStatementHistory,quarterlyIncomeStatementHistory,balanceSheetHistory,quarterlyBalanceSheetHistory,defaultKeyStatistics"
    
    print(f"Fetching {url}...")
    try:
        resp = session.get(url, timeout=10)
        print(f"Status Code: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            result = data.get("quoteSummary", {}).get("result", [])
            
            if not result:
                print("Error: 'result' list is empty.")
                return

            res0 = result[0]
            
            # Check keys
            print("Keys found in result:", res0.keys())
            
            inc = res0.get("incomeStatementHistory", {}).get("incomeStatementHistory", [])
            bal = res0.get("balanceSheetHistory", {}).get("balanceSheetHistory", [])
            stats = res0.get("defaultKeyStatistics", {})
            
            print(f"Income Statements found: {len(inc)}")
            print(f"Balance Sheets found: {len(bal)}")
            
            if inc:
                print("Sample Income Statement keys:", inc[0].keys())
                if 'endDate' in inc[0]:
                    print("Date raw:", inc[0]['endDate']['raw'])
                if 'netIncome' in inc[0]:
                    print("Net Income raw:", inc[0]['netIncome'].get('raw'))

            shares = stats.get("sharesOutstanding", {}).get("raw")
            print(f"Shares Outstanding: {shares}")
            
        else:
            print("Response text:", resp.text[:200])
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_fundamentals()
