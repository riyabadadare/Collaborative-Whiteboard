
function getInitials(fullName = "") {
  return fullName
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function PresenceAvatars({ peers }) {
  if (!peers || peers.length === 0) return null;

  return (
    <div className="presenceAvatars" aria-label="People on this board">
      {peers.map((peer) => (
        <div
          key={peer.userId}
          className="presenceAvatar"
          style={{ backgroundColor: peer.color }}
          aria-label={peer.fullName}
        >
          {getInitials(peer.fullName)}
          <span className="presenceAvatarTooltip">{peer.fullName}</span>
        </div>
      ))}
    </div>
  );
}
