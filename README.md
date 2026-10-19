# MilestoneLock

**Work proven. Progress unlocked.** A GenLayer settlement approval platform that locks deliverables, criteria, and evidence rules before work begins.

Public website: https://milestonelock.ansaf1st34.chatgpt.site

Contract (Studionet): `0x007cdf675F66115d37e0E311a6669306f4D3b380`.

## What it does

A sponsor creates an immutable milestone for a distinct contractor. The contractor accepts the exact commitment hash, then submits a public commit-pinned UTF-8 document with its SHA-256 and byte length. Any independent reviewer can request a GenLayer Full Consensus assessment. Validators independently retrieve and authenticate the evidence, infer every criterion and evidence-rule finding, normalize harmless metadata and criterion ordering, compare the stable decisions, verify exact excerpts and separately ground the proposed report against the source.

Deterministic rules produce APPROVED only when every criterion and the evidence rules are MET. UNCLEAR yields INCONCLUSIVE; otherwise a NOT_MET finding yields REJECTED. A failed retrieval or invalid model response reverts without consuming the pending evidence revision. A hash/length mismatch becomes INCONCLUSIVE. Approved milestones are terminal; rejected/inconclusive evidence may be replaced at most twice with a new hash. All completed decisions remain in a hash-linked append-only history.

## Settlement scope

**This Studionet pilot approves settlement; it does not escrow or transfer funds.** The reference amount is an informational label. APPROVED is evidence of an agreed document assessment, not a payment receipt, legal ruling, proof of real-world delivery, or guarantee of truth. The pilot artifacts are explicitly synthetic complete HTML documents. The contract cannot authenticate who created the artifact or prove facts outside the submitted evidence. Studio currently does not support token transfers.

## Website and wallet

The website reads LATEST_FINAL contract state without a wallet. It displays locked criteria, role addresses, references, exact excerpts, hashes and revision history. It verifies commitments and exported receipt hash chains locally. Evidence bytes can be independently rehashed in the browser. Preparation forms compute hashes locally and produce method arguments for Studio's built-in account. No private-key export is needed.

The optional browser wallet connection requests only `eth_requestAccounts`. Connecting never signs, switches chains, grants token approvals or sends a transaction. Writes are performed explicitly through Studio in Normal (Full Consensus) mode, with Simulation Mode disabled.

## Reproduce checks

```sh
npm ci
npm run test:web
npm run build
python -m venv .venv
. .venv/bin/activate
pip install -r requirements-test.txt
pytest -q tests
genvm-lint check contracts/milestone_lock.py
```

Python direct tests run the pinned official SDK v0.2.16. Web tests cover the URL allowlist, wallet RPC calls, Unicode-compatible canonical JSON and receipt tampering. Mocked direct tests are separate from real Studio consensus evidence. See [security](docs/SECURITY.md), [deployment](docs/DEPLOYMENT.md), and [live verification](docs/LIVE_TEST.md).

## Public evidence format

Use a raw GitHub `.txt` URL pinned to a full 40-character commit. The complete document is limited to 30,000 bytes; immutable criteria (maximum six) state what evidence is sufficient. If they require outside corroboration that is not present, validators must return UNCLEAR. References inside evidence are never fetched implicitly. Only the single committed document is assessed.

The contract has no privileged verdict setter, upgrade method, evidence-deletion method or global finite record slot. Records are auto-numbered and views paginate. The sponsor may cancel only before contractor acceptance. New records, acceptance and evidence submission have deterministic role guards. Review is permissionless but each evidence revision can produce only one completed decision.
