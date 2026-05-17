import { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [lists, setLists]             = useState([]);
  const [activeListId, setActiveListId] = useState(null);
  const [activeTabIds, setActiveTabIds] = useState({});  // listId -> tabId
  const [syncStatus, setSyncStatus]   = useState('');

  // ── Derived helpers ──────────────────────────────────────────────────────────

  const activeList = lists.find(l => l.id === activeListId) ?? null;

  // ── List mutations ───────────────────────────────────────────────────────────

  const addList = useCallback((list) => {
    setLists(prev => [...prev, list]);
  }, []);

  const removeList = useCallback((listId) => {
    setLists(prev => prev.filter(l => l.id !== listId));
  }, []);

  const updateList = useCallback((listId, fields) => {
    setLists(prev => prev.map(l => l.id === listId ? { ...l, ...fields } : l));
  }, []);

  // ── Tab mutations ────────────────────────────────────────────────────────────

  const addTab = useCallback((listId, tab) => {
    setLists(prev => prev.map(l =>
      l.id === listId ? { ...l, tabs: [...l.tabs, tab] } : l
    ));
  }, []);

  const removeTab = useCallback((listId, tabId) => {
    setLists(prev => prev.map(l =>
      l.id === listId ? { ...l, tabs: l.tabs.filter(t => t.id !== tabId) } : l
    ));
  }, []);

  const updateTab = useCallback((listId, tabId, fields) => {
    setLists(prev => prev.map(l =>
      l.id === listId
        ? { ...l, tabs: l.tabs.map(t => t.id === tabId ? { ...t, ...fields } : t) }
        : l
    ));
  }, []);

  const reorderTabs = useCallback((listId, tabs) => {
    setLists(prev => prev.map(l => l.id === listId ? { ...l, tabs } : l));
  }, []);

  // ── Section mutations ────────────────────────────────────────────────────────

  const addSection = useCallback((listId, tabId, section) => {
    setLists(prev => prev.map(l =>
      l.id === listId ? {
        ...l,
        tabs: l.tabs.map(t =>
          t.id === tabId ? { ...t, sections: [...t.sections, section] } : t
        )
      } : l
    ));
  }, []);

  const removeSection = useCallback((listId, tabId, sectionId) => {
    setLists(prev => prev.map(l =>
      l.id === listId ? {
        ...l,
        tabs: l.tabs.map(t =>
          t.id === tabId ? { ...t, sections: t.sections.filter(s => s.id !== sectionId) } : t
        )
      } : l
    ));
  }, []);

  const updateSection = useCallback((listId, tabId, sectionId, fields) => {
    setLists(prev => prev.map(l =>
      l.id === listId ? {
        ...l,
        tabs: l.tabs.map(t =>
          t.id === tabId ? {
            ...t,
            sections: t.sections.map(s => s.id === sectionId ? { ...s, ...fields } : s)
          } : t
        )
      } : l
    ));
  }, []);

  const reorderSections = useCallback((listId, tabId, sections) => {
    setLists(prev => prev.map(l =>
      l.id === listId ? {
        ...l,
        tabs: l.tabs.map(t => t.id === tabId ? { ...t, sections } : t)
      } : l
    ));
  }, []);

  // ── Item mutations ───────────────────────────────────────────────────────────

  const addItem = useCallback((listId, tabId, sectionId, item) => {
    setLists(prev => prev.map(l =>
      l.id === listId ? {
        ...l,
        tabs: l.tabs.map(t =>
          t.id === tabId ? {
            ...t,
            sections: t.sections.map(s =>
              s.id === sectionId ? { ...s, items: [...s.items, item] } : s
            )
          } : t
        )
      } : l
    ));
  }, []);

  const removeItem = useCallback((listId, tabId, sectionId, itemId) => {
    setLists(prev => prev.map(l =>
      l.id === listId ? {
        ...l,
        tabs: l.tabs.map(t =>
          t.id === tabId ? {
            ...t,
            sections: t.sections.map(s =>
              s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s
            )
          } : t
        )
      } : l
    ));
  }, []);

  const toggleItem = useCallback((listId, tabId, sectionId, itemId, checked) => {
    setLists(prev => prev.map(l =>
      l.id === listId ? {
        ...l,
        tabs: l.tabs.map(t =>
          t.id === tabId ? {
            ...t,
            sections: t.sections.map(s =>
              s.id === sectionId ? {
                ...s,
                items: s.items.map(i => i.id === itemId ? { ...i, checked } : i)
              } : s
            )
          } : t
        )
      } : l
    ));
  }, []);

  const reorderItems = useCallback((listId, tabId, sectionId, items) => {
    setLists(prev => prev.map(l =>
      l.id === listId ? {
        ...l,
        tabs: l.tabs.map(t =>
          t.id === tabId ? {
            ...t,
            sections: t.sections.map(s => s.id === sectionId ? { ...s, items } : s)
          } : t
        )
      } : l
    ));
  }, []);

  // ── Bulk checked mutations (for real-time + reset/check-all) ─────────────────

  const setItemChecked = useCallback((itemId, checked) => {
    setLists(prev => prev.map(l => ({
      ...l,
      tabs: l.tabs.map(t => ({
        ...t,
        sections: t.sections.map(s => ({
          ...s,
          items: s.items.map(i => i.id === itemId ? { ...i, checked } : i),
        })),
      })),
    })));
  }, []);

  const setAllChecked = useCallback((listId, checked) => {
    setLists(prev => prev.map(l =>
      l.id === listId ? {
        ...l,
        tabs: l.tabs.map(t => ({
          ...t,
          sections: t.sections.map(s => ({
            ...s,
            items: s.items.map(i => ({ ...i, checked })),
          })),
        })),
      } : l
    ));
  }, []);

  return (
    <AppContext.Provider value={{
      user, setUser,
      lists, setLists,
      activeListId, setActiveListId,
      activeTabIds, setActiveTabIds,
      syncStatus, setSyncStatus,
      activeList,
      addList, removeList, updateList,
      addTab, removeTab, updateTab, reorderTabs,
      addSection, removeSection, updateSection, reorderSections,
      addItem, removeItem, toggleItem, reorderItems,
      setItemChecked, setAllChecked,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
