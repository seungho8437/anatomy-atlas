# 3D Human Anatomy Atlas — Phase 1 MVP

An independent, open-source interactive 3D visualization of human anatomy for educational and clinical use.

## Project Independence

This project is **completely independent** of the existing `herbal-formulas` application. It does not depend on, import from, or share infrastructure with that project.

## Phase 1: Core Objectives

Build the foundational 3D anatomy viewer with:

- 3D structure visualization using Three.js
- Orbit camera controls (rotation, zoom, pan)
- Structure selection and highlighting
- Basic metadata display
- Extensible asset pipeline
- Clean separation between knowledge and 3D assets

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Navigate to http://localhost:3000/anatomy
```

## Project Structure

```
anatomy-atlas/
├── app/anatomy/              # Next.js app directory
├── components/anatomy/       # 3D viewer components
├── lib/anatomy/              # Domain types
├── data/                     # Asset registry and data
├── scripts/anatomy/          # Processing pipeline
├── licensing/                # Provenance documentation
└── tests/anatomy/            # Test suite
```

## Architecture Principles

**Core Principle**: AnatomyStructure (knowledge) ≠ Asset (3D representation)

One anatomical structure may have multiple assets. This separation enables:
- Multiple asset sources
- Different resolutions and formats
- Easy updates without restructuring knowledge
- Future scalability

## Development Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run typecheck    # Type validation
npm run lint         # Code linting
npm run test:smoke   # Smoke tests
npm run process -- --source <source> --structure <name>  # Process assets
```

## Phase 1 MVP Scope

Three representative anatomical structures for validation:
- **Femur** (bone.femur)
- **Tibia** (bone.tibia)
- **Sartorius** (muscle.sartorius)

## Data Sources & Licensing

All external sources must be documented with:
- Source name and version
- License and attribution
- URL and retrieval date
- Provenance record

See `licensing/PROVENANCE.md`

## Future Phases

- Phase 2: Anatomy Knowledge Database
- Phase 3: Korean Medicine Layer
- Phase 4: User Knowledge Database
- Phase 5: RAG + Knowledge Graph AI

## Core Development Rules

1. Inspect before modifying
2. Small incremental phases
3. Separate concerns
4. Reproducible processes
5. No large datasets to LLM
6. No fabricated data
7. Document architecture decisions
8. Stop at phase boundaries
