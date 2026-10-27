import { Boxes } from 'lucide-react'
export default function Brand({ inverse = false }: { inverse?: boolean }) {
  return <div className={`brand ${inverse ? 'brand-inverse' : ''}`}>
    <span className="brand-mark"><Boxes size={19} strokeWidth={2.2} /></span>
    <span className="brand-copy"><strong>stockpilot</strong><small>INTELLIGENCE</small></span>
  </div>
}
