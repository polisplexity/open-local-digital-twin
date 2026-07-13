export function renderCivicXrCameraRuntime() {
  return `
        function buildingClearanceAt(x, z, building = {}) {
          const halfWidth = clamp(finiteNumber(building.width, 1.4), 0.7, 28) / 2
          const halfDepth = clamp(finiteNumber(building.depth, 1.4), 0.7, 28) / 2
          const dx = Math.max(0, Math.abs(x - finiteNumber(building.x)) - halfWidth)
          const dz = Math.max(0, Math.abs(z - finiteNumber(building.z)) - halfDepth)
          return Math.hypot(dx, dz)
        }

        function nearestBuildingClearance(x, z, buildings = []) {
          if (!buildings.length) return Number.POSITIVE_INFINITY
          let clearance = Number.POSITIVE_INFINITY
          buildings.forEach((building) => {
            clearance = Math.min(clearance, buildingClearanceAt(x, z, building))
          })
          return clearance
        }

        function nearbyBuildingCount(x, z, buildings = [], radius = 32) {
          return buildings.reduce((count, building) => {
            const dx = finiteNumber(building.x) - x
            const dz = finiteNumber(building.z) - z
            return count + (Math.hypot(dx, dz) <= radius ? 1 : 0)
          }, 0)
        }

        function walkSpawnForModel(model = {}) {
          const extents = sceneExtents(model)
          const buildings = Array.isArray(model.buildings) ? model.buildings : []
          const roads = Array.isArray(model.roads) ? model.roads : []
          const candidates = []
          roads.forEach((points) => {
            const clean = (Array.isArray(points) ? points : [])
              .filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.z)))
            for (let index = 1; index < clean.length; index += 1) {
              const a = clean[index - 1]
              const b = clean[index]
              const ax = finiteNumber(a.x)
              const az = finiteNumber(a.z)
              const bx = finiteNumber(b.x)
              const bz = finiteNumber(b.z)
              const dx = bx - ax
              const dz = bz - az
              const length = Math.hypot(dx, dz)
              if (!Number.isFinite(length) || length < 1.6) continue
              ;[0.25, 0.5, 0.75].forEach((t) => {
                const x = ax + dx * t
                const z = az + dz * t
                const clearance = nearestBuildingClearance(x, z, buildings)
                const nearBuildings = nearbyBuildingCount(x, z, buildings, 22)
                const districtBuildings = nearbyBuildingCount(x, z, buildings, 48)
                const centerPenalty = Math.hypot(x - extents.center.x, z - extents.center.z) * 0.01
                const clearancePenalty = Math.abs(clamp(clearance, 0, 18) - 4.8) * 0.72
                candidates.push({
                  x,
                  z,
                  targetX: x + (dx / length) * clamp(length * 0.55, 4, 12),
                  targetZ: z + (dz / length) * clamp(length * 0.55, 4, 12),
                  clearance,
                  nearBuildings,
                  districtBuildings,
                  score: nearBuildings * 2.8 + districtBuildings * 0.42 + length * 0.018 - clearancePenalty - centerPenalty,
                })
              })
            }
          })
          const viable = candidates
            .filter((candidate) => candidate.clearance >= WALK_MIN_BUILDING_CLEARANCE && candidate.districtBuildings >= 3)
            .sort((a, b) => b.score - a.score)
          if (viable.length) return viable[0]
          const fallbackX = extents.center.x
          const fallbackZ = clamp(extents.center.z + extents.depth * 0.30, extents.minZ + 3, extents.maxZ - 3)
          return {
            x: fallbackX,
            z: fallbackZ,
            targetX: extents.center.x,
            targetZ: extents.center.z,
            clearance: nearestBuildingClearance(fallbackX, fallbackZ, buildings),
            score: 0,
          }
        }

        function setStreetCameraForModel(model = currentSceneModel) {
          if (!scene || !streetCamera || !model) return
          const spawn = walkSpawnForModel(model)
          camera?.detachControl()
          scene.activeCamera = streetCamera
          streetCamera.position = new Vector3(spawn.x, WALK_EYE_HEIGHT, spawn.z)
          streetCamera.fov = 1.08
          streetCamera.speed = 0.42
          streetCamera.angularSensibility = 3800
          streetCamera.checkCollisions = true
          streetCamera.applyGravity = false
          streetCamera.ellipsoid = new Vector3(WALK_COLLIDER_RADIUS, WALK_COLLIDER_HEIGHT, WALK_COLLIDER_RADIUS)
          streetCamera.setTarget(new Vector3(spawn.targetX, WALK_TARGET_HEIGHT, spawn.targetZ))
          streetCamera.attachControl(scene.getEngine().getRenderingCanvas(), true)
        }

        function setOrbitCameraForModel(model = currentSceneModel) {
          if (!scene || !camera) return
          const mode = EXPERIENCE_MODES[activeExperienceMode] || EXPERIENCE_MODES.walk
          streetCamera?.detachControl()
          scene.activeCamera = camera
          camera.attachControl(scene.getEngine().getRenderingCanvas(), true)
          camera.lowerBetaLimit = 0.22
          camera.upperBetaLimit = activeExperienceMode === 'compare' ? Math.PI / 2.12 : Math.PI / 1.92
          camera.lowerRadiusLimit = activeExperienceMode === 'compare' ? 26 : 16
          camera.upperRadiusLimit = activeExperienceMode === 'compare' ? 520 : 360
          camera.wheelPrecision = activeExperienceMode === 'compare' ? 48 : 36
          camera.panningSensibility = activeExperienceMode === 'compare' ? 46 : 62
          camera.inertia = 0.68
          camera.checkCollisions = false
          camera.applyGravity = false
          if (model) {
            const extents = sceneExtents(model)
            camera.setTarget(new Vector3(extents.center.x, clamp(extents.span * mode.camera.yFactor, 1.5, 10), extents.center.z))
            camera.alpha = activeExperienceMode === 'compare' ? -Math.PI / 2 : -Math.PI / 2.65
            camera.beta = mode.camera.beta
            camera.radius = clamp(extents.span * mode.camera.radiusFactor, camera.lowerRadiusLimit, camera.upperRadiusLimit)
          }
        }

        function updateStreetCameraClamp() {
          if (!scene || scene.activeCamera !== streetCamera || activeExperienceMode !== 'walk' || !currentSceneModel) return
          const extents = sceneExtents(currentSceneModel)
          const margin = 2.4
          streetCamera.position.y = WALK_EYE_HEIGHT
          streetCamera.position.x = clamp(streetCamera.position.x, extents.minX + margin, extents.maxX - margin)
          streetCamera.position.z = clamp(streetCamera.position.z, extents.minZ + margin, extents.maxZ - margin)
        }

        function applyCameraPolicy(model = currentSceneModel) {
          const activeCamera = activeExperienceMode === 'walk' ? streetCamera : camera
          if (!activeCamera) return
          const policy = renderPolicyForMode()
          if (scene) {
            scene.collisionsEnabled = Boolean(policy.collisions)
            scene.gravity = new Vector3(0, 0, 0)
          }
          ;(layerMeshes.get('buildings') || []).forEach((mesh) => {
            mesh.checkCollisions = Boolean(policy.collisions && mesh.metadata?.featureType === 'building')
          })
          if (groundMesh) groundMesh.checkCollisions = Boolean(policy.collisions)
          if (activeExperienceMode === 'walk') setStreetCameraForModel(model)
          else setOrbitCameraForModel(model)
          broadcastCivicVisualState({
            renderPolicy: policy,
            cameraPolicy: {
              cameraType: policy.cameraType,
              collisions: Boolean(policy.collisions),
              activeCamera: activeExperienceMode === 'walk' ? 'UniversalCamera' : 'ArcRotateCamera',
            },
          })
        }

        function focusSceneOnModel(model) {
          applyCameraPolicy(model)
        }
  `
}
