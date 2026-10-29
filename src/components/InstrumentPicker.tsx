import { FAMILIES, INSTRUMENTS, instrumentById } from "../lib/music";

export function InstrumentPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  return (
    <div className="instrument-picker">
      <div className="row wrap small muted">
        <span>{selected.length} instrumento{selected.length === 1 ? "" : "s"} asignado{selected.length === 1 ? "" : "s"}</span>
        {selected.length ? (
          <button type="button" className="btn small ghost" onClick={() => onChange([])}>
            Limpiar
          </button>
        ) : null}
        <span className="spacer" />
        <button
          type="button"
          className="btn small ghost"
          onClick={() => onChange(INSTRUMENTS.map((instrument) => instrument.id))}
        >
          Toda la orquesta
        </button>
      </div>
      {FAMILIES.map((family) => (
        <div className="family-block" key={family}>
          <h4>{family}</h4>
          <div className="instrument-grid">
            {INSTRUMENTS.filter((instrument) => instrument.family === family).map((instrument) => {
              const active = selected.includes(instrument.id);
              return (
                <button
                  key={instrument.id}
                  type="button"
                  className={`instrument-option${active ? " selected" : ""}`}
                  aria-pressed={active}
                  onClick={() => toggle(instrument.id)}
                >
                  <span className="ico" aria-hidden="true">
                    {instrument.icon}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600 }}>{instrument.name}</span>
                    <span className="small muted">
                      {instrument.clef === "treble"
                        ? "Clave de sol"
                        : instrument.clef === "bass"
                          ? "Clave de fa"
                          : instrument.clef === "alto"
                            ? "Clave de do 3.ª"
                            : "Clave de do 4.ª"}
                      {instrument.transpose ? ` · ${instrument.transpose > 0 ? "+" : ""}${instrument.transpose} st` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InstrumentSelect({
  value,
  onChange,
  placeholder = "Sin instrumento",
  id,
}: {
  value: string | undefined;
  onChange: (id: string) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <select id={id} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {FAMILIES.map((family) => (
        <optgroup key={family} label={family}>
          {INSTRUMENTS.filter((instrument) => instrument.family === family).map((instrument) => (
            <option key={instrument.id} value={instrument.id}>
              {instrument.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function InstrumentChips({ ids }: { ids: string[] }) {
  return (
    <div className="chips">
      {ids.map((id) => {
        const instrument = instrumentById(id);
        if (!instrument) return null;
        return (
          <span className="badge" key={id} title={instrument.name}>
            <span aria-hidden="true">{instrument.icon}</span>
            {instrument.short}
          </span>
        );
      })}
    </div>
  );
}
