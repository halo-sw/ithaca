# Run Ithaca locally

[Back to README](../README.md)


**Fastest: Docker.** No key is needed.

```bash
cp .env.example .env    # optional: fill in META_API_KEY for live Muse (MODEL_API_KEY also works)
docker compose up       # web on http://localhost:8080, relay on :8787
```

- The image builds the same static site as the public one and adds the prebuilt runtime data from the [`data-v1` release](https://github.com/halo-sw/ithaca/releases/tag/data-v1).
- Without a key, the header shows **Rule mode** and the chat says so once. The engine still computes every number.
- `npm test` at the root runs the JS tests.

<details>
<summary><b>From source</b> (Node 20+, Python 3.12, about 6 GB of raw data)</summary>

```bash
# 1. Python pipeline
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
# put south-korea-latest.osm.pbf (Geofabrik) in data/raw/ and the
# GIS건물통합정보 shapefiles in data/raw/buildings/<region>/  (see ATTRIBUTION.md)
.venv/bin/python -m pipeline build --all
.venv/bin/python -m pipeline.validate --all

# 2. Simulation runs
cd web && npm install && cd ..
node web/scripts/simulate.mjs --scenario scenarios/demo-two-homes.json --home both --out data/build/sim/
node web/scripts/money.mjs   --scenario scenarios/demo-two-homes.json --out data/build/sim/

# 3. App (the consult agent and live decisions need a Meta API key in the server environment)
cd web && META_API_KEY=... npm run dev
```

Useful URLs (add to `/?mode=sim&scenario=demo-two-homes`):

| URL | Shows |
|---|---|
| `&tour=demo` | 3-minute guided tour |
| `&home=A&day=1&t=07:52&follow=1` | Follow the commute (the Line 8 leg) |
| `&tab=money` | Living costs |
| `&tab=listings&fill=example` | Check a listing, with a labelled example |
| `&tab=money&share=1` | Result card |
| `&tab=criteria` | Criteria |

`/` opens the chat entry, and `/?area=seongsu&shot=3&time=18:30` is a scenic tour.

Raw and built data are never committed; the scripts above regenerate them. Real-transaction CSVs, the public-housing snapshot and the subway congestion file are fetched by the operator and stay local, as their terms require.

</details>
