export function renderCityCesiumCameraRuntime() {
  return String.raw`        function configureUrbanCameraControls() {
          if (!viewer?.scene?.screenSpaceCameraController) return
          const controller = viewer.scene.screenSpaceCameraController
          if ('enableInputs' in controller) controller.enableInputs = true
          controller.enableLook = false
          controller.enableTilt = true
          controller.enableRotate = true
          controller.enableTranslate = true
          controller.enableZoom = true
          controller.enableCollisionDetection = true
          controller.minimumZoomDistance = cameraMinimumHeight()
          controller.maximumZoomDistance = CAMERA_MAX_RANGE_M
          controller.inertiaSpin = 0.08
          controller.inertiaTranslate = 0
          controller.inertiaZoom = 0.08
          controller.bounceAnimationTime = 0
          controller.maximumMovementRatio = 0.06
          controller.maximumTiltAngle = Math.PI / 2.0
          controller.zoomFactor = 2.2
          if (CesiumLib.CameraEventType) {
            controller.rotateEventTypes = CesiumLib.CameraEventType.LEFT_DRAG
            controller.zoomEventTypes = [
              CesiumLib.CameraEventType.WHEEL,
              CesiumLib.CameraEventType.PINCH,
            ]
            controller.tiltEventTypes = [
              CesiumLib.CameraEventType.RIGHT_DRAG,
              CesiumLib.KeyboardEventModifier
                ? { eventType: CesiumLib.CameraEventType.LEFT_DRAG, modifier: CesiumLib.KeyboardEventModifier.CTRL }
                : CesiumLib.CameraEventType.RIGHT_DRAG,
            ]
            controller.lookEventTypes = undefined
          }
          viewer.camera.constrainedAxis = CesiumLib.Cartesian3.UNIT_Z
          viewer.camera.percentageChanged = 0.04
        }

        function clampNumber(value, min, max) {
          const numeric = Number(value)
          if (!Number.isFinite(numeric)) return min
          return Math.min(max, Math.max(min, numeric))
        }

        function boundsCenter(bounds) {
          const normalized = normalizedBounds(bounds)
          if (!normalized) return null
          return {
            lon: (normalized.minLon + normalized.maxLon) / 2,
            lat: (normalized.minLat + normalized.maxLat) / 2,
          }
        }

        function cameraFocusBounds() {
          return normalizedBounds(activeCameraFocusBounds) ||
            boundsFromPrimitives(activeQuerySelection?.primitives) ||
            boundsFromGeojson(activeQuerySelection?.geojson || featureCollection([])) ||
            boundsFromGeojson(payload?.layers?.boundary)
        }

        function cameraInteractionBounds() {
          const focusBounds = cameraFocusBounds()
          if (!focusBounds) return null
          const activeQuery = Boolean(activeQuerySelection)
          const padded = padBounds(focusBounds, activeQuery ? 0.9 : 0.12)
          if (!padded) return null
          const center = boundsCenter(focusBounds)
          if (!center) return padded
          const minLonSpan = activeQuery ? 0.012 : 0.04
          const minLatSpan = activeQuery ? 0.012 : 0.04
          const lonSpan = Math.max(padded.maxLon - padded.minLon, minLonSpan)
          const latSpan = Math.max(padded.maxLat - padded.minLat, minLatSpan)
          return {
            minLon: center.lon - lonSpan / 2,
            minLat: center.lat - latSpan / 2,
            maxLon: center.lon + lonSpan / 2,
            maxLat: center.lat + latSpan / 2,
          }
        }

        function clampCameraTarget(lon, lat, bounds = cameraInteractionBounds()) {
          const normalized = normalizedBounds(bounds)
          if (!normalized) return { lon, lat }
          return {
            lon: clampNumber(lon, normalized.minLon, normalized.maxLon),
            lat: clampNumber(lat, normalized.minLat, normalized.maxLat),
          }
        }

        function cameraMinimumRange() {
          return Math.max(CAMERA_MIN_RANGE_M, cameraMinimumHeight() + 120)
        }

        function currentCameraStateFallback() {
          const cartographic = viewer?.camera?.positionCartographic
          const center = boundsCenter(cameraFocusBounds()) || {
            lon: Number(payload?.center?.lon ?? payload?.city?.lon ?? 0),
            lat: Number(payload?.center?.lat ?? payload?.city?.lat ?? 0),
          }
          return {
            targetLon: Number.isFinite(center.lon) ? center.lon : 0,
            targetLat: Number.isFinite(center.lat) ? center.lat : 0,
            targetHeight: 0,
            headingDegrees: CesiumLib.Math.toDegrees(viewer?.camera?.heading || 0),
            pitchDegrees: CesiumLib.Math.toDegrees(viewer?.camera?.pitch || CesiumLib.Math.toRadians(-55)),
            rangeMeters: clampNumber(cartographic?.height || 3000, cameraMinimumRange(), CAMERA_MAX_RANGE_M),
          }
        }

        function setBoundedCameraView(nextState = {}, options = {}) {
          if (!viewer?.camera) return null
          const previous = boundedCameraState || currentCameraStateFallback()
          const bounds = normalizedBounds(nextState.bounds) || cameraInteractionBounds()
          const target = clampCameraTarget(
            Number(nextState.targetLon ?? previous.targetLon),
            Number(nextState.targetLat ?? previous.targetLat),
            bounds,
          )
          const state = {
            targetLon: target.lon,
            targetLat: target.lat,
            targetHeight: Number(nextState.targetHeight ?? previous.targetHeight ?? 0),
            headingDegrees: Number(nextState.headingDegrees ?? previous.headingDegrees ?? 0),
            pitchDegrees: clampNumber(Number(nextState.pitchDegrees ?? previous.pitchDegrees ?? -55), -82, -20),
            rangeMeters: clampNumber(Number(nextState.rangeMeters ?? previous.rangeMeters ?? 3000), cameraMinimumRange(), CAMERA_MAX_RANGE_M),
            bounds,
          }
          boundedCameraState = state
          const targetCartesian = CesiumLib.Cartesian3.fromDegrees(state.targetLon, state.targetLat, state.targetHeight)
          const offset = new CesiumLib.HeadingPitchRange(
            CesiumLib.Math.toRadians(state.headingDegrees),
            CesiumLib.Math.toRadians(state.pitchDegrees),
            state.rangeMeters,
          )
          viewer.camera.lookAt(targetCartesian, offset)
          viewer.camera.lookAtTransform(CesiumLib.Matrix4.IDENTITY)
          viewer.scene.requestRender()
          if (options.broadcast !== false) {
            broadcast('twin:state', {
              camera: {
                mode: 'bounded-query-camera',
                targetLon: state.targetLon,
                targetLat: state.targetLat,
                rangeMeters: Math.round(state.rangeMeters),
                headingDegrees: Math.round(state.headingDegrees),
                pitchDegrees: Math.round(state.pitchDegrees),
              },
            })
          }
          return state
        }

        function installStableCameraInteractions() {
          if (stableCameraInteractionsInstalled || !viewer?.scene?.canvas) return
          stableCameraInteractionsInstalled = true
          const canvas = viewer.scene.canvas
          canvas.addEventListener('contextmenu', (event) => event.preventDefault())
        }

        function stabilizeCameraHeight() {
          if (!viewer?.camera) return
          const cartographic = viewer.camera.positionCartographic
          if (!cartographic || !Number.isFinite(cartographic.height)) return
          const minHeight = cameraMinimumHeight()
          const maxHeight = CAMERA_MAX_RANGE_M
          let needsCorrection = cartographic.height < minHeight || cartographic.height > maxHeight
          let lon = CesiumLib.Math.toDegrees(cartographic.longitude)
          let lat = CesiumLib.Math.toDegrees(cartographic.latitude)
          if (!needsCorrection) return
          viewer.camera.setView({
            destination: CesiumLib.Cartesian3.fromDegrees(
              lon,
              lat,
              clampNumber(cartographic.height, minHeight, maxHeight),
            ),
            orientation: {
              heading: viewer.camera.heading,
              pitch: Math.min(viewer.camera.pitch, CesiumLib.Math.toRadians(-18)),
              roll: 0,
            },
          })
          viewer.scene.requestRender()
        }

        function bindCameraStabilizer() {
          let scheduled = false
          viewer.camera.changed.addEventListener(() => {
            if (scheduled) return
            scheduled = true
            window.requestAnimationFrame(() => {
              scheduled = false
              stabilizeCameraHeight()
            })
          })
        }

        function fitToPayload(payload, options = {}) {
          const boundaryBounds = boundsFromGeojson(payload?.layers?.boundary)
          if (boundaryBounds) {
            moveCameraToBounds(padBounds(boundaryBounds, options.startup ? 0.06 : 0.02), {
              animate: Boolean(options.animate),
              pitchDegrees: options.startup ? -82 : -64,
              heightMultiplier: options.startup ? 128000 : 145000,
            })
            return
          }
          const lon = Number(payload?.center?.lon ?? payload?.city?.lon)
          const lat = Number(payload?.center?.lat ?? payload?.city?.lat)
          if (Number.isFinite(lon) && Number.isFinite(lat)) {
            viewer.camera.setView({
              destination: CesiumLib.Cartesian3.fromDegrees(lon, lat, 9000),
              orientation: {
                heading: 0,
                pitch: CesiumLib.Math.toRadians(options.startup ? -82 : -60),
                roll: 0,
              },
            })
          }
        }

        function flyToGeojson(geojson) {
          const bounds = boundsFromGeojson(geojson)
          if (bounds) {
            moveCameraToBounds(bounds)
          }
        }

        function boundsMeters(bounds) {
          const centerLat = (bounds.minLat + bounds.maxLat) / 2
          const lonMeters = Math.abs(bounds.maxLon - bounds.minLon) * Math.max(1, Math.cos(centerLat * Math.PI / 180) * 111320)
          const latMeters = Math.abs(bounds.maxLat - bounds.minLat) * 111320
          return Math.max(lonMeters, latMeters, 600)
        }

        function moveCameraToBounds(bounds, options = {}) {
          const normalized = normalizedBounds(bounds)
          if (!normalized) return
          if (options.trackFocus !== false) activeCameraFocusBounds = normalized
          const range = Math.max(
            Number(options.minRange ?? 950),
            boundsMeters(normalized) * Number(options.rangeMultiplier ?? 1.35),
          )
          const center = boundsCenter(normalized)
          if (!center) return
          setBoundedCameraView({
            targetLon: center.lon,
            targetLat: center.lat,
            targetHeight: Number(options.targetHeight ?? 0),
            headingDegrees: Number(options.headingDegrees ?? 0),
            pitchDegrees: Number(options.pitchDegrees ?? -58),
            rangeMeters: range,
            bounds: normalized,
          }, { broadcast: options.broadcast })
        }`
}
