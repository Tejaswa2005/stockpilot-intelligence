# StockPilot Intelligence

**Optimized Retail Inventory Management System — prototype**

StockPilot Intelligence is a CSV-backed retail inventory dashboard for reviewing product stock positions, identifying records at or below configured reorder thresholds, inspecting supplier-level summaries, and exploring the supplied inventory dataset.

> **Prototype scope:** The current system uses descriptive analytics and rule-based reorder suggestions. It does not contain a validated demand-forecasting model or an optimized purchasing policy.

## Features

- Overview dashboard with product, supplier, stock, and inventory-value KPIs.
- Inventory table with product search and category filtering.
- Latest-record-per-product snapshot for current inventory views.
- Threshold-based reorder watch using `stock_qty <= reorder_level`.
- Baseline suggested order quantity using the current heuristic:
  `max(0, reorder_level + daily_sales * lead_days - stock_qty)`.
- Supplier summaries based on supplier IDs and available dataset fields.
- Data-insights page with dataset-quality context and a data dictionary.
- CSV export interactions in the frontend.
- EDA outputs and automated backend API tests.

## Technology stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI, pandas, Uvicorn
- **Testing:** pytest, FastAPI TestClient, httpx
- **Data:** CSV inventory dataset

## Repository structure

```text
stockpilot_intelligence/
├── README.md
├── data/
│   ├── inventory_dataset.csv
│   ├── inventory_dataset_cleaned.csv
│   └── data_dictionary.csv
├── docs/
│   ├── dashboard-data-contract.md
│   ├── eda_findings.md
│   ├── architecture.md
│   └── demo-checklist.md
├── analysis/run_eda.py
├── outputs/figures/
├── backend/
│   ├── app/main.py
│   ├── tests/test_api.py
│   └── requirements.txt
└── frontend/
    ├── src/
    ├── package.json
    └── vite.config.ts
```

Some generated or local-only files (such as `.venv/`, `frontend/node_modules/`, and `frontend/dist/`) may exist locally but should generally be excluded from a source-code submission ZIP.

## Requirements

- Python 3.11+ recommended; use the Python version already tested in your environment if required by the project.
- Node.js and npm.
- Windows PowerShell or an equivalent shell.

## Setup and run

### 1. Backend

From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m pip install pytest httpx
uvicorn app.main:app --app-dir backend --reload
```

Backend base URL: `http://127.0.0.1:8000`

Interactive API documentation: `http://127.0.0.1:8000/docs`

If you already have a virtual environment and dependencies installed, activate it and start Uvicorn without recreating it.

### 2. Frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (often `http://localhost:5173`; Vite may choose another port if that port is occupied).

### 3. Run EDA

From the project root with pandas and matplotlib installed:

```powershell
python -m pip install pandas matplotlib
python analysis/run_eda.py
```

The script prints dataset summaries and saves figures under `outputs/figures/`.

### 4. Run backend tests

From the project root:

```powershell
python -m pytest backend\tests -v
```

The observed local test run reported **5 passed**. Re-run tests after code changes; this is a record of the observed run, not a guarantee for future environments.

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Reports API status and whether the configured CSV path exists. |
| GET | `/api/inventory` | Returns the latest dated record per product by default. |
| GET | `/api/inventory?history=true&limit=50000` | Returns historical source records, subject to the limit. |
| GET | `/api/inventory?q=SKU0353` | Searches product ID, category, or supplier ID. |
| GET | `/api/inventory?category=Grocery` | Filters by exact category value. |
| GET | `/api/inventory?low_stock_only=true` | Filters to records at or below reorder level. |
| GET | `/api/summary` | Returns summary KPIs computed from the latest product snapshot. |
| GET | `/api/reorders` | Returns threshold-flagged products and baseline suggested order quantities. |

Optional inventory parameters include `q`, `category`, `low_stock_only`, `history`, `limit`, and `offset`.

