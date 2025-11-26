import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Button from '../components/Button';
import Card from '../components/Card';
import './SourceDetails.css';

const SourceDetails = () => {
    const { id } = useParams();
    const [source, setSource] = useState(null);
    const [currentPath, setCurrentPath] = useState([]); // Array of folder names
    const [items, setItems] = useState([]); // Items in current path
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);

    // Mock file system - simplified to avoid recursion issues
    const [fileSystem, setFileSystem] = useState({});

    useEffect(() => {
        const sources = JSON.parse(localStorage.getItem('connectedSources') || '[]');
        // Loose equality for ID matching
        const foundSource = sources.find(s => s.id == id);

        if (foundSource) {
            setSource(foundSource);

            // Generate safe mock data only once
            if (Object.keys(fileSystem).length === 0) {
                const mockData = {
                    root: [
                        {
                            id: 'f1', name: 'raw_data', type: 'FOLDER', size: '-', lastModified: '11/26/2025', status: '-', children: [
                                {
                                    id: 'f1_1', name: 'logs', type: 'FOLDER', size: '-', lastModified: '11/25/2025', status: '-', children: [
                                        { id: 'f1_1_1', name: 'app.log', type: 'LOG', size: '12 MB', lastModified: '11/25/2025', status: 'success' },
                                        { id: 'f1_1_2', name: 'error.log', type: 'LOG', size: '45 MB', lastModified: '11/25/2025', status: 'issues' }
                                    ]
                                },
                                { id: 'f1_2', name: 'transactions.csv', type: 'CSV', size: '128 MB', lastModified: '11/26/2025', status: 'success' }
                            ]
                        },
                        {
                            id: 'f2', name: 'processed', type: 'FOLDER', size: '-', lastModified: '11/24/2025', status: '-', children: [
                                { id: 'f2_1', name: 'analytics_2025.parquet', type: 'PARQUET', size: '450 MB', lastModified: '11/24/2025', status: 'success' }
                            ]
                        },
                        { id: 'd1', name: 'manifest.json', type: 'JSON', size: '2 KB', lastModified: '11/26/2025', status: 'success' },
                        { id: 'd2', name: 'schema_v1.sql', type: 'SQL', size: '15 KB', lastModified: '11/23/2025', status: 'success' },
                        { id: 'd3', name: 'bad_records.csv', type: 'CSV', size: '5 MB', lastModified: '11/26/2025', status: 'issues' }
                    ]
                };
                setFileSystem(mockData);
            }
        } else {
            setSource('NOT_FOUND');
        }
    }, [id]);

    // Update view when path changes
    useEffect(() => {
        if (Object.keys(fileSystem).length === 0) return;

        let currentItems = fileSystem.root;

        // Traverse path safely
        for (const folderName of currentPath) {
            if (!currentItems) break;
            const folder = currentItems.find(item => item.name === folderName && item.type === 'FOLDER');
            if (folder && folder.children) {
                currentItems = folder.children;
            } else {
                currentItems = []; // Path not found or empty
            }
        }
        setItems(currentItems || []);
    }, [currentPath, fileSystem]);

    const handleNavigate = (folderName) => {
        setCurrentPath([...currentPath, folderName]);
    };

    const handleBreadcrumbClick = (index) => {
        if (index === -1) {
            setCurrentPath([]);
        } else {
            setCurrentPath(currentPath.slice(0, index + 1));
        }
    };

    const handleScan = () => {
        setIsScanning(true);
        setScanProgress(0);

        const interval = setInterval(() => {
            setScanProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setIsScanning(false);
                    return 100;
                }
                return prev + 10;
            });
        }, 200);
    };

    if (source === 'NOT_FOUND') {
        return (
            <div className="container" style={{ paddingTop: '4rem', textAlign: 'center', color: 'white' }}>
                <h2>Source Not Found</h2>
                <Link to="/"><Button variant="primary">Return to Dashboard</Button></Link>
            </div>
        );
    }

    if (!source) {
        return <div className="container" style={{ paddingTop: '4rem', textAlign: 'center', color: 'white' }}>Loading...</div>;
    }

    return (
        <div className="source-details fade-in">
            <div className="details-header">
                <div className="header-left">
                    <Link to="/" className="back-link">← Back to Dashboard</Link>
                    <div className="title-row">
                        <div className="source-icon-large">{source.icon || '📁'}</div>
                        <div>
                            <h1>{source.sourceName}</h1>
                            <p className="subtitle">
                                {source.bucket ? `Bucket: ${source.bucket}` : `Connection ID: ${source.id}`}
                                <span className="separator">•</span>
                                Region: {source.region || 'us-east-1'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="header-actions">
                    <Link to={`/connect/${source.id}`}>
                        <Button variant="outline">Configuration</Button>
                    </Link>
                    <Button variant="primary" onClick={handleScan} disabled={isScanning}>
                        {isScanning ? `Scanning ${scanProgress}%` : 'Scan Now'}
                    </Button>
                </div>
            </div>

            <section className="files-section">
                <Card className="files-card">
                    <div className="card-header">
                        <div className="breadcrumbs">
                            <span
                                className={`breadcrumb-item ${currentPath.length === 0 ? 'active' : ''}`}
                                onClick={() => handleBreadcrumbClick(-1)}
                            >
                                Root
                            </span>
                            {currentPath.map((folder, index) => (
                                <React.Fragment key={folder}>
                                    <span className="breadcrumb-separator">/</span>
                                    <span
                                        className={`breadcrumb-item ${index === currentPath.length - 1 ? 'active' : ''}`}
                                        onClick={() => handleBreadcrumbClick(index)}
                                    >
                                        {folder}
                                    </span>
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="filter-controls">
                            <input type="text" placeholder="Search files..." className="search-input" />
                        </div>
                    </div>

                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Size</th>
                                    <th>Type</th>
                                    <th>Last Modified</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items && items.length > 0 ? items.map(item => (
                                    <tr key={item.id} className={item.type === 'FOLDER' ? 'folder-row' : ''} onClick={() => item.type === 'FOLDER' && handleNavigate(item.name)}>
                                        <td>
                                            <div className="file-name">
                                                <span className="file-icon">{item.type === 'FOLDER' ? '📁' : '📄'}</span>
                                                {item.name}
                                            </div>
                                        </td>
                                        <td>{item.size}</td>
                                        <td>{item.type}</td>
                                        <td>{item.lastModified}</td>
                                        <td>
                                            {item.type !== 'FOLDER' && (
                                                <span className={`status-badge ${item.status}`}>
                                                    {item.status === 'success' ? 'Valid' : 'Issues'}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <button className="action-btn" onClick={(e) => e.stopPropagation()}>⋮</button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                            Empty folder
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </section>
        </div>
    );
};

export default SourceDetails;
