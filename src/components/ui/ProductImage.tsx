import { tintFor } from '../../lib/util'

/** Product photo, or a soft tinted tile with the initial when there is none. */
export default function ProductImage({
  name, src, className = '', textClass = 'text-2xl',
}: { name: string; src?: string; className?: string; textClass?: string }) {
  if (src) {
    return <img src={src} alt={name} loading="lazy" draggable={false} className={`object-cover ${className}`} />
  }
  const [bg, fg] = tintFor(name)
  return (
    <div className={`flex items-center justify-center font-bold ${textClass} ${className}`} style={{ background: bg, color: fg }} aria-hidden>
      {name.trim().charAt(0).toUpperCase()}
    </div>
  )
}
