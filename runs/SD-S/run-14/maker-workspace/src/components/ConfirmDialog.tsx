import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  title: string
  children: React.ReactNode
  confirmLabel: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, children, confirmLabel, destructive, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
    cancelRef.current?.focus()
  }, [])

  return (
    <dialog ref={dialogRef} className="dialog" aria-labelledby="confirm-title" onCancel={(event) => { event.preventDefault(); onCancel() }}>
      <form method="dialog" onSubmit={(event) => event.preventDefault()}>
        <p className="eyebrow">Please confirm</p>
        <h2 id="confirm-title">{title}</h2>
        <div className="dialog-copy">{children}</div>
        <div className="dialog-actions">
          <button ref={cancelRef} className="button secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={`button ${destructive ? 'danger' : 'primary'}`} type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </form>
    </dialog>
  )
}
