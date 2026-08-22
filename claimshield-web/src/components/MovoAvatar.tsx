// Movo's robot avatar - adapted from the reference HTML/CSS design
// (rounded visor head, glowing cyan eyes with a blink animation, top
// antenna light) at a compact size suitable for the chat bubble and
// panel header, instead of the original ~220x170px full-size version.

export function MovoAvatar({ size = 32 }: { size?: number }) {
  return (
    <div
      className="movo-avatar"
      style={{ width: size, height: size * 0.78 }}
    >
      <span className="movo-avatar-antenna" />
      <span className="movo-avatar-side movo-avatar-side-left" />
      <span className="movo-avatar-side movo-avatar-side-right" />
      <div className="movo-avatar-visor">
        <span className="movo-avatar-eye movo-avatar-eye-left" />
        <span className="movo-avatar-eye movo-avatar-eye-right" />
        <span className="movo-avatar-mouth" />
      </div>
    </div>
  )
}