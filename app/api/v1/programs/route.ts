import { apiError, apiJson, getDateFilters, requireApiKey } from "@/lib/api/request";
import { getProgramReport } from "@/lib/api/reports";

export async function GET(request: Request) {
  try {
    const auth = await requireApiKey(request);
    if ("error" in auth) return auth.error;
    const parsed = getDateFilters(new URL(request.url));
    if ("error" in parsed) return apiError(parsed.error, 400);
    return apiJson({ programs: await getProgramReport(parsed.filters) });
  } catch {
    return apiError("The report could not be loaded.", 500);
  }
}
