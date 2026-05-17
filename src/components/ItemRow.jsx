import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useApp } from '../context/AppContext.jsx';
import { dbCheckItem, dbUncheckItem, dbDeleteItem } from '../lib/db.js';

export default function ItemRow({ item, listId, tabId, sectionId }) {
  const { user, toggleItem, removeItem } = useApp();

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  async function handleCheck(e) {
    const checked = e.target.checked;
    toggleItem(listId, tabId, sectionId, item.id, checked);
    if (checked) await dbCheckItem(item.id, user.id);
    else await dbUncheckItem(item.id, user.id);
  }

  async function handleDelete() {
    if (!confirm(`Remove "${item.text}"?`)) return;
    await dbDeleteItem(item.id);
    removeItem(listId, tabId, sectionId, item.id);
  }

  const id = `item-${item.id}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`item${item.checked ? ' done' : ''}`}
    >
      <span className="item-handle" {...attributes} {...listeners}>⠿</span>
      <input type="checkbox" id={id} checked={item.checked} onChange={handleCheck} />
      <label htmlFor={id}>{item.text}</label>
      <button className="del-btn" onClick={handleDelete} title="Remove">×</button>
    </div>
  );
}
