import { useEffect, useRef, useState } from "react";

type Osmd = {
  load: (xml: string) => Promise<void>;
  render: () => void;
  clear?: () => void;
};

export function ScoreRenderer({ xml, compact = false }: { xml: string; compact?: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const osmdRef = useRef<Osmd | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";

    (async () => {
      try {
        const module = await import("opensheetmusicdisplay");
        if (cancelled || !hostRef.current) return;
        const osmd = new module.OpenSheetMusicDisplay(hostRef.current, {
          autoResize: true,
          backend: "svg",
          drawingParameters: compact ? "compacttight" : "compact",
          drawTitle: !compact,
          drawComposer: !compact,
          drawPartNames: true,
          followCursor: false,
        } as unknown as ConstructorParameters<typeof module.OpenSheetMusicDisplay>[1]);
        osmdRef.current = osmd as unknown as Osmd;
        await osmd.load(xml);
        if (cancelled) return;
        osmd.render();
        setLoading(false);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "No se pudo renderizar la partitura.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        osmdRef.current?.clear?.();
      } catch {
        /* el contenedor se desmonta */
      }
      osmdRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [xml, compact]);

  if (error) {
    return (
      <div className="osmd-error">
        <strong>No se pudo dibujar la notación.</strong>
        <div style={{ marginTop: 6 }}>{error}</div>
        <div className="small" style={{ marginTop: 8 }}>
          El PDF original y el reproductor siguen disponibles.
        </div>
      </div>
    );
  }

  return (
    <div>
      {loading ? <div className="small muted" style={{ padding: 12 }}>Preparando la notación…</div> : null}
      <div ref={hostRef} className="osmd-host" />
    </div>
  );
}
