# Spark 1.3 vs Spark Open

[← README](../README.md) · [한국어](model-comparison.ko.md)

Each model has one job. Numbers never come from a model.

| Model | Job in the product | Status |
|---|---|---|
| **Muse Spark 1.3** | The household's everyday choices with reasons, the consult agent, and (as Muse Code) the coding agent that wrote this repository | built |
| **Muse Spark Open** (`meta-models/muse-spark-open-1026` on Baseten) | The same household decisions on an open-weight model; one switch (`--provider meta\|baseten`). Compared with Spark 1.3 below | built (comparison) |
| **Muse Spark 1.3 as a judge** | Reads each report sentence next to the simulation records it cites and answers supported or not, with a reason; a separate call from the writer | built |
| **Muse Voice Transcribe 1.0** | Spoken intake: tap the microphone and say your household and workplace; the transcript goes into the box, never sent on its own | built |
| **Muse Image 1.0** | Draws one moment from the 30-day diary, from a fixed scene list, always labelled as an illustration ([2 real calls](evidence/muse-image-2026-11-03.json)) | built |
| **SAM 3.1** | Finds the windows in a room photo you add; it returns boxes, and code computes the count and the share of the photo ([1 real call](evidence/sam-3.1-2026-11-03.json)). Room sizes from floor plans are *coming soon* | built |

**Spark 1.3 vs Spark Open on the same household** (2026-10-29, `reasoning_effort` low, files in [`scenarios/decisions/compare-1029/`](../scenarios/decisions/compare-1029/)):

| | Spark 1.3 | Spark Open |
|---|---|---|
| Decisions (A + B) | 154, all answered, 0 guard fallbacks | 154, all answered, 0 guard fallbacks |
| Same choice where both met the same decision point | 120 of 139 (86 %) | |
| Different from the rule default (of 154) | 75 | 72 |
| Average latency per call | 3.7 s | 2.7 s |
| Output tokens (A + B) | 140k | 96k |

Where they differ, it is mostly which shop to stop at after work (15 of 19). Without a reasoning limit, Spark Open spent its whole 2,000-token budget thinking on 116 of 154 calls. With `reasoning_effort: low` it answered every one.
