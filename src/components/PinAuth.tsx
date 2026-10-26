'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const MAX_LENGTH = 4

export default function PinAuth() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  // Guards against double submission (the old effect-based flow posted twice)
  const submittingRef = useRef(false)

  useEffect(() => {
    router.prefetch('/classify')
    inputRef.current?.focus()
  }, [router])

  const verifyPin = async (value: string) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: value }),
      })

      if (res.ok) {
        // Stay in loading state while navigating; replace so Back doesn't return to login
        router.replace('/classify')
        return
      }
      setError('Incorrect PIN')
      setPin('')
    } catch {
      setError('Connection error')
      setPin('')
    }
    submittingRef.current = false
    setIsLoading(false)
    inputRef.current?.focus()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading) return
    const value = e.target.value.replace(/\D/g, '').slice(0, MAX_LENGTH)
    setError('')
    setPin(value)
    if (value.length === MAX_LENGTH) verifyPin(value)
  }

  return (
    <div className="pin-screen" onClick={() => inputRef.current?.focus()}>
      <div className="pin-screen__card">
        <div className="pin-screen__logo">
          <img src="/mandera-logo.png" alt="Mandera African Wear" />
        </div>
        <h2 className="pin-screen__title">Welcome Back</h2>
        <p className="pin-screen__subtitle">
          {isLoading ? 'Signing in…' : 'Type your PIN to continue'}
        </p>

        <div className="pin-screen__dots" style={{ position: 'relative' }}>
          {Array.from({ length: MAX_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`pin-screen__dot ${
                i < pin.length
                  ? error
                    ? 'pin-screen__dot--error'
                    : 'pin-screen__dot--filled'
                  : ''
              }`}
            />
          ))}
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            autoFocus
            maxLength={MAX_LENGTH}
            value={pin}
            onChange={handleChange}
            disabled={isLoading}
            aria-label="Enter your PIN"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'text',
              fontSize: '16px', // prevents iOS zoom on focus
            }}
          />
        </div>

        {error && <p className="pin-screen__error">{error}</p>}
      </div>
    </div>
  )
}
