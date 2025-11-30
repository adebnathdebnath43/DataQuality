import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import QualityScoreChart from '../components/QualityScoreChart';
import './Dashboard.css';

const Dashboard = () => {
    const [connectedSources, setConnectedSources] = React.useState([]);
    const [qualityCheckResults, setQualityCheckResults] = React.useState(null);

    React.useEffect(() => {
        const sources = JSON.parse(localStorage.getItem('connectedSources') || '[]');
        setConnectedSources(sources);

        // Load quality check results from localStorage
        if (sources.length > 0) {
            const sourceId = sources[0].id;
            const savedResults = localStorage.getItem(`qualityCheckResults_${sourceId}`);
            if (savedResults) {
                try {
                    setQualityCheckResults(JSON.parse(savedResults));
                } catch (e) {
                    console.error('Error parsing saved results:', e);
                }
            }
        }
    }, []);

    // Calculate stats from quality check results
    const totalScans = qualityCheckResults?.files?.length || 0;
    const successfulScans = qualityCheckResults?.files?.filter(f => f.status === 'success').length || 0;
    const avgQuality = totalScans > 0
        ? Math.round(qualityCheckResults.files.reduce((sum, f) => sum + (f.quality_score || 0), 0) / totalScans)
        : 0;
    const recentScans = qualityCheckResults?.files || [];

    return (
        <div className="dashboard fade-in">
            <section className="hero-section">
                <h1 className="hero-title">
                    Aether <span className="text-gradient">Intelligence</span>
                </h1>
                <p className="hero-subtitle">
                    Data Clarity at Scale. Monitor, validate, and improve your data assets across all your cloud platforms.
                </p>
                <div className="hero-actions">
                    <Link to="/connect">
                        <Button variant="primary">Connect New Source</Button>
                    </Link>
                    {connectedSources.length > 0 && (
                        <Link to={`/source/${connectedSources[0].id}`}>
                            <Button variant="secondary">Run Quality Check</Button>
                        </Link>
                    )}
                </div>
            </section>

            <section className="stats-grid">
                <Card title="Data Health Score">
                    <div className={`stat-value ${avgQuality >= 80 ? 'text-gradient' : avgQuality >= 60 ? 'good' : 'warning'}`}>
                        {avgQuality > 0 ? `${avgQuality}%` : 'N/A'}
                    </div>
                    <p className="stat-desc">
                        {totalScans > 0
                            ? `Based on ${totalScans} quality check${totalScans > 1 ? 's' : ''}`
                            : 'Run a quality check to see your score'}
                    </p>
                </Card>
                <Card title="Total Scans">
                    <div className="stat-value">{totalScans}</div>
                    <p className="stat-desc">Quality checks completed</p>
                </Card>
                <Card title="Successful Scans">
                    <div className="stat-value text-gradient">{successfulScans}</div>
                    <p className="stat-desc">
                        {totalScans - successfulScans > 0
                            ? `${totalScans - successfulScans} failed`
                            : 'All scans successful'}
                    </p>
                </Card>
            </section>

            {recentScans.length > 0 && (
                <>
                    <QualityScoreChart scans={recentScans} />

                    <section className="recent-scans-section">
                        <h2 className="section-title">Recent Quality Checks</h2>
                        <div className="scans-list glass-panel">
                            {recentScans.map((scan, index) => {
                                const score = scan.quality_score || 0;
                                const scoreClass = score >= 80 ? 'excellent' :
                                    score >= 60 ? 'good' :
                                        score >= 40 ? 'fair' : 'poor';
                                const timeAgo = getTimeAgo(scan.processed_at);

                                return (
                                    <div key={index} className="scan-item">
                                        <div className="scan-icon">
                                            <span className={`quality-badge ${scoreClass}`}>{score}</span>
                                        </div>
                                        <div className="scan-details">
                                            <h4>{scan.file_name}</h4>
                                            <p>{scan.summary || 'Quality check completed'} • {timeAgo}</p>
                                        </div>
                                        <div className={`scan-status ${scan.status}`}>
                                            {scan.status === 'success' ? '✓' : '!'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </>
            )}

            {connectedSources.length > 0 && (
                <section className="connected-sources" style={{ marginBottom: '4rem' }}>
                    <h2 className="section-title">Connected Sources</h2>
                    <div className="sources-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', display: 'grid', gap: '1.5rem' }}>
                        {connectedSources.map((source) => {
                            // Format the source name better
                            const displayName = source.sourceName.replace(/_/g, ' ').replace(/S3 /g, 'S3: ');

                            return (
                                <Link key={source.id} to={`/source/${source.id}`} style={{ textDecoration: 'none' }}>
                                    <Card className="source-card source-card-interactive">
                                        <div className="source-icon" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{source.icon}</div>
                                        <h3 className="source-name" style={{
                                            fontSize: '1rem',
                                            marginBottom: '0.75rem',
                                            wordBreak: 'break-word',
                                            lineHeight: '1.4'
                                        }}>
                                            {displayName}
                                        </h3>
                                        {source.bucket && (
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--text-secondary)',
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                marginBottom: '0.5rem',
                                                fontFamily: 'monospace'
                                            }}>
                                                📦 {source.bucket}
                                            </div>
                                        )}
                                        {source.region && (
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                                🌍 {source.region}
                                            </p>
                                        )}
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            🔗 Connected: {new Date(source.connectedAt).toLocaleDateString()}
                                        </p>
                                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                                            <span className="badge success" style={{
                                                background: 'rgba(16, 185, 129, 0.2)',
                                                color: '#10b981',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem'
                                            }}>✓ Active</span>
                                        </div>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            )}

            {connectedSources.length === 0 && (
                <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <h2 style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>No Sources Connected</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                        Connect an S3 bucket to start monitoring your data quality
                    </p>
                    <Link to="/connect">
                        <Button variant="primary">Connect Your First Source</Button>
                    </Link>
                </section>
            )}
        </div>
    );
};

// Helper function to calculate time ago
function getTimeAgo(timestamp) {
    if (!timestamp) return 'Recently';
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export default Dashboard;
