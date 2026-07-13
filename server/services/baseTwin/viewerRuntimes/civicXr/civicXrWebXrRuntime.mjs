export function renderCivicXrWebXrRuntime() {
  return `
        async function initXr() {
          const xrStatus = document.getElementById('civic-xr-webxr')
          const xr = navigator.xr
          const vrSupported = Boolean(xr && await xr.isSessionSupported?.('immersive-vr').catch(() => false))
          const arSupported = Boolean(xr && await xr.isSessionSupported?.('immersive-ar').catch(() => false))
          xrSupport = { ar: arSupported, vr: vrSupported }
          xrSessionState = { ...xrSessionState, supported: true, arSupported, vrSupported }
          if (xrStatus) {
            xrStatus.textContent = arSupported
              ? 'WebXR AR available'
              : vrSupported
                ? 'WebXR VR available'
                : 'Desktop 3D active'
          }
          if (!scene?.createDefaultXRExperienceAsync || (!vrSupported && !arSupported)) return
          xrExperience = await scene.createDefaultXRExperienceAsync({
            floorMeshes: [document.__civicXrGround].filter(Boolean),
            optionalFeatures: ['hit-test', 'anchors', 'hand-tracking'],
            uiOptions: {
              sessionMode: arSupported ? 'immersive-ar' : 'immersive-vr',
              referenceSpaceType: 'local-floor',
            },
          }).catch((error) => {
            console.warn('Civic XR WebXR session bootstrap unavailable', error)
            return null
          })
        }

        async function enterXrSession(modeKey) {
          const sessionMode = modeKey === 'ar' ? 'immersive-ar' : 'immersive-vr'
          document.querySelectorAll('[data-civic-xr-session]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.civicXrSession === modeKey)
          })
          if (modeKey === 'desktop') {
            xrSessionState = { requestedMode: 'desktop', sessionMode: 'inline', active: false, supported: true, requiresUserGesture: false }
            setStatus('Desktop 3D active', 'Street-scale desktop inspection is active.')
            broadcastCivicVisualState()
            return
          }
          const supported = modeKey === 'ar' ? xrSupport.ar : xrSupport.vr
          xrSessionState = { requestedMode: modeKey, sessionMode, active: false, supported, requiresUserGesture: true }
          if (!supported || !xrExperience?.baseExperience?.enterXRAsync) {
            setStatus('XR hardware unavailable', modeKey.toUpperCase() + ' is not available in this browser. Desktop 3D remains active.')
            broadcastCivicVisualState()
            return
          }
          await xrExperience.baseExperience.enterXRAsync(
            sessionMode,
            'local-floor',
            document.__civicXrGround,
          ).then(() => {
            xrSessionState = { requestedMode: modeKey, sessionMode, active: true, supported: true, requiresUserGesture: false }
            broadcastCivicVisualState()
          }).catch((error) => {
            xrSessionState = { requestedMode: modeKey, sessionMode, active: false, supported: true, requiresUserGesture: true, error: String(error?.message || error) }
            console.warn('Civic XR session unavailable', error)
            setStatus('XR session unavailable', String(error?.message || error))
            broadcastCivicVisualState()
          })
        }

        function bindPresenceControls() {
          document.querySelectorAll('[data-civic-xr-session]').forEach((button) => {
            button.addEventListener('click', () => enterXrSession(button.dataset.civicXrSession))
          })
          document.querySelector('[data-civic-xr-fullscreen]')?.addEventListener('click', () => {
            document.querySelector('.scene-stage--civic-xr')?.requestFullscreen?.()
          })
        }
  `
}
