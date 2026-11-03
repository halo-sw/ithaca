// 49h: one-turn routine-revision intent for the plan review card's
// Adjust button. Armed once, consumed exactly once by the next valid
// send, which handoffs directly to a NEW plan. Busy/replay/empty
// sends never consume or append.
export function createRevisionIntent() {
  let armed = false;
  return {
    peek() { return armed; },
    arm() { armed = true; },
    consume() {
      if (!armed) return false;
      armed = false;
      return true;
    },
  };
}

// True only for the one revision send: armed + nonempty + not blocked.
// Blocked (busy/plan-busy/replay) preserves the intent — the caller
// must check blocks BEFORE this and return without consuming.
export function shouldTakeRevision({ armed, content, blocked }) {
  if (!armed) return false;
  if (blocked) return false;
  return String(content || "").trim().length > 0;
}

// Append the exact user quote for the review input without duplicating
// an already-present id (React state is async, so the caller syncs
// stateRef with this before building the review input).
export function withRevisionMessage(messages, userMsg) {
  const list = Array.isArray(messages) ? [...messages] : [];
  if (userMsg && userMsg.id !== undefined
    && list.some((m) => m && m.id === userMsg.id)) return list;
  list.push(userMsg);
  return list;
}
