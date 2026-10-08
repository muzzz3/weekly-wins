import { useRef, useEffect, useState } from 'preact/hooks';
import type { NewsArticle } from './types.js';
import styles from './ArticleViewer.module.css';

interface ArticleViewerProps {
  article: NewsArticle;
  onClose: () => void;
}

export function ArticleViewer({ article, onClose }: ArticleViewerProps) {
  const webviewRef = useRef<Electron.WebviewTag>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(article.link);
  const [closing, setClosing] = useState(false);

  function dismiss() {
    setClosing(true);
    setTimeout(onClose, 195);
  }

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    const shadow = wv.shadowRoot;
    if (shadow) {
      const s = document.createElement('style');
      s.textContent = ':host { height: 100% !important; } iframe { height: 100% !important; }';
      shadow.appendChild(s);
    }
  }, []);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const onStart = () => setLoading(true);
    const onStop = () => {
      setLoading(false);
      setCanGoBack(wv.canGoBack());
      setCanGoForward(wv.canGoForward());
      setCurrentUrl(wv.getURL());
    };
    // Intercept new-window events (target="_blank", window.open, etc.)
    // and navigate within the webview instead of opening system browser
    const onNewWindow = (e: Event) => {
      const url = (e as any).url as string;
      if (url) wv.loadURL(url);
    };

    wv.addEventListener('did-start-loading', onStart);
    wv.addEventListener('did-stop-loading', onStop);
    wv.addEventListener('new-window', onNewWindow);
    return () => {
      wv.removeEventListener('did-start-loading', onStart);
      wv.removeEventListener('did-stop-loading', onStop);
      wv.removeEventListener('new-window', onNewWindow);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function goBack() {
    const wv = webviewRef.current;
    if (wv?.canGoBack()) wv.goBack();
  }

  function goForward() {
    const wv = webviewRef.current;
    if (wv?.canGoForward()) wv.goForward();
  }

  function reload() {
    webviewRef.current?.reload();
  }

  function openExternal() {
    window.api.openLink(currentUrl);
  }

  // Truncate URL for display
  const displayUrl = (() => {
    try {
      const u = new URL(currentUrl);
      return u.hostname + u.pathname.slice(0, 40) + (u.pathname.length > 40 ? '…' : '');
    } catch {
      return currentUrl;
    }
  })();

  return (
    <div class={styles.overlay}>
      <div class={`${styles.panel} ${closing ? styles.panelClosing : ''}`}>
        {/* Toolbar */}
        <div class={styles.toolbar}>
          <button class={styles.toolBtn} onClick={dismiss} title="Close (Esc)">✕</button>
          <div class={styles.navBtns}>
            <button class={styles.toolBtn} onClick={goBack} disabled={!canGoBack} title="Back">‹</button>
            <button class={styles.toolBtn} onClick={goForward} disabled={!canGoForward} title="Forward">›</button>
          </div>
          <div class={styles.urlBar}>
            <span class={styles.sourceLabel}>{article.source}</span>
            <span class={styles.urlText}>{displayUrl}</span>
          </div>
          <button class={styles.toolBtn} onClick={reload} title="Reload">↻</button>
          <button class={styles.externalBtn} onClick={openExternal} title="Open in browser">↗</button>
        </div>

        {/* Loading bar */}
        {loading && <div class={styles.loadingBar}><div class={styles.loadingProgress} /></div>}

        {/* Webview wrapper — forces webview to fill remaining height */}
        <div class={styles.webviewWrap}>
          <webview
            ref={webviewRef}
            src={article.link}
            class={styles.webview}
            useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
          />
        </div>
      </div>
    </div>
  );
}
