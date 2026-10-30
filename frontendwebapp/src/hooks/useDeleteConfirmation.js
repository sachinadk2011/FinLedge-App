import { useState } from "react";

/** Shared pending-row and in-flight state for confirmed record deletion. */
export default function useDeleteConfirmation() {
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);

  async function runDelete(id, operation) {
    if (id == null) return;
    setDeletingId(id);
    try {
      await operation();
    } finally {
      setDeletingId(null);
    }
  }

  return { deletingId, pendingDeleteRow, setPendingDeleteRow, runDelete };
}
