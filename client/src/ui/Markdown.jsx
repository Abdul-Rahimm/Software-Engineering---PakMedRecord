import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

// Renders AI output as sanitised Markdown
const Markdown = ({ text, className = '' }) => {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text || '')), [text]);
  // eslint-disable-next-line react/no-danger
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
};

export default Markdown;
