import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

// Promise-based replacement for window.confirm:  if (await confirmAction("למחוק?")) ...
// <ConfirmHost /> is mounted once in Layout and renders the dialog.
let listener = null;

export function confirmAction(input) {
  const opts = typeof input === "string" ? { title: input } : input;
  return new Promise((resolve) => {
    if (!listener) {
      // Host not mounted (should not happen inside Layout): fall back to the browser dialog.
      resolve(window.confirm(opts.title));
      return;
    }
    listener({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState(null);

  useEffect(() => {
    listener = (r) => setReq(r);
    return () => { listener = null; };
  }, []);

  const close = (value) => {
    req?.resolve(value);
    setReq(null);
  };

  const destructive = req ? (req.destructive ?? /מחק|למחוק/.test(req.title)) : false;

  return (
    <ConfirmDialog
      open={!!req}
      onOpenChange={(o) => { if (!o) close(false); }}
      title={req?.title ?? ""}
      description={req?.description}
      confirmLabel={req?.confirmLabel ?? (destructive ? "מחק" : "אישור")}
      destructive={destructive}
      onConfirm={() => close(true)}
    />
  );
}
