# 50g — Complete US map attribution

Muse-only tiny product copy change. Max3 steps. Read `web/src/ui/chatmap.jsx:952-986` only. The new real OSM ground layer is visible beneath USGS imagery (imagery opacity .9), but the USGS credit branch still names only USGS. Change full USGS credit to `Map: USGS The National Map · © OpenStreetMap contributors` and short USGS credit to `© USGS · © OpenStreetMap`. Keep all other credit logic and product behavior unchanged. No new tests for two static source-label strings; no git/build/full suite. Stop after edit.
