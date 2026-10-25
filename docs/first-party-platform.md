# Oxy session and Alia integration

Atlas uses one registered Oxy public client and the shared OxyProvider. Store
reads stay public; writing a review and opening Alia use the normal account
dialog and shared session, without per-product scope or consent controls.

The production public client is pinned in `packages/frontend/lib/config.ts`.
An optional `EXPO_PUBLIC_OXY_CLIENT_ID` selects a separately registered deployment;
it is never a secret. The provider owns session restoration and account changes.

Store requests use `oxyServices.store`. Own-review cache keys include the account,
and the provider discards their memory-only query root and mutations at account
boundaries. A queued read/write checks the shared transport's session epoch before
sending. Completed mutations update the originating account's key, never the new
account's key. The local star selection is also account-bound. Public catalogue
caches remain separate and no local bearer or refresh logic is introduced.

Alia renders through its shared SDK, including its conversation transport and
account isolation. Release the SDK22 dependency only after it is published and
Alia's phase-B API rollout is verified. A package publication alone does not
confirm the recipient runtime is ready.

Validation: `bun run test:store`, frontend typecheck, lint and web export. The
session tests cover switch/logout, delayed writes/deletes and completion after a
switch. No Atlas backend or service identity is required.
