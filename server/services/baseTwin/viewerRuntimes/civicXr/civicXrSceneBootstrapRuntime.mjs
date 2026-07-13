export function renderCivicXrSceneBootstrapRuntime() {
  return `
        function createBaseScene() {
          const canvas = document.getElementById('civic-xr-canvas')
          if (!canvas) throw new Error('CIVIC_XR_CANVAS_MISSING')
          engine = new Engine(canvas, true, { antialias: true, preserveDrawingBuffer: true, stencil: true })
          scene = new Scene(engine)
          scene.clearColor = new Color4(0.92, 0.96, 0.98, 1)
          camera = new ArcRotateCamera('civic-xr-camera', -Math.PI / 2.65, Math.PI / 3.4, 130, new Vector3(0, 4, 0), scene)
          camera.attachControl(canvas, true)
          streetCamera = new UniversalCamera('civic-xr-street-camera', new Vector3(0, WALK_EYE_HEIGHT, 10), scene)
          streetCamera.minZ = 0.04
          streetCamera.fov = 1.08
          streetCamera.speed = 0.42
          streetCamera.angularSensibility = 3800
          streetCamera.checkCollisions = true
          streetCamera.applyGravity = false
          streetCamera.ellipsoid = new Vector3(WALK_COLLIDER_RADIUS, WALK_COLLIDER_HEIGHT, WALK_COLLIDER_RADIUS)
          streetCamera.keysUp.push(87)
          streetCamera.keysDown.push(83)
          streetCamera.keysLeft.push(65)
          streetCamera.keysRight.push(68)
          streetCamera.inputs.attached.mouse.detachControl()
          bindScenePicking(canvas)
          camera.lowerBetaLimit = 0.24
          camera.upperBetaLimit = Math.PI / 2.08
          camera.lowerRadiusLimit = 18
          camera.upperRadiusLimit = 420
          camera.wheelPrecision = 38
          camera.panningSensibility = 60
          camera.inertia = 0.68
          applyCameraPolicy()

          const light = new HemisphericLight('civic-xr-light', new Vector3(0.2, 1, 0.25), scene)
          light.intensity = 0.96

          const groundMaterial = material('civic-xr-ground-material', new Color3(0.82, 0.88, 0.92), 0.2)
          const ground = MeshBuilder.CreateGround('civic-xr-ground', { width: 360, height: 280 }, scene)
          ground.position = new Vector3(0, -0.22, 0)
          ground.material = groundMaterial
          ground.checkCollisions = true
          groundMesh = ground
          document.__civicXrGround = ground

          let lastPoseBroadcast = 0
          scene.onBeforeRenderObservable.add(updateStreetCameraClamp)
          engine.runRenderLoop(() => {
            const now = performance.now()
            if (activeExperienceMode === 'walk' && now - lastPoseBroadcast > 900) {
              lastPoseBroadcast = now
              broadcastCivicVisualState()
            }
            scene.render()
          })
          window.addEventListener('resize', () => engine.resize())
        }
  `
}
