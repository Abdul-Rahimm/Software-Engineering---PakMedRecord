import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UR, UR_PATTERNS } from './ur';

// English / Urdu. Urdu switches the page to right-to-left and translates the interface.
// Rather than threading t() through every component, a DOM pass translates any text node,
// placeholder, title or aria-label whose English text is in the dictionary (and re-runs as React updates).
const KEY = 'pakmedrecord.lang';
const ATTRS = ['placeholder', 'aria-label', 'title'];
// never translate inside these (text the user typed, code); their placeholders still are
const SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'svg', 'CANVAS']);
const NO_CHILDREN = new Set(['TEXTAREA']);

const readLang = () => {
  try {
    return localStorage.getItem(KEY) === 'ur' ? 'ur' : 'en';
  } catch {
    return 'en';
  }
};

let current = readLang();

// Exact phrase, then with trailing punctuation peeled off, then patterns with values in them
const lookup = (raw) => {
  const text = raw.replace(/\s+/g, ' ');
  if (UR[text]) return UR[text];
  const m = text.match(/^(.*?)([.:…?!]+)$/);
  if (m && UR[m[1]]) return UR[m[1]] + m[2].replace('?', '؟');
  for (const [rx, fn] of UR_PATTERNS) {
    const hit = text.match(rx);
    if (hit) return fn(...hit.slice(1));
  }
  return null;
};

// For strings built in code (toasts, confirm dialogs, document titles)
export const t = (text) => (current === 'ur' && text ? lookup(text) || text : text);

const EN = Symbol('en');
const UR_TEXT = Symbol('ur');

const translateText = (node) => {
  const value = node.nodeValue;
  // React (or we) changed the text since our last pass: treat it as fresh English
  if (node[UR_TEXT] !== value) node[EN] = value;
  const en = node[EN];
  const trimmed = en.trim();
  if (!trimmed || trimmed.length > 400) return;
  const ur = lookup(trimmed);
  if (!ur) return;
  const out = en.replace(trimmed, ur);
  node[UR_TEXT] = out;
  if (value !== out) node.nodeValue = out;
};

const translateAttrs = (el) => {
  for (const attr of ATTRS) {
    if (!el.hasAttribute(attr)) continue;
    const value = el.getAttribute(attr);
    const store = `data-en-${attr}`;
    if (el.getAttribute(`data-ur-${attr}`) !== value) el.setAttribute(store, value);
    const ur = lookup(el.getAttribute(store).trim());
    if (ur && value !== ur) {
      el.setAttribute(`data-ur-${attr}`, ur);
      el.setAttribute(attr, ur);
    }
  }
};

const walk = (root, fn) => {
  if (root.nodeType === 3) return fn(root);
  if (root.nodeType !== 1 || SKIP.has(root.nodeName) || root.closest?.('[data-no-translate]')) return;
  fn(root);
  if (NO_CHILDREN.has(root.nodeName)) return;
  for (const child of root.childNodes) walk(child, fn);
};

const translate = (root) => walk(root, (n) => (n.nodeType === 3 ? translateText(n) : translateAttrs(n)));

const restore = (root) => walk(root, (n) => {
  if (n.nodeType === 3) {
    if (n[EN] !== undefined && n[UR_TEXT] === n.nodeValue) n.nodeValue = n[EN];
    delete n[EN];
    delete n[UR_TEXT];
    return;
  }
  for (const attr of ATTRS) {
    const en = n.getAttribute(`data-en-${attr}`);
    if (en !== null && n.getAttribute(attr) === n.getAttribute(`data-ur-${attr}`)) n.setAttribute(attr, en);
    n.removeAttribute(`data-en-${attr}`);
    n.removeAttribute(`data-ur-${attr}`);
  }
});

let observer;
const startTranslating = () => {
  translate(document.body);
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') {
        if (!NO_CHILDREN.has(m.target.parentNode?.nodeName) && !m.target.parentElement?.closest('[data-no-translate]')) translateText(m.target);
      }
      else if (m.type === 'attributes') translateAttrs(m.target);
      else m.addedNodes.forEach(translate);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
};
const stopTranslating = () => {
  observer?.disconnect();
  observer = null;
  restore(document.body);
};

const LangContext = createContext({ lang: 'en', setLang: () => {} });

export const I18nProvider = ({ children }) => {
  const [lang, setLangState] = useState(current);

  useEffect(() => {
    current = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    if (lang === 'ur') startTranslating();
    return () => {
      if (lang === 'ur') stopTranslating();
    };
  }, [lang]);

  const setLang = useCallback((l) => {
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* private mode */
    }
    setLangState(l);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
};

export const useLang = () => useContext(LangContext);

// Shows the other language's name in its own script
export const LangToggle = ({ className = 'btn btn-ghost btn-sm lang-toggle' }) => {
  const { lang, setLang } = useLang();
  return (
    <button type="button" className={className} onClick={() => setLang(lang === 'ur' ? 'en' : 'ur')} aria-label={lang === 'ur' ? 'Switch to English' : 'اردو میں دیکھیں'} data-no-translate>
      {lang === 'ur' ? 'English' : 'اردو'}
    </button>
  );
};
