function ConfirmDialog({
  open,
  title = "Confirm action",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirming = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="dialog-card">
        <h3 id="confirm-dialog-title">{title}</h3>
        <p className="subtitle">{message}</p>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onCancel} disabled={confirming}>
            {cancelLabel}
          </button>
          <button type="button" className="ghost danger" onClick={onConfirm} disabled={confirming} autoFocus>
            {confirming ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
