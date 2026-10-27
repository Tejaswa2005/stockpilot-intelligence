from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CSV = ROOT / "data" / "inventory_dataset.csv"
CSV_PATH = Path(os.getenv("INVENTORY_CSV_PATH", str(DEFAULT_CSV)))

app = FastAPI(
    title="StockPilot Intelligence API",
    description="CSV-backed inventory prototype API. Forecast endpoints are not claimed until validated.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REQUIRED = [
    "date", "product_id", "category", "season", "stock_qty",
    "reorder_level", "daily_sales", "unit_cost", "supplier_id", "lead_days"
]


def read_data() -> pd.DataFrame:
    if not CSV_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Inventory CSV not found: {CSV_PATH}")
    try:
        df = pd.read_csv(CSV_PATH)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to read inventory CSV: {exc}") from exc
    missing = [col for col in REQUIRED if col not in df.columns]
    if missing:
        raise HTTPException(status_code=500, detail=f"Missing required columns: {missing}")
    for col in ["stock_qty", "reorder_level", "daily_sales", "unit_cost", "lead_days"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return df



def latest_snapshot(df: pd.DataFrame) -> pd.DataFrame:
    """Return the latest dated observation for each product identifier."""
    snapshot = df.copy()
    snapshot["_parsed_date"] = pd.to_datetime(snapshot["date"], errors="coerce")
    snapshot = snapshot.sort_values(["_parsed_date"], kind="stable", na_position="first")
    snapshot = snapshot.drop_duplicates(subset=["product_id"], keep="last")
    return snapshot.drop(columns=["_parsed_date"])


def to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    df = df.copy()
    df["date"] = df["date"].astype(str)
    df = df.where(pd.notna(df), None)
    return df.to_dict(orient="records")


@app.get("/api/health")
def health():
    return {"status": "ok", "dataset_path": str(CSV_PATH), "dataset_exists": CSV_PATH.exists()}


@app.get("/api/inventory")
def inventory(
    q: str | None = Query(default=None, description="Search product, category, or supplier ID"),
    category: str | None = None,
    low_stock_only: bool = False,
    history: bool = False,
    limit: int = Query(default=500, ge=1, le=50000),
    offset: int = Query(default=0, ge=0),
):
    df = read_data()
    if not history:
        df = latest_snapshot(df)
    if q:
        mask = (
            df["product_id"].astype(str).str.contains(q, case=False, na=False)
            | df["category"].astype(str).str.contains(q, case=False, na=False)
            | df["supplier_id"].astype(str).str.contains(q, case=False, na=False)
        )
        df = df[mask]
    if category:
        df = df[df["category"].astype(str) == category]
    if low_stock_only:
        df = df[df["stock_qty"] <= df["reorder_level"]]
    total = len(df)
    return {"total": total, "limit": limit, "offset": offset, "items": to_records(df.iloc[offset:offset + limit])}


@app.get("/api/summary")
def summary():
    source = read_data()
    df = latest_snapshot(source)
    low = df["stock_qty"] <= df["reorder_level"]
    return {
        "source_records": int(len(source)),
        "current_product_rows": int(len(df)),
        "records": int(len(df)),
        "unique_products": int(df["product_id"].nunique()),
        "unique_suppliers": int(df["supplier_id"].nunique()),
        "low_stock_records": int(low.sum()),
        "total_stock_units": float(df["stock_qty"].sum()),
        "estimated_inventory_value": float((df["stock_qty"] * df["unit_cost"]).sum()),
        "categories": sorted(df["category"].dropna().astype(str).unique().tolist()),
        "forecast_status": "not_validated",
    }


@app.get("/api/reorders")
def reorders(limit: int = Query(default=500, ge=1, le=50000)):
    df = latest_snapshot(read_data())
    df = df[df["stock_qty"] <= df["reorder_level"]].copy()
    df["stock_gap_to_threshold"] = (df["reorder_level"] - df["stock_qty"]).clip(lower=0)
    df["lead_time_demand_proxy"] = df["daily_sales"] * df["lead_days"]
    df["suggested_order_qty_baseline"] = (
        df["reorder_level"] + df["lead_time_demand_proxy"] - df["stock_qty"]
    ).clip(lower=0).round()
    df = df.sort_values("stock_gap_to_threshold", ascending=False).head(limit)
    return {"count_returned": len(df), "items": to_records(df)}
