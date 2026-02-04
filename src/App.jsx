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

    addLog("Starting indexing process...");

    for (let i = 0; i < urls.length; i++) {
      const currentUrl = urls[i].url;
      setProgress(prev => ({ ...prev, current: i + 1 }));
      addLog(`Processing [${i + 1}/${urls.length}]: ${currentUrl}`);

      const platformResults = { google: 'pending', bing: 'pending', naver: 'pending' };

      try {
        const results = await Promise.allSettled([
          submitToGoogle(currentUrl),
          submitToBing(currentUrl),
          submitToNaver(currentUrl)
        ]);

        // Process Google result
        if (results[0].status === 'fulfilled' && results[0].value?.status === 'success') {
          platformResults.google = 'success';
          stats.google.success++;
          addLog(`  ✓ Google: Success`, 'success');
        } else {
          platformResults.google = 'failed';
          stats.google.failed++;
          addLog(`  ✗ Google: ${results[0].reason || results[0].value?.message || 'Failed'}`, 'warning');
        }
        stats.google.submitted++;

        // Process Bing result
        if (results[1].status === 'fulfilled' && results[1].value?.status === 'success') {
          platformResults.bing = 'success';
          stats.bing.success++;
          addLog(`  ✓ Bing: Success`, 'success');
        } else {
          platformResults.bing = 'failed';
          stats.bing.failed++;
          addLog(`  ✗ Bing: ${results[1].reason || results[1].value?.message || 'Failed'}`, 'warning');
        }
        stats.bing.submitted++;

        // Process Naver result
        if (results[2].status === 'fulfilled' && results[2].value?.status === 'success') {
          platformResults.naver = 'success';
          stats.naver.success++;
          addLog(`  ✓ Naver: Success`, 'success');
        } else {
          platformResults.naver = 'failed';
          stats.naver.failed++;
          addLog(`  ✗ Naver: ${results[2].reason || results[2].value?.message || 'Failed'}`, 'warning');
        }
        stats.naver.submitted++;

        // Update URL status
        const allSuccess = Object.values(platformResults).every(s => s === 'success');
        const allFailed = Object.values(platformResults).every(s => s === 'failed');

        setUrls(prev => {
          const newUrls = [...prev];
          newUrls[i].status = allSuccess ? 'success' : allFailed ? 'failed' : 'partial';
          newUrls[i].platforms = platformResults;
          return newUrls;
        });

        if (allSuccess) {
          setProgress(prev => ({ ...prev, success: prev.success + 1 }));
        } else {
          setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
        }

      } catch (error) {
        addLog(`  ✗ Critical Error: ${error.message}`, 'error');
      }

      setPlatformStats({ ...stats });
      await new Promise(r => setTimeout(r, 200));
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

  const submitToGoogle = async (url) => {
    const res = await fetch('/submit-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url] })
    });
    const data = await res.json().catch(() => ({ message: res.statusText }));
    if (!res.ok) throw new Error(`Google: ${data.message || res.statusText || 'Unknown error'}`);
    return data;
  };

  const submitToBing = async (url) => {
    const res = await fetch('/submit-bing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url] })
    });
    const data = await res.json().catch(() => ({ message: res.statusText }));
    if (!res.ok) throw new Error(`Bing: ${data.message || res.statusText || 'Unknown error'}`);
    return data;
  };

  const submitToNaver = async (url) => {
    const res = await fetch('/submit-naver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url] })
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
