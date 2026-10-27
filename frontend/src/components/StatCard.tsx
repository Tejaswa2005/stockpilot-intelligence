import type { ReactNode } from 'react'
export default function StatCard({ label, value, note, icon, tone = 'green' }: {
  label: string; value: string; note: string; icon: ReactNode; tone?: string
}) {
  return <article className="stat-card">
    <div className="stat-top"><span className="stat-label">{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div>
    <div className="stat-value">{value}</div>
    <div className="stat-note">{note}</div>
  </article>
}
