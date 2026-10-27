from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "inventory_dataset_cleaned.csv"
FIGURES = ROOT / "outputs" / "figures"
FIGURES.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(INPUT, parse_dates=["date"])
print("Shape:", df.shape)
print("\nMissing values:\n", df.isna().sum())
print("\nExact duplicate rows:", df.duplicated().sum())
print("\nNumeric summary:\n", df[["stock_qty", "reorder_level", "daily_sales", "unit_cost", "lead_days"]].describe())
print("\nCategory counts:\n", df["category"].value_counts())
print("\nUnique products:", df["product_id"].nunique())
print("Unique suppliers:", df["supplier_id"].nunique())

plots = [
    ("01_category_record_counts.png", lambda: df["category"].value_counts().sort_values(ascending=False).plot(kind="bar"), "Record Count by Category", "Category", "Rows"),
    ("02_stock_quantity_distribution.png", lambda: df["stock_qty"].plot(kind="hist", bins=30), "Distribution of Recorded Stock Quantity", "Stock quantity", "Rows"),
    ("03_stock_vs_daily_sales.png", lambda: plt.scatter(df["daily_sales"], df["stock_qty"], alpha=0.25), "Recorded Stock vs. daily_sales", "daily_sales (as supplied)", "stock_qty"),
    ("04_supplier_median_lead_time.png", lambda: df.groupby("supplier_id")["lead_days"].median().sort_values().plot(kind="bar"), "Median Recorded Lead Time by Supplier ID", "Supplier ID", "Median lead time (days)"),
    ("05_reorder_threshold_status.png", lambda: (df["stock_qty"] <= df["reorder_level"]).map({True: "At/below threshold", False: "Above threshold"}).value_counts().plot(kind="bar"), "Records at or Below Their Reorder Threshold", "Threshold status", "Rows"),
]
for filename, draw, title, xlabel, ylabel in plots:
    plt.figure()
    draw()
    plt.title(title)
    plt.xlabel(xlabel)
    plt.ylabel(ylabel)
    plt.xticks(rotation=25 if "category" in filename else (90 if "supplier" in filename else 0), ha="right")
    plt.tight_layout()
    plt.savefig(FIGURES / filename, dpi=160)
    plt.close()
print(f"\nSaved {len(plots)} plots to {FIGURES}")
