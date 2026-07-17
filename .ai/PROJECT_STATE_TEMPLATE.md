# Project State Template

Version: 1.0

Status: Template — Copy this template to `PROJECT_STATE.md` for each execution session.

---

# Project State

## Session Metadata

| Field | Value |
|---|---|
| Session ID | `[SESSION-UUID]` |
| Started | `[ISO-8601 timestamp]` |
| Last Updated | `[ISO-8601 timestamp]` |
| Current Phase | `[Phase number/name]` |
| Operating Mode | `[Normal \| Degraded \| Critical]` |

---

## Mission State

| Field | Value |
|---|---|
| Active Mission | `[Mission objective identifier or name]` |
| Mission Status | `[Active \| Completed \| Blocked \| Suspended]` |
| Primary Objective | `[Current primary goal]` |
| Secondary Objectives | `["Objective 1", "Objective 2"]` |
| Mission Progress | `[Percentage or description]` |
| Last Milestone | `[Milestone name/date]` |
| Next Milestone | `[Milestone name/target date]` |

---

## Work Graph State

### Active Tasks

```json
{
  "active": [
    {
      "id": "TASK-NNNN",
      "title": "Brief description",
      "status": "running",
      "agent": "agent-identifier",
      "priority": "high",
      "budgetUsed": { "tokens": 0, "time": "00:00" },
      "startedAt": "ISO-8601"
    }
  ],
  "pending": [
    {
      "id": "TASK-NNNN",
      "title": "Brief description",
      "status": "waiting",
      "dependencies": ["TASK-NNNN"],
      "priority": "medium"
    }
  ],
  "completed": [
    {
      "id": "TASK-NNNN",
      "title": "Brief description",
      "status": "completed",
      "completedAt": "ISO-8601",
      "deliverable": "path/to/artifact"
    }
  ],
  "failed": [
    {
      "id": "TASK-NNNN",
      "title": "Brief description",
      "status": "failed",
      "failureReason": "Brief reason",
      "recoveryAttempted": true,
      "failedAt": "ISO-8601"
    }
  ]
}
```

---

## Resource State

### Provider Status

| Provider | Name | Status | Capability | Quota Used | Notes |
|---|---|---|---|---|---|
| `[provider-id]` | `[Display name]` | `[available \| unavailable \| degraded]` | `[capabilities]` | `[X%]` | `[Notes]` |

### Budget State

| Budget Type | Allocated | Used | Remaining | Notes |
|---|---|---|---|---|
| Session | `[tokens/time]` | `[used]` | `[remaining]` | — |
| Per-Task (TASK-NNNN) | `[tokens/time]` | `[used]` | `[remaining]` | — |

---

## Knowledge State

### Active Knowledge Entries

| Entry ID | Topic | Confidence | Source | Status |
|---|---|---|---|---|
| `KNW-NNNN` | `[Topic]` | `[high/medium/low]` | `[experiment/ADR/incident]` | `[active|hypothesis|review]` |

### Active Anti-Patterns

| ID | Pattern | Context | Mitigation |
|---|---|---|---|
| `AP-NNNN` | `[Anti-pattern name]` | `[Where it applies]` | `[How to avoid]` |

---

## Error State

### Recent Errors (Last 24 Hours)

| ID | Time | Criticality | Category | Recovery | Status |
|---|---|---|---|---|---|
| `ERR-NNNN` | `[timestamp]` | `[1-5]` | `[type]` | `[strategy]` | `[resolved \| pending]` |

### Active Blockers

| ID | Description | Impact | Resolution Path | Created |
|---|---|---|---|---|
| `BLK-NNNN` | `[What blocks progress]` | `[Which tasks affected]` | `[How to resolve]` | `[timestamp]` |

---

## Documentation State

### Recent ADR Changes

| ADR ID | Title | Changed By | Date | Status |
|---|---|---|---|---|
| `ADR-NNNN` | `[Title]` | `[agent/session]` | `[date]` | `[accepted/superseded]` |

