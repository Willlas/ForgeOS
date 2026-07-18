# Recovery Plan — TypeScript Build Fix

**Created:** 2026-07-18  
**Status:** Planned (not implemented)  
**Source Log:** `tsc_output_new.txt` (159 errors, all in `src/core/workgraph.ts`)

---

## Executive Summary

All 159 compiler errors originate from a **single root cause**: an incomplete object literal declaration at lines 56-60 of `workgraph.ts` that is never closed with `};`. This causes TypeScript to parse the subsequent `WorkGraphEngine` class inside the object context, producing cascading syntax errors throughout the entire file.

A **second root cause** exists: two functions (`_createWorkGraph` and `_createWorkNode`) are referenced with an incorrect underscore prefix — they should be imported and called as `createWorkGraph` and `createWorkNode`.

---

## Error Clustering (from compiler log)

### Cluster A — Unclosed Object Literal (Primary Root Cause)
**Location:** `workgraph.ts` lines 56-60  
**Errors:** Lines 1–178 of tsc_output_new.txt (all errors cascade from this single issue)  
**Root Cause:** The constant `DEFAULT_NODE_TRANSITIONS` starts at line 56 with `{` but lacks the closing `};`. The last enum member `WorkNodeState.Waiting` is mapped at line 60, but the remaining members (`Completed`, `Cancelled`, `Failed`, `Archived`) that should also be in the `Record<WorkNodeState, Set<WorkNodeState>>` type are either missing or the object was simply never closed.  
**Impact:** Every line after line 60 produces errors because TypeScript is still inside an object literal when it encounters class syntax, function signatures, and other constructs.

### Cluster B — Incorrect Import References (Secondary Root Cause)
**Location:** `workgraph.ts` lines 78 and 211  
**Errors:** Not directly visible in compiler log (these would be runtime/semantic errors that TypeScript catches as TS2304 "cannot find name")  
**Root Cause:** The code uses `_createWorkGraph` (line 78) and `_createWorkNode` (line 211) with an underscore prefix. The imports from `./types/work-graph.js` provide `createWorkGraph` and `createWorkNode` without underscores.  
**Impact:** 2 compilation errors.

---

## Recovery Phases

### Phase 0 — Baseline Verification
**Objective:** Confirm current broken state and capture error count.  
**Complexity:** Trivial (1-2 minutes)  

**Files Required:**
- `tsc_output_new.txt` (already exists)

**Steps:**
1. Run `npm run build` to confirm 159 errors
2. Record total error count for comparison after fix

**Validation Checklist:**
- [ ] Build fails with exactly 159 errors in `src/core/workgraph.ts`
- [ ] No other files have compilation errors

**Completion Criteria:** Broken state confirmed and documented.

---

### Phase 1 — Fix DEFAULT_NODE_TRANSITIONS Object Literal
**Objective:** Close the object literal and ensure all WorkNodeState enum values have entries.  

**Complexity:** Low (5-10 minutes)

**Files Required:**
| File | Change Type | Description |
|------|-------------|-------------|
| `src/core/workgraph.ts` | Edit | Add missing entries for Completed/Cancelled/Failed/Archived and close with `};` |

**Compiler Errors Affected:** ALL 159 errors (entire cluster resolved)

**Steps:**
1. Read `src/core/types/work-graph.ts` to identify all `WorkNodeState` enum values:
   - `Planned`, `Ready`, `Running`, `Waiting`, `Blocked`, `Review`, `Completed`, `Cancelled`, `Failed`, `Archived`
2. In `workgraph.ts`, after line 60, add entries for missing state transitions:
   ```typescript
   [WorkNodeState.Blocked]: new Set([WorkNodeState.Ready, WorkNodeState.Cancelled]),
   [WorkNodeState.Review]: new Set([WorkNodeState.Completed, WorkNodeState.Failed, WorkNodeState.Cancelled]),
   [WorkNodeState.Completed]: new Set([WorkNodeState.Archived]),
   [WorkNodeState.Cancelled]: new Set([WorkNodeState.Archived]),
   [WorkNodeState.Failed]: new Set([WorkNodeState.Ready, WorkNodeState.Cancelled]),
   [WorkNodeState.Archived]: new Set([]),
   };  // Close the object literal
   ```
3. Save file

