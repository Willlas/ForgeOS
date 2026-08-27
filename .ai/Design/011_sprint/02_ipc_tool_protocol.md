# 02 - IPC Tool Protocol

## Objective
Extend IPC so CLI sessions can request authorized tools and receive correlated results.

## Public Interfaces
Add typed envelopes for session/grant identifiers, tool requests, tool results, approval requests, cancellation and terminal errors. Every message SHALL include correlation data.

## Components
- IPC command and payload types
- request validation
- tool result/error serialization
- cancellation and timeout semantics

## Dependencies
01 workspace access grants; Sprint 010 transport behavior.

## Acceptance Criteria
- Invalid payloads fail with typed errors.
- Results cannot be delivered to another session.
- Cancellation is idempotent and bounded by timeout.
- Existing lifecycle and `ask` commands remain compatible.

## Definition of Done
Protocol types and round-trip tests cover success, failure, cancellation and expiry.
