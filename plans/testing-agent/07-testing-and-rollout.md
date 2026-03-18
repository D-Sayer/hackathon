# 07 Testing And Rollout

## Objective
Define how the testing agent is verified incrementally and rolled out safely from local development to live GitHub automation.

## Test Pyramid
### Unit tests
- signature verification
- event filtering
- payload normalization
- issue reference parsing
- heuristic analysis decisions
- schema validation
- comment marker detection
- comment rendering

### Fixture tests
- saved GitHub webhook payloads
- representative PR file lists and diff snippets
- representative attached issue title and body payloads
- positive and negative review-analysis scenarios

### Mocked integration tests
- GitHub client reads for PR metadata, changed files, issue details, and issue comments
- GitHub client writes for issue comment creation and issue comment update
- dry-run behavior

## Suggested Scripts
Add test support in a way that fits the existing Bun/Turbo setup.

Recommended additions:
- root `test` script via Turbo
- package-level `test` script for the new shared package
- keep `check-types` and relevant build steps in CI or local verification flow

## Acceptance Path
1. Validate webhook intake from a saved fixture locally.
2. Validate attached issue resolution from representative PR text fixtures.
3. Validate analysis from recorded PR and issue scenarios without GitHub writes.
4. Validate issue comment rendering in dry-run mode with returned markdown.
5. Validate issue comment writeback in a sandbox repo and issue.
6. Enable live mode only after dry-run results are stable.

## Observability
- Log delivery id, event type, action, source PR number, attached issue number, analysis outcome, and comment writeback result.
- Avoid logging secrets, private keys, raw signatures, or full token values.
- Make dry-run versus live mode explicit in logs.

## Rollout Plan
### Phase 1
- Local dry-run only
- fixture-driven testing

### Phase 2
- Live webhook intake against a sandbox repo
- still dry-run for issue comment writeback

### Phase 3
- Enable issue comment create and update in the sandbox repo

### Phase 4
- Promote to the target repo
- keep dry-run as the default safety mode until comment quality is stable

## Ongoing Maintenance
- Update fixtures when GitHub payload shapes or repo conventions change.
- Review false positives and false negatives from analysis.
- Refine prompts and heuristics based on real PR and issue history.
- Revisit shared helper extraction once both GitHub agents are stable enough to compare duplication concretely.
