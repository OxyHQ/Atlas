# Review session and persistence limits

Atlas passes its own `QueryClient` to `OxyProvider`. In Services 13.6 and
13.13, that skips the provider's shared-query persistor. The provider still
attaches the per-account persistor, which owns review mutations only when
their complete keys match `ATLAS_ACCOUNT_QUERIES.mutationKeys`.

Review writes and withdrawals now use those exact keys, make one attempt
without retry or offline queueing, and keep their session owner in memory. The
per-account persistor writes only paused registered mutations; these review
operations do not pause through network or retry policy. A failed operation
shows an error and leaves the previous rating visible. Replacing the session
invalidates pending callbacks, and the component allows only one action at a
time. An already-sent request cannot be unsent when the session changes.

The projected user must match `oxyServices.session.userId` from the current
bearer before an own-review read or mutation can run. Core 7.9.1 derives that
value from `userId` or `id`; opaque or `sub`-only tokens leave reviews
unavailable rather than associating a request with an unproven account. The
current Oxy API session issuer includes `userId` on access tokens, including
standard refresh rotation. Synthetic SDK tests cover those claims and their
absence; they do not replace a native-device sign-in and refresh test.

Earlier Atlas versions used keys with an app slug and account ID appended;
those keys did not match the registered account keys. A mutation left in
memory was therefore not removed by the account persistor at a switch. This
does not establish that Atlas wrote the mutation to a shared disk cache: no
shared persistor is attached for Atlas's external `QueryClient`. No existing
storage is read, migrated, or deleted by this change.

The shared-persister tests attach it explicitly as a compatibility experiment,
not as a claim that Atlas currently uses it. In that hypothetical setup,
legacy extended-key records remain untouched and have no registered replay
function; newly keyed operations are excluded. This does not establish the
fate of any historical blob, expiry, storage failure, another tab, or a past
app version with different wiring. Enabling a global clearing policy would
require a separate migration and ownership audit.

No reliable offline review replay is promised. Restoring an old pending
mutation does not reconstruct its function, and adding a generic default can
match extended legacy keys too. Safe replay would require an account-scoped
queue, validated ownership, a readiness barrier and a strategy for requests
already in flight.
