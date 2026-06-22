'use client'

import { useEffect } from 'react'

export default function LogoutPage() {
  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
        })
      } catch {
        // Ignore network failures and continue to the login page.
      } finally {
        if (active) {
          window.location.replace('/auth/login')
        }
      }
    }
    run()
    return () => {
      active = false
    }
  }, [])

  return null
}
