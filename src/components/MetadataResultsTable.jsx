import React, { useState } from 'react';
import './MetadataResultsTable.css';
import DimensionScoreCard from './DimensionScoreCard';

const MetadataResultsTable = ({ results, sourceMetadata, onRefresh }) => {
    // Auto-expand all rows by default to show dimensions
    const [expandedRows, setExpandedRows] = useState(() => {
        if (!results || !results.files) return new Set();
        return new Set(results.files.map((_, index) => index));
    });

    if (!results || !results.files || results.files.length === 0) {
        return null;
    }

    // Get all unique metadata fields from all files
    const getAllMetadataFields = () => {
        const fieldsSet = new Set();
        results.files.forEach(file => {
            if (file.metadata && typeof file.metadata === 'object') {
                Object.keys(file.metadata).forEach(key => {
                    // Only include fields that have values in at least one file
                    const value = file.metadata[key];
                    if (value && (Array.isArray(value) ? value.length > 0 : true)) {
                        fieldsSet.add(key);
                    }
                });
            }
        });
        return Array.from(fieldsSet).sort();
    };

    const metadataFields = getAllMetadataFields();

    // Icon mapping for common metadata fields
    const getFieldIcon = (field) => {
        const iconMap = {
            'people': '👤',
            'locations': '📍',
            'organizations': '🏢',
            'dates': '📅',
            'topics': '🏷️',
            'keywords': '🔑',
            'emails': '📧',
            'phones': '📞',
            'urls': '🔗',
            'addresses': '🏠',
            'companies': '🏭',
            'products': '📦',
            'events': '🎉',
            'technologies': '💻',
            'currencies': '💰',
            'percentages': '📊'
        };
        return iconMap[field.toLowerCase()] || '📋';
    };

    // Format field name for display
    const formatFieldName = (field) => {
        return field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ');
    };

    const toggleRow = (index) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedRows(newExpanded);
    };

    const renderMetadataCell = (metadata, field) => {
        if (!metadata || !metadata[field]) return '-';

        const value = metadata[field];

        // Handle empty strings
        if (typeof value === 'string' && value.trim() === '') return '-';

        // Handle string values (Mistral sometimes returns strings instead of arrays)
        if (typeof value === 'string') {
            const truncated = value.length > 50 ? value.substring(0, 50) + '...' : value;
            return <span title={value}>{truncated}</span>;
        }

        // Handle arrays
        if (Array.isArray(value)) {
            if (value.length === 0) return '-';
            if (value.length <= 2) {
                return value.join(', ');
            }
            return (
                <span title={value.join(', ')}>
                    {value.slice(0, 2).join(', ')} +{value.length - 2} more
                </span>
            );
        }

        return String(value);
    };

    const renderExpandedMetadata = (file) => {
        if (!file.metadata) return null;

        return (
            <div className="expanded-metadata">
                <div className="metadata-grid">
                    {metadataFields.map(field => {
                        const value = file.metadata[field];
                        if (!value || (Array.isArray(value) && value.length === 0)) return null;

                        return (
                            <div key={field} className="metadata-section">
                                <h4>{getFieldIcon(field)} {formatFieldName(field)}</h4>
                                {Array.isArray(value) ? (
                                    <ul>
                                        {value.map((item, idx) => (
                                            <li key={idx}>{item}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>{String(value)}</p>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="full-text-sections">
                    <div className="text-section">
                        <h4>📝 Full Summary</h4>
                        <p>{file.summary || 'No summary available'}</p>
                    </div>

                    <div className="text-section">
                        <h4>🎯 Full Context</h4>
                        <p>{file.context || 'No context available'}</p>
                    </div>

                    {file.quality_notes && (
                        <div className="text-section">
                            <h4>✅ Quality Notes</h4>
                            <p>{file.quality_notes}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="metadata-results-container">
            <div className="results-header">
                <h2>Quality Check Results</h2>
                <div className="results-stats">
                    <span className="stat">
                        <strong>Total Files:</strong> {results.total_files}
                    </span>
                    <span className="stat success">
                        <strong>Successful:</strong> {results.successful}
                    </span>
                    {results.failed > 0 && (
                        <span className="stat error">
                            <strong>Failed:</strong> {results.failed}
                        </span>
                    )}
                    <span className="stat">
                        <strong>Processed:</strong> {new Date(results.processed_at).toLocaleString()}
                    </span>
                </div>
            </div>

            <div className="table-container">
                <table className="metadata-table">
                    <thead>
                        <tr>
                            <th className="expand-col"></th>
                            <th>File Name</th>
                            <th>Document Type</th>
                            {metadataFields.map(field => (
                                <th key={field}>{formatFieldName(field)}</th>
                            ))}
                            <th style={{ minWidth: '200px' }}>Summary</th>
                            <th style={{ minWidth: '200px' }}>Context</th>
                            <th>
                                <div className="quality-score-header">
                                    Quality Score
                                    <span className="info-icon">ℹ️</span>
                                    <span className="tooltip">
                                        Score (0-100) based on:
                                        <br />• Completeness of metadata
                                        <br />• Clarity of content
                                        <br />• Presence of key entities
                                    </span>
                                </div>
                            </th>
                            <th>
                                <div className="quality-score-header">
                                    Similarity
                                    <span className="info-icon">ℹ️</span>
                                    <span className="tooltip">
                                        Cosine similarity with other documents.
                                        <br />• 95-96%: Similar
                                        <br />• 97-98%: Very Similar
                                        <br />• 99%+: Nearly Identical
                                    </span>
                                </div>
                            </th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.files.map((file, index) => (
                            <React.Fragment key={index}>
                                <tr className={file.status === 'error' ? 'error-row' : ''}>
                                    <td className="expand-col">
                                        {file.status === 'success' && (
                                            <button
                                                className="expand-btn"
                                                onClick={() => toggleRow(index)}
                                                aria-label={expandedRows.has(index) ? 'Collapse' : 'Expand'}
                                            >
                                                {expandedRows.has(index) ? '▼' : '▶'}
                                            </button>
                                        )}
                                    </td>
                                    <td className="file-name" title={file.file_name}>{file.file_name}</td>
                                    <td>{file.document_type || '-'}</td>
                                    {metadataFields.map(field => (
                                        <td key={field}>{renderMetadataCell(file.metadata, field)}</td>
                                    ))}
                                    <td className="summary-cell" title={file.summary}>
                                        {file.status === 'success'
                                            ? (file.summary?.substring(0, 100) + (file.summary?.length > 100 ? '...' : ''))
                                            : file.error}
                                    </td>
                                    <td className="summary-cell" title={file.context}>
                                        {file.status === 'success'
                                            ? (file.context?.substring(0, 100) + (file.context?.length > 100 ? '...' : ''))
                                            : '-'}
                                    </td>
                                    <td>
                                        {file.quality_score && (
                                            <span className={`quality-score score-${Math.floor(file.quality_score / 20)}`}>
                                                {file.quality_score}
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {file.potential_duplicates && file.potential_duplicates.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                {file.potential_duplicates.slice(0, 3).map((dup, idx) => (
                                                    <span key={idx} style={{
                                                        background: dup.similarity >= 99 ? '#dc2626' : dup.similarity >= 97 ? '#ea580c' : '#f59e0b',
                                                        color: 'white',
                                                        padding: '0.15rem 0.5rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 'bold',
                                                        textAlign: 'center'
                                                    }}>
                                                        {dup.similarity}%
                                                    </span>
                                                ))}
                                                {file.potential_duplicates.length > 3 && (
                                                    <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                                                        +{file.potential_duplicates.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ color: '#6b7280' }}>-</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${file.status}`}>
                                            {file.status}
                                        </span>
                                    </td>
                                </tr>
                                {expandedRows.has(index) && file.status === 'success' && (
                                    <tr className="expanded-row">
                                        <td colSpan={metadataFields.length + 8}>
                                            {/* 17-Dimension Quality Assessment */}
                                            {file.dimensions && (
                                                <DimensionScoreCard
                                                    dimensions={file.dimensions}
                                                    recommendedAction={file.recommended_action || 'REVIEW'}
                                                    overallScore={file.overall_quality_score || file.quality_score || 50}
                                                    fileName={file.file_name}
                                                    fileData={file}
                                                    sourceMetadata={sourceMetadata}
                                                    onRefresh={onRefresh}
                                                />
                                            )}
                                            {renderExpandedMetadata(file)}
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MetadataResultsTable;
