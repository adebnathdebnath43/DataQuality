import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Button from '../components/Button';
import Card from '../components/Card';
import MetadataResultsTable from '../components/MetadataResultsTable';
import { listFiles, listHistory, getHistoryContent, extractMetadata, API_URL } from '../services/api';
import './SourceDetails.css';

const SourceDetails = () => {
    const { id } = useParams();
    const [source, setSource] = useState(null);
    const [currentPath, setCurrentPath] = useState([]);
    const [items, setItems] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [qualityCheckResults, setQualityCheckResults] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [historyFiles, setHistoryFiles] = useState([]);

    useEffect(() => {
        const sources = JSON.parse(localStorage.getItem('connectedSources') || '[]');
        const foundSource = sources.find(s => s.id == id);

        if (foundSource) {
            setSource(foundSource);
        } else {
            setSource('NOT_FOUND');
        }

        // Load persisted results
        const savedResults = localStorage.getItem(`qualityCheckResults_${id}`);
        if (savedResults) {
            try {
                setQualityCheckResults(JSON.parse(savedResults));
            } catch (e) {
                console.error('Failed to parse saved results', e);
            }
        }
    }, [id]);

    // Load Bedrock models
    useEffect(() => {
        const loadModels = async () => {
            if (source && source !== 'NOT_FOUND') {
                try {
                    const accessKey = (source.authMethod === 'keys' || source.authMethod === 'assume_role') ? source.accessKey : undefined;
                    const secretKey = (source.authMethod === 'keys' || source.authMethod === 'assume_role') ? source.secretKey : undefined;

                    const { listBedrockModels } = await import('../services/api');
                    const data = await listBedrockModels(source.region, accessKey, secretKey);
                    const modelsList = data.models || [];
                    setModels(modelsList);
                    if (modelsList.length > 0 && !selectedModel) {
                        setSelectedModel(modelsList[0].model_id);
                    }
                } catch (err) {
                    console.error('Error loading models:', err);
                    const defaultModels = [
                        { model_id: 'anthropic.claude-3-sonnet-20240229-v1:0', model_name: 'Claude 3 Sonnet', provider: 'Anthropic' },
                        { model_id: 'anthropic.claude-3-haiku-20240307-v1:0', model_name: 'Claude 3 Haiku', provider: 'Anthropic' },
                        { model_id: 'mistral.mistral-large-2402-v1:0', model_name: 'Mistral Large', provider: 'Mistral AI' }
                    ];
                    setModels(defaultModels);
                    if (!selectedModel) {
                        setSelectedModel(defaultModels[0].model_id);
                    }
                }
            }
        };
        loadModels();
    }, [source]);

    // Load files when source or path changes
    useEffect(() => {
        if (source && source !== 'NOT_FOUND') {
            loadFiles();
        }
    }, [source, currentPath]);

    const loadFiles = async () => {
        if (!source || !source.bucket) return;

        setLoading(true);
        setError(null);
        try {
            const prefix = currentPath.length > 0 ? currentPath.join('/') + '/' : '';
            const accessKey = (source.authMethod === 'keys' || source.authMethod === 'assume_role') ? source.accessKey : undefined;
            const secretKey = (source.authMethod === 'keys' || source.authMethod === 'assume_role') ? source.secretKey : undefined;
            const roleArn = source.authMethod === 'assume_role' ? source.roleArn : undefined;

            const data = await listFiles(source.bucket, prefix, source.region, accessKey, secretKey, roleArn);
            setItems(data.files || []);
        } catch (err) {
            console.error('Error loading files:', err);
            setError('Unable to load files. Please check your connection settings.');
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

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

    const toggleSelectAll = () => {
        if (selectedItems.size === items.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(items.map(item => item.key)));
        }
    };

    const toggleSelectItem = (itemKey) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(itemKey)) {
            newSelected.delete(itemKey);
        } else {
            newSelected.add(itemKey);
        }
        setSelectedItems(newSelected);
    };

    const handleScan = async () => {
        if (selectedItems.size === 0) return;

        console.log('[Quality Check] Starting...');
        console.log('[Quality Check] Model:', selectedModel);
        console.log('[Quality Check] Files:', Array.from(selectedItems));

        setIsScanning(true);
        setScanProgress(10);
        setError(null);
        setQualityCheckResults(null); // Clear previous results

        let progressInterval;
        try {
            const accessKey = (source.authMethod === 'keys' || source.authMethod === 'assume_role') ? source.accessKey : undefined;
            const secretKey = (source.authMethod === 'keys' || source.authMethod === 'assume_role') ? source.secretKey : undefined;
            const roleArn = source.authMethod === 'assume_role' ? source.roleArn : undefined;

            const keysToProcess = Array.from(selectedItems).filter(k => !k.endsWith('/'));
            if (keysToProcess.length === 0) {
                setError('Please select at least one file (folders are ignored).');
                return;
            }

            // Drive progress to 90% while request runs; ensure cleanup on all paths
            progressInterval = setInterval(() => {
                setScanProgress(prev => Math.min(prev + 5, 90));
            }, 500);

            const { extractMetadata } = await import('../services/api');
            const result = await extractMetadata(
                source.bucket,
                keysToProcess,
                source.region,
                accessKey,
                secretKey,
                roleArn,
                selectedModel
            );

            console.log('[Quality Check] Result:', result);

            setScanProgress(100);

            if (result?.results?.length > 0) {
                if (result.results[0].consolidated_json) {
                    const consolidatedData = result.results[0].consolidated_json;
                    setQualityCheckResults(consolidatedData);
                    localStorage.setItem(`qualityCheckResults_${id}`, JSON.stringify(consolidatedData));
                }
            } else {
                setError('Quality check completed but returned no results.');
            }

            await loadFiles();
            setSelectedItems(new Set());

        } catch (err) {
            console.error('[Quality Check] Error:', err);
            setError('Failed to run quality check: ' + (err.response?.data?.detail || err.message));
        } finally {
            if (progressInterval) clearInterval(progressInterval);
            setIsScanning(false);
            setScanProgress(0);
        }
    };

    const handleViewAnalysis = async () => {
        if (selectedItems.size !== 1) return;
        const selectedKey = Array.from(selectedItems)[0];
        if (!selectedKey.endsWith('.json')) return;

        setLoading(true);
        setError(null);
        try {
            const accessKey = (source.authMethod === 'keys' || source.authMethod === 'assume_role') ? source.accessKey : undefined;
            const secretKey = (source.authMethod === 'keys' || source.authMethod === 'assume_role') ? source.secretKey : undefined;
            const roleArn = source.authMethod === 'assume_role' ? source.roleArn : undefined;

            const { getFileContent } = await import('../services/api');
            const data = await getFileContent(source.bucket, selectedKey, source.region, accessKey, secretKey, roleArn);

            // Wrap single file analysis in the structure expected by MetadataResultsTable
            const displayData = {
                processed_at: data.processed_at,
                total_files: 1,
                successful: 1,
                failed: 0,
                files: [data]
            };

            setQualityCheckResults(displayData);
            // We don't persist "view" actions to localStorage to avoid confusion with "run" history

        } catch (err) {
            console.error('Error viewing analysis:', err);
            setError('Failed to load analysis file: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    const clearResults = () => {
        setQualityCheckResults(null);
        localStorage.removeItem(`qualityCheckResults_${id}`);
    };

    const handleViewHistory = async () => {
        try {
            setLoading(true);
            const data = await listHistory();
            setHistoryFiles(data);
            setShowHistory(true);
        } catch (err) {
            setError('Failed to load history list: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadHistoryFile = async (filename) => {
        try {
            setLoading(true);
            const data = await getHistoryContent(filename);
            setQualityCheckResults(data);
            setShowHistory(false);
        } catch (err) {
            setError('Failed to load history file: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const recomputeDimensionsFromHistory = async () => {
        try {
            if (!qualityCheckResults || !qualityCheckResults.files || qualityCheckResults.files.length === 0) {
                alert('No history result loaded');
                return;
            }
            const files = qualityCheckResults.files;
            const keys = files.map(f => f.file_key).filter(Boolean);
            if (keys.length === 0) {
                alert('History entry does not contain file keys to re-analyze');
                return;
            }

            setLoading(true);
            const accessKey = (source.authMethod === 'keys' || source.authMethod === 'assume_role') ? source.accessKey : undefined;
            const secretKey = (source.authMethod === 'keys' || source.authMethod === 'assume_role') ? source.secretKey : undefined;
            const roleArn = source.authMethod === 'assume_role' ? source.roleArn : undefined;

            const result = await extractMetadata(
                source.bucket,
                keys,
                source.region,
                accessKey,
                secretKey,
                roleArn,
                selectedModel
            );

            setQualityCheckResults(result);
            localStorage.setItem(`qualityCheckResults_${id}`, JSON.stringify(result));
            alert('Computed 17-Dimension scores for history entry');
        } catch (err) {
            console.error('Error recomputing dimensions from history:', err);
            alert('Failed to compute 17-Dimension scores: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
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
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Bedrock Model</label>
                            <select
                                className="model-select"
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                disabled={isScanning}
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: '6px',
                                    border: '1px solid #e2e8f0',
                                    background: 'white',
                                    fontSize: '0.875rem',
                                    minWidth: '200px'
                                }}
                            >
                                <option value="" disabled>Select Model</option>
                                {models.map(model => (
                                    <option key={model.model_id} value={model.model_id}>
                                        {model.model_name || model.model_id}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedItems.size === 1 && Array.from(selectedItems)[0].endsWith('.json') && (
                            <Button
                                variant="secondary"
                                onClick={handleViewAnalysis}
                                disabled={loading}
                                style={{ marginTop: '1.25rem' }}
                            >
                                View Data Quality
                            </Button>
                        )}

                        <Button
                            variant="primary"
                            onClick={handleScan}
                            disabled={selectedItems.size === 0 || isScanning || !selectedModel}
                            style={{ marginTop: '1.25rem' }}
                        >
                            {isScanning ? `Scanning ${scanProgress}%` : 'Run Quality Check'}
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={handleViewHistory}
                            disabled={loading || isScanning}
                            style={{ marginTop: '1.25rem' }}
                        >
                            📜 View History
                        </Button>
                    </div>
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

                    {error && (
                        <div className="error-message" style={{ padding: '1rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', margin: '1rem' }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {showHistory && (
                        <div className="modal-overlay" style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.7)', zIndex: 1000,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <div className="modal-content" style={{
                                background: '#1e293b', padding: '2rem', borderRadius: '8px',
                                width: '600px', maxHeight: '80vh', overflowY: 'auto',
                                border: '1px solid #334155'
                            }}>
                                <h2 style={{ color: 'white', marginBottom: '1.5rem' }}>Select Result to View</h2>
                                {historyFiles.length === 0 ? (
                                    <p style={{ color: '#94a3b8' }}>No history files found.</p>
                                ) : (
                                    <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {historyFiles.map(file => (
                                            <div key={file.filename}
                                                onClick={() => loadHistoryFile(file.filename)}
                                                style={{
                                                    padding: '1rem',
                                                    background: file.has_duplicates ? 'rgba(239, 68, 68, 0.1)' : '#0f172a',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    border: file.has_duplicates ? '1px solid #ef4444' : '1px solid #334155',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.5rem'
                                                }}
                                                onMouseOver={e => e.currentTarget.style.borderColor = file.has_duplicates ? '#dc2626' : '#3b82f6'}
                                                onMouseOut={e => e.currentTarget.style.borderColor = file.has_duplicates ? '#ef4444' : '#334155'}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ color: '#e2e8f0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {new Date(file.created_at).toLocaleString()}
                                                            {file.has_duplicates && (
                                                                <span style={{
                                                                    background: file.max_similarity >= 99 ? '#dc2626' : file.max_similarity >= 97 ? '#ea580c' : '#f59e0b',
                                                                    color: 'white',
                                                                    padding: '0.15rem 0.5rem',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 'bold'
                                                                }}>
                                                                    ⚠️ {file.max_similarity}% Duplicate
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                                                            {file.total_files} files • {file.successful} success • {file.failed} failed
                                                        </div>
                                                    </div>
                                                    <div style={{ color: '#3b82f6' }}>View →</div>
                                                </div>

                                                {file.has_duplicates && file.duplicates && (
                                                    <div style={{
                                                        fontSize: '0.8rem',
                                                        color: '#9ca3af',
                                                        paddingTop: '0.5rem',
                                                        borderTop: '1px solid rgba(255,255,255,0.1)'
                                                    }}>
                                                        Similar to: {file.duplicates.slice(0, 3).map(d => d.file_name).join(', ')}
                                                        {file.duplicates.length > 3 && ` +${file.duplicates.length - 3} more`}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowHistory(false)}
                                    style={{ marginTop: '1.5rem', width: '100%' }}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th className="checkbox-col">
                                        <input
                                            type="checkbox"
                                            checked={items.length > 0 && selectedItems.size === items.length}
                                            onChange={toggleSelectAll}
                                            className="custom-checkbox"
                                        />
                                    </th>
                                    <th>Name</th>
                                    <th>Size</th>
                                    <th>Type</th>
                                    <th>Last Modified</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                            Loading files...
                                        </td>
                                    </tr>
                                ) : items && items.length > 0 ? items.map(item => (
                                    <tr
                                        key={item.key}
                                        className={`${item.is_folder ? 'folder-row' : ''} ${selectedItems.has(item.key) ? 'selected-row' : ''}`}
                                        onClick={() => item.is_folder && handleNavigate(item.name)}
                                    >
                                        <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedItems.has(item.key)}
                                                onChange={() => toggleSelectItem(item.key)}
                                                className="custom-checkbox"
                                            />
                                        </td>
                                        <td>
                                            <div className="file-name">
                                                <span className="file-icon">{item.is_folder ? '📁' : '📄'}</span>
                                                {item.name}
                                            </div>
                                        </td>
                                        <td>{item.size !== '-' ? (item.size / 1024).toFixed(1) + ' KB' : '-'}</td>
                                        <td>{item.type}</td>
                                        <td>{item.last_modified !== '-' ? new Date(item.last_modified).toLocaleDateString() : '-'}</td>
                                        <td>
                                            {!item.is_folder && (
                                                <span className="status-badge success">
                                                    Ready
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <button className="action-btn" onClick={(e) => e.stopPropagation()}>⋮</button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                            {error ? 'Failed to load files' : 'Empty folder'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Quality Check Results */}
                {qualityCheckResults && (
                    <>
                        {/* Duplicate Warning */}
                        {qualityCheckResults.files &&
                            qualityCheckResults.files.length === 1 &&
                            qualityCheckResults.files[0].potential_duplicates &&
                            qualityCheckResults.files[0].potential_duplicates.length > 0 && (
                                <div className="warning-alert" style={{
                                    background: 'rgba(245, 158, 11, 0.1)',
                                    border: '1px solid #f59e0b',
                                    borderRadius: '6px',
                                    padding: '1rem',
                                    marginBottom: '1rem',
                                    color: '#fbbf24'
                                }}>
                                    <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        ⚠️ Potential Duplicates Detected
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#d1d5db' }}>
                                        This document has high semantic similarity with the following files:
                                    </p>
                                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {qualityCheckResults.files[0].potential_duplicates.map((dup, idx) => (
                                            <div key={idx} style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid #ef4444',
                                                borderRadius: '6px',
                                                padding: '0.75rem',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span style={{ color: '#e5e7eb', fontSize: '0.9rem' }}>
                                                    📄 {dup.file_name}
                                                </span>
                                                <span style={{
                                                    background: dup.similarity >= 99 ? '#dc2626' : dup.similarity >= 97 ? '#ea580c' : '#f59e0b',
                                                    color: 'white',
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '12px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {dup.similarity}% Match
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <Button variant="secondary" onClick={clearResults}>
                                Clear Results
                            </Button>
                            {qualityCheckResults.files && qualityCheckResults.files.length > 0 && !qualityCheckResults.files[0].dimensions && (
                                <Button variant="primary" onClick={recomputeDimensionsFromHistory} style={{ marginLeft: '0.5rem' }}>
                                    Compute 17-Dimension Scores
                                </Button>
                            )}
                        </div>
                        <MetadataResultsTable 
                            results={qualityCheckResults}
                            connectionConfig={{
                                bucket: source.bucket,
                                region: source.region,
                                accessKey: (source.authMethod === 'keys' || source.authMethod === 'assume_role') ? source.accessKey : undefined,
                                secretKey: (source.authMethod === 'keys' || source.authMethod === 'assume_role') ? source.secretKey : undefined,
                                modelId: selectedModel
                            }}
                            onResultsChange={(updatedResults) => {
                                setQualityCheckResults(updatedResults);
                                localStorage.setItem(`qualityCheckResults_${id}`, JSON.stringify(updatedResults));
                            }}
                        />
                    </>
                )}
            </section>
            {/* Debug Info */}
            <div style={{
                position: 'fixed',
                bottom: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.7)',
                color: '#0f0',
                padding: '5px 10px',
                borderRadius: '4px',
                fontSize: '12px',
                pointerEvents: 'none',
                zIndex: 9999
            }}>
                Backend: {API_URL}
            </div>
        </div>
    );
};

export default SourceDetails;
