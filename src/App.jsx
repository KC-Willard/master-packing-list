import { useState } from 'react';
import { useApp } from './context/AppContext.jsx';
import { useAuth } from './hooks/useAuth.js';
import { useLists } from './hooks/useLists.js';
import { sb } from './lib/supabase.js';
import { dbCheckAll, dbUncheckAll } from './lib/db.js';
import LoginScreen from './components/LoginScreen.jsx';
import ListBar from './components/ListBar.jsx';
import ListView from './components/ListView.jsx';
import InviteBanner from './components/InviteBanner.jsx';
import ShareModal from './components/ShareModal.jsx';

export default function App() {
  useAuth();
  const { loading } = useLists();
  const { user, lists, activeListId, activeList, setAllChecked } = useApp();
  const [shareListId, setShareListId] = useState(null);

  if (!user) return <LoginScreen />;
  if (loading) return <div className="loading">Loading your lists…</div>;

  async function handleReset() {
    if (!activeList || !confirm('Reset all checkboxes in this list?')) return;
    const allItemIds = activeList.tabs.flatMap(t => t.sections.flatMap(s => s.items.map(i => i.id)));
    await dbUncheckAll(allItemIds, user.id);
    setAllChecked(activeListId, false);
  }

  async function handleCheckAll() {
    if (!activeList) return;
    const allItemIds = activeList.tabs.flatMap(t => t.sections.flatMap(s => s.items.map(i => i.id)));
    await dbCheckAll(allItemIds, user.id);
    setAllChecked(activeListId, true);
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Packing Lists</h1>
        <div className="topbar-right">
          <span className="user-badge">{user.user_metadata?.full_name || user.email}</span>
          <button className="signout-btn" onClick={() => sb.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <InviteBanner />

      <ListBar onShare={setShareListId} />

      {lists.length === 0 ? (
        <div className="empty-state">
          <p>No lists yet.</p>
          <p>Create one above or accept an invitation!</p>
        </div>
      ) : (
        activeList && <ListView key={activeListId} list={activeList} />
      )}

      <div className="global-actions">
        <button className="global-btn" onClick={handleReset}>Reset List</button>
        <button className="global-btn" onClick={handleCheckAll}>Check All</button>
      </div>

      {shareListId && (
        <ShareModal listId={shareListId} onClose={() => setShareListId(null)} />
      )}
    </div>
  );
}
