# Processing Modes: Normal and OpenMPI

Status: initial operator contract.

Twin Base Studio should keep two execution modes for heavy city-data work:

- `normal`: one process runs the command directly.
- `mpi`: the same command is launched through OpenMPI with `mpirun`.

This does not make every command faster automatically. MPI is useful only when
the command can safely split work by city zone, tile, layer, scenario, or other
independent partition. UI routes, browser rendering, and interactive debugging
should stay in normal mode.

## Local WSL Baseline

OpenMPI is installed in the local WSL environment:

```bash
source ~/.nvm/nvm.sh
nvm use --lts
mpirun --version
mpirun -np 4 --oversubscribe hostname
```

Use the WSL Node/NPM runtime through `nvm`. Without this, WSL may pick the
Windows `npm` binary while using an older Linux `node`, which breaks package
scripts from UNC paths.

## Runner

Use the lightweight runner when testing a command in both modes:

```bash
npm run ops:run -- --mode=normal -- hostname
npm run ops:run -- --mode=mpi --workers=4 -- hostname
```

For real Twin Studio jobs, the first target is to wrap batch scripts, not the
web server. Examples of candidate jobs:

```bash
npm run ops:run -- --mode=normal -- npm run db:ldt:refresh-viewer-aggregates -- --city=kharkiv
npm run ops:run -- --mode=mpi --workers=4 -- node server/workflows/process-city-partitions.mjs --city=kharkiv
```

## Where MPI Helps

Good candidates:

- processing independent city zones,
- generating tile packages by spatial partition,
- running semantic-pack indicators over many areas,
- CPU-bound simulation scenarios,
- batch validation across many provider files.

Poor candidates:

- live UI serving,
- Cesium/MapLibre browser work,
- GPU model inference,
- database migrations,
- commands that write to the same tables without partition locks or idempotent
  merge logic.

## Local vs External Processing Hosts vs VPS

Local machine:

- Use normal mode for development and GPU work.
- Use MPI mode only to develop and test partitionable jobs.

External processing host:

- Best target for MPI CPU jobs only after the host runtime, permissions, CPU,
  RAM, storage, and transfer path are inspected.
- High CPU/RAM hosts are useful for city-scale batch work when the job is
  partitionable and produces portable artifacts.
- Access and verification notes should live in private ops docs, not product
  architecture docs.

Hostinger VPS:

- Usually smaller and less suitable for MPI.
- Use normal mode unless the VPS has enough CPU cores and the job is truly
  partitioned.
- MPI can still be installed on Linux VPS, but the operational value depends on
  CPU count, RAM, and whether long-running batch jobs are acceptable on that
  server.

## Design Rule

Keep the source of truth in PostGIS and make MPI jobs write auditable outputs:

- workflow run ID,
- city ID,
- partition key,
- input snapshot,
- output artifact,
- merge status.

MPI should be an execution acceleration layer, not a new data model.
