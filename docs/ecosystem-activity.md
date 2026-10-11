# Ecosystem activity

Atlas has no service backend. Its catalog and review requests go through the
Oxy SDK to the central Oxy API, where the ecosystem collector observes their
actual requests and responses. The SDK update refreshes the browser's
Cloudflare PoP metadata after a network change; this is edge location, not
IP-derived visitor geography.

There is no invented Atlas infrastructure node.

## Cloudflare web traffic

Atlas's web traffic, including static asset requests and visits without an API
request, is measured keylessly by Oxy from Cloudflare's own analytics (see
OxyHQ/oxy `docs/operations/cloudflare-web-activity.md`). Atlas holds no Oxy
activity secret and runs no activity code: the Pages `_worker.js` only serves
assets.

The `OXY_EDGE_ACTIVITY_*` bindings of the retired edge observer were never
provisioned and nothing reads them now. If an operator ever finds one on the
Pages project, it can simply be deleted.
