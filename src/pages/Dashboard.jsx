import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import './Dashboard.css';

const Dashboard = () => {
    const [connectedSources, setConnectedSources] = React.useState([]);

    React.useEffect(() => {
        const sources = JSON.parse(localStorage.getItem('connectedSources') || '[]');
        setConnectedSources(sources);
    }, []);

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
                    <Button variant="secondary">View Reports</Button>
                </div>
            </section>

            <section className="stats-grid">
                <Card title="Data Health Score">
                    <div className="stat-value text-gradient">98%</div>
                    <p className="stat-desc">Across {connectedSources.length > 0 ? connectedSources.length : '12'} connected sources</p>
                </Card>
                <Card title="Recent Scans">
                    <div className="stat-value">24</div>
                    <p className="stat-desc">In the last 24 hours</p>
                </Card>
                <Card title="Issues Detected">
                    <div className="stat-value warning">3</div>
                    <p className="stat-desc">Requires attention</p>
                </Card>
            </section>

            {connectedSources.length > 0 && (
                <section className="connected-sources" style={{ marginBottom: '4rem' }}>
                    <h2 className="section-title">Connected Sources</h2>
                    <div className="sources-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', display: 'grid', gap: '1.5rem' }}>
                        {connectedSources.map((source) => (
                            <Link key={source.id} to={`/source/${source.id}`} style={{ textDecoration: 'none' }}>
                                <Card className="source-card source-card-interactive">
                                    <div className="source-icon" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{source.icon}</div>
                                    <h3 className="source-name" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{source.sourceName}</h3>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        Connected: {new Date(source.connectedAt).toLocaleDateString()}
                                    </p>
                                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                                        <span className="badge success" style={{
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            color: '#10b981',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem'
                                        }}>Active</span>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <section className="recent-activity">
                <h2 className="section-title">Recent Activity</h2>
                <div className="activity-list glass-panel">
                    <div className="activity-item">
                        <div className="activity-icon success">✓</div>
                        <div className="activity-details">
                            <h4>Snowflake Sales Data</h4>
                            <p>Scan completed successfully • 2 mins ago</p>
                        </div>
                    </div>
                    <div className="activity-item">
                        <div className="activity-icon error">!</div>
                        <div className="activity-details">
                            <h4>AWS S3 Raw Logs</h4>
                            <p>Schema validation failed • 1 hour ago</p>
                        </div>
                    </div>
                    <div className="activity-item">
                        <div className="activity-icon success">✓</div>
                        <div className="activity-details">
                            <h4>Postgres Users</h4>
                            <p>Scan completed successfully • 3 hours ago</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
