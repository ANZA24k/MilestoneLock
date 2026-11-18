# Milestone v3 — complete-project readiness and role-aware next actions

## Exact delta

Pre-v3 repository baseline: `07fa7e1e2fec3f7bded5833f6e8ec9411fdcee97` (the latest v2 browser QA commit). This is the implementation baseline; confirm it matches the steward's last accepted revision when submitting.

V2 compares two reviews of one milestone and checks imported receipts. V3 adds a separate **Project readiness** workspace at `/readiness.html`, covering the complete locked project rather than a single revision pair.

- Read every milestone in the immutable 2–6-step plan using `LATEST_FINAL`.
- Verify the project commitment, each milestone's membership, roles, dependency, specification, commitment and complete decision chain.
- Identify awaiting acceptance, awaiting evidence, blocked, awaiting review, needs revision, exhausted, approved and cancelled states. A pending third submission remains reviewable even though no further submissions remain.
- Show approved count, completion, used/remaining evidence submissions, predecessor blockers, and next permitted actor and method. Acceptance includes the exact locked commitment; pending reviews include the correct milestone ID. Evidence submission routes through the existing evidence-pack preparation workspace.
- Extract unresolved criterion IDs and original requirements from the latest completed review, alongside evidence-rule findings and the finding's revision number. Old findings remain explicitly labeled when a newer revision is pending.
- Export the entire project, all records, action guidance, timestamps and decision fingerprints as an unsigned JSON handoff report.
- Re-read each record and the project after collection; reject detected changes, missing/duplicate records, malformed workflow state, tampering and RPC failure. Never replace failed live reads with recorded fixtures.

## Contract preservation

No contract source, deployment manifest, address or on-chain state was changed. No transactions were sent. Live verification matches **both** deployed sources byte-for-byte and checks their existing SHA-256 values.

Plan contract: https://explorer-studio.genlayer.com/address/0xc1B531B1f8bae23Bb3a942F78Df0ccee45705A2B

Original contract: https://explorer-studio.genlayer.com/address/0x007cdf675F66115d37e0E311a6669306f4D3b380

## Reproduce

```sh
npm ci
npm run test:web
npm run build
npm run verify:readiness
pytest -q tests
genvm-lint check contracts/milestone_lock.py
genvm-lint check contracts/milestone_plan.py
```

The new live verifier writes `docs/evidence/v3-readiness-live.json` only after successful live checks, including full project state and both source comparisons. Unit fixtures are recorded synthetic pilot data, not new transactions. Tests also construct synthetic rejected, inconclusive, exhausted, pending and blocked states; they do not claim live use of those states in v3.

## Review path and publication status

1. Build and serve `dist` over HTTPS, then open `/readiness.html`.
2. Load project **1**. Expect **2 / 2 approved**, terminal actions and zero methods to execute.
3. Export the complete readiness report. Inspect the two complete milestone records, three total reviews and contract address.
4. Independently reproduce `npm run verify:readiness`; compare commitments and decision hashes with the export.
5. Run the new readiness tests for dependency blockers, remediation requirements, pending third revisions, exhausted revisions and inconsistent reads.

The original public website remains at https://milestonelock.ansaf1st34.chatgpt.site. The connected hosting account does not list that existing Site, including editable Sites. Consequently this v3 source and build are available in GitHub, but **v3 has not been published to the existing website**. Do not use the existing live URL as proof that v3 is deployed.

## Limits

This is new application workflow functionality over the accepted contracts, not new contract consensus logic. Bracketed reads detect observed concurrent changes but do not provide an atomic block snapshot. Refresh before acting; contract guards remain authoritative. Hash checks prove consistency, not source authorship or real-world truth. The downloadable report is unsigned and must not be treated as independent provenance without fresh RPC reads. Synthetic pilot; no escrow, payments, new adoption or real customer delivery claimed.
