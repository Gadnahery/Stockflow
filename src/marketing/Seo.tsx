import { useEffect } from 'react'
import { applySeo, type SeoProps } from '../lib/seo'

/** Sets document head for public marketing pages. */
export default function Seo(props: SeoProps) {
  useEffect(() => {
    applySeo(props)
  }, [props.title, props.description, props.path, props.type, props.noindex, props.image])
  return null
}
