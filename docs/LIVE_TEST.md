# Live verification

The release uses contract `0x007cdf675F66115d37e0E311a6669306f4D3b380` on Studionet (61999). Source is pinned in `deployment.json` and checked byte for byte against the deployed GenVM source.

The pilot uses two distinct Studio built-in accounts. The sponsor locks the specification, the contractor accepts its exact commitment, and only the contractor submits evidence. Reviews are requested from the separate sponsor account in Normal Full Consensus mode, with Simulation Mode disabled.

The synthetic complete artifact contains an associated visible email label, a native submit button in normal tab order, and a required email input. The incomplete artifact explicitly changes the input to text, omits required, and sets the submit button tabindex to -1. Primary artifacts, rather than asserted test results, are assessed.

`npm run verify:live` requires the following finalized history:

| Milestone | Expected history |
| --- | --- |
| 1 | APPROVED for the complete artifact |
| 2 | REJECTED for the incomplete artifact, then APPROVED for new corrected evidence |

The verifier independently re-downloads both committed documents, authenticates their exact bytes and SHA-256, checks every milestone commitment and decision hash link, and requires FINALIZED, Normal mode, MAJORITY_AGREE and successful execution for every listed lifecycle transaction. A finalized failed/reverted transaction is not counted as success.

`docs/evidence/live-state.json` records the actual outcomes and votes once these checks pass. `docs/evidence/validation.json` distinguishes direct/mock tests and wallet-provider tests from live consensus. No value is escrowed, transferred or claimed as paid.

## Earlier deployment

The initial deployment is preserved in `docs/legacy/first-deployment.json`. One negative review ended in majority disagreement and a retry reverted on invalid model output; neither created a stored decision. The final source normalizes harmless model metadata and criterion ordering, rejects duplicate/missing criteria, clarifies document admissibility, and retains independent inference plus source-grounding checks. The legacy address is not the submitted final release. The summarized disagreement is retained for transparency, not counted as successful consensus.
