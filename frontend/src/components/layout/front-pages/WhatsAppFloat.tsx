'use client'

import { useState, useEffect } from 'react'

interface WidgetConfig {
  enabled: boolean
  phone: string
  message: string
  position: string
  label: string
}

const WhatsAppFloat = () => {
  const [config, setConfig] = useState<WidgetConfig | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nepalfillings.com/api'
        const res = await fetch(`${apiUrl}/public/widget/whatsapp`)
        const data = await res.json()

        if (data.success && data.data?.enabled) {
          setConfig(data.data)

          // Show tooltip after 3 seconds
          setTimeout(() => setShowTooltip(true), 3000)
          setTimeout(() => setShowTooltip(false), 8000)
        }
      } catch {
        // Silently fail - widget is optional
      }
    }

    fetchConfig()
  }, [])

  if (!config || !config.enabled) return null

  const phone = config.phone.replace(/[^0-9]/g, '')
  const encodedMsg = encodeURIComponent(config.message)
  const whatsappUrl = `https://wa.me/${phone}?text=${encodedMsg}`
  const isRight = config.position !== 'left'

  return (
    <>
      {/* Tooltip */}
      {showTooltip && (
        <div
          onClick={() => setShowTooltip(false)}
          style={{
            position: 'fixed',
            bottom: 90,
            [isRight ? 'right' : 'left']: 24,
            backgroundColor: '#fff',
            color: '#1a1a2e',
            padding: '10px 16px',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            fontSize: 14,
            fontWeight: 500,
            zIndex: 9998,
            cursor: 'pointer',
            maxWidth: 220,
            animation: 'waFloatIn 0.3s ease-out'
          }}
        >
          {config.label || 'Chat with us'}
          <div
            style={{
              position: 'absolute',
              bottom: -6,
              [isRight ? 'right' : 'left']: 28,
              width: 12,
              height: 12,
              backgroundColor: '#fff',
              transform: 'rotate(45deg)',
              boxShadow: '2px 2px 4px rgba(0,0,0,0.1)'
            }}
          />
        </div>
      )}

      {/* WhatsApp Button */}
      <a
        href={whatsappUrl}
        target='_blank'
        rel='noopener noreferrer'
        aria-label='Chat on WhatsApp'
        style={{
          position: 'fixed',
          bottom: 24,
          [isRight ? 'right' : 'left']: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: '#25D366',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(37, 211, 102, 0.4)',
          zIndex: 9999,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          cursor: 'pointer',
          animation: 'waFloatIn 0.5s ease-out'
        }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(37, 211, 102, 0.5)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(37, 211, 102, 0.4)'
        }}
      >
        <svg viewBox='0 0 32 32' width='30' height='30' fill='#fff'>
          <path d='M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.497 1.132 6.736 3.053 9.37L1.055 31.37l6.2-1.966a15.91 15.91 0 008.749 2.6C24.826 32 32 24.826 32 16.004S24.826 0 16.004 0zm9.53 22.602c-.4 1.13-2.35 2.16-3.28 2.24-.87.07-1.96.13-3.16-.4-1.83-.74-3.01-1.58-4.22-3.59-.98-1.63-1.97-4.37-.29-6.37 1.26-1.5 2.5-1.11 3.16-.74.66.37 1.08.66 1.32 1.13.24.47.57 1.4.2 2.28-.37.88-.57 1.04-.84 1.34-.27.3.12.7.64 1.3.74.87 1.52 1.5 2.4 1.97.56.3.97.21 1.34-.16.37-.37.84-1.08 1.21-1.45.37-.37.74-.3 1.24-.1.5.2 3.17 1.5 3.71 1.77.54.27.9.4 1.03.63.13.22.13 1.3-.27 2.43z' />
        </svg>
      </a>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes waFloatIn {
          from { opacity: 0; transform: translateY(20px) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `
        }}
      />
    </>
  )
}

export default WhatsAppFloat
