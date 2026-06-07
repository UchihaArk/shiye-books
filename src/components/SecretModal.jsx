import { useState, useRef, useEffect } from 'react';

/**
 * 暗号输入弹窗。
 * @param {string} title - 文章标题
 * @param {function} onVerify - async (input) => boolean
 * @param {function} onSuccess - 验证成功回调
 * @param {function} onClose - 关闭回调
 */
export default function SecretModal({ title, onVerify, onSuccess, onClose }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const [composing, setComposing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (composing || !input.trim() || verifying) return;

    setVerifying(true);
    setError('');

    const ok = await onVerify(input.trim());
    if (ok) {
      onSuccess();
    } else {
      setError('暗号不正确');
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setVerifying(false);
    }
  };

  return (
    <div className="secretOverlay" onClick={onClose}>
      <div
        className={`secretCard${shake ? ' shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="secretIcon">🔒</div>
        <h3 className="secretTitle">{title}</h3>
        <p className="secretHint">输入暗号解锁阅读</p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="secretInput"
            type="text"
            placeholder="请输入暗号"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            autoComplete="off"
          />
          {error && <div className="secretError">{error}</div>}
          <button className="secretBtn" type="submit" disabled={verifying || !input.trim()}>
            {verifying ? '验证中…' : '解锁'}
          </button>
        </form>
      </div>
    </div>
  );
}
