# StockPilot Intelligence — Architecture Notes

## High-level architecture

```text
Browser (React + TypeScript + Vite)
            |
            | HTTP requests to /api/*
            v
       FastAPI application
            |
            | pandas reads CSV
            v
 data/inventory_dataset.csv
            |
            +--> latest product snapshot
            +--> summary KPIs
            +--> threshold-based reorder candidates
            +--> baseline suggested order quantities
```

## Backend responsibilities

The FastAPI application in `backend/app/main.py` loads the CSV from `data/inventory_dataset.csv` by default, checks required columns, converts numeric fields, creates a latest-record-per-product view, and exposes health, inventory, summary, and reorder endpoints. It does not expose a validated forecasting model.

## Frontend responsibilities

The React frontend presents overview KPIs, inventory search/filtering, reorder recommendations, supplier summaries, data insights, and CSV export interactions.

## Key data fields

- `date`: source timestamp; confirm its business meaning and sampling frequency.
- `product_id`: product identifier.
- `category`: product category.
- `season`: season label in the source.
- `stock_qty`: recorded stock quantity.
- `reorder_level`: configured threshold.
- `daily_sales`: sales-related field; semantics need confirmation before assuming a true daily rate.
- `unit_cost`: cost-related field; currency and unit semantics need confirmation.
- `supplier_id`: supplier identifier, not verified supplier contact information.
- `lead_days`: lead-time field, assumed by the current heuristic to be days.

## Known limitations

- CSV-backed prototype; no transactional database is configured in the reviewed backend.
- No validated forecasting or optimization model.
- Reorder quantity is a heuristic, not a purchasing recommendation validated against historical outcomes.
- Timestamp gaps are irregular, so rows cannot safely be treated as consecutive daily observations without further evidence.
- Currency and cost semantics are unconfirmed.
