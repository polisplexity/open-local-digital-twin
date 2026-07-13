export function renderCivicXrSessionRuntime() {
  return `
        function vectorSnapshot(vector = {}) {
          return {
            x: finiteNumber(vector.x),
            y: finiteNumber(vector.y),
            z: finiteNumber(vector.z),
          }
        }

        function applyVectorSnapshot(target, vector = {}) {
          if (!target || !vector || typeof vector !== 'object') return false
          if (![vector.x, vector.y, vector.z].every((value) => Number.isFinite(Number(value)))) return false
          target.set(Number(vector.x), Number(vector.y), Number(vector.z))
          return true
        }

        function currentCivicCameraState() {
          const activeCamera = scene?.activeCamera || (activeExperienceMode === 'walk' ? streetCamera : camera)
          if (!activeCamera) return null
          const base = {
            mode: 'babylon-civic-xr-camera',
            experienceMode: activeExperienceMode,
            activeCamera: activeCamera.name || (activeCamera === streetCamera ? 'UniversalCamera' : 'ArcRotateCamera'),
            position: vectorSnapshot(activeCamera.position),
            fov: Number(activeCamera.fov || 0),
          }
          if (activeCamera === streetCamera) {
            const forward = activeCamera.getForwardRay?.(8)?.direction
            return {
              ...base,
              cameraType: 'street-presence',
              rotation: vectorSnapshot(activeCamera.rotation),
              direction: forward ? vectorSnapshot(forward) : null,
              speed: Number(streetCamera.speed || 0),
              ellipsoid: vectorSnapshot(streetCamera.ellipsoid),
            }
          }
          return {
            ...base,
            cameraType: 'inspection-orbit',
            alpha: Number(camera?.alpha || 0),
            beta: Number(camera?.beta || 0),
            radius: Number(camera?.radius || 0),
            target: vectorSnapshot(camera?.target || camera?.getTarget?.() || {}),
          }
        }

        function broadcastCivicVisualState(extra = {}) {
          broadcast('twin:state', {
            xrMode: activeExperienceMode,
            camera: currentCivicCameraState(),
            xrSession: { ...xrSessionState },
            runtime: 'babylon-webxr',
            ...extra,
          })
        }

        function applyCivicCameraState(cameraState = {}) {
          if (!scene || !cameraState || typeof cameraState !== 'object') return
          const savedMode = cameraState.experienceMode || cameraState.xrMode || activeExperienceMode
          if (savedMode && EXPERIENCE_MODES[savedMode] && savedMode !== activeExperienceMode) {
            activeExperienceMode = savedMode
            applyCameraPolicy(currentSceneModel)
          }
          const wantsWalk = cameraState.cameraType === 'street-presence' || cameraState.activeCamera === 'civic-xr-street-camera' || activeExperienceMode === 'walk'
          if (wantsWalk && streetCamera) {
            scene.activeCamera = streetCamera
            camera?.detachControl()
            streetCamera.attachControl(scene.getEngine().getRenderingCanvas(), true)
            applyVectorSnapshot(streetCamera.position, cameraState.position)
            applyVectorSnapshot(streetCamera.rotation, cameraState.rotation)
            if (Number.isFinite(Number(cameraState.fov))) streetCamera.fov = Number(cameraState.fov)
            if (Number.isFinite(Number(cameraState.speed))) streetCamera.speed = Number(cameraState.speed)
            if (cameraState.ellipsoid) applyVectorSnapshot(streetCamera.ellipsoid, cameraState.ellipsoid)
            updateStreetCameraClamp()
            broadcastCivicVisualState()
            return
          }
          if (!camera) return
          streetCamera?.detachControl()
          scene.activeCamera = camera
          camera.attachControl(scene.getEngine().getRenderingCanvas(), true)
          applyVectorSnapshot(camera.position, cameraState.position)
          if (cameraState.target) camera.setTarget(new Vector3(finiteNumber(cameraState.target.x), finiteNumber(cameraState.target.y), finiteNumber(cameraState.target.z)))
          if (Number.isFinite(Number(cameraState.alpha))) camera.alpha = Number(cameraState.alpha)
          if (Number.isFinite(Number(cameraState.beta))) camera.beta = Number(cameraState.beta)
          if (Number.isFinite(Number(cameraState.radius))) camera.radius = Number(cameraState.radius)
          if (Number.isFinite(Number(cameraState.fov))) camera.fov = Number(cameraState.fov)
          broadcastCivicVisualState()
        }

        function applyXrSessionState(nextState = {}) {
          const requestedMode = ['desktop', 'vr', 'ar'].includes(nextState.requestedMode || nextState.mode)
            ? (nextState.requestedMode || nextState.mode)
            : 'desktop'
          const sessionMode = requestedMode === 'ar' ? 'immersive-ar' : requestedMode === 'vr' ? 'immersive-vr' : 'inline'
          const supported = requestedMode === 'ar' ? xrSupport.ar : requestedMode === 'vr' ? xrSupport.vr : true
          xrSessionState = {
            requestedMode,
            sessionMode,
            active: false,
            supported,
            requiresUserGesture: requestedMode !== 'desktop',
            restoredAt: new Date().toISOString(),
          }
          document.querySelectorAll('[data-civic-xr-session]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.civicXrSession === requestedMode)
          })
          if (requestedMode !== 'desktop') {
            setStatus(requestedMode.toUpperCase() + ' ready', 'Saved view restored. Use the ' + requestedMode.toUpperCase() + ' control to enter the browser WebXR session.')
          }
          broadcastCivicVisualState()
        }
  `
}
