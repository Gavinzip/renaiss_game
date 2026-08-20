import { playGameUiSound } from "../audio/gameUiSounds";
import { useArenaI18n } from "../i18n/arena";

interface MobileControlLayoutEditorProps {
  onCancel: () => void;
  onReset: () => void;
  onSave: () => void;
}

export function MobileControlLayoutEditor({
  onCancel,
  onReset,
  onSave
}: MobileControlLayoutEditorProps) {
  const { t } = useArenaI18n();

  return (
    <section className="mobile-control-layout-editor" aria-label={t.ui.controlLayoutTitle}>
      <div>
        <strong>{t.ui.controlLayoutTitle}</strong>
        <span>{t.ui.controlLayoutHint}</span>
      </div>
      <nav aria-label={t.ui.controlLayoutActions}>
        <button type="button" onClick={() => {
          playGameUiSound("select");
          onReset();
        }}>
          {t.ui.controlLayoutReset}
        </button>
        <button type="button" onClick={() => {
          playGameUiSound("close");
          onCancel();
        }}>
          {t.ui.controlLayoutCancel}
        </button>
        <button type="button" className="is-primary" onClick={() => {
          playGameUiSound("success");
          onSave();
        }}>
          {t.ui.controlLayoutSave}
        </button>
      </nav>
    </section>
  );
}
