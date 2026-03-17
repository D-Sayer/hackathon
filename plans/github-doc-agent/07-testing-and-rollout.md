# 07 Testing And Rollout

## Objective
Define how the docs agent is verified incrementally and rolled out safely from local development to live GitHub automation.

## Test Pyramid
### Unit tests
- signature verification
- event filtering
- payload normalization
- heuristic classification
- schema validation
- path safety
- branch naming

### Fixture tests
- saved GitHub webhook payloads
- representative PR file lists and diff snippets
- positive and negative docs-needed scenarios

### Mocked integration tests
- GitHub client reads for PR metadata and changed files
- GitHub client writes for branch creation, file commit, and draft PR creation
- dry-run behavior

## Suggested Scripts
Add test support in a way that fits the existing Bun/Turbo setup.

Recommended additions:
- root `test` script via Turbo
- package-level `test` script for the new shared package
- keep `check-types` and relevant build steps in CI or local verification flow

## Acceptance Path
1. Validate webhook intake from a saved fixture locally.
2. Validate classification from recorded PR scenarios without GitHub writes.
3. Validate doc generation in dry-run mode with patch output.
4. Validate branch writeback in a sandbox repo or isolated test PR.
5. Enable live mode only after dry-run results are stable.

## Observability
- Log delivery id, event type, action, source PR number, classifier outcome, and docs PR number.
- Avoid logging secrets, private keys, raw signatures, or full token values.
- Make dry-run versus live mode explicit in logs.

## Rollout Plan
### Phase 1
- Local dry-run only
- fixture-driven testing

### Phase 2
- Live webhook intake against a sandbox repo
- still dry-run for writeback

### Phase 3
- Enable branch and draft PR creation in the sandbox repo

### Phase 4
- Promote to the target repo
- keep draft PR mode as the default

## Ongoing Maintenance
- Update fixtures when GitHub payload shapes or repo conventions change.
- Review false positives and false negatives from classification.
- Refine prompts and targeting rules based on real PR history.
