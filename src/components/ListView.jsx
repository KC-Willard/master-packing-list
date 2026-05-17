import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { dbUpdateList } from '../lib/db.js';
import TabBar from './TabBar.jsx';
import TabPage from './TabPage.jsx';
import EmojiPicker from './EmojiPicker.jsx';

export default function ListView({ list }) {
  const { activeTabIds, updateList } = useApp();
  const [listName, setListName]     = useState(list.name);
  const [showEmoji, setShowEmoji]   = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState(null);

  const activeTab = list.tabs.find(t => t.id === activeTabIds[list.id]) ?? list.tabs[0];

  const allItems  = list.tabs.flatMap(t => t.sections.flatMap(s => s.items));
  const total     = allItems.length;
  const done      = allItems.filter(i => i.checked).length;
  const pct       = total ? Math.round(done / total * 100) : 0;

  async function handleNameBlur() {
    const trimmed = listName.trim() || list.name;
    setListName(trimmed);
    if (trimmed !== list.name) {
      updateList(list.id, { name: trimmed });
      await dbUpdateList(list.id, { name: trimmed });
    }
  }

  async function handleEmojiSelect(emoji) {
    setShowEmoji(false);
    updateList(list.id, { emoji });
    await dbUpdateList(list.id, { emoji });
  }

  return (
    <div className="list-view">
      <div className="list-header">
        <button
          className="emoji-btn"
          onClick={e => { setEmojiAnchor({ x: e.clientX, y: e.clientY }); setShowEmoji(true); }}
        >
          {list.emoji}
        </button>
        <input
          className="list-name-input"
          value={listName}
          onChange={e => setListName(e.target.value)}
          onBlur={handleNameBlur}
        />
        <span className="list-count">{done}/{total}</span>
      </div>

      {showEmoji && (
        <EmojiPicker anchor={emojiAnchor} onSelect={handleEmojiSelect} onClose={() => setShowEmoji(false)} />
      )}

      <div className="progress-wrap">
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-label">{total ? `${done} of ${total} items packed` : ''}</p>

      <TabBar list={list} />

      {activeTab && <TabPage tab={activeTab} listId={list.id} />}
    </div>
  );
}
