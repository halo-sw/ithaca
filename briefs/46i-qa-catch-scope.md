# 46i — catch variable scope

Edit ONLY web/scripts/aerial-detail-audit.mjs. Current lines96–97 declare instrumentBefore and instrumentAfter inside the try block, but catch at274 references them. Move both declarations to runCase function scope immediately before `try` atline77, remove the old declarations. No other behavior change. Read only70–107 and274–292 if needed. `node --check` then stop. No git/build/browser/product.
