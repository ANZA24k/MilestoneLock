# Validation boundaries

The release passes 34 official GenVM Direct Mode contract tests, four Node web tests, the site build, and GenVM lint/schema validation. GitHub Actions runs the same checks. Direct tests mock web and model responses; they exercise actual SDK storage and validator closures but are not a simulation of network voting.

The real pilot uses Studio built-in accounts and Normal Full Consensus, with simulation disabled. `npm run verify:live` checks the exact deployed source, finalized state, successful leader execution, MAJORITY_AGREE, document commitments and decision hash chains. `npm run verify:site` checks public HTML/JS/CSS/logo, the deployed address and RPC CORS.

The optional browser wallet connection is unit-tested with an EIP-1193 provider stub to request only eth_requestAccounts and reject malformed results. A real MetaMask extension is not available in this environment; no real MetaMask approval or signature is claimed. Actual contract writes use Studio's built-in account.

Browser visual and mobile interaction QA was unavailable because the required control-browser preview capability was not installed. Responsive layouts and reduced-motion behavior are implemented, but automated HTTP and unit checks do not replace visual inspection.

## Project-plan milestone update (software v2)

The updated suite has 67 official Direct Mode contract cases (34 preserved baseline cases + 33 project-plan cases) and six Node web tests. Both contracts pass the GenLayer linter. Mocked tests cover invalid UTF-8, HTTP error classification, every-source hashing, wrong-source excerpts, dependency gates, pending and maximum revision guards, plan cancellation, exact acceptance and validator disagreement. Mocked model responses establish enforcement behavior, not model quality.

The live two-source pilot uses separate Studio sponsor and contractor accounts. `npm run verify:plans` checks the exact source, whole-plan and milestone commitments, finalized Normal/MAJORITY_AGREE/SUCCESS transactions, the intentionally blocked predecessor submission, source bytes, and preserved rejected-then-approved history. The corroboration document deliberately claims passing checks even when the primary artifact fails; live model decisions remain independently inspectable in `docs/evidence/plan-live-state.json`.

The public site verification additionally checks `/plans.html`, `/plans.js`, the separate new deployment manifest and recorded plan evidence. Browser visual/mobile QA and real MetaMask extension QA remain unavailable and are not claimed.
