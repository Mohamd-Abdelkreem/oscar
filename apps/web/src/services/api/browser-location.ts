export type BrowserLocationSnapshot = Readonly<{
  pathname: string;
  search: string;
}>;

export const getBrowserLocation = (): BrowserLocationSnapshot | null =>
  typeof window === "undefined"
    ? null
    : {
        pathname: window.location.pathname,
        search: window.location.search,
      };

export const assignBrowserLocation = (path: string): void => {
  if (typeof window !== "undefined") window.location.assign(path);
};
