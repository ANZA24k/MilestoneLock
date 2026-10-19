# Deployment

Network: GenLayer Studionet (chain ID 61999), RPC https://studio.genlayer.com/api.

Use Studio's built-in account; do not export its private key. Import `contracts/milestone_lock.py`, choose Normal (Full Consensus), leave simulation disabled and deploy with no constructor arguments. The exact source is verified by `scripts/verify-live.mjs` against `getContractCode`.

Create a milestone as sponsor using `examples/specification.json` and a separate built-in contractor account. Read the commitment, switch to the contractor, accept it, then submit the exact committed document URL, hash and byte count. Switch back to a separate reviewer to call `review`. Verify FINALIZED status and GenVM SUCCESS, not status alone.

Deployment addresses, source SHA-256 and transaction hashes are recorded in `deployment.json`; final pilot outcomes and consensus votes are in `docs/evidence/live-state.json` after live verification. `npm run verify:live` rechecks them using the pinned SDK. Local direct tests use mocked web/model responses and are not live evidence.
