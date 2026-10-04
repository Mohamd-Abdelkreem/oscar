// Consumers reconcile through their subscribed App Router lifecycle, without a reload.
export const createBrowserSessionNotifications = (
  barrierKey: string,
  retire: () => void,
) => {
  const channel =
    typeof BroadcastChannel === "undefined"
      ? undefined
      : new BroadcastChannel("oscar.session-retirement");
  const storageChanged = (event: StorageEvent) => {
    if (event.key === barrierKey || event.key === null) retire();
  };
  window.addEventListener("storage", storageChanged);
  channel?.addEventListener("message", retire);
  return {
    notifyRetirement: () => {
      channel?.postMessage({ version: 1, kind: "retire" });
    },
    dispose: () => {
      window.removeEventListener("storage", storageChanged);
      channel?.removeEventListener("message", retire);
      channel?.close();
    },
  };
};
