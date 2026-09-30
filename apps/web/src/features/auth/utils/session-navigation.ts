export const replaceWithLogin = (): void => {
  if (typeof window !== "undefined") window.location.replace("/auth/login");
};
