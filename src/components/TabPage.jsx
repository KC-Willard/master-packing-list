import { useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { useApp } from '../context/AppContext.jsx';
import { dbCreateSection, dbDeleteTab, dbUpdateTab, dbReorderSections } from '../lib/db.js';
import Section from './Section.jsx';
import EmojiPicker from './EmojiPicker.jsx';

export default function TabPage({ tab, listId }) {
  const { addSection, removeTab, updateTab, reorderSections, setActiveTabIds, activeList } = useApp();
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [tabName, setTabName]                 = useState(tab.name);
  const [showEmoji, setShowEmoji]             = useState(false);
  const [emojiAnchor, setEmojiAnchor]         = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleTabNameBlur() {
    const trimmed = tabName.trim() || tab.name;
    setTabName(trimmed);
    if (trimmed !== tab.name) {
      updateTab(listId, tab.id, { name: trimmed });
      await dbUpdateTab(tab.id, { name: trimmed });
    }
  }

  async function handleEmojiSelect(emoji) {
    setShowEmoji(false);
    updateTab(listId, tab.id, { emoji });
    await dbUpdateTab(tab.id, { emoji });
  }

  async function handleDeleteTab() {
    if (!confirm(`Delete tab "${tab.name}" and all its items?`)) return;
    await dbDeleteTab(tab.id);
    removeTab(listId, tab.id);
    const remaining = activeList?.tabs.filter(t => t.id !== tab.id);
    if (remaining?.length) setActiveTabIds(prev => ({ ...prev, [listId]: remaining[0].id }));
  }

  async function handleAddSection() {
    const title = newSectionTitle.trim(); if (!title) return;
    const data = await dbCreateSection(tab.id, title, tab.sections.length);
    addSection(listId, tab.id, { ...data, items: [] });
    setNewSectionTitle('');
  }

  async function handleSectionDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tab.sections.findIndex(s => s.id === active.id);
    const newIndex = tab.sections.findIndex(s => s.id === over.id);
    const reordered = arrayMove(tab.sections, oldIndex, newIndex);
    reorderSections(listId, tab.id, reordered);
    await dbReorderSections(reordered);
  }

  const n = tab.sections.length;
  const colClass = n <= 1 ? 'col-1' : n <= 2 ? 'col-2' : n <= 3 ? 'col-3' : 'col-4';

  return (
    <div className="page-wrap">
      <div className="tab-page-header">
        <button
          className="tab-emoji-btn"
          onClick={e => { setEmojiAnchor({ x: e.clientX, y: e.clientY }); setShowEmoji(true); }}
        >
          {tab.emoji}
        </button>
        <input
          className="tab-name-input"
          value={tabName}
          onChange={e => setTabName(e.target.value)}
          onBlur={handleTabNameBlur}
        />
        <button className="tab-del-btn" onClick={handleDeleteTab}>Delete tab</button>
      </div>

      {showEmoji && (
        <EmojiPicker
          anchor={emojiAnchor}
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmoji(false)}
        />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={tab.sections.map(s => s.id)} strategy={rectSortingStrategy}>
          <div className={`columns ${colClass}`}>
            {tab.sections.map(sec => (
              <Section key={sec.id} section={sec} listId={listId} tabId={tab.id} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="add-section-row">
        <input
          className="add-section-input"
          placeholder="+ new section name…"
          value={newSectionTitle}
          onChange={e => setNewSectionTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddSection()}
        />
        <button className="add-section-btn" onClick={handleAddSection}>Add section</button>
      </div>
    </div>
  );
}
