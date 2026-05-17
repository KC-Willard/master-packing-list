import { sb } from './supabase.js';

// ─── Lists ────────────────────────────────────────────────────────────────────

export async function loadLists() {
  const { data: memberships } = await sb.from('list_members').select('list_id, role');
  if (!memberships?.length) return [];
  const listIds = memberships.map(m => m.list_id);

  const [
    { data: listsData },
    { data: allTabs },
    { data: allSections },
    { data: allItems },
  ] = await Promise.all([
    sb.from('lists').select('*').in('id', listIds).order('created_at'),
    sb.from('tabs').select('*').in('list_id', listIds).order('position'),
    sb.from('sections').select('*').order('position'),
    sb.from('items').select('*').eq('is_deleted', false).order('position'),
  ]);

  const allItemIds = (allItems || []).map(i => i.id);
  let checkedIds = new Set();
  if (allItemIds.length) {
    const { data: checked } = await sb.from('checked_state').select('item_id').in('item_id', allItemIds);
    checkedIds = new Set((checked || []).map(c => c.item_id));
  }

  const tabsByList = {};
  const secsByTab  = {};
  const itemsBySec = {};
  for (const tab of (allTabs || [])) {
    (tabsByList[tab.list_id] ??= []).push(tab);
  }
  for (const sec of (allSections || [])) {
    (secsByTab[sec.tab_id] ??= []).push(sec);
  }
  for (const item of (allItems || [])) {
    (itemsBySec[item.section_id] ??= []).push(item);
  }

  return (listsData || []).map(list => ({
    ...list,
    tabs: (tabsByList[list.id] || []).map(tab => ({
      ...tab,
      sections: (secsByTab[tab.id] || []).map(sec => ({
        ...sec,
        items: (itemsBySec[sec.id] || []).map(item => ({
          ...item,
          checked: checkedIds.has(item.id),
        })),
      })),
    })),
  }));
}

export async function dbCreateList(id, name, emoji, userId) {
  const { error: le } = await sb.from('lists').insert({ id, name, emoji, created_at: new Date().toISOString() });
  if (le) throw le;
  const { error: me } = await sb.from('list_members').insert({ list_id: id, user_id: userId, role: 'owner' });
  if (me) throw me;
}

export async function dbUpdateList(id, fields) {
  const { error } = await sb.from('lists').update(fields).eq('id', id);
  if (error) throw error;
}

export async function dbDeleteList(id) {
  const { error } = await sb.from('lists').delete().eq('id', id);
  if (error) throw error;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export async function dbCreateTab(listId, name, emoji, position) {
  const { data, error } = await sb.from('tabs').insert({ list_id: listId, name, emoji, position }).select().single();
  if (error) throw error;
  return data;
}

export async function dbUpdateTab(id, fields) {
  const { error } = await sb.from('tabs').update(fields).eq('id', id);
  if (error) throw error;
}

export async function dbDeleteTab(id) {
  const { error } = await sb.from('tabs').delete().eq('id', id);
  if (error) throw error;
}

export async function dbReorderTabs(tabs) {
  await Promise.all(tabs.map((t, i) => sb.from('tabs').update({ position: i }).eq('id', t.id)));
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export async function dbCreateSection(tabId, title, position) {
  const { data, error } = await sb.from('sections').insert({ tab_id: tabId, title, position }).select().single();
  if (error) throw error;
  return data;
}

export async function dbUpdateSection(id, fields) {
  const { error } = await sb.from('sections').update(fields).eq('id', id);
  if (error) throw error;
}

export async function dbDeleteSection(id) {
  const { error } = await sb.from('sections').delete().eq('id', id);
  if (error) throw error;
}

export async function dbReorderSections(sections) {
  await Promise.all(sections.map((s, i) => sb.from('sections').update({ position: i }).eq('id', s.id)));
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function dbCreateItem(sectionId, text, position) {
  const { data, error } = await sb.from('items').insert({ section_id: sectionId, text, position }).select().single();
  if (error) throw error;
  return data;
}

export async function dbDeleteItem(id) {
  const { error } = await sb.from('items').update({ is_deleted: true }).eq('id', id);
  if (error) throw error;
}

export async function dbReorderItems(items) {
  await Promise.all(items.map((it, i) => sb.from('items').update({ position: i }).eq('id', it.id)));
}

// ─── Checked state ────────────────────────────────────────────────────────────

export async function dbCheckItem(itemId, userId) {
  await sb.from('checked_state').upsert({ item_id: itemId, checked_by: userId });
}

export async function dbUncheckItem(itemId, userId) {
  await sb.from('checked_state').delete().eq('item_id', itemId).eq('checked_by', userId);
}

export async function dbCheckAll(itemIds, userId) {
  if (!itemIds.length) return;
  await sb.from('checked_state').upsert(itemIds.map(id => ({ item_id: id, checked_by: userId })));
}

export async function dbUncheckAll(itemIds, userId) {
  if (!itemIds.length) return;
  await sb.from('checked_state').delete().in('item_id', itemIds).eq('checked_by', userId);
}

// ─── Invitations ──────────────────────────────────────────────────────────────

export async function dbSendInvitation(listId, email, userId) {
  const { error } = await sb.from('list_invitations').insert({
    list_id: listId,
    invited_by: userId,
    invited_email: email.toLowerCase(),
  });
  if (error) throw error;
}

export async function dbLoadPendingInvitations(userId) {
  const { data, error } = await sb
    .from('list_invitations')
    .select('id, list_id, invited_by, invited_email, created_at, lists(name, emoji)')
    .eq('status', 'pending')
    .neq('invited_by', userId);
  if (error) throw error;
  return data || [];
}

export async function dbLoadSentPendingInvitations(listId) {
  const { data } = await sb
    .from('list_invitations')
    .select('id, invited_email, created_at')
    .eq('list_id', listId)
    .eq('status', 'pending');
  return data || [];
}

export async function dbAcceptInvitation(inv, userId) {
  const { error } = await sb.from('list_members').insert({ list_id: inv.list_id, user_id: userId, role: 'editor' });
  if (error) throw error;
  await sb.from('list_invitations').update({ status: 'accepted' }).eq('id', inv.id);
}

export async function dbDeclineInvitation(invId) {
  await sb.from('list_invitations').update({ status: 'declined' }).eq('id', invId);
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function dbGetListMembers(listId) {
  const { data } = await sb.from('list_members').select('user_id, role').eq('list_id', listId);
  return data || [];
}

export async function dbRemoveMember(listId, userId) {
  await sb.from('list_members').delete().eq('list_id', listId).eq('user_id', userId);
}

export async function dbGetEmailByUserId(userId) {
  const { data } = await sb.rpc('get_email_by_user_id', { user_id_input: userId });
  return data;
}

export async function dbGetUserIdByEmail(email) {
  const { data } = await sb.rpc('get_user_id_by_email', { email_input: email });
  return data;
}
