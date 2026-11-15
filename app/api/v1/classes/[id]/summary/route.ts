import { apiError, apiJson, getDateFilters, requireApiKey } from "@/lib/api/request";
import { getClassReport } from "@/lib/api/reports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiKey(request);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    if (!UUID.test(id)) return apiError("A valid class UUID is required.", 400);
    const parsed = getDateFilters(new URL(request.url));
    if ("error" in parsed) return apiError(parsed.error, 400);
    const modules = await getClassReport(id, parsed.filters);
    if (!modules) return apiError("Class not found.", 404);
    return apiJson({ class_id: id, modules });
  } catch {
    return apiError("The report could not be loaded.", 500);
  }
}
