import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase.js';
import { loadLists } from '../lib/db.js';
import { useApp } from '../context/AppContext.jsx';

export function useLists() {
  const { user, setLists, setActiveListId, activeTabIds, setActiveTabIds, setItemChecked } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    loadLists()
      .then(lists => {
        setLists(lists);
        if (lists.length) {
          setActiveListId(lists[0].id);
          const defaultTabs = {};
          lists.forEach(l => {
            if (l.tabs.length) defaultTabs[l.id] = l.tabs[0].id;
          });
          setActiveTabIds(defaultTabs);
        }
      })
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, [user]);

  // Real-time checked state
  useEffect(() => {
    if (!user) return;

    const channel = sb.channel('checked-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checked_state' }, payload => {
        const itemId  = payload.new?.item_id || payload.old?.item_id;
        const checked = payload.eventType === 'INSERT';
        setItemChecked(itemId, checked);
      })
      .subscribe();

    return () => sb.removeChannel(channel);
  }, [user]);

  return { loading, error };
}
