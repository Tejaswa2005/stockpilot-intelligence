import Papa from 'papaparse'
import type { InventoryRow } from './types'

const number = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function loadInventory(): Promise<InventoryRow[]> {
  const required = ['date','product_id','category','season','stock_qty','reorder_level','daily_sales','unit_cost','supplier_id','lead_days']
  const number = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  const normalize = (rows: Record<string, unknown>[]) => rows.map(row => ({
    date: String(row.date ?? ''),
    product_id: String(row.product_id ?? ''),
    category: String(row.category ?? 'Uncategorized'),
    season: String(row.season ?? 'Unknown'),
    stock_qty: number(row.stock_qty),
    reorder_level: number(row.reorder_level),
    daily_sales: number(row.daily_sales),
    unit_cost: number(row.unit_cost),
    supplier_id: String(row.supplier_id ?? 'Unknown'),
    lead_days: number(row.lead_days),
  } satisfies InventoryRow)).filter(row => row.product_id.length > 0)

  // Prefer the API when it is running; the local CSV keeps the prototype usable on its own.
  try {
    const response = await fetch('/api/inventory?history=true&limit=50000')
    if (response.ok) {
      const payload = await response.json() as { items?: Record<string, unknown>[] }
      if (Array.isArray(payload.items)) return normalize(payload.items)
    }
  } catch {
    // Backend is optional during frontend-only development; continue to the bundled CSV.
  }

  const response = await fetch('/data/inventory_dataset.csv')
  if (!response.ok) throw new Error('Could not load inventory_dataset.csv. Start the API or check frontend/public/data/.')
  const csv = await response.text()
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true })
  const fields = parsed.meta.fields ?? []
  const missing = required.filter(k => !fields.includes(k))
  if (missing.length) throw new Error(`Dataset is missing required columns: ${missing.join(', ')}`)
  return normalize(parsed.data)
}

export function isLowStock(row: InventoryRow) {
  return row.stock_qty <= row.reorder_level
}

export function suggestedOrder(row: InventoryRow) {
  return Math.max(0, Math.ceil(row.reorder_level + row.daily_sales * row.lead_days - row.stock_qty))
}

export function money(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
}

export function compact(value: number) {
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
