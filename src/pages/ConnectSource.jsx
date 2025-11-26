import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import './ConnectSource.css';

const ConnectSource = () => {
    const [activeTab, setActiveTab] = useState('structured');

    const structuredSources = [
        { id: 'snowflake', name: 'Snowflake', icon: '❄️' },
        { id: 'postgres', name: 'PostgreSQL', icon: '🐘' },
        { id: 'oracle', name: 'Oracle', icon: '🔴' },
        { id: 'databricks', name: 'Databricks', icon: '🧱' },
    ];

    const unstructuredSources = [
        { id: 'aws', name: 'AWS S3', icon: '🟧' },
        { id: 'azure', name: 'Azure Blob', icon: '🟦' },
        { id: 'gcp', name: 'Google Cloud Storage', icon: '🟩' },
    ];

    const sources = activeTab === 'structured' ? structuredSources : unstructuredSources;

    return (
        <div className="connect-page fade-in">
            <div className="header-section">
                <h1 className="page-title">Connect Data Source</h1>
                <p className="page-subtitle">Select a data source to begin quality monitoring.</p>
            </div>

            <div className="tabs-container">
                <div className="tabs glass-panel">
                    <button
                        className={`tab ${activeTab === 'structured' ? 'active' : ''}`}
                        onClick={() => setActiveTab('structured')}
                    >
                        Structured Data
                    </button>
                    <button
                        className={`tab ${activeTab === 'unstructured' ? 'active' : ''}`}
                        onClick={() => setActiveTab('unstructured')}
                    >
                        Unstructured Data
                    </button>
                </div>
            </div>

            <div className="sources-grid">
                {sources.map((source) => (
                    <Card key={source.id} className="source-card">
                        <div className="source-icon">{source.icon}</div>
                        <h3 className="source-name">{source.name}</h3>
                        <Link to={`/connect/${source.id}`} style={{ width: '100%' }}>
                            <Button variant="outline" className="connect-btn">Connect</Button>
                        </Link>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default ConnectSource;
