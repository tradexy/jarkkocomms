import type { Copy } from "../lib/i18n";

type Props = {
  copy: Copy;
  hasKey: boolean;
  busy: boolean;
  text: string;
  error: string | null;
  onBriefContract: () => void;
  onBriefSpread: () => void;
};

export function BriefPanel({ copy, hasKey, busy, text, error, onBriefContract, onBriefSpread }: Props) {
  return (
    <section className="panel">
      <h2>AI</h2>
      <p className="name">{hasKey ? copy.aiCost : copy.optionalAi}</p>
      <div className="voice-actions">
        <button type="button" className="chip" disabled={!hasKey || busy} onClick={onBriefContract}>
          {busy ? copy.briefing : copy.briefContract}
        </button>
        <button type="button" className="chip" disabled={!hasKey || busy} onClick={onBriefSpread}>
          {copy.briefSpread}
        </button>
      </div>
      {error && <p className="banner">{error}</p>}
      <p className="brief-body">{text || (hasKey ? copy.briefEmpty : copy.briefNeedKey)}</p>
    </section>
  );
}
