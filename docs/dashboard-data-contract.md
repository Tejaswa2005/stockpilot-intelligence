# Dashboard data contract

- **Historical observations:** all 50,000 CSV rows; used for date-grouped descriptive trends and source-quality checks.
- **Current product snapshot:** latest valid dated row per `product_id`; used for current-stock KPIs, inventory table, supplier cards, and reorder review.
- **Inventory value:** sum of `stock_qty × unit_cost` across current product rows.
- **At reorder threshold:** count of current product rows where `stock_qty <= reorder_level`.
- **Category mix:** current `stock_qty` summed by category across current product rows.
- **Daily trend:** mean recorded `daily_sales` or mean recorded `stock_qty` among rows with the same date. It is not a model forecast.
- **Suggested order baseline:** `max(0, reorder_level + daily_sales × lead_days − stock_qty)`.

Supplier names, contact details, actual purchase orders, safety-stock policies, and validated forecasts are not present in the supplied data and are not invented by this prototype.
