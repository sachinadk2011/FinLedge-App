function TransactionsTable({ columns, rows, actions, actionsLabel = "Actions" }) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            {actions ? <th>{actionsLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="empty-state">
                No records yet.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={`${row.id || row.date}-${index}`}>
                {columns.map((column) => (
                  <td key={column.key}>{row[column.key]}</td>
                ))}
                {actions ? <td className="actions-cell">{actions(row)}</td> : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default TransactionsTable;
