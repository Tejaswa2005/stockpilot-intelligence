# StockPilot Intelligence — Phase 1 EDA and Data Validation

## Dataset profile
- Source file: `inventory_dataset.csv`
- Raw dimensions: 50,000 rows × 10 columns
- Exported cleaned dimensions: 50,000 rows × 10 columns
- Distinct products: 500
- Distinct suppliers: 30
- Distinct categories: 4
- Distinct season labels: 5
- Date range: 2024-01-01 00:00:00 to 2024-12-31 23:49:21
- Distinct timestamps: 50,000
- Exact duplicate rows before cleaning: 0
- Invalid/missing timestamps before cleaning: 0
- Missing values before cleaning by column: date=0, product_id=0, category=0, season=0, stock_qty=0, reorder_level=0, daily_sales=0, unit_cost=0, supplier_id=0, lead_days=0

## Numeric summaries
       stock_qty  reorder_level  daily_sales  unit_cost  lead_days
count   50000.00       50000.00     50000.00   50000.00   50000.00
mean      149.84          60.29        33.41    2476.53      12.35
std        89.69          23.63        18.44    1386.64       4.71
min         0.00          20.00         0.00     104.22       3.00
25%        79.00          40.00        18.00    1279.01       9.00
50%       133.00          62.00        31.00    2397.83      12.00
75%       205.00          80.00        46.00    3598.23      16.00
max       500.00         100.00       131.00    5630.43      21.00

## Category counts
category
HomeDecor      13495
Electronics    12899
Apparel        12604
Grocery        11002

## Product-record counts
- Minimum rows per product: 99
- Median rows per product: 100.0
- Maximum rows per product: 105

## Threshold status (row-level, not unique products)
- Records at or below reorder threshold: 4,310
- Records above reorder threshold: 45,690

## Important interpretation limits
1. The timestamps are unique and span one calendar year, but many timestamps are only seconds apart. A unique timestamp per row does **not** prove the data is a true daily time series.
2. Do not aggregate the rows into daily sales history or claim forecast accuracy until the data-generation process and timestamp semantics are confirmed.
3. `daily_sales` is retained as supplied. Its name suggests daily demand, but this file alone does not establish the observation period represented by each row.
4. Currency for `unit_cost` is not specified in the CSV. Avoid adding a currency symbol unless confirmed by the project owner or source documentation.
5. The rule `stock_qty <= reorder_level` is a transparent descriptive alert, not proof of an optimal reorder policy.
6. The cleaned file only removes exact duplicate rows and records with invalid timestamps. The source currently has 0 exact duplicates and 0 invalid/missing timestamps, so this export preserves all valid rows without inventing values.

## Generated visualizations
- `outputs/figures/01_category_record_counts.png`
- `outputs/figures/02_stock_quantity_distribution.png`
- `outputs/figures/03_stock_vs_daily_sales.png`
- `outputs/figures/04_supplier_median_lead_time.png`
- `outputs/figures/05_reorder_threshold_status.png`

## Recommended next work
1. Confirm the intended meaning and sampling frequency of `date` and `daily_sales`.
2. Validate inventory value formula and threshold alert counts against the application.
3. Build tests for summary metrics, filters, exports, and API responses.
4. Only then assess whether forecasting is methodologically supported by this dataset.
