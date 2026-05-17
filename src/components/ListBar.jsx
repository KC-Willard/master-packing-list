import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { dbCreateList, dbDeleteList } from '../lib/db.js';

export default function ListBar({ onShare }) {
  const { user, lists, activeListId, setActiveListId, addList, removeList, setActiveTabIds } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  async function handleCreate() {
    const name = newName.trim(); if (!name) return;
    const id = crypto.randomUUID();
    await dbCreateList(id, name, '📋', user.id);
    const newList = { id, name, emoji: '📋', created_at: new Date().toISOString(), tabs: [] };
    addList(newList);
    setActiveListId(newList.id);
    setNewName('');
    setShowNew(false);
  }

  async function handleDelete(e, listId) {
    e.stopPropagation();
    const list = lists.find(l => l.id === listId);
    if (!list || !confirm(`Delete list "${list.name}"?`)) return;
    await dbDeleteList(listId);
    removeList(listId);
    if (activeListId === listId) {
      const remaining = lists.filter(l => l.id !== listId);
      setActiveListId(remaining[0]?.id ?? null);
    }
  }

  return (
    <div className="list-bar">
      {lists.map(list => (
        <div
          key={list.id}
          className={`list-pill${list.id === activeListId ? ' active' : ''}`}
          onClick={() => setActiveListId(list.id)}
        >
          <span>{list.emoji} {list.name}</span>
          <button className="pill-share" title="Share" onClick={e => { e.stopPropagation(); onShare(list.id); }}>↗</button>
          {lists.length > 1 && (
            <button className="pill-del" title="Delete" onClick={e => handleDelete(e, list.id)}>×</button>
          )}
        </div>
      ))}

      {showNew ? (
        <div className="new-list-form">
          <input
            className="new-list-input"
            autoFocus
            placeholder="List name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNew(false); }}
          />
          <button className="modal-btn" onClick={handleCreate}>Create</button>
          <button className="modal-btn cancel" onClick={() => setShowNew(false)}>Cancel</button>
        </div>
      ) : (
        <button className="new-list-btn" onClick={() => setShowNew(true)}>+ new list</button>
      )}
    </div>
  );
}