**Validation Checklist:**
- [ ] All lines 68-793 compile without syntax errors (TS1005, TS1128, TS1136, TS1434, TS1359)
- [ ] No cascade errors remain from unclosed object literal

**Completion Criteria:** `npm run build` shows zero TS1005/TS1128/TS1136/TS1434 errors in workgraph.ts.

---

### Phase 2 — Fix Underscore Prefix References
**Objective:** Correct `_createWorkGraph` and `_createWorkNode` to `createWorkGraph` and `createWorkNode`.  

**Complexity:** Trivial (2-5 minutes)

**Files Required:**
| File | Change Type | Description |
|------|-------------|-------------|
| `src/core/workgraph.ts` | Edit | Line 78: `_createWorkGraph` → `createWorkGraph` |
| `src/core/workgraph.ts` | Edit | Line 211: `_createWorkNode` → `createWorkNode` |

**Compiler Errors Affected:**
- Potential TS2304 errors for `_createWorkGraph` and `_createWorkNode`

**Steps:**
1. On line 78, replace `_createWorkGraph` with `createWorkGraph`
2. On line 211, replace `_createWorkNode` with `createWorkNode`

**Validation Checklist:**
- [ ] No TS2304 "cannot find name" errors remain
- [ ] Both functions are properly imported (verified against `src/core/types/work-graph.ts`)

**Completion Criteria:** `npm run build` shows zero remaining errors in workgraph.ts.

---

### Phase 3 — Final Verification & Regression Check
**Objective:** Ensure the full project builds successfully and no regressions were introduced.  

**Complexity:** Low (5-10 minutes)

**Files Required:**
- All project files (for verification)
- `tsconfig.json`
- `vitest.config.ts`

**Steps:**
1. Run `npm run build` — expect 0 errors
2. Run `npx vitest run` (or equivalent test command) — expect all existing tests pass
3. Verify no TypeScript errors in any other file (`src/index.ts`, `src/config/`, `src/runtime/`, etc.)

**Validation Checklist:**
- [ ] `npm run build` completes with exit code 0
- [ ] Zero TypeScript compilation errors across all files
- [ ] Existing tests pass
- [ ] No new linting errors introduced

**Completion Criteria:** Full project builds cleanly, all tests pass.

---

## Dependency Graph

```
Phase 0 (Baseline)
     │
     ▼
Phase 1 (Close Object Literal)
     │
     ▼
Phase 2 (Fix Import References)
     │
     ▼
Phase 3 (Final Verification)
```

**Dependencies:** Each phase depends on the successful completion of its predecessor. Phase 1 must complete before Phase 2 can be validated, because Phase 1 resolves all cascade errors that mask or interact with Phase 2's errors.

---

## Recommended Execution Order

| Order | Phase | Est. Time | Error Count Impact |
|-------|-------|-----------|-------------------|
| 1 | Phase 0: Baseline | 1-2 min | — (documentation only) |
| 2 | Phase 1: Close Object Literal | 5-10 min | Resolves all 159 errors |
| 3 | Phase 2: Fix Import References | 2-5 min | Resolves 2 semantic errors |
| 4 | Phase 3: Final Verification | 5-10 min | Confirms 0 remaining errors |

**Total Estimated Time:** 13-27 minutes

---

## File Summary

| File | Total Changes | Change Types |
|------|---------------|--------------|
| `src/core/workgraph.ts` | 2 edits | 1 structural (add closing + missing enum entries), 2 identifier corrections |
| `RECOVERY_PLAN.md` | 1 create | This document |

**No other files require modification.**

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Adding missing state transitions introduces new errors | Low | Use exact enum member names from `WorkNodeState` definition |
| Fixing underscore prefix breaks runtime behavior | Very Low | The underscore-prefixed names don't exist; correction is unambiguous |
| Other files have hidden errors masked by cascade | Medium | Phase 3 catches all remaining errors |

---

## Completion Checklist (Overall)

- [ ] Phase 0: Baseline captured
- [ ] Phase 1: `DEFAULT_NODE_TRANSITIONS` properly closed with all enum members
- [ ] Phase 2: `_createWorkGraph` → `createWorkGraph`, `_createWorkNode` → `createWorkNode`
- [ ] Phase 3: Full build passes, tests pass
- [ ] All 159 compiler errors resolved
- [ ] No regressions introduced

---

## Stop Condition

This plan is complete when Phase 3 validation checklist is fully satisfied.  
No implementation actions are included in this document.