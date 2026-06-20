import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformMe } from "@/lib/platform.functions";

export function usePlatformStaff() {
  const fn = useServerFn(getPlatformMe);
  return useQuery({
    queryKey: ["platform-me"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}
