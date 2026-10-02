import { useEffect, useState } from 'react';
import { FiCopy, FiDownload, FiFileText, FiImage } from 'react-icons/fi';
import { downloadFile, fetchFileUrl, formatBytes } from '../lib/files';
import Modal from './Modal';
import Markdown from './Markdown';
import { Spinner } from './Bits';
import PdfPreview from './PdfPreview';
import { useFeedback } from './Feedback';
import './uploader.css';

// Original document on one side, the AI-extracted text on the other
export const AttachmentViewer = ({ attachment, onClose }) => {
  const { toast } = useFeedback();
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!attachment) return undefined;
    let objectUrl;
    setUrl(null);
    setFailed(false);
    fetchFileUrl(attachment._id)
      .then((u) => { objectUrl = u; setUrl(u); })
      .catch(() => setFailed(true));
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
  }, [attachment]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(attachment.ocr?.text || '');
      toast('Text copied');
    } catch {
      toast('Could not copy', 'error');
    }
  };

  const ocr = attachment?.ocr;
  return (
    <Modal open={Boolean(attachment)} onClose={onClose} title={attachment?.name} subtitle={attachment && `${attachment.mime === 'application/pdf' ? 'PDF' : 'Image'} · ${formatBytes(attachment.size)}`} width={1100}>
      {attachment && (
        <div className="stack gap-16">
          <div className="viewer">
            <div className="viewer-doc">
              {failed ? <p className="subtle">Could not load the file.</p>
                : !url ? <Spinner size={24} />
                  : attachment.mime === 'application/pdf' ? <PdfPreview url={url} />
                    : <img src={url} alt={attachment.name} />}
            </div>
            <div className="viewer-text stack gap-12">
              <div className="row between">
                <span className="field-label">Extracted text</span>
                {ocr?.status === 'done' && ocr.text && <button type="button" className="btn btn-ghost btn-sm" onClick={copy}><FiCopy /> Copy</button>}
              </div>
              {ocr?.summary && <p className="muted" style={{ fontSize: 13.5, fontStyle: 'italic' }}>{ocr.summary}</p>}
              {ocr?.status === 'done' && ocr.text ? <Markdown text={ocr.text} />
                : <p className="subtle">{ocr?.error || 'No text could be extracted from this file.'}</p>}
            </div>
          </div>
          <div className="row between wrap gap-12">
            <span className="subtle" style={{ fontSize: 12.5 }}>Text was read automatically by AI. Check it against the original document.</span>
            <button type="button" className="btn" onClick={() => downloadFile(attachment).catch(() => toast('Download failed', 'error'))}><FiDownload /> Download original</button>
          </div>
        </div>
      )}
    </Modal>
  );
};

// Row of file chips; clicking one opens the viewer
export const AttachmentChips = ({ attachments }) => {
  const [open, setOpen] = useState(null);
  const list = (attachments || []).filter((a) => a && a._id);
  if (!list.length) return null;
  return (
    <>
      <div className="att-chips">
        {list.map((a) => (
          <button key={a._id} type="button" className="att-chip" onClick={() => setOpen(a)} title={`Open ${a.name}`}>
            {a.mime === 'application/pdf' ? <FiFileText size={15} /> : <FiImage size={15} />}
            <span className="truncate">{a.name}</span>
            {a.ocr?.status === 'done' && <span className="badge badge-green badge-plain" style={{ height: 20, fontSize: 10.5 }}>Text</span>}
          </button>
        ))}
      </div>
      <AttachmentViewer attachment={open} onClose={() => setOpen(null)} />
    </>
  );
};
