import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import {
  dbGetListMembers, dbGetEmailByUserId, dbGetUserIdByEmail,
  dbSendInvitation, dbRemoveMember, dbLoadSentPendingInvitations,
} from '../lib/db.js';

export default function ShareModal({ listId, onClose }) {
  const { user, activeList } = useApp();
  const [members, setMembers]   = useState([]);
  const [pending, setPending]   = useState([]);
  const [email, setEmail]       = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!listId) return;
    setLoading(true);
    Promise.all([
      dbGetListMembers(listId),
      dbLoadSentPendingInvitations(listId),
    ]).then(async ([rawMembers, pendingInvites]) => {
      const resolved = await Promise.all(
        rawMembers.map(async m => ({
          ...m,
          email: m.user_id === user.id
            ? user.email
            : (await dbGetEmailByUserId(m.user_id)) || `${m.user_id.slice(0, 8)}…`,
        }))
      );
      setMembers(resolved);
      setPending(pendingInvites);
      setLoading(false);
    });
  }, [listId]);

  async function handleInvite() {
    setError(''); setSuccess('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    if (trimmed === user.email.toLowerCase()) { setError("That's you!"); return; }
    if (members.find(m => m.email?.toLowerCase() === trimmed)) { setError('Already a member.'); return; }
    if (pending.find(p => p.invited_email === trimmed)) { setError('Invite already pending.'); return; }

    const userId = await dbGetUserIdByEmail(trimmed);
    if (!userId) { setError('No account found. They need to sign in once first.'); return; }

    try {
      await dbSendInvitation(listId, trimmed, user.id);
      setPending(prev => [...prev, { id: Date.now(), invited_email: trimmed }]);
      setEmail('');
      setSuccess(`Invitation sent to ${trimmed}!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Something went wrong. Try again.');
    }
  }

  async function handleRemove(userId) {
    await dbRemoveMember(listId, userId);
    setMembers(prev => prev.filter(m => m.user_id !== userId));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Share "{activeList?.name}"</h2>

        {loading ? (
          <p className="modal-loading">Loading…</p>
        ) : (
          <>
            <p className="member-list-label">Current members</p>
            <div className="member-list">
              {members.map(m => (
                <div key={m.user_id} className="member-row">
                  <div className="member-info">
                    <span className="member-email">{m.email}</span>
                    <span className="member-role">{m.role}</span>
                  </div>
                  {m.user_id !== user.id && (
                    <button className="member-remove" onClick={() => handleRemove(m.user_id)}>× remove</button>
                  )}
                </div>
              ))}
            </div>

            {pending.length > 0 && (
              <>
                <p className="member-list-label" style={{ marginTop: '0.75rem' }}>Pending invitations</p>
                <div className="member-list">
                  {pending.map(p => (
                    <div key={p.id} className="member-row">
                      <div className="member-info">
                        <span className="member-email">{p.invited_email}</span>
                        <span className="member-role" style={{ color: 'var(--muted)' }}>pending</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <hr className="share-divider" />
            {error   && <p className="share-error">{error}</p>}
            {success && <p className="share-success">{success}</p>}
            <div className="share-input-row">
              <input
                className="modal-input"
                type="email"
                placeholder="Invite by email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onClose}>Done</button>
          <button className="modal-btn" onClick={handleInvite}>Invite</button>
        </div>
      </div>
    </div>
  );
}
