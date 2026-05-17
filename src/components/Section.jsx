import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { useApp } from '../context/AppContext.jsx';
import {
  dbCreateItem, dbDeleteSection, dbUpdateSection, dbCheckAll, dbUncheckAll, dbReorderItems,
} from '../lib/db.js';
import ItemRow from './ItemRow.jsx';

export default function Section({ section, listId, tabId }) {
  const { user, addItem, removeSection, updateSection, reorderItems } = useApp();
  const [newItemText, setNewItemText] = useState('');
  const [title, setTitle]             = useState(section.title);

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleTitleBlur() {
    const trimmed = title.trim() || section.title;
    setTitle(trimmed);
    if (trimmed !== section.title) {
      updateSection(listId, tabId, section.id, { title: trimmed });
      await dbUpdateSection(section.id, { title: trimmed });
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete section "${section.title}" and all its items?`)) return;
    await dbDeleteSection(section.id);
    removeSection(listId, tabId, section.id);
  }

  async function handleAddItem() {
    const text = newItemText.trim(); if (!text) return;
    const data = await dbCreateItem(section.id, text, section.items.length);
    addItem(listId, tabId, section.id, { ...data, checked: false });
    setNewItemText('');
  }

  async function handleCheckAll() {
    const unchecked = section.items.filter(i => !i.checked).map(i => i.id);
    await dbCheckAll(unchecked, user.id);
    // State update handled by real-time subscription
  }

  async function handleClear() {
    const checked = section.items.filter(i => i.checked).map(i => i.id);
    await dbUncheckAll(checked, user.id);
  }

  async function handleItemDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = section.items.findIndex(i => i.id === active.id);
    const newIndex = section.items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(section.items, oldIndex, newIndex);
    reorderItems(listId, tabId, section.id, reordered);
    await dbReorderItems(reordered);
  }

  return (
    <div ref={setNodeRef} style={style} className="section-wrap">
      <div className="section-header">
        <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
        <input
          className="section-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
        />
        <button className="sec-del-btn" onClick={handleDelete} title="Delete section">×</button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
        <SortableContext items={section.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {section.items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              listId={listId}
              tabId={tabId}
              sectionId={section.id}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="sec-actions">
        <button className="sec-btn" onClick={handleCheckAll}>Check all</button>
        <button className="sec-btn" onClick={handleClear}>Clear</button>
      </div>

      <div className="add-row">
        <input
          className="add-input"
          placeholder="+ add item…"
          value={newItemText}
          onChange={e => setNewItemText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddItem()}
        />
        <button className="add-btn" onClick={handleAddItem}>Add</button>
      </div>
    </div>
  );
}
