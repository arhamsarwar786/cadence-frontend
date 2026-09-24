# Dummy candidate import packages

> **Do not upload these files to production.** Use **Candidate imports → Create sample package** in the staff app instead (encrypts in your browser for your org).

Cadence expects an **encrypted** import file. The canonical extension is **`.migpkg`**; **`dummy-candidates.pkg`** is the same bytes (some teams call it “pkg”).

| File | Contents |
|------|----------|
| `dummy-candidates.migpkg` | Fixed sample: 2 valid CSV rows + sample documents (Jane Doe, John Smith) |
| `dummy-candidates.pkg` | Identical copy of the `.migpkg` file |

## Regenerate for your org

The package must be encrypted for **your org id** (AAD `cadence:migration-intake:v1:<org_id>`) and the **same migration KMS key** as the API that will validate it.

### Against the deployed API (`api.app-cadence.com`)

1. Log in on the staff app and note your org id from `/api/v1/auth/me/` (or the seed admin session).
2. Fetch the org’s public key: `GET /api/v1/candidate-imports/public-key/`  
   If this returns **500**, imports cannot be built or validated until migration KMS is configured on that environment.
3. Run from `cadence-frontend/`:

```bash
node scripts/build-dummy-candidate-package.mjs --test-upload
```

### Local backend (same machine as `build_test_package`)

```bash
ORG=<your-org-uuid>
cd ../app-cadence/Backend
uv run python manage.py build_test_package --org "$ORG" --out ../../cadence-frontend/docs/fixtures/dummy-candidates.migpkg
cp ../../cadence-frontend/docs/fixtures/dummy-candidates.migpkg ../../cadence-frontend/docs/fixtures/dummy-candidates.pkg
```

Upload via **Candidate imports → Upload package** (needs `candidate_imports.create`).
