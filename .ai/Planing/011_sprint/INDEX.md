# Planning Index - Sprint 011

## Goal
Turn `ask/chat` into a controlled project-working interface through explicit workspace grants.

## Phases

| Phase | Tasks | Focus | Status |
|---|---|---|---|
| A | 01-02 | Grants and IPC contract | Done |
| B | 03-05 | Read, execute and mutate tools | Done |
| C | 06 | Agent/CLI integration | In progress |
| D | 07 | Tests, documentation and acceptance | In progress |

## Dependency Graph

```text
01 -> 02 -> 03 -> 05
       |     04   |
       +-----> 06 -> 07
```

## Delivery Rules
Deny by default, least privilege, no shell execution, explicit approval for writes, per-session isolation and complete auditability.

## Risks
Windows path semantics, process-tree cancellation, secret leakage, weak command allowlists and cross-client state leakage.
