'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Monitor, Smartphone } from 'react-feather'
import { Button, Card } from 'react-bootstrap'
import { usePlatformContext } from '@/context/PlatformContext'

const DESKTOP_MIN_WIDTH = 1180
const BYPASS_KEY = 'twin-desktop-first-bypass'

const DesktopFirstGate = ({ surfaceName = 'workspace', description }) => {
  const { activeCity } = usePlatformContext()
  const [isCompact, setIsCompact] = useState(false)
  const [bypass, setBypass] = useState(false)

  useEffect(() => {
    const nextBypass = window.sessionStorage.getItem(BYPASS_KEY) === '1'
    setBypass(nextBypass)

    const syncViewport = () => {
      setIsCompact(window.innerWidth < DESKTOP_MIN_WIDTH)
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  const handleContinue = () => {
    window.sessionStorage.setItem(BYPASS_KEY, '1')
    setBypass(true)
  }

  if (!isCompact || bypass) return null

  const cityName = activeCity?.name || 'this city'

  return (
    <div className="dt-mobile-gate">
      <Card className="card-border dt-mobile-gate__card">
        <Card.Body className="dt-mobile-gate__body">
          <div className="dt-mobile-gate__icon">
            <Monitor size={26} />
          </div>
          <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">
            Desktop-first experience
          </div>
          <h2 className="h3 mb-3">{surfaceName} is designed for desktop review</h2>
          <p className="mb-3">
            This {surfaceName.toLowerCase()} uses dense spatial controls, layered maps, and multi-panel reading. On a phone it will look broken
            and hide important context.
          </p>
          <div className="dt-mobile-gate__city">
            <strong>{cityName}</strong>
            <span>{description || 'Open the workspace from a desktop or laptop for the intended experience.'}</span>
          </div>
          <div className="dt-mobile-gate__tips">
            <div className="dt-mobile-gate__tip">
              <Monitor size={16} />
              <span>Recommended: laptop or desktop browser</span>
            </div>
            <div className="dt-mobile-gate__tip">
              <Smartphone size={16} />
              <span>You can continue on mobile, but the layout may be incomplete.</span>
            </div>
          </div>
          <div className="dt-mobile-gate__actions">
            <Button variant="primary" onClick={handleContinue}>
              Continue anyway
            </Button>
            <Button as={Link} href="/auth/login" variant="outline-light">
              Back to sign in
            </Button>
          </div>
          <div className="dt-mobile-gate__warning">
            <AlertTriangle size={14} />
            <span>The desktop recommendation is a product guard, not an access restriction.</span>
          </div>
        </Card.Body>
      </Card>
    </div>
  )
}

export default DesktopFirstGate
