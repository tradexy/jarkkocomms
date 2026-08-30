import type { Copy } from "../lib/i18n";

type Props = {
  copy: Copy;
  canListen: boolean;
  listening: boolean;
  speaking: boolean;
  heard: string;
  onSpeak: () => void;
  onSpeakOil: () => void;
  onStop: () => void;
  onListen: () => void;
};

export function VoiceBar({
  copy,
  canListen,
  listening,
  speaking,
  heard,
  onSpeak,
  onSpeakOil,
  onStop,
  onListen,
}: Props) {
  return (
    <section className="voice-bar" aria-label={copy.speak}>
      <div className="voice-actions">
        <button type="button" className="chip" onClick={onSpeak}>
          {copy.speak}
        </button>
        <button type="button" className="chip" onClick={onSpeakOil}>
          {copy.speakOil}
        </button>
        <button type="button" className={speaking ? "chip active" : "chip"} onClick={onStop}>
          {copy.stop}
        </button>
        {canListen && (
          <button type="button" className={listening ? "chip active" : "chip"} onClick={onListen}>
            {listening ? copy.listening : copy.listen}
          </button>
        )}
      </div>
      <p className="voice-note">
        {copy.voiceNote}
        {heard ? ` · ${heard}` : ""}
      </p>
    </section>
  );
}
