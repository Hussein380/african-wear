'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PinAuth() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const maxLength = 4

  const handleKeyPress = useCallback((digit: string) => {
    if (isLoading) return
    setError('')
    setPin(prev => {
      if (prev.length >= maxLength) return prev
      return prev + digit
    })
  }, [isLoading])

  useEffect(() => {
    if (pin.length === maxLength && !isLoading) {
      const verifyPin = async () => {
        setIsLoading(true)
        try {
          const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin }),
          })

          if (res.ok) {
            router.push('/classify')
          } else {
            setError('Incorrect PIN')
            setPin('')
          }
        } catch {
          setError('Connection error')
          setPin('')
        } finally {
          setIsLoading(false)
        }
      }
      verifyPin()
    }
  }, [pin, isLoading, router])

  const handleBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1))
    setError('')
  }, [])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

  return (
    <div className="pin-screen">
      <div className="pin-screen__card">
        <div className="pin-screen__logo">
          <img src="/mandera-logo.png" alt="Mandera African Wear" />
        </div>
        <h2 className="pin-screen__title">Welcome Back</h2>
        <p className="pin-screen__subtitle">Enter your PIN to continue</p>

        <div className="pin-screen__dots">
          {Array.from({ length: maxLength }).map((_, i) => (
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
        </div>

        <div className="pin-screen__keypad">
          {keys.map((key, i) => (
            <button
              key={i}
              className={`pin-screen__key ${
                key === '⌫' ? 'pin-screen__key--backspace' : ''
              } ${key === '' ? 'pin-screen__key--empty' : ''}`}
              onClick={() => {
                if (key === '⌫') handleBackspace()
                else if (key !== '') handleKeyPress(key)
              }}
              disabled={isLoading}
              type="button"
            >
              {key}
            </button>
          ))}
        </div>

        {error && <p className="pin-screen__error">{error}</p>}
      </div>
    </div>
  )
}
