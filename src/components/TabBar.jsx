import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  SortableContext, horizontalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useApp } from '../context/AppContext.jsx';
import { dbCreateTab, dbReorderTabs } from '../lib/db.js';
import { useDndSensors } from '../hooks/useDndSensors.js';

function SortableTab({ tab, listId, isActive, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });

  const items = tab.sections.flatMap(s => s.items);
  const done  = items.filter(i => i.checked).length;

  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`tab-btn${isActive ? ' active' : ''}`}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      {tab.emoji} {tab.name}
      <span className="tab-count">{done}/{items.length}</span>
    </button>
  );
}

export default function TabBar({ list }) {
  const { activeTabIds, setActiveTabIds, addTab, reorderTabs } = useApp();
  const activeTabId = activeTabIds[list.id];
  const sensors = useDndSensors();

  async function handleAddTab() {
    const name = prompt('Category name:')?.trim();
    if (!name) return;
    const data = await dbCreateTab(list.id, name, '📋', list.tabs.length);
    const newTab = { ...data, sections: [] };
    addTab(list.id, newTab);
    setActiveTabIds(prev => ({ ...prev, [list.id]: newTab.id }));
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = list.tabs.findIndex(t => t.id === active.id);
    const newIndex = list.tabs.findIndex(t => t.id === over.id);
    const reordered = arrayMove(list.tabs, oldIndex, newIndex);
    reorderTabs(list.id, reordered);
    await dbReorderTabs(reordered);
  }

  return (
    <div className="tab-bar">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={list.tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
          {list.tabs.map(tab => (
            <SortableTab
              key={tab.id}
              tab={tab}
              listId={list.id}
              isActive={activeTabId === tab.id}
              onClick={() => setActiveTabIds(prev => ({ ...prev, [list.id]: tab.id }))}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button className="add-tab-btn" onClick={handleAddTab}>+ category</button>
    </div>
  );
}
