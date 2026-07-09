'use client'

import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import PinAuth from '@/components/PinAuth'

function HomeContent() {
  const searchParams = useSearchParams()
  const authRequired = searchParams.get('auth') === 'required'
  const [showPin, setShowPin] = useState(authRequired)

  if (showPin) {
    return <PinAuth />
  }

  return (
    <div className="landing">
      <div className="landing__content">
        <div className="landing__logo">
          <img src="/mandera-logo.png" alt="Mandera African Wear" />
        </div>
        <h1 className="landing__title">Mandera African Wear</h1>
        <p className="landing__subtitle">Stock Management System</p>
        <button
          className="landing__enter-btn"
          onClick={() => setShowPin(true)}
          type="button"
        >
          Enter Stock Manager →
        </button>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="landing">
        <div className="landing__content">
          <div className="landing__logo">
            <img src="/mandera-logo.png" alt="Mandera African Wear" />
          </div>
          <h1 className="landing__title">Mandera African Wear</h1>
          <p className="landing__subtitle">Stock Management System</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