The CSV path defaults to `data/inventory_dataset.csv` and can be overridden with the `INVENTORY_CSV_PATH` environment variable.

## Dataset and EDA summary

The supplied source dataset contains **50,000 rows and 10 columns**, with 500 distinct product IDs, 30 supplier IDs, and four categories. The EDA run found no missing values, no exact duplicate rows, and no invalid dates in the source data.

The dataset spans 2024. Product observations have irregular timestamp gaps; therefore, the records should not automatically be treated as a continuous daily time series. The meaning and sampling process of `daily_sales` should be confirmed before using it as a validated daily demand history.

See `docs/eda_findings.md`, `data/data_dictionary.csv`, and `outputs/figures/`.

## Current verified baseline

Based on local dataset checks and the API response reviewed during development:

- Source records: 50,000
- Latest product rows: 500
- Unique suppliers in latest snapshot: 30
- Products at or below reorder threshold in latest snapshot: 52
- Total stock units in latest snapshot: 74,637
- Historical source rows at or below threshold: 4,310

The historical count (4,310) and latest-snapshot count (52) measure different things and should not be presented as equivalent.

## Business rules and limitations

### Reorder watch

A product is flagged when `stock_qty <= reorder_level`. This is a threshold-based alert, not proof of an impending stockout.

### Baseline order quantity

The current API computes:

```text
lead_time_demand_proxy = daily_sales * lead_days
suggested_order_qty_baseline =
    max(0, reorder_level + lead_time_demand_proxy - stock_qty)
```

This is a heuristic baseline. It assumes `daily_sales` is an appropriate daily-demand value and `lead_days` represents lead time in days. Those semantics, the appropriate safety stock, pack-size constraints, and purchasing policy have not been independently validated. Recommendations should be reviewed before real purchasing decisions.

### Inventory value

The API multiplies `stock_qty * unit_cost`. The arithmetic has been checked against the current dataset, but the source currency and precise meaning of `unit_cost` have not been confirmed. Do not claim the amount is INR unless the data owner confirms that assumption.

### Forecasting

The API marks forecasting as `not_validated`. Do not describe the current dashboard as using a trained or validated ML forecasting model.

### Supplier information

The dataset contains supplier IDs and lead-time values, but no supplier contact details or verified supplier names. Supplier cards summarize available IDs and data only.

## Testing and verification record

Observed during local development:

- EDA script executed successfully and generated five figures.
- API summary values matched an independent calculation using the same latest-snapshot logic.
- Reorder endpoint returned 52 latest-snapshot candidates.
- Five automated backend tests passed.
- `npm run build` completed successfully with TypeScript and Vite.

The frontend build displayed a Vite warning that the minified JavaScript bundle exceeded 500 kB. This did not fail the build; code splitting can be considered as a future performance improvement.

## Suggested demonstration flow

1. Open Overview and explain the headline KPIs.
2. Open Inventory, search `SKU0353`, and explain stock 3 versus threshold 60.
3. Open Reorder Center and explain the threshold rule and baseline order quantity of 153 for that record.
4. Open Suppliers and explain that the cards use supplier IDs available in the CSV.
5. Open Data Insights and show dataset dimensions and the data dictionary.
6. Export data and show the downloaded CSV.
7. Explain limitations honestly: no validated forecasting model, unconfirmed currency semantics, and heuristic reorder quantities.

## Before submission

- [ ] Confirm official project brief and grading rubric.
- [ ] Confirm currency and `unit_cost` semantics with the data owner.
- [ ] Confirm the business meaning and sampling frequency of `daily_sales`.
- [ ] Re-run `python -m pytest backend\tests -v`.
- [ ] Re-run `npm run build` from `frontend/`.
- [ ] Verify all app pages, filters, and exports on the submission machine.
- [ ] Include the dataset only if submission rules permit it.
- [ ] Exclude `.venv/`, `node_modules/`, `.pytest_cache/`, and generated folders from the source ZIP.
- [ ] Capture final screenshots and prepare a short demo.
