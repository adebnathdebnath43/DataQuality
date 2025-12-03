import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import api from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
    const [connectedSources, setConnectedSources] = useState([]);
    const [dashboardMetrics, setDashboardMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const sources = JSON.parse(localStorage.getItem('connectedSources') || '[]');
        setConnectedSources(sources);

        // Fetch dashboard metrics from backend
        fetchDashboardMetrics();
    }, []);

    const fetchDashboardMetrics = async () => {
        try {
            const response = await api.get('/dashboard-metrics');
            setDashboardMetrics(response.data);
        } catch (error) {
            console.error('Error fetching dashboard metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 90) return '#10b981';
        if (score >= 70) return '#f59e0b';
        if (score >= 50) return '#f97316';
        return '#ef4444';
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'KEEP': return '#10b981';
            case 'REVIEW': return '#f59e0b';
            case 'QUARANTINE': return '#f97316';
            case 'DISCARD': return '#ef4444';
            default: return '#6b7280';
        }
    };

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

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    Loading dashboard metrics...
                </div>
            ) : dashboardMetrics ? (
                <>
                    {/* Stats Grid */}
                    <section className="stats-grid">
                        <Card title="Total Files Processed">
                            <div className="stat-value text-gradient">
                                {dashboardMetrics.total_files_processed}
                            </div>
                            <p className="stat-desc">Last 7 days</p>
                        </Card>

                        <Card title="S3 Bucket">
                            <div className="stat-value" style={{ fontSize: '1.5rem', color: '#3b82f6' }}>
                                {dashboardMetrics.bucket_name}
                            </div>
                            <p className="stat-desc">Connected source</p>
                        </Card>

                        <Card title="Average Quality Score">
                            <div className="stat-value">
                                {dashboardMetrics.last_7_days.length > 0
                                    ? Math.round(dashboardMetrics.last_7_days.reduce((sum, day) => sum + day.avg_quality_score, 0) / dashboardMetrics.last_7_days.length)
                                    : 0}%
                            </div>
                            <p className="stat-desc">Across all files</p>
                        </Card>
                    </section>

                    {/* Last 7 Days Trend */}
                    {dashboardMetrics.last_7_days.length > 0 && (
                        <section className="quality-trend-section">
                            <h2 className="section-title">Quality Score Trend (Last 7 Days)</h2>
                            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', height: '200px' }}>
                                    {dashboardMetrics.last_7_days.map((day, index) => (
                                        <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{
                                                height: `${day.avg_quality_score * 2}px`,
                                                width: '100%',
                                                background: getScoreColor(day.avg_quality_score),
                                                borderRadius: '4px 4px 0 0',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                justifyContent: 'center',
                                                padding: '0.5rem 0',
                                                color: 'white',
                                                fontWeight: 'bold',
                                                fontSize: '0.875rem'
                                            }}>
                                                {day.avg_quality_score}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
                                                {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                {day.files_processed} files
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Average Dimension Scores */}
                    {Object.keys(dashboardMetrics.avg_dimension_scores).length > 0 && (
                        <section className="dimension-scores-section">
                            <h2 className="section-title">Average Dimension Scores</h2>
                            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                    {Object.entries(dashboardMetrics.avg_dimension_scores).map(([dimName, score]) => (
                                        <div key={dimName} style={{
                                            background: 'rgba(15, 23, 42, 0.5)',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            border: '1px solid #334155'
                                        }}>
                                            <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                                                {dimName.replace(/_/g, ' ')}
                                            </div>
                                            <div style={{
                                                fontSize: '1.5rem',
                                                fontWeight: 'bold',
                                                color: getScoreColor(score)
                                            }}>
                                                {score}/100
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Recent Files */}
                    {dashboardMetrics.recent_files.length > 0 && (
                        <section className="recent-files-section">
                            <h2 className="section-title">Recent Quality Checks</h2>
                            <div className="glass-panel">
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #334155' }}>
                                            <th style={{ padding: '1rem', textAlign: 'left', color: '#94a3b8', fontWeight: 600 }}>File Name</th>
                                            <th style={{ padding: '1rem', textAlign: 'left', color: '#94a3b8', fontWeight: 600 }}>Quality Score</th>
                                            <th style={{ padding: '1rem', textAlign: 'left', color: '#94a3b8', fontWeight: 600 }}>Action</th>
                                            <th style={{ padding: '1rem', textAlign: 'left', color: '#94a3b8', fontWeight: 600 }}>Processed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dashboardMetrics.recent_files.map((file, index) => (
                                            <tr key={index} style={{ borderBottom: '1px solid #334155' }}>
                                                <td style={{ padding: '1rem', color: '#e2e8f0' }}>{file.file_name}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{
                                                        background: getScoreColor(file.quality_score),
                                                        color: 'white',
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '6px',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {file.quality_score}/100
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{
                                                        background: getActionColor(file.recommended_action),
                                                        color: 'white',
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.875rem',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {file.recommended_action}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                                                    {new Date(file.processed_at).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}
                </>
            ) : (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: '#94a3b8', fontSize: '1.125rem' }}>
                        No quality check data available. Run a quality check to see metrics.
                    </p>
                    {connectedSources.length > 0 && (
                        <Link to={`/source/${connectedSources[0].id}`}>
                            <Button variant="primary" style={{ marginTop: '1rem' }}>Run Quality Check</Button>
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
