import { BANK_CATEGORIES } from "../constants/options";

function BankForm({ value, onChange, onSubmit, submitting, submitLabel = "Add Bank Entry" }) {
  return (
    <section className="card">
      <h2>Bank Entry</h2>
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
          <span>Category</span>
          <select
            value={value.category}
            onChange={(e) => onChange({ ...value, category: e.target.value })}
          >
            {BANK_CATEGORIES.map((category) => (
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
            placeholder="e.g., salary, freelancing, refund"
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

export default BankForm;
