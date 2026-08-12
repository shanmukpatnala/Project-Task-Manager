import { useState } from "react";

function PasswordInput({ value, onChange, placeholder }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="icon-button"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 4.2A9.7 9.7 0 0 1 12 4c5 0 8.6 4.3 10 8a13.7 13.7 0 0 1-2 3.3" />
            <path d="M6.1 6.1A13.4 13.4 0 0 0 2 12c1.4 3.7 5 8 10 8a9.7 9.7 0 0 0 4.2-.9" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 12s3.6-8 10-8 10 8 10 8-3.6 8-10 8S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default PasswordInput;
