# Attribution Requirements

This document specifies attribution requirements for all data sources used in the Anatomy Atlas.

## Display Requirements

### In Application
An "About / Credits / Licenses" page should display:
- Source name and version
- Author/Creator
- License type
- Attribution requirement
- Link to original source (where applicable)
- Date added/modified

### In Documentation
README.md and other public documentation should acknowledge primary sources.

## Current Sources

### Phase 1

To be completed as sources are integrated.

## Generation
A future feature should auto-generate attribution text from the provenance records:

```python
# Pseudocode
for source in provenance_records:
    if source.requires_attribution:
        attribution_page += source.attribution_text()
```

## Future User Materials
When Phase 4 (User Knowledge Database) is implemented:
- User-uploaded materials require explicit provenance tracking
- Original document attribution must be preserved
- Extracted knowledge must link back to source
