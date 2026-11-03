import { z } from "zod";
import { STORAGE_KEYS } from "./keys";

const DraftSchema = z.object({
  version: z.literal(1),
  pendingUrls: z.array(z.string().min(1).max(2048)).max(50),
  useXml: z.boolean(),
  xmlFilename: z.string().optional(),
  refresh: z.boolean(),
  updatedAt: z.number().finite(),
});
export type AnalysisDraft = z.infer<typeof DraftSchema>;

export function readAnalysisDraft(): AnalysisDraft | null {
  const raw = window.localStorage.getItem(STORAGE_KEYS.analysisDraft);
  if (raw === null) return null;
  return DraftSchema.parse(JSON.parse(raw));
}
export function saveAnalysisDraft(draft: AnalysisDraft | null): void {
  if (!draft || !draft.pendingUrls.length)
    window.localStorage.removeItem(STORAGE_KEYS.analysisDraft);
  else
    window.localStorage.setItem(
      STORAGE_KEYS.analysisDraft,
      JSON.stringify(DraftSchema.parse(draft)),
    );
}
