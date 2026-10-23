function TransactionFilters({ search, onSearchChange, category, onCategoryChange, categories, placeholder = "Search transactions" }) {
  return (
    <div className="transaction-filters">
      <label className="field transaction-search">
        <span>Search</span>
        <input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={placeholder} />
      </label>
      <label className="field transaction-category-filter">
        <span>Filter by</span>
        <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>
  );
}

export default TransactionFilters;
