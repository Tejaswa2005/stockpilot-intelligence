import sys
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

# Make the backend package importable when pytest runs from the project root.
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app import main


@pytest.fixture
def client_with_test_data(tmp_path, monkeypatch):
    """Use a small, predictable CSV instead of the real dataset."""
    rows = [
        {
            "date": "2024-01-01", "product_id": "SKU001",
            "category": "Grocery", "season": "Winter",
            "stock_qty": 10, "reorder_level": 10,
            "daily_sales": 2, "unit_cost": 5,
            "supplier_id": "SUP01", "lead_days": 3,
        },
        {
            "date": "2024-01-02", "product_id": "SKU001",
            "category": "Grocery", "season": "Winter",
            "stock_qty": 8, "reorder_level": 10,
            "daily_sales": 2, "unit_cost": 5,
            "supplier_id": "SUP01", "lead_days": 3,
        },
        {
            "date": "2024-01-01", "product_id": "SKU002",
            "category": "Apparel", "season": "Winter",
            "stock_qty": 20, "reorder_level": 10,
            "daily_sales": 1, "unit_cost": 4,
            "supplier_id": "SUP02", "lead_days": 2,
        },
    ]

    csv_path = tmp_path / "inventory_dataset.csv"
    pd.DataFrame(rows).to_csv(csv_path, index=False)
    monkeypatch.setattr(main, "CSV_PATH", csv_path)

    with TestClient(main.app) as client:
        yield client


def test_health_endpoint(client_with_test_data):
    response = client_with_test_data.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["dataset_exists"] is True


def test_summary_uses_latest_record_per_product(client_with_test_data):
    response = client_with_test_data.get("/api/summary")
    assert response.status_code == 200

    data = response.json()
    assert data["source_records"] == 3
    assert data["current_product_rows"] == 2
    assert data["unique_products"] == 2
    assert data["unique_suppliers"] == 2
    assert data["low_stock_records"] == 1
    assert data["total_stock_units"] == 28
    assert data["estimated_inventory_value"] == 120


def test_inventory_returns_latest_record_by_default(client_with_test_data):
    response = client_with_test_data.get("/api/inventory")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 2

    sku001 = next(
        item for item in data["items"]
        if item["product_id"] == "SKU001"
    )
    assert sku001["stock_qty"] == 8
    assert sku001["date"] == "2024-01-02"


def test_history_returns_all_records(client_with_test_data):
    response = client_with_test_data.get(
        "/api/inventory", params={"history": "true", "limit": 50000}
    )
    assert response.status_code == 200
    assert response.json()["total"] == 3


def test_reorders_calculates_baseline_quantity(client_with_test_data):
    response = client_with_test_data.get("/api/reorders")
    assert response.status_code == 200

    data = response.json()
    assert data["count_returned"] == 1

    item = data["items"][0]
    assert item["product_id"] == "SKU001"
    assert item["stock_gap_to_threshold"] == 2
    assert item["lead_time_demand_proxy"] == 6
    assert item["suggested_order_qty_baseline"] == 8
