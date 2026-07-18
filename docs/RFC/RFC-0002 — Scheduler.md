# RFC-0002

Title

Engineering Scheduler

---

## Responsibilities

The Scheduler owns execution.

Nothing else.

It never plans.

It never writes prompts.

It never edits files.

It only answers:

Who should execute what?

When?

Using which resources?

---

## Inputs

Work Graph

Worker Registry

Resource Manager

Knowledge

Budgets

Policies

---

## Outputs

Execution Plan

---

## Scheduling Algorithm

Every Work Item receives a score.

Score =

Engineering Value

×

Knowledge Gain

×

Priority

×

Dependency Unlock

÷

Estimated Cost

÷

Risk

The highest score wins.

---

## Policies

Small tasks first

or

Large tasks first

or

Research first

or

Testing first

or

Maximum Throughput

Policies are replaceable.

---

## Scheduling Loop

Observe

↓

Score

↓

Allocate

↓

Monitor

↓

Adjust

↓

Repeat

---

## Dynamic Scheduling

If a Worker finishes,

the graph is rescored.

If knowledge changes,

the graph is rescored.

If resources change,

the graph is rescored.

Scheduling is continuous.

Never static.
