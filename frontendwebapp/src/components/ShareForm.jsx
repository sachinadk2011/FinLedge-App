import { SHARE_CATEGORIES, SHARE_CATEGORY_LABELS } from "../constants/options";

function ShareForm({
  value,
  onChange,
  onSubmit,
  submitting,
  submitLabel = "Add Share Entry",
  suggestions = [],
}) {
  return (
    <section className="card">
      <h2>Share Entry</h2>
      <form onSubmit={onSubmit}>
        <label className="field">
          <span>Date</span>
          <input
            type="date"
            value={value.dates}
            onChange={(e) => onChange({ ...value, dates: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Share name</span>
          <input
            placeholder="Share name"
            value={value.share_name}
            onChange={(e) => onChange({ ...value, share_name: e.target.value })}
            list="share-name-suggestions"
            required
          />
          {suggestions.length > 0 ? (
            <datalist id="share-name-suggestions">
              {suggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          ) : null}
        </label>
        <label className="field">
          <span>Entry type</span>
          <select value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value })}>
            {SHARE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {SHARE_CATEGORY_LABELS[category] || category}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Per unit price</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Per unit price"
            value={value.per_unit_price}
            onChange={(e) => onChange({ ...value, per_unit_price: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Allotted</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="Allotted"
            value={value.allotted}
            onChange={(e) => onChange({ ...value, allotted: e.target.value })}
            required
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
      </form>
    </section>
  );
}

export default ShareForm;
