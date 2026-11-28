import { MAX_DISPLAY_NAME_LENGTH } from '@scrum-poker/shared';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  title: string;
  hint?: string;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  /** Extra fields rendered after the display name (e.g. the room code). */
  children?: ReactNode;
  onSubmit: (displayName: string) => void;
  initialName?: string;
}

export function NameForm({
  title,
  hint,
  submitLabel,
  busy,
  error,
  children,
  onSubmit,
  initialName = '',
}: Props) {
  const { t } = useTranslation('common');
  const [name, setName] = useState(initialName);
  const nameId = useId();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <form className="panel form" onSubmit={handleSubmit}>
      <h2>{title}</h2>
      {hint && <p className="muted">{hint}</p>}
      <label htmlFor={nameId}>{t('displayName')}</label>
      <input
        id={nameId}
        value={name}
        maxLength={MAX_DISPLAY_NAME_LENGTH}
        onChange={(event) => setName(event.target.value)}
        autoComplete="nickname"
        required
      />
      {children}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" className="primary" disabled={busy || !name.trim()}>
        {submitLabel}
      </button>
    </form>
  );
}
