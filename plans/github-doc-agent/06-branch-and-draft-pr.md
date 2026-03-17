# 06 Branch And Draft PR

## Objective
Implement the GitHub writeback slice: take generated docs changes, commit them to a bot branch, and create or refresh a draft PR tied to the source PR.

## Branch Strategy
- Use a stable branch per source PR.
- Suggested pattern: `docs-bot/pr-<source-pr-number>`.
- Reuse the branch on reruns so new docs changes update the existing draft PR rather than creating duplicates.

## Commit Flow
1. Resolve the base branch, defaulting to `main`.
2. Create the docs bot branch if it does not exist.
3. Write the generated docs files to the branch.
4. Create a commit with a predictable message, for example `docs: update documentation for #<source-pr-number>`.
5. Push only when not in dry-run mode.

## Draft PR Behavior
- Open a draft PR from the docs bot branch into the base branch.
- Use a predictable title such as `docs: update documentation for #<source-pr-number>`.
- Reference the source PR in the body.
- If the draft PR already exists, update it instead of creating another one.

## Idempotency
- Key reruns by source PR number and stable bot branch name.
- Treat "branch already exists" and "draft PR already exists" as normal conditions.
- Avoid duplicate commits when generated content is identical to the current docs bot branch state.

## Failure Handling
- If classification succeeds but generation fails, stop before GitHub writes and log the reason.
- If branch creation succeeds but PR creation fails, log enough detail to repair manually.
- Keep dry-run available as the default safety mode during early rollout.

## Tests For This Slice
- create bot branch when missing
- reuse bot branch on rerun
- skip writeback when there is no content delta
- create draft PR
- update existing draft PR
- handle partial GitHub API failures cleanly

## Done Criteria
- Generated docs changes can be written to a stable bot branch.
- The system opens or updates one draft PR per source PR.
- Reruns are idempotent and do not spam branches or PRs.
- Tests cover the main writeback and recovery paths.
