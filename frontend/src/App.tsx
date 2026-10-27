import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Boxes, Check, ChevronDown,
  CircleHelp, Clock3, Command, Download, ExternalLink, Eye, Filter, LayoutDashboard,
  Leaf, Menu, Package, Search, Settings2, ShieldCheck, Sparkles, Truck, X, Zap
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, BarChart, Bar
} from 'recharts'
import Brand from './components/Brand'
import StatCard from './components/StatCard'
import { compact, isLowStock, loadInventory, money, suggestedOrder } from './lib'
import type { InventoryRow } from './types'

type Page = 'overview' | 'inventory' | 'reorders' | 'suppliers' | 'insights'
const NAV: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'reorders', label: 'Reorder center', icon: Bell },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'insights', label: 'Data insights', icon: Activity },
]
const COLORS = ['#245d4b', '#82a995', '#d8b16a', '#d98068', '#c8d7cc']

function useInventory() {
  const [data, setData] = useState<InventoryRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    loadInventory().then(setData).catch(e => setError(e instanceof Error ? e.message : 'Dataset load failed')).finally(() => setLoading(false))
  }, [])
  return { data, error, loading }
}

function App() {
  const { data, error, loading } = useInventory()
  const [page, setPage] = useState<Page>('overview')
  const [inApp, setInApp] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const [tablePage, setTablePage] = useState(0)
  const [toast, setToast] = useState('')
  const [scenarioSales, setScenarioSales] = useState(8)
  const [scenarioLead, setScenarioLead] = useState(7)
  const [scenarioStock, setScenarioStock] = useState(42)

  // Treat the most recent row for each product as the current inventory snapshot.
  // The full CSV remains available for descriptive trend charts and data-quality checks.
  const currentRows = useMemo(() => {
    const latest = new Map<string, InventoryRow>()
    for (const row of data) {
      const existing = latest.get(row.product_id)
      const rowTime = Date.parse(row.date)
      const existingTime = existing ? Date.parse(existing.date) : Number.NEGATIVE_INFINITY
      if (!existing || (Number.isFinite(rowTime) && (!Number.isFinite(existingTime) || rowTime >= existingTime))) {
        latest.set(row.product_id, row)
      }
    }
    return [...latest.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  }, [data])

  const categories = useMemo(() => [...new Set(currentRows.map(d => d.category))].sort(), [currentRows])
  const suppliers = useMemo(() => new Set(currentRows.map(d => d.supplier_id)).size, [currentRows])
  const lowRows = useMemo(() => currentRows.filter(isLowStock), [currentRows])
  const totalValue = useMemo(() => currentRows.reduce((sum, r) => sum + r.stock_qty * r.unit_cost, 0), [currentRows])
  const totalStock = useMemo(() => currentRows.reduce((sum, r) => sum + r.stock_qty, 0), [currentRows])

  const filtered = useMemo(() => currentRows.filter(r => {
    const matchesQuery = `${r.product_id} ${r.category} ${r.supplier_id}`.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = category === 'All categories' || r.category === category
    const matchesPage = page !== 'reorders' || isLowStock(r)
    return matchesQuery && matchesCategory && matchesPage
  }), [currentRows, query, category, page])

  const uniqueProductCount = currentRows.length
  const categoryData = useMemo(() => categories.map((name, i) => {
    const rows = currentRows.filter(r => r.category === name)
    return { name, stock: rows.reduce((s, r) => s + r.stock_qty, 0), value: rows.reduce((s, r) => s + r.stock_qty * r.unit_cost, 0), color: COLORS[i % COLORS.length] }
  }), [currentRows, categories])
  const trendData = useMemo(() => {
    const map = new Map<string, { day: string; sales: number; stock: number; count: number }>()
    data.forEach(r => {
      const parsed = new Date(r.date)
      if (Number.isNaN(parsed.getTime())) return
      // Keep the date prefix from the CSV to avoid timezone shifts near midnight.
      const key = /^\d{4}-\d{2}-\d{2}/.test(r.date) ? r.date.slice(0, 10) : parsed.toISOString().slice(0, 10)
      const item = map.get(key) ?? { day: key, sales: 0, stock: 0, count: 0 }
      item.sales += r.daily_sales
      item.stock += r.stock_qty
      item.count += 1
      map.set(key, item)
    })
    return [...map.values()].sort((a, b) => a.day.localeCompare(b.day)).map(d => ({
      day: d.day,
      sales: Number((d.sales / Math.max(d.count, 1)).toFixed(1)),
      stock: Number((d.stock / Math.max(d.count, 1)).toFixed(1)),
      count: d.count,
      label: new Date(`${d.day}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    }))
  }, [data])
  const topAlerts = useMemo(() => [...lowRows].sort((a, b) => (a.stock_qty - a.reorder_level) - (b.stock_qty - b.reorder_level)).slice(0, 5), [lowRows])
  const scenarioOrder = Math.max(0, Math.ceil(scenarioSales * scenarioLead + 20 - scenarioStock))

  function enterDashboard(target: Page = 'overview') {
    setPage(target); setInApp(true); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function notify(message: string) {
    setToast(message); window.setTimeout(() => setToast(''), 2600)
  }
  function downloadCsv(rows: InventoryRow[], filename: string) {
    const header = ['date','product_id','category','season','stock_qty','reorder_level','daily_sales','unit_cost','supplier_id','lead_days']
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [header.join(','), ...rows.map(r => header.map(h => escape((r as unknown as Record<string, unknown>)[h])).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify('CSV export prepared')
  }

  if (loading) return <div className="loading-screen"><div className="loader-mark"><Boxes size={28}/></div><p>Preparing your inventory intelligence…</p><div className="loading-bar"><span /></div></div>
  if (error) return <div className="error-screen"><Brand/><h1>We couldn't load the inventory data.</h1><p>{error}</p><p>Confirm that <code>public/data/inventory_dataset.csv</code> exists and contains the required columns.</p></div>

  if (!inApp) return <main className="landing">
    <nav className="landing-nav shell">
      <Brand/>
      <div className="landing-links"><a href="#platform">Platform</a><a href="#how-it-works">How it works</a><a href="#decision-studio">Decision studio</a></div>
      <button className="button button-dark nav-cta" onClick={() => enterDashboard()}><span>Open workspace</span><ArrowRight size={16}/></button>
    </nav>

    <section className="hero shell">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-dot"/> INVENTORY, WITH INTELLIGENCE</div>
        <h1>Know what to stock.<br/><em>Before you run out.</em></h1>
        <p className="hero-description">A clearer view of your inventory, supplier lead times, and demand signals — so the next decision feels less like a guess.</p>
        <div className="hero-actions"><button className="button button-dark button-large" onClick={() => enterDashboard()}>Explore your inventory <ArrowRight size={17}/></button><a className="text-link" href="#platform"><span className="play-dot">↓</span> Discover the platform</a></div>
        <div className="hero-proof"><div className="avatar-stack"><span>SP</span><span>IN</span><span>AI</span></div><span><strong>One view.</strong> Better-informed decisions.</span></div>
      </div>
      <div className="hero-art" aria-label="Illustration of inventory analytics">
        <div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/>
        <div className="hero-glow"/>
        <div className="floating-tag tag-top"><span className="tag-icon"><Activity size={16}/></span><span><small>STOCK SIGNAL</small><strong>Needs attention</strong></span><span className="tag-pulse"/></div>
        <div className="hero-dashboard-card">
          <div className="mini-head"><span className="mini-logo"><Boxes size={13}/></span><b>stockpilot</b><span className="mini-live"><i/> LIVE PREVIEW</span></div>
          <div className="mini-kpi-row"><div><small>Inventory value</small><strong>{money(totalValue)}</strong><span className="mini-muted">Across current records</span></div><div className="mini-kpi-icon"><Package size={20}/></div></div>
          <div className="mini-chart-head"><span>Sales activity</span><span className="mini-period">DATA PREVIEW</span></div>
          <div className="mini-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData.slice(-8)}><defs><linearGradient id="miniFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3c846b" stopOpacity={0.25}/><stop offset="100%" stopColor="#3c846b" stopOpacity={0}/></linearGradient></defs><Area dataKey="sales" type="monotone" stroke="#245d4b" strokeWidth={2.5} fill="url(#miniFill)" /></AreaChart></ResponsiveContainer></div>
          <div className="mini-foot"><span><i className="dot-green"/> Dataset connected</span><span>{data.length.toLocaleString()} rows</span></div>
        </div>
        <div className="floating-tag tag-bottom"><span className="tag-icon amber"><Bell size={16}/></span><span><small>REORDER WATCH</small><strong>{lowRows.length.toLocaleString()} records at threshold</strong></span></div>
        <div className="art-stamp"><Sparkles size={15}/><span>MAKE STOCK<br/>WORK SMARTER</span></div>
      </div>
      <div className="hero-bottom-note"><span>BUILT FOR BETTER OPERATIONS</span><span className="note-line"/><span>DATA IN. CLARITY OUT.</span></div>
    </section>

    <section className="trust-strip"><div className="shell trust-inner"><span>ONE CONNECTED VIEW</span><div><Package size={17}/> Inventory</div><div><Activity size={17}/> Demand signals</div><div><Truck size={17}/> Supplier context</div><div><ShieldCheck size={17}/> Transparent rules</div></div></section>

    <section className="platform-section shell" id="platform">
      <div className="section-heading"><div><div className="eyebrow">A MORE USEFUL KIND OF DASHBOARD</div><h2>From stock on a shelf<br/>to <em>clarity on a screen.</em></h2></div><p>Inventory management is more than a number. StockPilot brings the signals together so you can see what needs attention and why.</p></div>
      <div className="feature-grid">
        <article className="feature-card feature-main"><div className="feature-icon"><Activity size={20}/></div><span className="feature-number">01 / SEE THE WHOLE PICTURE</span><h3>Inventory, in context.</h3><p>Explore stock levels, recorded sales, category mix, and estimated stock value in one considered workspace.</p><div className="feature-visual visual-bars"><div className="bars-label"><span>Category stock mix</span><span>BY CATEGORY</span></div><div className="decor-bars">{[48,76,58,92,68,84,43,70,54,88,61,79].map((h,i)=><i key={i} style={{height:`${h}%`,opacity:.25+h/140}}/>)}</div><div className="bars-legend"><span><i/> Current stock snapshot</span><span>Illustrative distribution</span></div></div></article>
        <article className="feature-card feature-dark"><div className="feature-icon"><Bell size={20}/></div><span className="feature-number">02 / ACT BEFORE THE GAP</span><h3>See the signal.<br/><em>Make the move.</em></h3><p>Find records at or below their reorder threshold and inspect the demand and lead-time assumptions behind a suggested order.</p><div className="alert-preview"><div className="alert-preview-icon"><Bell size={16}/></div><div><strong>Reorder watch</strong><small>Rule-based threshold alert</small></div><span className="alert-count">{lowRows.length.toLocaleString()}</span></div></article>
        <article className="feature-card feature-wide"><div className="wide-feature-copy"><div className="feature-icon"><Truck size={20}/></div><span className="feature-number">03 / CONNECT THE SUPPLY</span><h3>Supplier context<br/>that matters.</h3><p>Keep supplier identifiers and lead-time data close to the stock decisions they influence.</p><button className="text-link" onClick={() => enterDashboard('suppliers')}>Explore supplier view <ArrowRight size={15}/></button></div><div className="supplier-visual"><div className="route-line"><span/><i/><span/></div><div className="route-card route-origin"><Package size={18}/><span><small>INVENTORY</small><strong>On hand</strong></span></div><div className="route-card route-destination"><Truck size={18}/><span><small>SUPPLIER</small><strong>Lead time</strong></span><span className="route-days">DAYS</span></div><div className="route-caption">SUPPLY CHAIN, MADE VISIBLE</div></div></article>
      </div>
    </section>

    <section className="scenario-section" id="decision-studio"><div className="shell scenario-layout">
      <div className="scenario-copy"><div className="eyebrow eyebrow-light">A SMALL INTERACTION. A BIGGER PICTURE.</div><h2>What changes when<br/><em>the demand changes?</em></h2><p>Try a simple replenishment scenario. Adjust the assumptions and see how the baseline order suggestion responds. This is a transparent rule-based example, not a trained forecast.</p><div className="scenario-disclaimer"><ShieldCheck size={17}/><span>Every input is visible. No hidden model claims.</span></div></div>
      <div className="scenario-panel"><div className="scenario-panel-top"><div><span className="panel-kicker">DECISION STUDIO</span><h3>Replenishment sandbox</h3></div><span className="sandbox-pill"><i/> INTERACTIVE</span></div>
        <div className="scenario-controls">
          <label><span>Daily demand <strong>{scenarioSales} units</strong></span><input type="range" min="1" max="30" value={scenarioSales} onChange={e=>setScenarioSales(Number(e.target.value))}/><small>Average units sold per day</small></label>
          <label><span>Supplier lead time <strong>{scenarioLead} days</strong></span><input type="range" min="1" max="30" value={scenarioLead} onChange={e=>setScenarioLead(Number(e.target.value))}/><small>Days until replenishment arrives</small></label>
          <label><span>Current stock <strong>{scenarioStock} units</strong></span><input type="range" min="0" max="200" value={scenarioStock} onChange={e=>setScenarioStock(Number(e.target.value))}/><small>Available inventory today</small></label>
        </div>
        <div className="scenario-result"><div><small>BASELINE SUGGESTED ORDER</small><strong>{scenarioOrder} <i>units</i></strong><span>Assumes a 20-unit threshold buffer</span></div><div className={`scenario-status ${scenarioStock <= scenarioSales*scenarioLead ? 'risk' : ''}`}><span className="status-dot"/>{scenarioStock <= scenarioSales*scenarioLead ? 'Potential shortfall during lead time' : 'Stock covers modeled lead-time demand'}</div></div>
        <div className="scenario-formula">Rule: max(0, demand × lead time + 20 − current stock)</div>
      </div>
    </div></section>

    <section className="how-section shell" id="how-it-works"><div className="eyebrow">A CLEARER OPERATING RHYTHM</div><h2>Three steps. <em>One better view.</em></h2><div className="steps-grid"><div className="step"><span>01</span><div className="step-icon"><Boxes size={20}/></div><h3>Bring the data together</h3><p>Start with your inventory records, product categories, stock levels, and supplier lead times.</p></div><div className="step"><span>02</span><div className="step-icon"><Eye size={20}/></div><h3>See what stands out</h3><p>Review thresholds, stock distribution, and the recorded sales signals that need closer inspection.</p></div><div className="step"><span>03</span><div className="step-icon"><Zap size={20}/></div><h3>Choose the next action</h3><p>Explore a transparent reorder baseline, export the relevant records, and document the decision.</p></div></div></section>

    <section className="closing-cta"><div className="shell closing-inner"><div><span className="eyebrow eyebrow-light">YOUR INVENTORY, IN FOCUS</span><h2>Ready to see the<br/><em>whole picture?</em></h2></div><button className="button button-cream button-large" onClick={() => enterDashboard()}>Enter StockPilot <ArrowRight size={17}/></button><div className="closing-orb"/></div></section>
    <footer className="landing-footer shell"><Brand/><span>Inventory intelligence prototype · HCLTech Career Shaper Programme</span><span>Designed for clarity, built for decisions.</span></footer>
  </main>

  return <div className={`app-shell ${inApp ? 'app-visible' : ''}`}>
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand-row"><Brand inverse/><button className="icon-button mobile-close" aria-label="Close navigation" onClick={()=>setSidebarOpen(false)}><X size={19}/></button></div>
      <div className="workspace-switch"><div className="workspace-avatar">SP</div><div><strong>Operations workspace</strong><small>Retail inventory</small></div><ChevronDown size={15}/></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">{NAV.map(item=>{const Icon=item.icon;return <button key={item.id} className={`side-link ${page===item.id?'active':''}`} onClick={()=>{setPage(item.id);setSidebarOpen(false);setTablePage(0)}}><Icon size={18}/><span>{item.label}</span>{item.id==='reorders'&&lowRows.length>0&&<small className="nav-count">{compact(lowRows.length)}</small>}</button>})}</nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><div className="help-icon"><CircleHelp size={17}/></div><strong>Need a hand?</strong><p>Explore the data notes to understand the current rules and assumptions.</p><button onClick={()=>setPage('insights')}>View data notes <ArrowRight size={13}/></button></div><div className="sidebar-user"><div className="user-avatar">SI</div><div><strong>StockPilot demo</strong><small>Local dataset</small></div><Settings2 size={17}/></div></div>
    </aside>
    {sidebarOpen&&<button className="sidebar-scrim" aria-label="Close menu" onClick={()=>setSidebarOpen(false)}/>}
    <main className="dashboard-main">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={()=>setSidebarOpen(true)}><Menu size={20}/></button><span className="breadcrumb-muted">Workspace</span><span className="breadcrumb-slash">/</span><strong>{NAV.find(n=>n.id===page)?.label}</strong></div><div className="topbar-right"><span className="data-status"><i/> CSV connected</span><button className="icon-button notification-button" aria-label="View reorder alerts" onClick={()=>setPage('reorders')}><Bell size={18}/>{lowRows.length>0&&<i/>}</button><div className="top-avatar">SP</div></div></header>
      <div className="dashboard-content">
        <div className="page-heading"><div><div className="page-eyebrow">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div><h1>{page==='overview'?'Good decisions start with a clear view.':NAV.find(n=>n.id===page)?.label}</h1><p>{page==='overview'?'Current product positions, reorder signals, and observed activity from your dataset.':'Explore the records and signals available in your current dataset.'}</p></div><div className="heading-actions"><button className="button button-outline" onClick={()=>downloadCsv(filtered,'stockpilot-inventory-export.csv')}><Download size={15}/> Export data</button><button className="button button-dark" onClick={()=>setPage('reorders')}><Bell size={15}/> Reorder center <ArrowRight size={14}/></button></div></div>
        {page==='overview'&&<Overview data={currentRows} sourceRecordCount={data.length} lowRows={lowRows} totalValue={totalValue} totalStock={totalStock} uniqueProducts={uniqueProductCount} suppliers={suppliers} categoryData={categoryData} trendData={trendData} topAlerts={topAlerts} onNavigate={setPage} onNotify={notify}/>}
        {page==='inventory'&&<section className="panel inventory-page"><div className="panel-heading"><div><h2>Inventory records</h2><p>Search and filter the rows in your uploaded CSV.</p></div><span className="result-count">{filtered.length.toLocaleString()} records</span></div><InventoryTable rows={filtered} query={query} setQuery={setQuery} category={category} setCategory={setCategory} categories={categories} pageIndex={tablePage} setPageIndex={setTablePage}/></section>}
        {page==='reorders'&&<Reorders rows={filtered} query={query} setQuery={setQuery} onExport={()=>downloadCsv(filtered.filter(isLowStock),'stockpilot-reorder-report.csv')}/>}
        {page==='suppliers'&&<Suppliers data={currentRows} onExport={()=>downloadCsv(data,'stockpilot-supplier-source-records.csv')}/>}
        {page==='insights'&&<Insights data={data} categories={categories} onNotify={notify}/>}
        <footer className="dashboard-footer"><span>© StockPilot Intelligence · Industry project prototype</span><span><i/> Live from supplied CSV <span className="footer-sep">·</span> No forecast model validated yet</span></footer>
      </div>
    </main>
    {toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}
  </div>
}

function Overview({data,sourceRecordCount,lowRows,totalValue,totalStock,uniqueProducts,suppliers,categoryData,trendData,topAlerts,onNavigate,onNotify}:any) {
  const [chartMode,setChartMode]=useState<'sales'|'stock'>('sales')
  const [range,setRange]=useState('14 days')
  const chart = trendData.slice(-Number.parseInt(range,10) || trendData.length)
  return <>
    <div className="stat-grid">
      <StatCard label="Inventory value" value={money(totalValue)} note="Stock quantity × unit cost" icon={<span className="rupee">₹</span>} tone="green"/>
      <StatCard label="Product IDs" value={uniqueProducts.toLocaleString()} note={`${sourceRecordCount.toLocaleString()} historical source records`} icon={<Package size={19}/>} tone="sage"/>
      <StatCard label="At reorder threshold" value={lowRows.length.toLocaleString()} note="Records at or below reorder level" icon={<Bell size={19}/>} tone="amber"/>
      <StatCard label="Suppliers represented" value={suppliers.toLocaleString()} note="Unique supplier IDs in the CSV" icon={<Truck size={19}/>} tone="coral"/>
    </div>
    <div className="dashboard-grid chart-grid">
      <section className="panel trend-panel"><div className="panel-heading"><div><div className="panel-kicker">ACTIVITY OVER TIME</div><h2>Recorded sales & stock</h2><p>Daily averages across the records present on each date.</p></div><div className="chart-controls"><div className="segmented"><button className={chartMode==='sales'?'selected':''} onClick={()=>setChartMode('sales')}>Sales</button><button className={chartMode==='stock'?'selected':''} onClick={()=>setChartMode('stock')}>Stock</button></div><button className="select-button" onClick={()=>setRange(range==='14 days'?'30 days':'14 days')}>{range}<ChevronDown size={13}/></button></div></div><div className="chart-legend"><span><i className="legend-green"/>{chartMode==='sales'?'Average recorded sales per row':'Average recorded stock per row'}</span><span className="chart-context"><span className="context-dot"/>Source CSV aggregation</span></div><div className="large-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="mainChartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2b7059" stopOpacity={.18}/><stop offset="100%" stopColor="#2b7059" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e9ede8" vertical={false} strokeDasharray="3 4"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:'#8a938b',fontSize:11}} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8a938b',fontSize:11}} width={40}/><Tooltip contentStyle={{borderRadius:12,border:'1px solid #e3e9e3',fontSize:12}}/><Area type="monotone" dataKey={chartMode==='sales'?'sales':'stock'} stroke="#2b7059" strokeWidth={2.5} fill="url(#mainChartFill)" activeDot={{r:5,strokeWidth:0}}/></AreaChart></ResponsiveContainer></div><div className="chart-footnote"><ShieldCheck size={14}/> Daily averages reflect rows recorded on each date; they are descriptive, not a validated forecast.</div></section>
      <section className="panel category-panel"><div className="panel-heading"><div><div className="panel-kicker">WHERE STOCK SITS</div><h2>Category mix</h2><p>Recorded stock units by category.</p></div><button className="icon-button" aria-label="View inventory" onClick={()=>onNavigate('inventory')}><ArrowUpRight size={17}/></button></div><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="stock" nameKey="name" innerRadius={66} outerRadius={91} paddingAngle={4} stroke="none">{categoryData.map((e:any,i:number)=><Cell key={e.name} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={(v:any)=>Number(v).toLocaleString()}/></PieChart></ResponsiveContainer><div className="donut-center"><strong>{compact(totalStock)}</strong><span>total units</span></div></div><div className="category-legend">{categoryData.map((c:any,i:number)=><div key={c.name}><span className="category-name"><i style={{background:COLORS[i%COLORS.length]}}/>{c.name}</span><strong>{compact(c.stock)}</strong></div>)}</div></section>
    </div>
    <div className="dashboard-grid lower-grid">
      <section className="panel alerts-panel"><div className="panel-heading"><div><div className="panel-kicker">NEEDS A CLOSER LOOK</div><h2>Reorder watch</h2><p>Records at or below the configured stock threshold.</p></div><button className="text-link small-link" onClick={()=>onNavigate('reorders')}>View all <ArrowRight size={14}/></button></div>{topAlerts.length===0?<div className="empty-state">No low-stock records in this dataset.</div>:<div className="alert-list">{topAlerts.map((r:InventoryRow)=>{const gap=Math.max(0,r.reorder_level-r.stock_qty);return <div className="alert-row" key={`${r.product_id}-${r.date}-${r.supplier_id}`}><div className="alert-product-icon"><Package size={17}/></div><div className="alert-product"><strong>{r.product_id}</strong><span>{r.category} · Supplier {r.supplier_id}</span></div><div className="alert-stock"><strong>{r.stock_qty} <small>/ {r.reorder_level}</small></strong><span>Stock / threshold</span></div><span className={`severity ${gap>10?'high':'medium'}`}>{gap>10?'Below threshold':'At threshold'}</span></div>})}</div>}<button className="button button-soft full-button" onClick={()=>onNavigate('reorders')}>Review reorder recommendations <ArrowRight size={15}/></button></section>
      <section className="panel stock-health-panel"><div className="panel-heading"><div><div className="panel-kicker">INVENTORY SNAPSHOT</div><h2>Stock health</h2><p>Based on current stock vs reorder levels.</p></div><span className="health-icon"><Leaf size={18}/></span></div><div className="health-summary"><div><strong>{data.length?Math.round((data.length-lowRows.length)/data.length*100):0}%</strong><span>Above reorder threshold</span></div><div className="health-ring"><svg viewBox="0 0 100 100" aria-label="Percentage of records above reorder threshold"><circle cx="50" cy="50" r="40" className="ring-bg"/><circle cx="50" cy="50" r="40" className="ring-value" style={{strokeDasharray:`${(data.length?((data.length-lowRows.length)/data.length):0)*251.2} 251.2`}}/><text x="50" y="55" textAnchor="middle">{data.length?Math.round((data.length-lowRows.length)/data.length*100):0}%</text></svg></div></div><div className="health-note"><span className="health-note-icon"><ShieldCheck size={16}/></span><p>This is a threshold comparison only. It does not account for demand uncertainty, safety-stock policy, or forecast error.</p></div><button className="text-link" onClick={()=>onNavigate('insights')}>Explore data quality <ArrowRight size={14}/></button></section>
    </div>
    <section className="panel recent-panel"><div className="panel-heading"><div><div className="panel-kicker">FROM YOUR DATASET</div><h2>Inventory records</h2><p>Latest recorded row for each product, not every historical observation.</p></div><button className="text-link small-link" onClick={()=>onNavigate('inventory')}>Open inventory <ArrowRight size={14}/></button></div><InventoryTable rows={data.slice(0,7)} compactView/></section>
  </>
}

function InventoryTable({rows,query='',setQuery=()=>{},category='All categories',setCategory=()=>{},categories=[],pageIndex=0,setPageIndex=()=>{},compactView=false}:any) {
  const pageSize=compactView?7:12
  const maxPage=Math.max(0,Math.ceil(rows.length/pageSize)-1)
  const safePage=Math.min(pageIndex,maxPage)
  const shown=compactView?rows.slice(0,pageSize):rows.slice(safePage*pageSize,(safePage+1)*pageSize)
  return <><div className="table-toolbar">{!compactView&&<><div className="search-field"><Search size={16}/><input value={query} onChange={e=>{setQuery(e.target.value);setPageIndex(0)}} placeholder="Search product, category or supplier…" aria-label="Search inventory"/></div><label className="filter-select"><Filter size={15}/><select value={category} onChange={e=>{setCategory(e.target.value);setPageIndex(0)}}><option>All categories</option>{categories.map((c:string)=><option key={c}>{c}</option>)}</select><ChevronDown size={13}/></label></>}<span className="table-count">{rows.length.toLocaleString()} {compactView?'recent rows':'matching rows'}</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>Category</th><th>Stock level</th><th>Daily sales</th><th>Lead time</th><th>Supplier</th><th>Status</th></tr></thead><tbody>{shown.map((r:InventoryRow,i:number)=>{const low=isLowStock(r);return <tr key={`${r.product_id}-${r.date}-${i}`}><td><div className="product-cell"><span className="product-avatar">{r.product_id.slice(0,2).toUpperCase()}</span><span><strong>{r.product_id}</strong><small>{r.date?new Date(r.date).toLocaleDateString('en-IN'):'No date'}</small></span></div></td><td><span className="category-chip">{r.category}</span></td><td><div className="stock-cell"><strong>{r.stock_qty}</strong><span className="stock-track"><i style={{width:`${Math.min(100,r.reorder_level? r.stock_qty/r.reorder_level*55:0)}%`,background:low?'#d98068':'#4e8c70'}}/></span><small>Threshold {r.reorder_level}</small></div></td><td>{r.daily_sales} <span className="muted-cell">units</span></td><td>{r.lead_days} days</td><td>{r.supplier_id}</td><td><span className={`status-pill ${low?'status-low':'status-ok'}`}><i/>{low?'Reorder watch':'In range'}</span></td></tr>})}</tbody></table></div>{!compactView&&<div className="table-pagination"><span>Showing {rows.length?safePage*pageSize+1:0}–{Math.min((safePage+1)*pageSize,rows.length)} of {rows.length.toLocaleString()}</span><div><button className="pagination-button" disabled={safePage===0} onClick={()=>setPageIndex(safePage-1)}>Previous</button><button className="pagination-button" disabled={safePage>=maxPage} onClick={()=>setPageIndex(safePage+1)}>Next <ArrowRight size={13}/></button></div></div>}</>
}

function Reorders({rows,query,setQuery,onExport}:any) {
  const reorderRows=rows.filter(isLowStock).sort((a:InventoryRow,b:InventoryRow)=>(a.stock_qty-a.reorder_level)-(b.stock_qty-b.reorder_level))
  return <><div className="reorder-banner"><div className="reorder-banner-icon"><Bell size={21}/></div><div><strong>Threshold-based reorder watch</strong><p>These rows meet the simple rule <code>stock_qty ≤ reorder_level</code>. Order quantities are a baseline suggestion, not an optimized policy.</p></div><button className="button button-cream" onClick={onExport}><Download size={15}/> Export list</button></div><div className="stat-grid reorder-stats"><StatCard label="Rows to review" value={reorderRows.length.toLocaleString()} note="Records meeting threshold rule" icon={<Bell size={18}/>} tone="amber"/><StatCard label="Units below threshold" value={compact(reorderRows.reduce((s:number,r:InventoryRow)=>s+Math.max(0,r.reorder_level-r.stock_qty),0))} note="Sum of positive stock gaps" icon={<ArrowDownRight size={18}/>} tone="coral"/><StatCard label="Supplier IDs involved" value={new Set(reorderRows.map((r:InventoryRow)=>r.supplier_id)).size.toLocaleString()} note="Unique suppliers in flagged rows" icon={<Truck size={18}/>} tone="sage"/><StatCard label="Baseline order units" value={compact(reorderRows.reduce((s:number,r:InventoryRow)=>s+suggestedOrder(r),0))} note="Heuristic quantity; review before use" icon={<Boxes size={18}/>} tone="green"/></div><section className="panel"><div className="panel-heading"><div><h2>Products to review</h2><p>Sorted by largest stock gap relative to reorder level.</p></div><span className="result-count">{reorderRows.length.toLocaleString()} flagged rows</span></div><div className="table-toolbar"><div className="search-field"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search product, category or supplier…" aria-label="Search reorder records"/></div><span className="table-count">CSV-backed recommendations</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>Current stock</th><th>Threshold</th><th>Lead time</th><th>Demand × lead</th><th>Suggested order</th><th>Supplier</th></tr></thead><tbody>{reorderRows.filter((r:InventoryRow)=>`${r.product_id} ${r.category} ${r.supplier_id}`.toLowerCase().includes(query.toLowerCase())).slice(0,250).map((r:InventoryRow,i:number)=><tr key={`${r.product_id}-${r.date}-${i}`}><td><div className="product-cell"><span className="product-avatar">{r.product_id.slice(0,2)}</span><span><strong>{r.product_id}</strong><small>{r.category}</small></span></div></td><td><strong className="risk-number">{r.stock_qty}</strong></td><td>{r.reorder_level}</td><td>{r.lead_days} days</td><td>{r.daily_sales*r.lead_days} units</td><td><span className="order-quantity">{suggestedOrder(r)} units</span></td><td>{r.supplier_id}</td></tr>)}</tbody></table></div><div className="panel-bottom-note"><ShieldCheck size={15}/> Review suggested quantities against your actual safety-stock and purchasing policies before placing orders.</div></section></>
}

function Suppliers({data,onExport}:any) {
  const list=useMemo(()=>[...new Set(data.map((r:InventoryRow)=>r.supplier_id))].sort().map(id=>{const rows=data.filter((r:InventoryRow)=>r.supplier_id===id);return {id,records:rows.length,products:new Set(rows.map((r:InventoryRow)=>r.product_id)).size,avgLead:rows.reduce((s:number,r:InventoryRow)=>s+r.lead_days,0)/Math.max(1,rows.length),low:rows.filter(isLowStock).length,value:rows.reduce((s:number,r:InventoryRow)=>s+r.stock_qty*r.unit_cost,0)}}),[data])
  return <><div className="supplier-summary"><div><span className="panel-kicker">SUPPLIER NETWORK</span><h2>Know who your stock depends on.</h2><p>Supplier IDs and lead-time context from the uploaded dataset. Contact information and supplier names are not present in the source file.</p></div><button className="button button-outline" onClick={onExport}><Download size={15}/> Export source rows</button></div><div className="supplier-card-grid">{list.map((s:any,i:number)=><article className="supplier-card" key={s.id}><div className="supplier-card-top"><div className="supplier-logo">{s.id.slice(0,2).toUpperCase()}</div><span className="supplier-number">SUPPLIER {String(i+1).padStart(2,'0')}</span></div><h3>{s.id}</h3><div className="supplier-metrics"><div><span>Product IDs</span><strong>{s.products}</strong></div><div><span>Avg. lead time</span><strong>{s.avgLead.toFixed(1)} <small>days</small></strong></div></div><div className="supplier-card-bottom"><span><i className={s.low?'dot-coral':'dot-green'}/>{s.low.toLocaleString()} flagged rows</span><strong>{money(s.value)}</strong></div></article>)}</div></>
}

function Insights({data,categories,onNotify}:any) {
  const [showAll,setShowAll]=useState(false)
  const fields=[['date','Timestamp; confirm the business meaning and sampling frequency.'],['product_id','Product identifier; repeated IDs may represent multiple observations.'],['category','Product category used for grouping and filtering.'],['season','Season label in the source data.'],['stock_qty','Recorded stock quantity.'],['reorder_level','Threshold used by the baseline reorder rule.'],['daily_sales','Sales figure recorded per row; do not assume daily time series without validation.'],['unit_cost','Unit cost used to estimate stock value.'],['supplier_id','Supplier identifier; supplier names/contact data are not provided.'],['lead_days','Recorded supplier delivery lead time in days.']]
  const invalidDate=data.filter((r:InventoryRow)=>!r.date||Number.isNaN(new Date(r.date).getTime())).length
  const exactUnique=new Set(data.map((r:InventoryRow)=>JSON.stringify(r))).size
  return <><section className="insights-intro"><div className="insight-symbol"><Activity size={23}/></div><div><span className="panel-kicker">DATA BEFORE MODELS</span><h2>Understand the signal before you forecast it.</h2><p>This page documents what the current CSV supports, what the dashboard derives, and what still needs validation before ML results can be claimed.</p></div></section><div className="stat-grid"><StatCard label="Rows loaded" value={data.length.toLocaleString()} note="Parsed from the provided CSV" icon={<Boxes size={18}/>} tone="green"/><StatCard label="Unique product IDs" value={new Set(data.map((r:InventoryRow)=>r.product_id)).size.toLocaleString()} note="Distinct identifiers" icon={<Package size={18}/>} tone="sage"/><StatCard label="Unique supplier IDs" value={new Set(data.map((r:InventoryRow)=>r.supplier_id)).size.toLocaleString()} note="No supplier contact fields supplied" icon={<Truck size={18}/>} tone="amber"/><StatCard label="Invalid date rows" value={invalidDate.toLocaleString()} note="Date parsing check in browser" icon={<Clock3 size={18}/>} tone="coral"/></div><section className="panel data-dictionary"><div className="panel-heading"><div><h2>Data dictionary</h2><p>Column definitions for the supplied 10-field inventory log.</p></div><span className="result-count">10 fields</span></div><div className="dictionary-list">{fields.slice(0,showAll?fields.length:5).map(([name,desc])=><div className="dictionary-row" key={name}><code>{name}</code><span>{desc}</span></div>)}</div><button className="text-link dictionary-toggle" onClick={()=>setShowAll(!showAll)}>{showAll?'Show fewer fields':'Show all 10 fields'} <ChevronDown size={14}/></button></section><div className="dashboard-grid insight-bottom"><section className="panel"><div className="panel-heading"><div><h2>Validation checklist</h2><p>Work to complete before reporting forecasting performance.</p></div></div><div className="checklist"><div><span className="check-pending"><Clock3 size={15}/></span><p><strong>Validate timestamp semantics</strong><small>Determine whether each row is a point-in-time snapshot, a transaction, or a daily product record.</small></p></div><div><span className="check-pending"><Clock3 size={15}/></span><p><strong>Inspect product-level time coverage</strong><small>Check repeated dates, intervals, gaps, and whether daily sales is an observation or generated attribute.</small></p></div><div><span className="check-pending"><Clock3 size={15}/></span><p><strong>Build a chronological holdout</strong><small>Only after data semantics are established; avoid random splitting for a time series.</small></p></div><div><span className="check-pending"><Clock3 size={15}/></span><p><strong>Evaluate against a baseline</strong><small>Report MAE/RMSE only after training and testing actually run.</small></p></div></div></section><section className="panel"><div className="panel-heading"><div><h2>Derived values</h2><p>Calculation notes for transparency.</p></div></div><div className="formula-list"><div><strong>Inventory value</strong><code>stock_qty × unit_cost</code></div><div><strong>Low-stock rule</strong><code>stock_qty ≤ reorder_level</code></div><div><strong>Lead-time demand proxy</strong><code>daily_sales × lead_days</code></div><div><strong>Baseline order quantity</strong><code>max(0, reorder_level + proxy − stock_qty)</code></div></div><div className="notice-box"><ShieldCheck size={16}/><span>These are transparent descriptive calculations, not proof of an optimal replenishment policy or an ML forecast.</span></div></section></div></>
}

export default App
