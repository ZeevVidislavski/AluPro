// Keyboard navigation for dialog forms so the mouse isn't needed:
//   ArrowDown / ArrowUp  move to the next / previous field
//   Enter                submits (native form behaviour: confirms / adds)
// Attach as `onKeyDown={handleFormArrowNav}` on a <form>. Date and file
// inputs keep their native arrow behaviour; on number inputs the arrows
// move between fields instead of changing the value.
const SKIP_TYPES = ['date', 'time', 'checkbox', 'radio', 'file', 'hidden'];
const FIELD_SELECTOR =
  'input:not([disabled]):not([type=hidden]):not([type=file]):not([type=date]),textarea:not([disabled]),button[role=combobox]:not([disabled])';

export function handleFormArrowNav(e) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const target = e.target;
  const isTextArea = target instanceof HTMLTextAreaElement;
  const isInput = target instanceof HTMLInputElement && !SKIP_TYPES.includes(target.type);
  if (!isInput && !isTextArea) return;

  const fields = [...e.currentTarget.querySelectorAll(FIELD_SELECTOR)];
  const index = fields.indexOf(target);
  if (index < 0) return;
  const next = fields[index + (e.key === 'ArrowDown' ? 1 : -1)];
  if (!next) return;

  // A multi-line textarea needs its own arrows while there is text to move through.
  if (isTextArea && target.value.includes('\n')) return;

  e.preventDefault();
  next.focus();
  if (typeof next.select === 'function') next.select();
}
