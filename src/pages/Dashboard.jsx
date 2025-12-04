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
    const [selectedBucket, setSelectedBucket] = useState('all');
    const [selectedAction, setSelectedAction] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

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

    // Get unique buckets from file keys
    const getUniqueBuckets = () => {
        if (!dashboardMetrics?.recent_files) return [];
        const buckets = new Set();
        dashboardMetrics.recent_files.forEach(file => {
            const fileKey = file.file_key || '';
            if (fileKey.startsWith('s3://')) {
                const bucket = fileKey.split('/')[2];
                if (bucket) buckets.add(bucket);
            }
        });
        return Array.from(buckets);
    };

    // Filter files based on selected filters
    const getFilteredFiles = () => {
        if (!dashboardMetrics?.recent_files) return [];
        
        return dashboardMetrics.recent_files.filter(file => {
            // Filter by bucket
            if (selectedBucket !== 'all') {
                const fileKey = file.file_key || '';
                const bucket = fileKey.startsWith('s3://') ? fileKey.split('/')[2] : '';
                if (bucket !== selectedBucket) return false;
            }

            // Filter by action
            if (selectedAction !== 'all' && file.recommended_action !== selectedAction) {
                return false;
            }

            // Filter by search term
            if (searchTerm && !file.file_name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }

            return true;
        });
    };

    const uniqueBuckets = dashboardMetrics ? getUniqueBuckets() : [];
    const filteredFiles = dashboardMetrics ? getFilteredFiles() : [];
    const avgQualityScore = dashboardMetrics?.last_7_days.length > 0
        ? Math.round(dashboardMetrics.last_7_days.reduce((sum, day) => sum + day.avg_quality_score, 0) / dashboardMetrics.last_7_days.length)
        : 0;

    return (
        <div className="dashboard fade-in">
            <section className="hero-section">
                <h1 className="hero-title">
                    <span className="text-gradient">Data Quality</span> Dashboard
                </h1>
                <p className="hero-subtitle">
                    Monitor and validate your data assets with AI-powered quality assessment
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
                            <div className="stat-value" style={{ fontSize: '1.5rem', color: '#60a5fa' }}>
                                {dashboardMetrics.bucket_name !== 'N/A' ? dashboardMetrics.bucket_name : 'No bucket connected'}
                            </div>
                            <p className="stat-desc">Connected source</p>
                        </Card>

                        <Card title="Average Quality Score">
                            <div className="stat-value" style={{ color: getScoreColor(avgQualityScore) }}>
                                {avgQualityScore}%
                            </div>
                            <p className="stat-desc">Across all files</p>
                        </Card>
                    </section>

                    {/* Last 7 Days Trend */}
                    {dashboardMetrics.last_7_days.length > 0 && (
                        <section className="quality-trend-section">
                            <h2 className="section-title">Quality Score Trend (Last 7 Days)</h2>
                            <div className="glass-panel trend-chart">
                                <div className="chart-container">
                                    {dashboardMetrics.last_7_days.map((day, index) => (
                                        <div key={index} className="chart-bar">
                                            <div className="bar-value"
                                                style={{
                                                    height: `${(day.avg_quality_score / 100) * 180}px`,
                                                    background: `linear-gradient(180deg, ${getScoreColor(day.avg_quality_score)}, ${getScoreColor(day.avg_quality_score)}dd)`
                                                }}>
                                                <span className="bar-label">{day.avg_quality_score}</span>
                                            </div>
                                            <div className="bar-date">
                                                {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="bar-count">
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
                            <div className="glass-panel dimension-grid">
                                {Object.entries(dashboardMetrics.avg_dimension_scores)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([dimName, score]) => (
                                        <div key={dimName} className="dimension-card">
                                            <div className="dimension-name">
                                                {dimName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                            </div>
                                            <div className="dimension-score" style={{ color: getScoreColor(score) }}>
                                                {score}<span style={{ fontSize: '1rem', opacity: 0.7 }}>/100</span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </section>
                    )}

                    {/* Recent Files with Filters */}
                    {dashboardMetrics.recent_files.length > 0 && (
                        <section className="recent-files-section">
                            <h2 className="section-title">Recent Quality Checks</h2>
                            
                            {/* Filters */}
                            <div className="filters-container glass-panel">
                                <div className="filter-group">
                                    <label>🔍 Search Files</label>
                                    <input
                                        type="text"
                                        placeholder="Search by filename..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="filter-input"
                                    />
                                </div>

                                <div className="filter-group">
                                    <label>🪣 S3 Bucket</label>
                                    <select
                                        value={selectedBucket}
                                        onChange={(e) => setSelectedBucket(e.target.value)}
                                        className="filter-select"
                                    >
                                        <option value="all">All Buckets</option>
                                        {uniqueBuckets.map(bucket => (
                                            <option key={bucket} value={bucket}>{bucket}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="filter-group">
                                    <label>⚡ Recommended Action</label>
                                    <select
                                        value={selectedAction}
                                        onChange={(e) => setSelectedAction(e.target.value)}
                                        className="filter-select"
                                    >
                                        <option value="all">All Actions</option>
                                        <option value="KEEP">KEEP</option>
                                        <option value="REVIEW">REVIEW</option>
                                        <option value="QUARANTINE">QUARANTINE</option>
                                        <option value="DISCARD">DISCARD</option>
                                    </select>
                                </div>

                                <div className="filter-results">
                                    Showing <strong>{filteredFiles.length}</strong> of <strong>{dashboardMetrics.recent_files.length}</strong> files
                                </div>
                            </div>

                            {/* Files Table */}
                            <div className="glass-panel files-table-container">
                                <table className="files-table">
                                    <thead>
                                        <tr>
                                            <th>File Name</th>
                                            <th>Quality Score</th>
                                            <th>Action</th>
                                            <th>Processed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredFiles.length > 0 ? (
                                            filteredFiles.map((file, index) => (
                                                <tr key={index}>
                                                    <td className="file-name-cell">
                                                        <div className="file-name-wrapper">
                                                            <span className="file-icon">📄</span>
                                                            <span className="file-name-text">{file.file_name}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="score-badge"
                                                            style={{
                                                                background: getScoreColor(file.quality_score),
                                                            }}>
                                                            {file.quality_score}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="action-badge"
                                                            style={{
                                                                background: getActionColor(file.recommended_action),
                                                            }}>
                                                            {file.recommended_action}
                                                        </span>
                                                    </td>
                                                    <td className="date-cell">
                                                        {new Date(file.processed_at).toLocaleString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                    No files match the selected filters
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}
                </>
            ) : (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📊</div>
                    <p style={{ color: '#94a3b8', fontSize: '1.125rem', marginBottom: '1rem' }}>
                        No quality check data available yet
                    </p>
                    <p style={{ color: '#64748b', marginBottom: '2rem' }}>
                        Run your first quality check to see comprehensive metrics and insights
                    </p>
                    {connectedSources.length > 0 && (
                        <Link to={`/source/${connectedSources[0].id}`}>
                            <Button variant="primary">Run Quality Check</Button>
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
