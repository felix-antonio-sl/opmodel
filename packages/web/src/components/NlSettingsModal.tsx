import { useState } from "react";

type NlConfig = {
  provider: "claude" | "openai";
  apiKey: string;
  model?: string;
};

interface Props {
  config: NlConfig | null;
  onSave: (config: NlConfig) => void;
  onClose: () => void;
}

export function NlSettingsModal({ config, onSave, onClose }: Props) {
  const [provider, setProvider] = useState<"claude" | "openai">(config?.provider ?? "claude");
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [model, setModel] = useState(config?.model ?? "");

  const isKeyValid = provider === "claude"
    ? apiKey.startsWith("sk-ant-")
    : apiKey.startsWith("sk-");

  const handleSave = () => {
    const cfg: NlConfig = { provider, apiKey, ...(model ? { model } : {}) };
    localStorage.setItem("opmodel:nl-config", JSON.stringify(cfg));
    onSave(cfg);
    onClose();
  };

  return (
    <div className="nl-settings__overlay" onClick={onClose}>
      <div className="nl-settings" onClick={(e) => e.stopPropagation()}>
        <h3 className="nl-settings__title">NL Settings</h3>
        <div className="nl-settings__field">
          <label className="opl-editor__label">Provider</label>
          <select className="opl-editor__select" value={provider} onChange={(e) => setProvider(e.target.value as any)}>
            <option value="claude">Claude (Anthropic)</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div className="nl-settings__field">
          <label className="opl-editor__label">API Key</label>
          <input
            className="opl-editor__input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "claude" ? "sk-ant-..." : "sk-..."}
          />
          {apiKey && !isKeyValid && (
            <span className="opl-editor__warning">
              Key should start with {provider === "claude" ? "sk-ant-" : "sk-"}
            </span>
          )}
        </div>
        <div className="nl-settings__field">
          <label className="opl-editor__label">Model (optional)</label>
          <input
            className="opl-editor__input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={provider === "claude" ? "claude-sonnet-4-20250514" : "gpt-4o"}
          />
        </div>
        <div className="nl-settings__actions">
          <button className="opl-editor__apply" onClick={handleSave} disabled={!apiKey || !isKeyValid}>Save</button>
          <button className="opl-editor__nl-clear" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
