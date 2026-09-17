# RFC-0003

Purpose

Transform execution requests into actual execution.

---

Scheduler

↓

Execution Request

↓

Dispatcher

↓

Worker

---

Dispatcher Responsibilities

Find Worker

Reserve Resources

Load Provider

Load Model

Create Workspace

Stream Logs

Capture Metrics

Recover Failures

Dispose Worker

---

The Dispatcher owns execution lifecycle.

Not scheduling.
