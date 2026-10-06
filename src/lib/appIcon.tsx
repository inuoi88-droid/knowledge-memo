// ホーム画面・通知に使うアイコン（next/og の ImageResponse で PNG にする）
// 丸く切り抜かれても欠けないよう、絵は中央 60% に収める
export function AppIcon({ size }: { size: number }) {
  const card = Math.round(size * 0.56)
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #c026d3 100%)',
      }}
    >
      <div
        style={{
          width: card,
          height: card,
          borderRadius: card * 0.22,
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxShadow: '0 8px 24px rgba(30, 27, 75, 0.35)',
        }}
      >
        <div style={{ fontSize: card * 0.72, fontWeight: 900, color: '#4f46e5', lineHeight: 1, marginTop: -card * 0.04 }}>Q</div>
        <div
          style={{
            position: 'absolute',
            right: -card * 0.1,
            top: -card * 0.1,
            width: card * 0.34,
            height: card * 0.34,
            borderRadius: card,
            background: '#fbbf24',
            border: `${Math.max(2, Math.round(card * 0.05))}px solid #ffffff`,
          }}
        />
      </div>
    </div>
  )
}
