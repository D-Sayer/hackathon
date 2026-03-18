# 06 Issue Comment Rendering And Writeback

## Objective
Implement the GitHub writeback slice: take a positive structured review result, render a stable issue comment, and create or update one bot-owned comment on the attached issue.

## Comment Strategy
- Use one stable comment per source PR and attached issue pair.
- Include a hidden marker in the comment body containing the source PR number and agent identity.
- Reuse the marker on reruns so the bot updates the existing issue comment instead of creating duplicates.

## Comment Template
Render a compact, predictable markdown body with sections such as:
- `## Summary`
- `## Implementation Gaps`
- `## Testing Notes`
- `## Blast Radius`
- `## Oversights`
- `## Source Pull Request`

The comment should:
- reference the source PR with a link
- explain when no findings were identified, if the agent still chooses to comment
- remain short enough to scan in the GitHub issue UI

## Writeback Flow
1. Resolve the attached issue number from the loaded context.
2. Render the issue comment body from the structured analysis.
3. List existing issue comments and find the matching bot-owned comment using the hidden marker.
4. Create the comment if none exists.
5. Update the comment if one already exists.
6. In dry-run mode, return the rendered body without calling GitHub write APIs.

## Idempotency
- Key reruns by source PR number and stable marker in the issue comment.
- Treat an existing bot comment as the normal update path.
- Optionally skip updates when the rendered comment body is unchanged.

## Failure Handling
- If analysis succeeds but comment rendering fails, stop before GitHub writes and log the reason.
- If issue loading succeeds but comment writeback fails, log enough detail to repair manually.
- Keep dry-run available as the default safety mode during early rollout.

## GitHub Client Surface
Add issue-comment writeback capabilities such as:
- `listIssueComments`
- `createIssueComment`
- `updateIssueComment`

Keep these APIs separate from analysis so they are easy to mock in tests.

## Tests For This Slice
- create bot comment when missing
- update existing bot comment on rerun
- skip writeback when `shouldComment=false`
- skip writeback in dry-run mode
- skip update when the rendered body is unchanged
- handle partial GitHub API failures cleanly

## Done Criteria
- Structured review results can be rendered into a stable issue comment body.
- The system creates or updates one issue comment per source PR.
- Reruns are idempotent and do not spam issue comments.
- Tests cover the main writeback and recovery paths.
