export default function ImmersiveBar({ onExit }) {
  return (
    <div className="immBar">
      <button onClick={onExit}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
        退出沉浸
      </button>
      <span className="escHint">Esc</span>
    </div>
  );
}
