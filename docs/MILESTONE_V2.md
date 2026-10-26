# Milestone v2 — revision comparison and contract-anchored receipt audits

Accepted milestone v1 baseline: `10c1524e400035f5a48d74b5caf7889a36449d5c`.

## New functionality beyond v1

V1 exposes ordered plans, evidence packs and historical decision hashes. V2 makes those histories actionable in a dedicated `/audit.html` workspace:

- Compare two reviewed revisions: per-criterion before/after findings, exact source-bound quotations, resolved and regressed requirements, and unresolved criteria.
- Compare evidence commitments by source ID, including role, URL, SHA-256, byte length and added/removed/changed status. Show evidence-rule findings too.
- Import a complete plan receipt and independently read its project and milestone using `LATEST_FINAL`. Validate local commitment chains, then compare every imported history entry against finalized state. A forged history with recomputed hashes is rejected. Older matching histories are explicitly identified as historical prefixes, rather than current state.
- Re-fetch all distinct historical sources, verify exact bytes, length and UTF-8, then confirm every nonempty quotation occurs in its bound source. Downloads are bounded to the committed length and use timeouts.
- Export complete receipts and revision audit JSON. The report explicitly identifies itself as an unsigned local export.

## Address preservation

Both `deployment.json` and `plan-deployment.json` remain unchanged. No contract source changes, deployments or new transactions are required. Existing plan address:

https://explorer-studio.genlayer.com/address/0xc1B531B1f8bae23Bb3a942F78Df0ccee45705A2B

Original single-milestone address also remains unchanged:

https://explorer-studio.genlayer.com/address/0x007cdf675F66115d37e0E311a6669306f4D3b380

## Reviewer path

1. Open https://milestonelock.ansaf1st34.chatgpt.site/audit.html and load milestone **2**.
2. Compare revisions **1** and **2**. Expect `REJECTED → APPROVED`, resolved `keyboard_submit` and `required_email`, changed `artifact`, unchanged `checks`, and no unresolved criteria.
3. Click **Verify all historical sources**. Expect three distinct documents and six exact quotations verified.
4. Click **Export complete receipt**, select that JSON with the receipt file input, then click **Verify receipt provenance**. Expect a match to all finalized reviews.
5. Change an outcome in a copy of the receipt and import it. Expect failure. The automated adversarial test also recomputes the forged hash chain and proves it still fails finalized-state anchoring.
6. **Export revision audit** downloads the comparison and decision fingerprints.

No wallet, signature or payment is needed. The existing plan builder and Studio transaction preparation remain available at `/plans.html`.

## Reproduce

```sh
npm ci
npm run test:web
npm run build
npm run verify:audit
```

`verify:audit` reads the existing deployment, matches deployed source byte-for-byte, compares live history, verifies current and historical receipt provenance, and re-fetches historical sources. Its dated output is `docs/evidence/v2-audit-live.json`. A failed run does not write a new success report. Unit tests use the previously recorded pilot as fixtures; they are not additional live transactions.

## Scope and limits

This is new frontend audit functionality over the accepted deployment, not a new consensus algorithm or contract feature. Source checks prove committed bytes and quote presence, not authorship or real-world truth. The pilot is synthetic; approval does not transfer funds. Imported receipts authenticate reviewed history only: mutable status and pending evidence fields are independently reloaded and never trusted from the import. RPC errors stop verification; cached fixtures are not presented as live state. Hash verification requires HTTPS; the HTTP-only local preview cannot exercise Web Crypto. Final live website testing uses HTTPS.
