# Validation boundaries

The release passes 34 official GenVM Direct Mode contract tests, four Node web tests, the site build, and GenVM lint/schema validation. GitHub Actions runs the same checks. Direct tests mock web and model responses; they exercise actual SDK storage and validator closures but are not a simulation of network voting.

The real pilot uses Studio built-in accounts and Normal Full Consensus, with simulation disabled. `npm run verify:live` checks the exact deployed source, finalized state, successful leader execution, MAJORITY_AGREE, document commitments and decision hash chains. `npm run verify:site` checks public HTML/JS/CSS/logo, the deployed address and RPC CORS.

The optional browser wallet connection is unit-tested with an EIP-1193 provider stub to request only eth_requestAccounts and reject malformed results. A real MetaMask extension is not available in this environment; no real MetaMask approval or signature is claimed. Actual contract writes use Studio's built-in account.

Browser visual and mobile interaction QA was unavailable because the required control-browser preview capability was not installed. Responsive layouts and reduced-motion behavior are implemented, but automated HTTP and unit checks do not replace visual inspection.
