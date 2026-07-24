# AI Native Repository Standard

## Mission

ForgeOS is developed by autonomous AI agents.

Agents MUST execute small, well-defined work packages.

Repository-wide analysis is prohibited unless explicitly requested.

---

# Golden Rule

Never refactor an entire directory.

Never refactor an entire subsystem.

Always work on one component at a time.

---

# Allowed Work Unit

One execution should target only ONE of the following:

- one file
- one component
- one interface
- one algorithm
- one responsibility

Never multiple unrelated targets.

---

# Repository Exploration

Repository exploration is expensive.

Agents MUST NOT:

- recursively inspect src/
- inspect every file in a directory
- count files
- build architectural maps

Instead:

Read only the files explicitly referenced by the task.

---

# Preferred Workflow

Understand

↓

Implement

↓

Build

↓

Run affected tests

↓

Commit

↓

Stop

---

# Reading Policy

Read the minimum amount of code required.

Maximum:

- 1 primary implementation file
- 2 supporting files
- affected tests

Avoid reopening files already read.

---

# Refactoring Policy

Refactor only the target component.

Never refactor neighbouring components.

Never "improve" unrelated code.

---

# File Size Targets

Ideal:

150-250 lines

Acceptable:

250-350 lines

Review:

350-500 lines

Refactor:

>500 lines

---

# Extraction Order

When splitting a file:

1. Interface
2. Algorithms
3. Validation
4. Builder
5. Serialization
6. Runtime
7. State

Never mix responsibilities.

---

# Commit Policy

One logical change.

One build.

One test run.

One commit.

Continue only after success.

---

# Success Criteria

A task is complete when:

- code compiles
- affected tests pass
- one small commit exists

Do not continue analysing after that.