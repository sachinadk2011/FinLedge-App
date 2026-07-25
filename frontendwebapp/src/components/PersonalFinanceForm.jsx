import {
  PERSONAL_FINANCE_DIRECTIONS,
  PERSONAL_FINANCE_EXPENSE_CATEGORIES,
  PERSONAL_FINANCE_FLOWS,
  PERSONAL_FINANCE_INCOME_CATEGORIES,
} from "../constants/options";

function getCategories(direction) {
  return direction === "income" ? PERSONAL_FINANCE_INCOME_CATEGORIES : PERSONAL_FINANCE_EXPENSE_CATEGORIES;
}

function PersonalFinanceForm({
  value,
  onChange,
  onSubmit,
  submitting,
  submitLabel = "Add Personal Expenses Entry",
}) {
  const categories = getCategories(value.direction);

  function updateDirection(direction) {
    onChange({
      ...value,
      direction,
      category: getCategories(direction)[0],
    });
  }

  return (
    <section className="card">
      <h2>Personal Expenses Entry</h2>
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
          <span>Flow</span>
          <select value={value.flow_type} onChange={(e) => onChange({ ...value, flow_type: e.target.value })}>
            {PERSONAL_FINANCE_FLOWS.map((flow) => (
              <option key={flow.value} value={flow.value}>
                {flow.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Type</span>
          <select value={value.direction} onChange={(e) => updateDirection(e.target.value)}>
            {PERSONAL_FINANCE_DIRECTIONS.map((direction) => (
              <option key={direction.value} value={direction.value}>
                {direction.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Category</span>
          <select value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value })}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Amount</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Amount"
            value={value.amount}
            onChange={(e) => onChange({ ...value, amount: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <input
            placeholder="e.g., grocery, salary, refund"
            value={value.description || ""}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
      </form>
    </section>
  );
}

export default PersonalFinanceForm;
