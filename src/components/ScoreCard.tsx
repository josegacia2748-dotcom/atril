import type { Score } from "../lib/types";
import { CLEF_SHORT, keyName, instrumentName } from "../lib/music";
import { Badge } from "./UI";
import { InstrumentChips } from "./InstrumentPicker";

export function ScoreCard({ score }: { score: Score }) {
  const instrumentCount = score.instrumentIds.length;
  return (
    <a className="score-card" href={`#/partitura/${score.id}`}>
      <div className="sc-top">
        <span className="score-cover" aria-hidden="true">
          𝄞
        </span>
        <div style={{ minWidth: 0 }}>
          <h3>{score.title}</h3>
          <div className="composer">{score.composer}</div>
        </div>
      </div>
      <div className="chips">
        <Badge tone="brass">{CLEF_SHORT[score.clef]}</Badge>
        <Badge>{keyName(score.keyFifths)}</Badge>
        <Badge>
          {score.time.beats}/{score.time.beatType}
        </Badge>
        <Badge>♩ = {score.tempo}</Badge>
        {score.omr ? <Badge tone="teal">OMR {Math.round(score.omr.confidence * 100)}%</Badge> : null}
        {score.pdfId ? <Badge tone="blue">PDF</Badge> : null}
      </div>
      <InstrumentChips ids={score.instrumentIds} />
      <div className="foot">
        <span>
          {instrumentCount} instrumento{instrumentCount === 1 ? "" : "s"}
        </span>
        <span className="spacer" />
        <span>
          {score.events.length} nota{score.events.length === 1 ? "" : "s"}
        </span>
      </div>
      <span className="small muted" style={{ marginTop: -4 }}>
        {score.instrumentIds.slice(0, 3).map(instrumentName).join(" · ")}
        {instrumentCount > 3 ? ` · +${instrumentCount - 3}` : ""}
      </span>
    </a>
  );
}
