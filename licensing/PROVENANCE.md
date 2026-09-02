# Anatomy Atlas - Licensing & Provenance Documentation

This directory contains detailed provenance and licensing information for all external data sources used in the Anatomy Atlas project.

## Principle
Every external asset source must have complete documentation:
- Source name and version
- Original URL
- License type and restrictions
- Attribution requirements
- Retrieval date and processing status
- Derivative status

**Rule: Never invent or rely on memory for license information. If uncertain, research and document carefully.**

## Directory Structure
```
licensing/
├── PROVENANCE.md (this file)
├── SOURCES.md
├── bodyparts3d/
│   └── LICENSE.md
├── hra/
│   └── LICENSE.md
└── ATTRIBUTION.md
```

## Sources (Phase 1)

### BodyParts3D
- **Status**: Not yet integrated in Phase 1
- **URL**: (to be documented)
- **License**: (to be verified and documented)
- **Details**: See `bodyparts3d/LICENSE.md`

### HRA (Human Reference Atlas)
- **Status**: Potential future integration
- **URL**: (to be documented)
- **License**: (to be verified and documented)
- **Details**: See `hra/LICENSE.md`

## Future Integration
As new sources are added:
1. Create a new directory under `licensing/`
2. Document all license and provenance details
3. Update this file
4. Update `ATTRIBUTION.md` with attribution requirements
5. Create processing validation rules

## Generated Attribution
A future application feature should generate an About/Credits/Licenses page from these records.
