import type { Model, Settings, Meta, Essence, OplEssenceVisibility, OplUnitsVisibility, OpdNameFormat, SystemType } from "@opmodel/core";
import type { Command } from "../lib/commands";

interface Props {
  model: Model;
  dispatch: (cmd: Command) => boolean;
  onClose: () => void;
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-panel__row">
      <label className="settings-panel__label">{label}</label>
      <div className="settings-panel__control">{children}</div>
    </div>
  );
}

export function SettingsPanel({ model, dispatch, onClose }: Props) {
  const s = model.settings;

  const update = (patch: Partial<Settings>) => {
    dispatch({ tag: "updateSettings", patch });
  };

  const updateM = (patch: Partial<Omit<Meta, "created" | "modified">>) => {
    dispatch({ tag: "updateMeta", patch });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-panel__header">
          <span className="settings-panel__title">Model Settings</span>
          <button className="settings-panel__close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-panel__section-title">Model</div>

        <SettingRow label="Name">
          <input
            type="text"
            value={model.meta.name}
            onChange={(e) => updateM({ name: e.target.value })}
          />
        </SettingRow>

        <SettingRow label="Description">
          <input
            type="text"
            value={model.meta.description ?? ""}
            onChange={(e) => updateM({ description: e.target.value || undefined })}
            placeholder="Model description..."
          />
        </SettingRow>

        <SettingRow label="System type">
          <select
            value={model.meta.system_type ?? ""}
            onChange={(e) => updateM({ system_type: (e.target.value || undefined) as SystemType | undefined })}
          >
            <option value="">Not specified</option>
            <option value="artificial">Artificial</option>
            <option value="natural">Natural</option>
            <option value="social">Social</option>
            <option value="socio-technical">Socio-technical</option>
          </select>
        </SettingRow>

        <div className="settings-panel__section-title">OPL</div>

        <SettingRow label="Language">
          <select value={s.opl_language ?? "en"} onChange={(e) => update({ opl_language: e.target.value })}>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </SettingRow>

        <SettingRow label="Essence visibility">
          <select
            value={s.opl_essence_visibility ?? "all"}
            onChange={(e) => update({ opl_essence_visibility: e.target.value as OplEssenceVisibility })}
          >
            <option value="all">Show all</option>
            <option value="non_default">Non-default only</option>
            <option value="none">Hide</option>
          </select>
        </SettingRow>

        <SettingRow label="Units visibility">
          <select
            value={s.opl_units_visibility ?? "always"}
            onChange={(e) => update({ opl_units_visibility: e.target.value as OplUnitsVisibility })}
          >
            <option value="always">Always</option>
            <option value="when_applicable">When applicable</option>
            <option value="hide">Hide</option>
          </select>
        </SettingRow>

        <SettingRow label="Show aliases">
          <input
            type="checkbox"
            checked={s.opl_alias_visibility ?? false}
            onChange={(e) => update({ opl_alias_visibility: e.target.checked })}
          />
        </SettingRow>

        <SettingRow label="Primary essence">
          <select
            value={s.primary_essence ?? "informatical"}
            onChange={(e) => update({ primary_essence: e.target.value as Essence })}
          >
            <option value="informatical">Informatical</option>
            <option value="physical">Physical</option>
          </select>
        </SettingRow>

        <div className="settings-panel__section-title">Display</div>

        <SettingRow label="OPD name format">
          <select
            value={s.opd_name_format ?? "full"}
            onChange={(e) => update({ opd_name_format: e.target.value as OpdNameFormat })}
          >
            <option value="full">Full</option>
            <option value="short">Short</option>
          </select>
        </SettingRow>

        <SettingRow label="Highlight OPD">
          <input
            type="checkbox"
            checked={s.opl_highlight_opd ?? false}
            onChange={(e) => update({ opl_highlight_opd: e.target.checked })}
          />
        </SettingRow>

        <SettingRow label="Highlight OPL">
          <input
            type="checkbox"
            checked={s.opl_highlight_opl ?? false}
            onChange={(e) => update({ opl_highlight_opl: e.target.checked })}
          />
        </SettingRow>

        <SettingRow label="Color sync">
          <input
            type="checkbox"
            checked={s.opl_color_sync ?? false}
            onChange={(e) => update({ opl_color_sync: e.target.checked })}
          />
        </SettingRow>

        <SettingRow label="Show notes">
          <input
            type="checkbox"
            checked={s.notes_visible ?? false}
            onChange={(e) => update({ notes_visible: e.target.checked })}
          />
        </SettingRow>

        <SettingRow label="Methodology coaching">
          <input
            type="checkbox"
            checked={s.methodology_coaching ?? false}
            onChange={(e) => update({ methodology_coaching: e.target.checked })}
          />
        </SettingRow>

        <div className="settings-panel__section-title">Behavior</div>

        <SettingRow label="Autosave interval (s)">
          <input
            type="number"
            min={0.1}
            max={300}
            step={0.1}
            value={s.autosave_interval_s ?? 0.3}
            onChange={(e) => update({ autosave_interval_s: parseFloat(e.target.value) || 0.3 })}
          />
        </SettingRow>

        <SettingRow label="Decimal precision">
          <input
            type="number"
            min={0}
            max={10}
            value={s.decimal_precision ?? 2}
            onChange={(e) => update({ decimal_precision: parseInt(e.target.value) || 2 })}
          />
        </SettingRow>

        <div className="settings-panel__section-title">Scenarios ({model.scenarios.size})</div>

        {[...model.scenarios.values()].map(sc => (
          <div key={sc.id} className="settings-panel__row" style={{ flexWrap: "wrap", gap: 4 }}>
            <input
              type="text"
              value={sc.name}
              onChange={(e) => dispatch({ tag: "updateScenario", scenarioId: sc.id, patch: { name: e.target.value } })}
              style={{ flex: 1, minWidth: 100 }}
            />
            <input
              type="text"
              value={sc.path_labels.join(", ")}
              onChange={(e) => dispatch({ tag: "updateScenario", scenarioId: sc.id, patch: { path_labels: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } })}
              placeholder="path labels (comma-separated)"
              style={{ flex: 2, minWidth: 140, fontSize: 10 }}
            />
            <button
              className="settings-panel__close"
              onClick={() => dispatch({ tag: "removeScenario", scenarioId: sc.id })}
              style={{ padding: "0 4px" }}
            >✕</button>
          </div>
        ))}
        <div className="settings-panel__row">
          <button
            className="props-panel__add-btn"
            style={{ width: "100%" }}
            onClick={() => {
              const id = `sc-${Date.now().toString(36)}`;
              dispatch({ tag: "addScenario", scenario: { id, name: "New Scenario", path_labels: [] } });
            }}
          >+ Scenario</button>
        </div>
      </div>
    </div>
  );
}
