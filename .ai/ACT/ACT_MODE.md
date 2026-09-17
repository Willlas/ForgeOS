# ACT MODE - Autonomous Repository Modernization

You are now executing the repository modernization plan.

## Primary Objective

Execute the existing PLAN.md incrementally.

Do NOT redesign the architecture.

Do NOT create a new plan.

Your only responsibility is to execute the existing plan safely.

---

# Execution Rules

Process ONLY ONE logical change at a time.

Each iteration must follow this exact lifecycle:

1. Read the minimum number of files required.
2. Perform one isolated modification.
3. Build.
4. Run only the tests affected by the change.
5. Fix compilation/test failures immediately.
6. Stage only modified files.
7. Create one atomic commit.
8. Continue with the next pending task.

Never batch unrelated work.

---

# Repository Reading Rules

The repository is considered AI-Native.

Never scan the entire repository.

Never perform global searches unless strictly required.

Read only:

- the current file
- directly imported files
- interfaces required to understand the change

If additional context is needed,
read the minimum possible amount of code.

---

# Refactoring Rules

Prefer extracting code over modifying it.

When a source file exceeds roughly 400-500 lines:

1. Identify cohesive responsibilities.
2. Create subdirectories if appropriate.
3. Extract interfaces.
4. Extract shared types.
5. Extract services.
6. Keep public APIs stable.

Never introduce behavioural changes while splitting files.

---

# Documentation Rules

Every public module must have its companion markdown.

Example:

eventbus.ts
eventbus.md

Documentation should remain concise.

---

# Commit Rules

Every commit must compile.

Every commit must leave the repository in a better state.

Commit after EVERY completed task.

Never accumulate unrelated changes.

Commit messages must follow:

docs(...)
refactor(...)
feat(...)
fix(...)
test(...)

---

# Recovery Rules

If blocked:

Do NOT inspect the whole repository.

Stop.

Explain:

- which symbol is missing
- which file is required
- why it is required

Then continue after obtaining only that information.

---

# Forbidden

Do NOT redesign the architecture.

Do NOT rewrite completed modules.

Do NOT reread completed documentation.

Do NOT create large commits.

Do NOT spend long periods analysing.

Implementation time should always dominate analysis time.

---

# Success Criteria

Progress is measured by:

- smaller source files
- more extracted interfaces
- more modular folders
- passing tests
- successful builds
- many small commits

Continue autonomously until every item in PLAN.md has been executed.

## Build and Test Policy

Never invoke build tools directly.

Always use the official npm scripts defined in package.json.

Preferred commands:

- npm run build
- npm run test
- npm run lint
- npm run typecheck
## Priority Rules

When multiple project documents disagree, always use this priority:

1. PROJECT_STATE.md (highest priority)
2. Active sprint documentation
3. ROADMAP.md
4. Source code
5. Assumptions

Never start a future sprint while the current sprint is still marked as active in PROJECT_STATE.md.

If ROADMAP and PROJECT_STATE disagree, PROJECT_STATE is authoritative.