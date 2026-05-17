import { useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import {
  dbLoadPendingInvitations,
  dbAcceptInvitation,
  dbDeclineInvitation,
  loadLists,
} from '../lib/db.js';

export function useInvitations() {
  const { user, setLists, setActiveListId, setActiveTabIds, addList } = useApp();
  const [invitations, setInvitations] = useState([]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const pending = await dbLoadPendingInvitations(user.id);
    setInvitations(pending);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const accept = useCallback(async (inv) => {
    await dbAcceptInvitation(inv, user.id);
    // Reload full list data for the newly accepted list
    const all = await loadLists();
    const newList = all.find(l => l.id === inv.list_id);
    if (newList) {
      addList(newList);
      if (newList.tabs.length) {
        setActiveTabIds(prev => ({ ...prev, [newList.id]: newList.tabs[0].id }));
      }
    }
    setInvitations(prev => prev.filter(i => i.id !== inv.id));
  }, [user]);

  const decline = useCallback(async (invId) => {
    await dbDeclineInvitation(invId);
    setInvitations(prev => prev.filter(i => i.id !== invId));
  }, []);

  return { invitations, refresh, accept, decline };
}
