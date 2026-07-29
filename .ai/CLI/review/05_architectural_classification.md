# 05 — Architectural Classification

## Objective
Classify the current ForgeOS Runtime implementation into exactly one architectural category.

## Categories (Choose ONLY One)

- [ ] **Embedded Library** — Runtime is a library imported and used directly within the CLI process.
- [ ] **In-Process Runtime** — Runtime runs in the same process as the CLI but has its own event loop/lifecycle.
- [ ] **Background Service** — Runtime runs as a background service independent of the CLI.
- [ ] **Daemon** — Runtime is a long-lived daemon process managed separately from the CLI.
- [ ] **Client / Server Runtime** — CLI acts as a client communicating with a separate Runtime server.
- [ ] **Hybrid** — A combination of the above (explain which mix).

## Decision Criteria

Use findings from Phases 1–4 to determine:

| Criterion | Embedded Library | Background Service/Daemon | Client/Server |
|-----------|------------------|---------------------------|---------------|
| Runtime survives CLI exit | No | Yes | Yes |
| IPC required | No | Yes | Yes |
| Separate process | No | Yes | Yes |
| Multiple CLI instances share Runtime | No | Yes | Yes |

## Files to Review (Summary Only)

Synthesize evidence from previous phases. Do NOT re-read files unless a critical gap exists.

## Questions to Answer

1. Which category best fits the evidence collected?
2. Why do the other categories NOT fit?
3. What is the single strongest piece of evidence supporting your classification?

## Output Format

```markdown
### Findings — Phase 5
- Classification: [chosen category]
- Justification: [explanation based on evidence]
- Ruling out alternatives: [why other options don't fit]
- Key evidence: [file:path + description of decisive proof]
```
