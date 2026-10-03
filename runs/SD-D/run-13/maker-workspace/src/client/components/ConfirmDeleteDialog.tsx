import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from 'react-aria-components';

export function ConfirmDeleteDialog({ title,onConfirm,compact=false }: { title:string;onConfirm:()=>void|Promise<void>;compact?:boolean }) {
  return <DialogTrigger><Button className={`button ${compact?'quiet':'danger'}`}>{compact?'Delete':'Delete permanently'}</Button><ModalOverlay className="modal-overlay" isDismissable><Modal className="modal"><Dialog role="alertdialog" className="dialog">{({close})=><><Heading slot="title">Delete “{title}”?</Heading><p>This cannot be undone. The bookmark and its notes will be permanently removed.</p><div className="dialog-actions"><Button className="button" autoFocus onPress={close}>Cancel</Button><Button className="button danger" onPress={async()=>{await onConfirm();close();}}>Delete permanently</Button></div></>}</Dialog></Modal></ModalOverlay></DialogTrigger>;
}
