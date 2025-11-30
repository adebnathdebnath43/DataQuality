import React, { useState } from 'react';
import './MetadataResultsTable.css';

const MetadataResultsTable = ({ results }) => {
    const [expandedRows, setExpandedRows] = useState(new Set());

    if (!results || !results.files || results.files.length === 0) {
        return null;
    }

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
        return value;
    };

    const renderExpandedMetadata = (file) => {
        if (!file.metadata) return null;

        return (
            <div className="expanded-metadata">
                <div className="metadata-grid">
                    {file.metadata.people && file.metadata.people.length > 0 && (
                        <div className="metadata-section">
                            <h4>👤 People</h4>
                            <ul>
                                {file.metadata.people.map((person, idx) => (
                                    <li key={idx}>{person}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {file.metadata.locations && file.metadata.locations.length > 0 && (
                        <div className="metadata-section">
                            <h4>📍 Locations</h4>
                            <ul>
                                {file.metadata.locations.map((loc, idx) => (
                                    <li key={idx}>{loc}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {file.metadata.organizations && file.metadata.organizations.length > 0 && (
                        <div className="metadata-section">
                            <h4>🏢 Organizations</h4>
                            <ul>
                                {file.metadata.organizations.map((org, idx) => (
                                    <li key={idx}>{org}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {file.metadata.dates && file.metadata.dates.length > 0 && (
                        <div className="metadata-section">
                            <h4>📅 Dates</h4>
                            <ul>
                                {file.metadata.dates.map((date, idx) => (
                                    <li key={idx}>{date}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {file.metadata.topics && file.metadata.topics.length > 0 && (
                        <div className="metadata-section">
                            <h4>🏷️ Topics</h4>
                            <ul>
                                {file.metadata.topics.map((topic, idx) => (
                                    <li key={idx}>{topic}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {file.metadata.keywords && file.metadata.keywords.length > 0 && (
                        <div className="metadata-section">
                            <h4>🔑 Keywords</h4>
                            <ul>
                                {file.metadata.keywords.map((keyword, idx) => (
                                    <li key={idx}>{keyword}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {file.metadata.emails && file.metadata.emails.length > 0 && (
                        <div className="metadata-section">
                            <h4>📧 Emails</h4>
                            <ul>
                                {file.metadata.emails.map((email, idx) => (
                                    <li key={idx}>{email}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {file.metadata.phones && file.metadata.phones.length > 0 && (
                        <div className="metadata-section">
                            <h4>📞 Phones</h4>
                            <ul>
                                {file.metadata.phones.map((phone, idx) => (
                                    <li key={idx}>{phone}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="full-text-sections">
                    <div className="text-section">
                        <h4>📝 Full Summary</h4>
                        <p>{file.summary || 'No summary available'}</p>
                    </div>

                    <div className="text-section">
                        <h4>🎯 Context</h4>
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
                            <th>People</th>
                            <th>Locations</th>
                            <th>Organizations</th>
                            <th>Topics</th>
                            <th>Summary</th>
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
                                    <td>{renderMetadataCell(file.metadata, 'people')}</td>
                                    <td>{renderMetadataCell(file.metadata, 'locations')}</td>
                                    <td>{renderMetadataCell(file.metadata, 'organizations')}</td>
                                    <td>{renderMetadataCell(file.metadata, 'topics')}</td>
                                    <td className="summary-cell" title={file.summary}>
                                        {file.status === 'success'
                                            ? (file.summary?.substring(0, 100) + (file.summary?.length > 100 ? '...' : ''))
                                            : file.error}
                                    </td>
                                    <td>
                                        {file.quality_score && (
                                            <span className={`quality-score score-${Math.floor(file.quality_score / 20)}`}>
                                                {file.quality_score}
                                            </span>
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
                                        <td colSpan="10">
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
