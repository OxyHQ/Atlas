# Ecosystem activity

Atlas has no service backend. Its catalog and review requests go through the
Oxy SDK to the central Oxy API, where the ecosystem collector observes their
actual requests and responses. The SDK update refreshes the browser's
Cloudflare PoP metadata after a network change; this is edge location, not
IP-derived visitor geography.

There is no invented Atlas infrastructure node. Static asset requests served
by the hosting platform require that platform's own collector; updating this
client alone does not claim to observe CDN traffic or page visits without an
API request.
