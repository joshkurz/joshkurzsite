const OG_ENDPOINT = 'https://joshkurz.net/api/og'

// Builds a URL for the dynamic /api/og image-generation endpoint.
export function buildOgImageUrl({ title, subtitle, badge, emoji }) {
  const params = new URLSearchParams()
  if (title) params.set('title', title)
  if (subtitle) params.set('subtitle', subtitle)
  if (badge) params.set('badge', badge)
  if (emoji) params.set('emoji', emoji)
  return `${OG_ENDPOINT}?${params.toString()}`
}
