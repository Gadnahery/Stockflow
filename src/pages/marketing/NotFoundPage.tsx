import { Link } from 'react-router-dom'
import Seo from '../../marketing/Seo'

export default function NotFoundPage() {
  return (
    <>
      <Seo title="Page not found" description="The page you requested does not exist." path="/404" noindex />
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-[48px] font-bold text-ink-muted">404</p>
        <h1 className="mt-2 text-[22px] font-bold">Page not found</h1>
        <p className="mt-2 text-[15px] text-ink-secondary">The link may be outdated or mistyped.</p>
        <Link to="/" className="press mt-6 inline-flex h-11 px-5 rounded-full bg-primary text-white font-semibold text-[14px]">
          Back to home
        </Link>
      </div>
    </>
  )
}
