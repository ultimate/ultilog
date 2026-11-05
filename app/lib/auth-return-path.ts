/** Only local paths are accepted, including across intermediate authentication pages. */
export function loginReturnDestination(search = typeof window === "undefined" ? "" : window.location.search) {
  const destination = new URLSearchParams(search).get("callbackUrl");
  return destination?.startsWith("/") && !destination.startsWith("//") && !/[\\\u0000-\u0020\u007f]/.test(destination) ? destination : "/";
}
