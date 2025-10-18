// src/layout/CustomAlgoUpload.tsx
import { useRef, useState } from 'react';
import { uploadAlgorithm } from '@/api';
import type { UploadedAlgorithm } from '@/types';
import { useTranslation } from 'react-i18next';

export default function CustomAlgoUpload({
  onUploaded,
}: {
  onUploaded: (algo: UploadedAlgorithm) => void;
}) {
  const { t } = useTranslation();

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [entry, setEntry] = useState('run');
  const [hash, setHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>('');

  const inputRef = useRef<HTMLInputElement | null>(null);

  async function sha256(f: File) {
    const buf = await f.arrayBuffer();
    const dig = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(dig)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function onPick(f?: File) {
    if (!f) return;
    if (!/\.(py|zip)$/i.test(f.name)) {
      setErr(t('controls.uploadFileTypeError'));
      return;
    }
    setErr('');
    setFile(f);
    setName(f.name.replace(/\.(py|zip)$/i, ''));
    setHash(await sha256(f));
  }

  async function onUpload() {
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const algo = await uploadAlgorithm(file, {
        name: name || file.name,
        language: 'python',
        entry,
        sha256: hash,
      });
      onUploaded(algo);
      // reset
      setFile(null); setName(''); setEntry('run'); setHash('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (e: any) {
      setErr(e?.message ?? t('controls.uploadFailed'));
    } finally {
      setBusy(false);
    }
  }

  // Single button handler: pick or upload
  function onButtonClick() {
    if (!file) inputRef.current?.click();
    else onUpload();
  }

  return (
    <div className="space-y-3">
      {/* Hidden native input */}
      <input
        ref={inputRef}
        type="file"
        accept=".py,.zip"
        onChange={e => onPick(e.target.files?.[0] ?? undefined)}
        className="sr-only"
      />

      {/* One button only */}
      <button className="btn w-42" onClick={onButtonClick} disabled={busy}>
        {busy
          ? t('controls.uploading')
          : file
            ? `${t('controls.uploadAlgorithmBtn')} (${file.name})`
            : t('controls.uploadAlgorithmBtn')}
      </button>

      {/* Optional details shown only after a file is chosen */}
      {file && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="label mb-1">{t('controls.name')}</div>
            <input className="input w-full" value={name} onChange={e => setName(e.target.value)} />
          </div>
        </div>
      )}

      {err && <div className="text-sm text-red-600">{err}</div>}
    </div>
  );
}
