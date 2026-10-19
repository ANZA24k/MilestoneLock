# GenLayer project submission

## Name
MilestoneLock

## One-liner
Lock milestone criteria before work begins, then use independent GenLayer validators to approve or reject settlement from committed evidence.

## Description
MilestoneLock helps project sponsors and contractors agree on completion before work begins. Sponsors lock deliverables, criteria and evidence rules; contractors accept the exact commitment hash. Contractors submit commit-pinned public documents with SHA-256 and byte-length commitments. GenLayer leaders and validators independently retrieve the evidence, assess each criterion and validate supporting excerpts. Deterministic rules return APPROVED, REJECTED or INCONCLUSIVE. New evidence can append up to three decisions without deleting history; approvals are terminal. The website reads finalized state, displays criteria and findings, verifies receipt chains and prepares Studio calls. Wallet connection requests only a public address. The synthetic Studionet pilot records settlement approval only: no funds are escrowed or transferred, and judgments apply only to submitted evidence.

## Evidence
- Website: https://milestonelock.ansaf1st34.chatgpt.site
- Repository: https://github.com/ANZA24k/MilestoneLock
- Contract: https://explorer-studio.genlayer.com/address/0x007cdf675F66115d37e0E311a6669306f4D3b380
- Source: https://github.com/ANZA24k/MilestoneLock/blob/main/contracts/milestone_lock.py
- Live verification: https://github.com/ANZA24k/MilestoneLock/blob/main/docs/evidence/live-state.json
- Tests and CI: https://github.com/ANZA24k/MilestoneLock/actions
- Validation boundaries: https://github.com/ANZA24k/MilestoneLock/blob/main/docs/VALIDATION.md

Use Projects for the full platform submission. The reference amount is informational; describe the pilot as settlement approval rather than an escrow/payment system.
