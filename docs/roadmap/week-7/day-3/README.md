# Week 7 · Day 3 — CI/CD Pipeline

> Roadmap: [index](../../README.md) · [Week 7](../README.md)
> Refs: `docs/ARCHITECTURE.md` §12 (CI/CD), §16 (Delivery)

## Goal
Automate lint/typecheck/test → Docker build → image scan → push to ECR on every PR.

## Why this matters
§12: GitHub Actions runs ESLint + `tsc --noEmit` + tests on PR; Docker multi-stage
build tagged by git SHA; Trivy image scan; push to ECR. Both `backend/` and
`frontend/` already have ESLint configs and Dockerfiles to build on.

## Tasks
- [ ] Add a GitHub Actions workflow: on PR run `eslint` + `tsc --noEmit` (+ tests if present) for backend and frontend
- [ ] Build both Docker images (multi-stage), tag with the git SHA
- [ ] Scan images with **Trivy**; fail on high/critical vulns
- [ ] Push images to **ECR** on merge to main
- [ ] Cache npm/build layers for speed
- [ ] Add a status badge / required check on the repo

## Acceptance criteria
- [ ] PRs are blocked on lint/typecheck failures
- [ ] Images build, scan, and push to ECR on merge
- [ ] Build is reproducible and SHA-tagged

## Notes
> Keep the MediaSoup build deps in mind — the backend Dockerfile already installs
> `python3` + `build-essential` for native compilation.
