# Atlas: published SDK adoption

Source `a0a7a70f7ccd1406f2442d42954c5b498d438abb` pins the published SDK and its measured compatible Bloom version, including the regenerated lockfile. Existing application behavior and previously reviewed fixes remain in the branch.

Validation: {"edgePassed": 2, "sdkImporterMembers": 2999, "bloomImporterMembers": 43882, "frontendTypesExport": "passed"}. Exact commands, logs, archive member hashes and importer resolutions are in [proof.json](proof.json).

- Published registry archives and all installed SDK importer members were compared byte for byte. Stale same-version candidate materializations were retained and repaired with a frozen install; their setup failures remain in the records.
- Local web export proves compilation, not browser/native acceptance or deployed public-client configuration. Required PR/main CI and root image/promotion remain separate.
- No production database, provider writes, grants, credentials or auth fixtures were changed. Atlas is frontend-only. Export used the existing independently verified public client ID.
