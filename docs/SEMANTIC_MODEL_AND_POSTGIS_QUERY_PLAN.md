# Semantic Model And PostGIS Query Plan

Updated: 2026-05-21

Este documento fija como entiendo la semantica del Twin Base Studio y como debe
vivir en PostGIS para que los visualizadores puedan seleccionar cualquier
elemento de la ciudad por consulta.

## Idea Central

El digital twin no debe ser un mapa con capas sueltas. Debe ser un inventario
consolidado de elementos de ciudad, cada elemento con:

- identidad estable,
- geometria,
- clase semantica,
- atributos consultables,
- evidencia de origen,
- estado de autoridad,
- y posibles resultados derivados por analisis o paquetes semanticos.

La UI no debe preguntar "quieres OSM u Overture?". La UI debe preguntar "quieres
edificios?", y el sistema debe resolver internamente que fuentes soportan,
confirman, contradicen o enriquecen cada edificio.

## Semantica

Una clase semantica es el significado de un objeto urbano dentro del inventario.
Ejemplos:

- edificio,
- camino,
- sistema verde-azul,
- lugar/asentamiento,
- equipamiento o semilla civica,
- activo de movilidad,
- punto de servicio,
- poligono de uso de suelo,
- sensor,
- objeto BIM/3D,
- resultado de un paquete semantico.

Un atributo no es una clase. Altura, pisos, tipo de carretera, confianza, fuente
o estado BIM son atributos consultables de una clase.

Una fuente tampoco es una clase. OSM, Overture, Microsoft, Google, datos
oficiales o BIM son evidencia/procedencia. Pueden alimentar el mismo edificio o
crear un candidato nuevo, pero no deben aparecer como capas principales
duplicadas para el analista.

## Paquetes Semanticos

Un paquete semantico no es simplemente una categoria de objeto. Es logica de
dominio que se conecta al inventario base.

Ejemplos:

- reconstruccion,
- residuos y limpieza urbana,
- continuidad de servicios,
- movilidad y accesibilidad,
- riesgo de inundacion,
- incendios,
- energia,
- vivienda,
- simulacion de red,
- indicadores sociales/economicos/culturales.

Un paquete semantico debe declarar:

- que clases semanticas usa como entrada,
- que fuentes o nivel de autoridad necesita,
- que reglas aplica,
- que indicadores produce,
- que entidades o zonas derivadas genera,
- que no puede afirmar todavia,
- que revision humana o municipal requiere.

Esto separa tres niveles:

- `base twin`: inventario abierto/consolidado de ciudad,
- `inferred seeds`: inferencias ligeras desde datos publicos,
- `semantic packs`: interpretaciones de dominio con reglas, indicadores y
  workflow.

## Estructura PostGIS

La direccion nativa sigue siendo:

- `ldt_core`: inventario canonico de entidades urbanas.
- `ldt_prov`: fuentes crudas, evidencia y decisiones de revision.
- `ldt_catalog`: datasets, distribuciones, licencias y calidad.
- `ldt_semantic`: paquetes semanticos, reglas, bindings, indicadores y
  features derivados.
- `ldt_science` / `ldt_society`: indicadores, modelos, observaciones,
  escenarios y resultados analiticos.
- `ldt_analysis`: sesiones de analisis, selecciones persistidas de objetos de
  ciudad, miembros de seleccion, metricas, estilos y comparaciones.
- `ldt_viewer`: agregados, unidades de seleccion, manifests de embed/share y
  telemetria de uso del visualizador.
- `ldt_interop` / `ldt_fiware`: proyecciones OGC, DCAT, NGSI-LD y contexto vivo.

El estado actual todavia usa `public.city_features` como tabla de compatibilidad
de visualizadores. Eso esta bien como puente, pero la direccion productiva es
que los visualizadores consulten una vista o API comun que represente el
inventario consolidado de `ldt_core`.

## Consulta Semantica Y Seleccion Persistida

El contrato de consulta que deben compartir mapa, 3D e inmersivo es:

```json
{
  "classes": ["buildings"],
  "scope": {
    "key": "radius",
    "center": [36.2304, 49.9935],
    "radiusMeters": 1000
  },
  "filters": [
    {
      "field": "heightMeters",
      "operator": "gte",
      "value": 10
    }
  ],
  "combine": "and",
  "render": {
    "mode": "isolate",
    "maxFeatures": 5000
  },
  "intent": "analysis"
}
```

La forma canonica es `scope.key`. Para no acoplar demasiado a los
visualizadores, el API tambien acepta `scope.mode` y `scope.type`, pero los
normaliza a `scope.key` antes de ejecutar la consulta y antes de guardarla en
observabilidad.

