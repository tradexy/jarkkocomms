import { FormEvent, useState } from "react";
import type { Copy } from "../lib/i18n";
import { DEEPSEEK_MODELS, LLM_PROVIDERS, type LlmModelId, type LlmProviderId } from "../lib/llm";

type Props = {
  copy: Copy;
  open: boolean;
  onClose: () => void;
  provider: LlmProviderId;
  model: LlmModelId;
  hasKey: boolean;
  onProvider: (provider: LlmProviderId) => void;
  onModel: (model: LlmModelId) => void;
  onSaveKey: (key: string) => void;
  onClearKey: () => void;
  briefBusy?: boolean;
  briefText?: string;
  briefError?: string | null;
  onBriefContract?: () => void;
  onBriefSpread?: () => void;
};

export function SettingsPanel({
  copy,
  open,
  onClose,
  provider,
  model,
  hasKey,
  onProvider,
  onModel,
  onSaveKey,
  onClearKey,
  briefBusy = false,
  briefText = "",
  briefError = null,
  onBriefContract,
  onBriefSpread,
}: Props) {
  const [draft, setDraft] = useState("");
  if (!open) return null;
  const selected = LLM_PROVIDERS.find((item) => item.id === provider);

  function save(event: FormEvent) {
    event.preventDefault();
    if (draft.trim()) onSaveKey(draft.trim());
    setDraft("");
  }

  return (
    <div className="settings-scrim" onClick={onClose}>
      <section className="settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h2>{copy.extras}</h2>
          <button type="button" className="ghost" onClick={onClose}>
            {copy.close}
          </button>
        </div>
        <p className="name">{copy.optionalAi}</p>
        <p className="name">{copy.keysStay}</p>
        <p className="name">{copy.aiCost}</p>
        <label className="desk-form">
          {copy.provider}
          <select value={provider} onChange={(event) => onProvider(event.target.value as LlmProviderId)}>
            {LLM_PROVIDERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
                {item.implemented ? "" : ` — ${copy.comingSoon}`}
              </option>
            ))}
          </select>
        </label>
        {selected?.implemented ? (
          <>
            <label className="desk-form">
              {copy.model}
              <select value={model} onChange={(event) => onModel(event.target.value as LlmModelId)}>
                {DEEPSEEK_MODELS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {copy[item.labelKey]} · {item.id}
                  </option>
                ))}
              </select>
            </label>
            <form className="alert-form" onSubmit={save}>
              <input
                type="password"
                autoComplete="off"
                placeholder={hasKey ? "••••••••" : copy.pasteKey}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit">{copy.saveKey}</button>
              {hasKey && (
                <button type="button" className="ghost" onClick={onClearKey}>
                  {copy.clearKey}
                </button>
              )}
            </form>
            {hasKey && onBriefContract && onBriefSpread && (
              <div className="voice-actions">
                <button type="button" className="chip" disabled={briefBusy} onClick={onBriefContract}>
                  {briefBusy ? copy.briefing : copy.briefContract}
                </button>
                <button type="button" className="chip" disabled={briefBusy} onClick={onBriefSpread}>
                  {copy.briefSpread}
                </button>
              </div>
            )}
            {hasKey && briefError && <p className="banner">{briefError}</p>}
            {hasKey && briefText && <p className="brief-body">{briefText}</p>}
          </>
        ) : (
          <p className="name">{copy.comingSoon}</p>
        )}
        <p className="voice-note">{copy.installHint}</p>
        <p className="voice-note">{copy.installIos}</p>
      </section>
    </div>
  );
}
