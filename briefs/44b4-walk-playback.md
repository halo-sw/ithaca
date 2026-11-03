# 44b4 — Add a watchable slow playback speed
One tiny usability change, authored by Muse Code. Do not run full tests/build/git. Do not explore.
`web/src/sim.js:13–14` currently:
```
export const SPEEDS = [1, 10, 60]; // sim-min per 0.1 s at 1×
export const SIM_TICK_S = 0.1; // seconds per sim-minute at 1×
```
Add 0.1 as the first accepted speed, preserving 1/10/60 and current default. The existing timeline dynamically maps SPEEDS to radios and main.js accepts SPEEDS.includes(next), so no other product change is necessary. 0.1× means 1 simulated minute per real second, allowing a person to watch a short walk. Do not alter simulation records, figures or time calculations. This is a reversible constant change; no implementation-mirroring test is needed. Finish after editing this one line.
