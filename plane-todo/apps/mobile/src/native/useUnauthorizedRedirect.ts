import { useRouter } from "expo-router";
import { useEffect } from "react";
import { isUnauthorized } from "../data/errors";

/** On a 401 from any query/mutation error, route to /setup with a message. */
export function useUnauthorizedRedirect(error: unknown): void {
  const router = useRouter();
  useEffect(() => {
    if (isUnauthorized(error)) {
      router.replace({
        pathname: "/setup",
        params: { error: "API key invalid" },
      });
    }
  }, [error, router]);
}
