import { useEffect, useState } from "react";
import { PHOTO_BUCKET, supabase } from "@/lib/supabase";
import type { Visit } from "@/lib/types";

/** Photos live in a private bucket, so we show them through a short-lived signed URL. */
export function VisitPhoto({ visit }: { visit: Visit }) {
  const [url, setUrl] = useState<string | null>(visit.photoDataUrl ?? null);

  useEffect(() => {
    if (visit.photoDataUrl || !visit.photoPath || !supabase) return;
    let cancelled = false;
    supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(visit.photoPath, 60 * 60)
      .then(({ data }) => {
        if (!cancelled && data) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [visit.photoPath, visit.photoDataUrl]);

  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="ml-auto">
      <img src={url} alt="Receipt or menu photo" className="h-12 w-12 rounded-lg object-cover" />
    </a>
  );
}
