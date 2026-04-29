import { SHARE_CATEGORIES, SHARE_CATEGORY_LABELS } from "../constants/options";

function ShareForm({
  value,
  onChange,
  onSubmit,
  submitting,
  submitLabel = "Add Share Entry",
  suggestions = [],
}) {
  const isDividend = value.category === "dividend";
  const isSecondary = value.category === "buy" || value.category === "sell";

  const handleTotalQtyChange = (field, updatedText) => {
    const newVal = { ...value, [field]: updatedText };
    if (isSecondary) {
      const tot = Number(newVal._totalAmount) || 0;
      const qty = Number(newVal.allotted) || 0;
      if (qty > 0) {
        newVal.per_unit_price = String((tot / qty).toFixed(4));
      } else {
        newVal.per_unit_price = "";
      }
    }
    onChange(newVal);
  };

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
            autoComplete="off"
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
          <select 
            value={value.category} 
            onChange={(e) => {
              const cat = e.target.value;
              onChange({ 
                ...value, 
                category: cat,
                _dividendType: cat === "dividend" ? "cash" : undefined,
                _totalAmount: "",
                per_unit_price: "",
                allotted: cat === "dividend" ? "0" : ""
              });
            }}
          >
            {SHARE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {SHARE_CATEGORY_LABELS[category] || category}
              </option>
            ))}
          </select>
        </label>

        {isDividend ? (
          <>
            <label className="field">
              <span>Dividend Type</span>
              <select 
                value={value._dividendType || "cash"}
                onChange={(e) => {
                  const dt = e.target.value;
                  onChange({
                    ...value,
                    _dividendType: dt,
                    per_unit_price: "",
                    allotted: dt === "cash" ? "0" : ""
                  });
                }}
              >
                <option value="cash">Cash</option>
                <option value="bonus">Bonus Share</option>
              </select>
            </label>
            {value._dividendType === "cash" ? (
              <label className="field">
                <span>Amount</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="Cash Amount"
                  value={value.per_unit_price}
                  onChange={(e) => onChange({ ...value, per_unit_price: e.target.value, allotted: "0" })}
                  required
                />
              </label>
            ) : (
              <label className="field">
                <span>Number of Shares</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  placeholder="Bonus Shares"
                  value={value.allotted}
                  onChange={(e) => onChange({ ...value, allotted: e.target.value, per_unit_price: "0" })}
                  required
                />
              </label>
            )}
          </>
        ) : isSecondary ? (
          <>
            <label className="field">
              <span>Total Amount</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Total Amount"
                value={value._totalAmount || ""}
                onChange={(e) => handleTotalQtyChange("_totalAmount", e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Quantity</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="Quantity"
                value={value.allotted}
                onChange={(e) => handleTotalQtyChange("allotted", e.target.value)}
                required
              />
            </label>
            {value.per_unit_price && (
              <p className="subtitle" style={{ marginTop: -8, marginBottom: 12 }}>
                Calculated Per Unit: {value.per_unit_price}
              </p>
            )}
          </>
        ) : (
          <>
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
          </>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
      </form>
    </section>
  );
}

export default ShareForm;

