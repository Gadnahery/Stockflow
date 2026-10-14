import type { ReactNode } from 'react'

/** Shared chrome for login / signup / onboarding — always light, readable */
export default function AuthShell({
  children,
  title,
  subtitle,
  footer,
}: {
  children: ReactNode
  title: string
  subtitle?: string
  footer?: ReactNode
}) {
  return (
    <div className="auth-canvas min-h-full flex flex-col items-center justify-center px-5 py-10 sm:py-14">
      <div className="auth-blob auth-blob-a" aria-hidden />
      <div className="auth-blob auth-blob-b" aria-hidden />

      <div className="relative w-full max-w-[400px] page-enter">
        <div className="text-center mb-7">
          <div className="auth-logo mx-auto mb-5">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6h15l-1.6 8.2a2 2 0 0 1-2 1.6H8.2a2 2 0 0 1-2-1.6L4.4 3H2" />
              <circle cx="9" cy="20" r="1.4" />
              <circle cx="18" cy="20" r="1.4" />
            </svg>
          </div>
          <h1
            className="text-[28px] sm:text-[30px] font-bold tracking-tight leading-tight"
            style={{ color: '#1C1C1E' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="mt-2 text-[15px] leading-snug max-w-[320px] mx-auto"
              style={{ color: '#636366' }}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div className="auth-card">{children}</div>

        {footer && (
          <div className="mt-6 text-center text-[15px] space-y-3" style={{ color: '#636366' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
