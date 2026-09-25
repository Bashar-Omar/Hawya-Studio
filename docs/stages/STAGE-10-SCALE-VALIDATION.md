# Stage 10 — Representative Scale Validation

The deterministic Stage 10 fixture exercises the binding v1 scale target in normal CI:

- 50 guide pages;
- 500 canonical layers (10 per page);
- 100 asset metadata entries;
- 4 project fonts.

The query test validates both Guide Studio and Brand System projections against that model and keeps the combined projection budget below 500 ms on the GitHub test runner. It also verifies that asset-reference counting remains correct at scale.

The editor test resolves one active page and asserts that binary hydration is limited to visual assets referenced by that active scene rather than hydrating the full 100-asset corpus.

## Virtualization decision

No list virtualization is added by default at this target. The measured projection is bounded, Guide Studio keeps one active full preview, and editor hydration is active-scene-only. Adding virtualization without a measured bottleneck would add state/scroll complexity without evidence.

If later browser profiling shows page-rail or asset-grid rendering pressure beyond the v1 target, virtualization belongs in the projection/UI layer; the canonical project model must remain unchanged.

## Large local corpus

The Project Pack's 100–250 MB local asset corpus remains a resource-stress scenario rather than a normal hosted-CI payload. The architecture already avoids decoding every binary simultaneously; Stage 10 documents the stress result/exception at closure instead of committing a very large fixture to the repository.
