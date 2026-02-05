import { useState, useRef, useEffect } from 'react';
import { SitemapParser } from './parser';
import { Globe, Search, Send, CheckCircle, AlertCircle, Terminal, ExternalLink, Copy, RefreshCw } from 'lucide-react';

function App() {
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploadMode, setIsUploadMode] = useState(false);
  const [urls, setUrls] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [progress, setProgress] = useState({ total: 0, current: 0, success: 0, failed: 0 });
  const [indexingDone, setIndexingDone] = useState(false);

  // Platform-specific stats
  const [platformStats, setPlatformStats] = useState({
    google: { submitted: 0, success: 0, failed: 0 },
    bing: { submitted: 0, success: 0, failed: 0 },
    naver: { submitted: 0, success: 0, failed: 0 }
  });

  const logEndRef = useRef(null);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleParse = async () => {
    if (!isUploadMode && !sitemapUrl) {
      addLog("Please enter a URL", 'warning');
      return;
    }
    if (isUploadMode && !uploadFile) {
      addLog("Please select a file", 'warning');
      return;
    }

    setIsParsing(true);
    setUrls([]);
    setLogs([]);
    setIndexingDone(false);
    setPlatformStats({
      google: { submitted: 0, success: 0, failed: 0 },
      bing: { submitted: 0, success: 0, failed: 0 },
      naver: { submitted: 0, success: 0, failed: 0 }
    });

    try {
      const parser = new SitemapParser();
      let extractedUrls = [];

      if (isUploadMode) {
        addLog(`Reading uploaded file: ${uploadFile.name}...`);
        extractedUrls = await parser.parseXmlFile(uploadFile);
      } else {
        addLog(`Fetching sitemap from ${sitemapUrl}...`);
        extractedUrls = await parser.fetchAndParse(sitemapUrl);
      }

      setUrls(extractedUrls.map(url => ({
        url,
        status: 'pending',
        platforms: { google: 'pending', bing: 'pending', naver: 'pending' }
      })));
      addLog(`Successfully parsed ${extractedUrls.length} URLs.`, 'success');
    } catch (error) {
      addLog(`Error parsing sitemap: ${error.message}.`, 'error');
    } finally {
      setIsParsing(false);
    }
  };

  // Helper: Chunk array into batches
  const chunkArray = (arr, size) => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
      arr.slice(i * size, i * size + size)
    );
  };

  const handleIndex = async () => {
    if (urls.length === 0) return;
    setIsIndexing(true);
    setIndexingDone(false);
    setProgress({ total: urls.length, current: 0, success: 0, failed: 0 });

    const stats = {
      google: { submitted: 0, success: 0, failed: 0 },
      bing: { submitted: 0, success: 0, failed: 0 },
      naver: { submitted: 0, success: 0, failed: 0 }
    };

    addLog("Starting indexing process (Batch Mode)...");

    // Process in batches of 50
    const BATCH_SIZE = 50;
    const batches = chunkArray(urls, BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batchUrls = batches[batchIdx];
      const batchUrlStrings = batchUrls.map(u => u.url);

      const startIdx = batchIdx * BATCH_SIZE;
      addLog(`Processing Batch ${batchIdx + 1}/${batches.length} (${batchUrlStrings.length} URLs)...`);

      try {
        const results = await Promise.allSettled([
          submitToGoogle(batchUrlStrings),
          submitToBing(batchUrlStrings),
          submitToNaver(batchUrlStrings)
        ]);

        // --- Process Google Results ---
        if (results[0].status === 'fulfilled' && results[0].value?.results) {
          results[0].value.results.forEach((res, idx) => {
            const globalIdx = startIdx + idx;
            if (res.status === 'success') {
              stats.google.success++;
              setUrls(prev => { const n = [...prev]; n[globalIdx].platforms.google = 'success'; return n; });
            } else {
              stats.google.failed++;
              const msg = res.apiResponse?.error?.message || 'Failed';
              addLog(`  ✗ Google [${batchUrlStrings[idx]}]: ${msg}`, 'warning');
              setUrls(prev => { const n = [...prev]; n[globalIdx].platforms.google = 'failed'; return n; });
            }
          });
          if (results[0].value.status === 'success') addLog(`  ✓ Google: Batch Success`, 'success');
        } else {
          // Whole batch failed
          stats.google.failed += batchUrlStrings.length;
          const errorMsg = results[0].reason?.message || results[0].value?.message || 'Unknown Batch Error';
          addLog(`  ✗ Google Batch Failed: ${errorMsg}`, 'error');
          batchUrlStrings.forEach((_, idx) => {
            setUrls(prev => { const n = [...prev]; n[startIdx + idx].platforms.google = 'failed'; return n; });
          });
        }
        stats.google.submitted += batchUrlStrings.length;


        // --- Process Bing Results ---
        if (results[1].status === 'fulfilled' && results[1].value?.status === 'success') {
          stats.bing.success += batchUrlStrings.length;
          batchUrlStrings.forEach((_, idx) => {
            setUrls(prev => { const n = [...prev]; n[startIdx + idx].platforms.bing = 'success'; return n; });
          });
          addLog(`  ✓ Bing: Batch Success`, 'success');
        } else {
          stats.bing.failed += batchUrlStrings.length;
          const errorMsg = results[1].reason?.message || results[1].value?.message || 'Failed';
          addLog(`  ✗ Bing Batch Failed: ${errorMsg}`, 'warning');
          batchUrlStrings.forEach((_, idx) => {
            setUrls(prev => { const n = [...prev]; n[startIdx + idx].platforms.bing = 'failed'; return n; });
          });
        }
        stats.bing.submitted += batchUrlStrings.length;

        // --- Process Naver Results ---
        if (results[2].status === 'fulfilled' && results[2].value?.status === 'success') {
          stats.naver.success += batchUrlStrings.length;
          batchUrlStrings.forEach((_, idx) => {
            setUrls(prev => { const n = [...prev]; n[startIdx + idx].platforms.naver = 'success'; return n; });
          });
          addLog(`  ✓ Naver: Batch Success`, 'success');
        } else {
          stats.naver.failed += batchUrlStrings.length;
          const errorMsg = results[2].reason?.message || results[2].value?.message || 'Failed';
          addLog(`  ✗ Naver Batch Failed: ${errorMsg}`, 'warning');
          batchUrlStrings.forEach((_, idx) => {
            setUrls(prev => { const n = [...prev]; n[startIdx + idx].platforms.naver = 'failed'; return n; });
          });
        }
        stats.naver.submitted += batchUrlStrings.length;

        // Update Progress UI
        setProgress(prev => ({
          ...prev,
          current: Math.min(prev.total, startIdx + batchUrlStrings.length),
          // Rough estimation for progress bar success/fail based on overall batch success
          success: prev.success + (results.every(r => r.status === 'fulfilled' && r.value?.status === 'success') ? batchUrlStrings.length : 0),
          failed: prev.failed + (results.some(r => r.status === 'rejected' || r.value?.status !== 'success') ? batchUrlStrings.length : 0)
        }));

      } catch (error) {
        addLog(`  ✗ Critical Batch Error: ${error.message}`, 'error');
      }

      setPlatformStats({ ...stats });
      await new Promise(r => setTimeout(r, 1000)); // 1s delay between batches
    }

    setIsIndexing(false);
    setIndexingDone(true);
    addLog("Indexing process completed!", 'success');
    addLog(`Summary: Google ${stats.google.success}/${stats.google.submitted}, Bing ${stats.bing.success}/${stats.bing.submitted}, Naver ${stats.naver.success}/${stats.naver.submitted}`, 'success');
  };

  const generateCheckLinks = (url) => {
    const encoded = encodeURIComponent(url);
    return {
      google: `https://www.google.com/search?q=site:${encoded}`,
      bing: `https://www.bing.com/search?q=site:${encoded}`,
      naver: `https://search.naver.com/search.naver?query=site:${encoded}`
    };
  };

  const copyLogs = () => {
    const logText = logs.map(l => `[${l.timestamp}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(logText);
    addLog('Logs copied to clipboard!', 'success');
  };

  // Updated submit functions to accept array of URLs
  const submitToGoogle = async (urls) => {
    const res = await fetch('/submit-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }) // Sending array
    });
    const data = await res.json().catch(() => ({ message: res.statusText }));
    if (!res.ok) throw new Error(`Google: ${data.message || res.statusText || 'Unknown error'}`);
    return data;
  };

  const submitToBing = async (urls) => {
    const res = await fetch('/submit-bing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }) // Sending array
    });
    const data = await res.json().catch(() => ({ message: res.statusText }));
    if (!res.ok) throw new Error(`Bing: ${data.message || res.statusText || 'Unknown error'}`);
    return data;
  };

  const submitToNaver = async (urls) => {
    const res = await fetch('/submit-naver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }) // Sending array
    });
    const data = await res.json().catch(() => ({ message: res.statusText }));
    if (!res.ok) throw new Error(`Naver: ${data.message || res.statusText || 'Unknown error'}`);
    return data;
  };

  return (
    <div className="container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Globe size={40} color="#818cf8" />
          <h1>Auto Indexer</h1>
        </div>
        <p style={{ color: '#94a3b8' }}>Submit your sitemap to Google, Bing, and Naver instantly.</p>
      </header>

      <div className="card">
        <h2><Search size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Sitemap Input</h2>

        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
          <label style={{ cursor: 'pointer' }}>
            <input type="radio" name="mode" checked={!isUploadMode} onChange={() => setIsUploadMode(false)} /> URL
          </label>
          <label style={{ cursor: 'pointer' }}>
            <input type="radio" name="mode" checked={isUploadMode} onChange={() => setIsUploadMode(true)} /> Upload File
          </label>
        </div>

        <div className="input-group">
          {!isUploadMode ? (
            <input
              type="text"
              placeholder="https://example.com/sitemap.xml"
              value={sitemapUrl}
              onChange={(e) => setSitemapUrl(e.target.value)}
            />
          ) : (
            <input
              type="file"
              accept=".xml"
              onChange={(e) => setUploadFile(e.target.files[0])}
              style={{ color: 'white' }}
            />
          )}

          <button onClick={handleParse} disabled={isParsing || isIndexing}>
            {isParsing ? 'Parsing...' : 'Fetch & Parse'}
          </button>
        </div>

        {urls.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Found {urls.length} URLs</h3>
              <button onClick={handleIndex} disabled={isIndexing}>
                <Send size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                {isIndexing ? 'Indexing...' : 'Start Indexing'}
              </button>
            </div>

            {/* Progress Stats */}
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{progress.current} / {progress.total}</div>
                <div className="stat-label">Processed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: '#10b981' }}>{progress.success}</div>
                <div className="stat-label">All Success</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: '#ef4444' }}>{progress.failed}</div>
                <div className="stat-label">Partial/Failed</div>
              </div>
            </div>

            {/* Platform Stats - Show after indexing starts */}
            {(isIndexing || indexingDone) && (
              <div className="platform-stats">
                <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: '#94a3b8' }}>Platform Breakdown</h4>
                <div className="stats-grid">
                  <div className="stat-item platform-google">
                    <div className="stat-value">
                      <span style={{ color: '#10b981' }}>{platformStats.google.success}</span>
                      <span style={{ color: '#64748b' }}> / </span>
                      <span>{platformStats.google.submitted}</span>
                    </div>
                    <div className="stat-label">🔴 Google</div>
                  </div>
                  <div className="stat-item platform-bing">
                    <div className="stat-value">
                      <span style={{ color: '#10b981' }}>{platformStats.bing.success}</span>
                      <span style={{ color: '#64748b' }}> / </span>
                      <span>{platformStats.bing.submitted}</span>
                    </div>
                    <div className="stat-label">🔵 Bing</div>
                  </div>
                  <div className="stat-item platform-naver">
                    <div className="stat-value">
                      <span style={{ color: '#10b981' }}>{platformStats.naver.success}</span>
                      <span style={{ color: '#64748b' }}> / </span>
                      <span>{platformStats.naver.submitted}</span>
                    </div>
                    <div className="stat-label">🟢 Naver</div>
                  </div>
                </div>
              </div>
            )}

            {/* URL List with Check Links */}
            <div className="url-list">
              {urls.map((u, i) => (
                <div key={i} className="url-item-expanded">
                  <div className="url-main">
                    <span title={u.url} className="url-text">
                      {u.url}
                    </span>
                    <span className={`status-badge status-${u.status}`}>
                      {u.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Platform status and check links */}
                  {u.platforms && (
                    <div className="platform-icons">
                      <span className={`platform-status ${u.platforms.google}`} title={`Google: ${u.platforms.google}`}>
                        G
                      </span>
                      <span className={`platform-status ${u.platforms.bing}`} title={`Bing: ${u.platforms.bing}`}>
                        B
                      </span>
                      <span className={`platform-status ${u.platforms.naver}`} title={`Naver: ${u.platforms.naver}`}>
                        N
                      </span>

                      {/* Check Index Links - appear after indexing done */}
                      {indexingDone && (
                        <div className="check-links">
                          <a href={generateCheckLinks(u.url).google} target="_blank" rel="noopener noreferrer" title="Check on Google">
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bulk Check Index Status */}
            {indexingDone && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#0f172a', borderRadius: '8px' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  💡 <strong>Tip:</strong> Click the <ExternalLink size={12} style={{ verticalAlign: 'middle' }} /> icon next to each URL to check if it's indexed on Google.
                </p>
                <p style={{ color: '#64748b', fontSize: '0.8rem' }}>
                  Note: Indexing may take a few minutes to several days depending on the search engine.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2><Terminal size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Live Logs</h2>
          {logs.length > 0 && (
            <button onClick={copyLogs} style={{ padding: '0.5rem 1rem', background: '#334155' }}>
              <Copy size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Copy Logs
            </button>
          )}
        </div>
        <div className="log-console">
          {logs.length === 0 && <span style={{ color: '#555' }}>Ready to start...</span>}
          {logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>
              <span style={{ color: '#555' }}>[{log.timestamp}]</span>{' '}
              <span style={{ color: log.type === 'error' ? '#ef4444' : log.type === 'warning' ? '#f59e0b' : log.type === 'success' ? '#10b981' : '#00ff00' }}>
                {log.message}
              </span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

export default App;
