# StockPilot Intelligence — Demo Checklist

## 5–7 minute walkthrough

### 1. Problem and purpose (30–45 seconds)
Explain that the prototype helps users review retail inventory records, identify stock at or below configured thresholds, and inspect supplier and category context.

### 2. Overview (60 seconds)
Show product count, supplier count, stock units, and low-stock count. Explain that the summary represents the latest dated record per product.

### 3. Inventory search (60 seconds)
Search `SKU0353`. Show stock quantity 3, reorder threshold 60, daily-sales field 12, and lead time 8 days.

### 4. Reorder Center (60–90 seconds)
Show the threshold rule and baseline quantity:
`60 + (12 × 8) − 3 = 153`.
Emphasize that 153 is a heuristic quantity, not an optimized or validated order.

### 5. Suppliers (45 seconds)
Show supplier IDs and available lead-time summaries. State that supplier contact information is not present in the dataset.

### 6. Data Insights (60 seconds)
Show 50,000 rows, 500 product IDs, 30 supplier IDs, four categories, and the data dictionary. Mention irregular timestamp intervals and that forecasting is not validated.

### 7. Export and close (30 seconds)
Export a CSV and explain next steps: confirm data semantics, validate replenishment policy, and evaluate forecasting only if the data supports it.

## Questions to prepare for

- Why does the dashboard show 52 low-stock products while the historical count is 4,310? The first uses one latest record per product; the second counts qualifying rows across all historical observations.
- Is this an AI forecasting system? Not currently. The API explicitly marks forecast status as not validated.
- Is the inventory value definitely INR? Not confirmed from the source data; the symbol should be treated as an assumption until verified.
- Is the suggested order quantity optimal? No. It is a baseline heuristic using the configured reorder level, stock quantity, sales field, and lead time.
