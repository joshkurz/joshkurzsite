import { ImageResponse } from 'next/og'

export const config = { runtime: 'edge' }

const BG = 'linear-gradient(180deg, #0a0a0a 0%, #111111 100%)'

export default function handler(request) {
  const { searchParams } = new URL(request.url)
  const title = (searchParams.get('title') || 'JoshKurz.net').slice(0, 120)
  const subtitle = (searchParams.get('subtitle') || '').slice(0, 160)
  const badge = (searchParams.get('badge') || '').slice(0, 40)
  const emoji = (searchParams.get('emoji') || '').slice(0, 8)

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: BG,
          padding: '80px',
          position: 'relative',
        }}
      >
        {badge && (
          <div
            style={{
              display: 'flex',
              background: 'linear-gradient(135deg, #f39c12, #e67e22)',
              color: 'white',
              fontSize: 28,
              fontWeight: 700,
              padding: '10px 32px',
              borderRadius: 999,
              marginBottom: 36,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {badge}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: title.length > 60 ? 58 : 74,
            fontWeight: 800,
            color: '#f8fafc',
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: 1000,
          }}
        >
          {emoji && <span style={{ marginRight: 24 }}>{emoji}</span>}
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              color: 'rgba(226,232,240,0.7)',
              marginTop: 28,
              textAlign: 'center',
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: 48,
            fontSize: 28,
            color: '#f7dc6f',
            fontWeight: 700,
          }}
        >
          JoshKurz.net
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, immutable, no-transform, max-age=31536000',
      },
    }
  )
}
