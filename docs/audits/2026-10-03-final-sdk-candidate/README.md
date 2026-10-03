# Atlas candidate compatibility

Atlas remains a public storefront with one canonical OxyProvider and the
existing registered client ID. No backend, local auth, catalogue policy, grant,
registration or deployment was added. The only source change makes the canonical
Pages workflow install freshly published dependencies with minimum release age
zero; its client variable and API URL remain unchanged.

On base `530f6fea31fb6ba089026855646c4be9a73d91ac`, the final Oxy candidate packs
from `20013421a4cc07545a7685931db68f4ee55f1773` passed frontend TypeScript, the
root `test:edge` command (2 tests), and `build:frontend` (Expo web export + edge
worker). Bloom 7.1.2 comes from the published registry archive and supports the
existing subpath APIs, including content-panel; no blind downgrade to 6.2 was
made. All 25,283 installed package files across core/contracts/protocol/Services
and Bloom match their archives byte for byte.

`candidate-inputs/` preserves **test inputs only**. The actual package manifests
and lock remain uncommitted local candidate inputs. Final exact registry pins
and regenerated lock will be committed together after Oxy publication, followed
by final validation. This does not prove browser/native rendering or deployed
SDK adoption. No package was published from this repo.

`public-client.json` retains the selected root read-only preflight: the existing
active production public credential belongs to Atlas, matches the authenticated
GitHub variable, and has the expected redirect/user:read scope. Neither row nor
variable was changed. Root owns workflow pause/merge/dispatch; Atlas has only a
Cloudflare frontend and contributes no ECS service to the restoration count.
