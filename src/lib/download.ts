import { toast } from "sonner";

import { apiBlob } from "@/lib/api-client";

/** Trigger a browser download for an authenticated fetch URL (e.g. SBD PDFs). */
export async function downloadAuthenticatedFile(url: string, filename: string): Promise<void> {
  const { blob } = await apiBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke asynchronously — WebKit can abort the download if the object URL
  // is revoked in the same tick as the click.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export type SbdForm = "sbd4" | "sbd61";

export const SBD_FORM_LABEL: Record<SbdForm, string> = {
  sbd4: "SBD 4",
  sbd61: "SBD 6.1",
};

/**
 * Fetch a generated SBD form and save it, reporting the outcome by toast.
 * Callers own presentation only, so the file name and copy stay identical
 * across every surface that offers a form.
 */
export async function downloadSbdForm(tenderId: string, form: SbdForm): Promise<void> {
  const label = SBD_FORM_LABEL[form];
  try {
    await downloadAuthenticatedFile(
      `/api/tender/${tenderId}/${form}`,
      `${form.toUpperCase()}-${tenderId}.pdf`,
    );
    toast.success(`${label} downloaded`);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : `Failed to download ${label}`);
  }
}
