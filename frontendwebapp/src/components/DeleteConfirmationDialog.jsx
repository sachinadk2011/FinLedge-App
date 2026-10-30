import ConfirmDialog from "./ConfirmDialog";

export default function DeleteConfirmationDialog({ record, deletingId, title, message, onCancel, onConfirm }) {
  return (
    <ConfirmDialog
      open={Boolean(record)}
      title={title}
      message={message}
      confirming={deletingId === record?.id}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