El significado de la consulta:

- `classes`: que objetos urbanos quiero ver.
- `scope`: donde quiero buscar, por ciudad, viewport, radio, unidad de
  seleccion o poligono.
- `filters`: atributos de esas clases.
- `combine`: si los filtros se combinan con AND u OR.
- `render`: si solo cuento, aislo, muestro, inspecciono o preparo export/embed.
- `intent`: por que se esta consultando: inspeccion, analisis, simulacion,
  operacion, embed o exportacion.

La consulta por si sola no es una decision ni un artefacto de trabajo. Cuando
el analista quiere conservar lo que encontro, comparar dos conjuntos, compartir
un visor, o usar el resultado en una simulacion, la salida se guarda como una
seleccion persistida:

```text
ldt_analysis.selection_sets
ldt_analysis.selection_set_members
```

Esto permite que una seleccion de edificios, caminos, parques, sensores,
semaforos, baches o cualquier otro objeto del inventario tenga identidad propia
sin duplicar la geometria fuente. La seleccion guarda IDs, contrato de query,
metricas, atributos compactos y puntos de muestra; la geometria completa sigue
en `ldt_core` y en la vista `ldt_query.city_objects`.

## API Inicial Implementada

El primer endpoint ejecutable queda disponible en:

- `GET /api/live/current/semantic-query`
- `POST /api/live/current/semantic-query`
- `GET /api/live/:cityId/semantic-query`
- `POST /api/live/:cityId/semantic-query`

El endpoint ejecuta filtros sobre la tabla actual de inventario visual
`city_features` y devuelve:

- la consulta normalizada,
- conteo total,
- conteos por clase semantica,
- conteos por layer visual,
- GeoJSON de resultados cuando `render.mode` no es `count`.

Tambien se mantiene:

- `GET /api/live/current/semantic-query-contract`
- `GET /api/live/:cityId/semantic-query-contract`

Ese contrato dice que clases, campos, operadores y scopes puede usar cada
visualizador.

La ruta avanzada actual es `twin-query` sobre `ldt_query.city_objects`, y la
ruta de laboratorio de seleccion persistida queda documentada en
`docs/ANALYSIS_SELECTION_LAB_CONTRACT.md`. Esa ruta no reemplaza
`semantic-query`; la complementa:

- `semantic-query`: lenguaje simple para seleccionar rapidamente.
- `twin-query`: contrato avanzado TwinQL/CQL2 con predicados y multi-clausula.
- `analysis-selections`: persistencia de los objetos encontrados por la query.

## Telemetria De Uso

Cada consulta semantica debe guardarse como evento en:

```text
ldt_viewer.semantic_query_events
```

Esto no convierte la consulta en verdad urbana. Es telemetria de demanda:

- que elementos de la ciudad se consultan mas,
- que usuarios o embeds preguntan por que clases,
- que filtros usan,
- si el uso fue analitico, simulacion, operativo, exportacion o embed,
- si la ciudad o proveedor necesita exponer mejor cierta informacion.

Esta es una segunda capa de compartir datos: no solo publicamos APIs, tambien
publicamos experiencias UI embebibles que consumen las mismas consultas. El uso
de esas experiencias se vuelve evidencia de demanda y operacion del LDT.

## Embeds

Un embed no debe ser una captura del mapa. Debe ser un manifest + una consulta
semantica.

Ejemplo conceptual:

```json
{
  "surface": "map",
  "shareKey": "kharkiv-reconstruction-services",
  "query": {
    "classes": ["accessSeeds", "buildings"],
    "scope": { "key": "city" },
    "filters": [
      { "field": "category", "operator": "in", "value": ["hospital", "school"] }
    ],
    "render": { "mode": "show", "maxFeatures": 5000 },
    "intent": "embed"
  }
}
```

Asi mapa, 3D e inmersivo pueden usar la misma seleccion base y cambiar solo la
forma de representarla.

## Lo Que Falta

- UI compartida para construir estas consultas en los tres visualizadores.
- Empujar predicados semanticos tambien a MVT cuando el resultado deba
  transmitirse como vector tiles.
- Ingesta y revision de distritos, barrios, manzanas y bloques oficiales para
  que esos scopes no sean solo inferidos.
- Completar la migracion de todos los visualizadores hacia `ldt_query` y
  `ldt_analysis` para que no recreen filtros privados por superficie.
- Versionar queries guardadas para embeds publicos y dashboards externos.
