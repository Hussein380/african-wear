'use client'

import { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    const checkDismissed = localStorage.getItem('pwa_prompt_dismissed')
    if (checkDismissed) {
      setIsDismissed(true)
    }

    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e)
      // Update UI notify the user they can install the PWA
      setIsVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    window.addEventListener('appinstalled', () => {
      // Hide the app-provided install promotion
      setIsVisible(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    // Show the install prompt
    deferredPrompt.prompt()
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsVisible(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setIsVisible(false)
    setIsDismissed(true)
    localStorage.setItem('pwa_prompt_dismissed', 'true')
  }

  if (!isVisible || isDismissed) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 'max(env(safe-area-inset-bottom, 20px), 20px)',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: '400px',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      alignItems: 'center',
      padding: '16px',
      gap: '12px',
      zIndex: 9999,
      border: '1px solid #E5E5E5'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: '#F2F0F1'
      }}>
        <img src="/icon-192x192.png" alt="App Icon" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      </div>
      <div style={{ flex: 1, paddingRight: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>Install Mandera App</h4>
        <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#5A5A5A', lineHeight: 1.3 }}>Add to home screen for faster access</p>
      </div>
      <button 
        onClick={handleInstallClick}
        style={{
          backgroundColor: '#5B1A3E',
          color: 'white',
          border: 'none',
          padding: '8px 18px',
          borderRadius: '24px',
          fontWeight: 600,
          fontSize: '13px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(91, 26, 62, 0.3)'
        }}
      >
        Install
      </button>
      <button 
        onClick={handleDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: '#8A8A8A',
          padding: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          top: '2px',
          right: '2px'
        }}
        aria-label="Dismiss"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  )
}
