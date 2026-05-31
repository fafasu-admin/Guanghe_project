const LOCAL_EVENT_KEY = "guanghe_resonance_events";

export const EVENT_TYPES = Object.freeze({
  H5_ENTER: "h5_enter",
  TEST_START: "test_start",
  QUESTION_ANSWERED: "question_answered",
  TEST_COMPLETED: "test_completed",
  RESULT_SHARED: "result_shared",
  RESULT_SHARE_SAVED: "result_share_saved",
  RESULT_SHARE_LINK_COPIED: "result_share_link_copied",
  COMMUNITY_CTA_CLICKED: "community_cta_clicked"
});

export function reportEvent(type, payload = {}) {
  const event = {
    type,
    payload,
    timestamp: new Date().toISOString()
  };

  console.info("[report placeholder]", event);

  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_EVENT_KEY) || "[]");
    stored.push(event);
    localStorage.setItem(LOCAL_EVENT_KEY, JSON.stringify(stored.slice(-100)));
  } catch (error) {
    console.warn("[report placeholder] local event cache failed", error);
  }

  return event;
}

export function getCachedEvents() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_EVENT_KEY) || "[]");
  } catch {
    return [];
  }
}
