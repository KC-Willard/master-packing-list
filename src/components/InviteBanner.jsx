import { useInvitations } from '../hooks/useInvitations.js';

export default function InviteBanner() {
  const { invitations, accept, decline } = useInvitations();

  if (!invitations.length) return null;

  return (
    <div className="invite-banner">
      {invitations.map(inv => (
        <div key={inv.id} className="invite-row">
          <span className="invite-text">
            {inv.lists?.emoji || '📋'} <strong>{inv.lists?.name || 'a list'}</strong> — you've been invited
          </span>
          <div className="invite-actions">
            <button className="invite-btn accept" onClick={() => accept(inv)}>Accept</button>
            <button className="invite-btn decline" onClick={() => decline(inv.id)}>Decline</button>
          </div>
        </div>
      ))}
    </div>
  );
}
