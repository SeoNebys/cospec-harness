import { describe,expect,it,vi } from 'vitest';
import { render,screen,waitFor,within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDeleteDialog } from '../../../src/client/components/ConfirmDeleteDialog.js';

describe('destructive confirmation',()=>{it('names the bookmark, cancels safely, and confirms explicitly',async()=>{
  const user=userEvent.setup();const confirm=vi.fn(async()=>{});render(<ConfirmDeleteDialog title="Important bookmark" onConfirm={confirm}/>);
  const trigger=screen.getByRole('button',{name:'Delete permanently'});trigger.focus();await user.click(trigger);
  let dialog=await screen.findByRole('alertdialog');expect(dialog).toHaveTextContent('Important bookmark');expect(screen.getByRole('button',{name:'Cancel'})).toHaveFocus();
  await user.click(screen.getByRole('button',{name:'Cancel'}));expect(confirm).not.toHaveBeenCalled();await waitFor(()=>expect(trigger).toHaveFocus());
  await user.click(trigger);dialog=await screen.findByRole('alertdialog');await user.click(within(dialog).getByRole('button',{name:'Delete permanently'}));expect(confirm).toHaveBeenCalledOnce();
});});