### Documentation Gaps

| Document | Gap Type | Severity | Action Required |
|---|---|---|---|
| `[Document name]` | `[missing \| outdated \| incomplete]` | `[high/medium/low]` | `[What to do]` |

---

## Quality Metrics

### Current Phase Metrics

| Metric | Value | Target | Status |
|---|---|---|---|
| Task Completion Rate | `[X%]` | `[>80%]` | `[passing \| failing]` |
| Budget Efficiency | `[X%]` | `[<90%]` | `[passing \| failing]` |
| First-Pass Quality | `[X%]` | `[>75%]` | `[passing \| failing]` |
| Alignment Score | `[X%]` | `[>90%]` | `[passing \| failing]` |

---

## Execution Context

### Current Operation

| Field | Value |
|---|---|
| Active Component | `[Which runtime component is active]` |
| Current Operation | `[What is happening now]` |
| Next Scheduled Action | `[Next action and when]` |
| Concurrency Level | `[number of concurrent operations]` |

### Pending Events

| Event Type | Source | Timestamp | Status |
|---|---|---|---|
| `[event type]` | `[source]` | `[timestamp]` | `[pending \| processing \| processed]` |

---

## Session Summary

### What Was Accomplished This Session

1. `[Accomplishment 1 with artifact link]`
2. `[Accomplishment 2 with artifact link]`
3. `[Accomplishment 3 with artifact link]`

### What Remains For Next Session

1. `[Remaining work item]`
2. `[Remaining work item]`
3. `[Remaining work item]`

### Decisions Made This Session

| Decision | Date | Rationale | Status |
|---|---|---|---|
| `[What was decided]` | `[date]` | `[why]` | `[accepted/superseded]` |

### Lessons Learned This Session

1. `[Lesson 1 — what, why, how to apply]`
2. `[Lesson 2 — what, why, how to apply]`

---

## Agent State

### Active Agents

| Agent ID | Role | Status | Current Task | Budget Remaining |
|---|---|---|---|---|
| `[agent-id]` | `[role]` | `[active \| idle \| blocked]` | `[TASK-NNNN or none]` | `[remaining budget]` |

### Agent Performance (This Session)

| Agent ID | Tasks Completed | Tasks Failed | Budget Used | Notes |
|---|---|---|---|---|
| `[agent-id]` | `[count]` | `[count]` | `[tokens/time]` | `[notes]` |

---

## File State

### Modified Files (This Session)

| File | Change Type | By Agent | Timestamp |
|---|---|---|---|
| `[file path]` | `[added/modified/deleted]` | `[agent-id]` | `[timestamp]` |

### New Artifacts (This Session)

| Artifact Type | Path | Created By | Timestamp |
|---|---|---|---|
| `[ADR/experiment/knowledge/doc]` | `[path]` | `[agent-id]` | `[timestamp]` |

---

## Handoff Notes

### For Next Session

- **Critical context**: `[What the next session MUST know]`
- **Blocking issues**: `[Any blockers to address immediately]`
- **Priority focus**: `[What to work on first]`
- **Budget remaining**: `[Total remaining for next session]`

### Open Questions

1. `[Question 1 — why it matters, who needs to answer]`
2. `[Question 2 — why it matters, who needs to answer]`

---

## Emergency Information

### Last Known Good State

| Field | Value |
|---|---|
| Checkpoint ID | `[last-good-checkpoint-id]` |
| Checkpoint Time | `[ISO-8601 timestamp]` |
| Recovery Point Objective | `[max acceptable data loss]` |

### Known Issues

| Issue | Severity | Workaround | Status |
|---|---|---|---|
| `[Description]` | `[critical/high/medium/low]` | `[What to do now]` | `[known/mitigated/fixed]` |

---

> **Template Instructions**: Fill all `[bracketed]` fields for each execution session. Delete sections not applicable to current phase. Keep this format consistent across sessions for agent readability.