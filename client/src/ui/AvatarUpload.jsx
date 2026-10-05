import { useRef, useState } from 'react';
import { FiCamera, FiTrash2 } from 'react-icons/fi';
import api from '../api';
import { apiError } from '../lib/format';
import { Avatar, Spinner } from './Bits';
import { useFeedback } from './Feedback';

// Centre-crop to a square and shrink to 512px JPEG before uploading (phone photos are several MB)
const squareJpeg = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const size = Math.min(512, side);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    URL.revokeObjectURL(url);
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the photo'))), 'image/jpeg', 0.85);
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the photo')); };
  img.src = url;
});

// Profile photo picker for the signed-in account (any role)
const AvatarUpload = ({ person, first, last, seed, onChange }) => {
  const { toast } = useFeedback();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(undefined); // optimistic: null = removed

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await squareJpeg(file);
      const { data } = await api.put('/account/avatar', blob, { headers: { 'Content-Type': 'application/octet-stream' } });
      setLocal({ avatar: data.avatar });
      toast('Photo updated');
      onChange?.();
    } catch (err) {
      toast(apiError(err, err.message), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete('/account/avatar');
      setLocal(null);
      toast('Photo removed');
      onChange?.();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const shown = local === undefined ? person : local;
  const has = Boolean(shown?.avatar?.key || shown?.avatarKey);
  return (
    <div className="avatar-upload">
      <Avatar photo={shown} first={first} last={last} seed={seed} size={72} />
      <div className="stack gap-8">
        <div className="row gap-8 wrap">
          <button type="button" className="btn btn-sm" onClick={() => input.current?.click()} disabled={busy}>{busy ? <Spinner /> : <FiCamera />} {has ? 'Change photo' : 'Add photo'}</button>
          {has && <button type="button" className="btn btn-ghost btn-sm" onClick={remove} disabled={busy}><FiTrash2 /> Remove</button>}
        </div>
        <span className="subtle" style={{ fontSize: 12.5 }}>JPG, PNG or WebP. Shown to the people you deal with on PakMedRecord.</span>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
};

export default AvatarUpload;
