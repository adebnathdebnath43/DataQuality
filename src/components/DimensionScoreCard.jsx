import React, { useState, useEffect } from 'react';
import { Radar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
} from 'chart.js';
import { approveDimension, rejectDimension, reanalyzeDimension } from '../services/api';
import { downloadAsJSON, downloadAsText } from '../utils/reportGenerator';
import './DimensionScoreCard.css';

// Register Chart.js components
ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

const DimensionScoreCard = ({ dimensions, recommendedAction, overallScore, fileName, fileData, connectionConfig, onDataChange }) => {
    const [dimensionApprovals, setDimensionApprovals] = useState(fileData?.dimension_approvals || {});
    const [feedbackModal, setFeedbackModal] = useState({ show: false, dimension: null, mode: 'reject' });
    const [feedback, setFeedback] = useState('');
    const [reanalyzing, setReanalyzing] = useState(false);
    const [showHistory, setShowHistory] = useState({});
    const [currentDimensions, setCurrentDimensions] = useState(dimensions);

    // Sync state with props when fileData changes (e.g., when navigating back)
    useEffect(() => {
        if (fileData?.dimension_approvals) {
            setDimensionApprovals(fileData.dimension_approvals);
        }
        if (dimensions) {
            setCurrentDimensions(dimensions);
        }
    }, [fileData, dimensions]);

    if (!dimensions || Object.keys(dimensions).length === 0) {
        return null;
    }

    // Prepare data for radar chart
    const dimensionNames = Object.keys(currentDimensions);
    const scores = dimensionNames.map(name => currentDimensions[name]?.score || 0);

    const radarData = {
        labels: dimensionNames,
        datasets: [{
            label: 'Quality Dimensions',
            data: scores,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(59, 130, 246, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
        }]
    };

    const radarOptions = {
        scales: {
            r: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    stepSize: 20,
                    color: '#94a3b8'
                },
                grid: {
                    color: 'rgba(148, 163, 184, 0.2)'
                },
                pointLabels: {
                    color: '#e2e8f0',
                    font: {
                        size: 11
                    }
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        return `${context.label}: ${context.parsed.r}/100`;
                    }
                }
            }
        },
        maintainAspectRatio: true
    };

    // Get score color
    const getScoreColor = (score) => {
        if (score >= 90) return '#10b981'; // Green
        if (score >= 70) return '#f59e0b'; // Yellow
        if (score >= 50) return '#f97316'; // Orange
        return '#ef4444'; // Red
    };

    // Get action badge color
    const getActionColor = (action) => {
        switch (action) {
            case 'KEEP': return '#10b981';
            case 'REVIEW': return '#f59e0b';
            case 'QUARANTINE': return '#f97316';
            case 'DISCARD': return '#ef4444';
            default: return '#6b7280';
        }
    };

    // Handle dimension approval
    const handleApproveDimension = async (dimensionName) => {
        try {
            await approveDimension(fileName, dimensionName);

            const newApprovals = {
                ...dimensionApprovals,
                [dimensionName]: { status: 'approved', timestamp: new Date().toISOString() }
            };
            setDimensionApprovals(newApprovals);
            
            // Notify parent component to update its data
            if (onDataChange) {
                onDataChange({ dimension_approvals: newApprovals });
            }
        } catch (error) {
            console.error('Error approving dimension:', error);
            alert('Failed to approve dimension: ' + (error.response?.data?.detail || error.message));
        }
    };

    // Handle dimension rejection
    const handleRejectDimension = (dimensionName) => {
        setFeedbackModal({ show: true, dimension: dimensionName, mode: 'reject' });
        setFeedback('');
    };

    // Submit rejection with feedback
    const submitRejection = async () => {
        if (!feedback.trim()) {
            alert('Please provide feedback for rejection');
            return;
        }

        try {
            await rejectDimension(fileName, feedbackModal.dimension, feedback);

            const newApprovals = {
                ...dimensionApprovals,
                [feedbackModal.dimension]: {
                    status: 'rejected',
                    feedback: feedback,
                    timestamp: new Date().toISOString()
                }
            };
            setDimensionApprovals(newApprovals);

            // Notify parent component to update its data
            if (onDataChange) {
                onDataChange({ dimension_approvals: newApprovals });
            }

            setFeedbackModal({ show: false, dimension: null, mode: 'reject' });
            alert('Dimension rejected successfully. You can now re-analyze it with your feedback.');
        } catch (error) {
            console.error('Error rejecting dimension:', error);
            alert('Failed to reject dimension: ' + (error.response?.data?.detail || error.message));
        }
    };

    // Handle re-analysis of a rejected dimension
    const handleReanalyzeDimension = async (dimensionName) => {
        const approval = dimensionApprovals[dimensionName];
        if (!approval || approval.status !== 'rejected') {
            alert('Please reject the dimension first before re-analyzing');
            return;
        }

        if (!connectionConfig) {
            alert('Connection configuration is missing. Please go back and configure connection.');
            return;
        }

        setFeedbackModal({ show: true, dimension: dimensionName, mode: 'reanalyze' });
        setFeedback(approval.feedback || '');
    };

    const submitReanalysis = async () => {
        if (!feedback.trim()) {
            alert('Please provide feedback for re-analysis');
            return;
        }

        setReanalyzing(true);
        try {
            const result = await reanalyzeDimension(
                fileName,
                feedbackModal.dimension,
                feedback,
                connectionConfig.bucket,
                connectionConfig.region,
                connectionConfig.accessKey,
                connectionConfig.secretKey,
                connectionConfig.modelId
            );

            // Update current dimensions with new score
            const newDimensions = {
                ...currentDimensions,
                [feedbackModal.dimension]: {
                    score: result.new_score,
                    evidence: result.new_evidence
                }
            };
            setCurrentDimensions(newDimensions);

            // Update approvals to show reanalyzed status
            const newApprovals = {
                ...dimensionApprovals,
                [feedbackModal.dimension]: {
                    status: 'reanalyzed',
                    feedback: feedback,
                    timestamp: new Date().toISOString()
                }
            };
            setDimensionApprovals(newApprovals);

            // Notify parent component to update its data
            if (onDataChange) {
                onDataChange({ 
                    dimensions: newDimensions,
                    dimension_approvals: newApprovals 
                });
            }

            setFeedbackModal({ show: false, dimension: null, mode: 'reject' });
            alert(`Dimension re-analyzed successfully! New score: ${result.new_score}/100`);
        } catch (error) {
            console.error('Error re-analyzing dimension:', error);
            alert('Failed to re-analyze dimension: ' + (error.response?.data?.detail || error.message));
        } finally {
            setReanalyzing(false);
        }
    };

    // Toggle history display
    const toggleHistory = (dimensionName) => {
        setShowHistory(prev => ({
            ...prev,
            [dimensionName]: !prev[dimensionName]
        }));
    };

    return (
        <div className="dimension-score-card">
            <div className="dimension-header">
                <h3>17-Dimension Quality Assessment</h3>
                <div className="dimension-badges">
                    <span className="overall-score" style={{ background: getScoreColor(overallScore) }}>
                        Overall: {overallScore}/100
                    </span>
                    <span className="action-badge" style={{ background: getActionColor(recommendedAction) }}>
                        {recommendedAction}
                    </span>
                    <button
                        className="download-btn"
                        onClick={() => downloadAsJSON(fileData)}
                        title="Download JSON Report"
                    >
                        📥 JSON
                    </button>
                    <button
                        className="download-btn"
                        onClick={() => downloadAsText(fileData)}
                        title="Download Text Report"
                    >
                        📄 TXT
                    </button>
                </div>
            </div>

            <div className="dimension-content">
                <div className="radar-chart-container">
                    <Radar data={radarData} options={radarOptions} />
                </div>

                <div className="dimension-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Dimension</th>
                                <th>Score</th>
                                <th>Evidence</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dimensionNames.map(name => {
                                const dim = currentDimensions[name];
                                const score = dim?.score || 0;
                                const approval = dimensionApprovals[name];
                                const hasHistory = approval?.history && approval.history.length > 0;

                                return (
                                    <React.Fragment key={name}>
                                        <tr className={approval?.status === 'rejected' ? 'rejected-row' : approval?.status === 'reanalyzed' ? 'reanalyzed-row' : ''}>
                                            <td className="dimension-name">
                                                {name.replace(/_/g, ' ')}
                                                {hasHistory && (
                                                    <button
                                                        onClick={() => toggleHistory(name)}
                                                        className="history-toggle"
                                                        title="View history"
                                                    >
                                                        📜 {showHistory[name] ? '▼' : '▶'}
                                                    </button>
                                                )}
                                            </td>
                                            <td>
                                                <div className="score-cell">
                                                    <span
                                                        className="score-badge"
                                                        style={{ background: getScoreColor(score) }}
                                                    >
                                                        {score}
                                                    </span>
                                                    <div className="score-bar">
                                                        <div
                                                            className="score-fill"
                                                            style={{
                                                                width: `${score}%`,
                                                                background: getScoreColor(score)
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="evidence-cell">
                                                {dim?.evidence || 'N/A'}
                                                {approval?.feedback && (
                                                    <div className="feedback-note">
                                                        <strong>Feedback:</strong> {approval.feedback}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="actions-cell">
                                                {approval?.status === 'approved' ? (
                                                    <span className="status-badge approved">✓ Approved</span>
                                                ) : approval?.status === 'rejected' ? (
                                                    <div className="action-buttons">
                                                        <span className="status-badge rejected">✗ Rejected</span>
                                                        <button
                                                            className="reanalyze-btn"
                                                            onClick={() => handleReanalyzeDimension(name)}
                                                            title="Re-analyze this dimension with feedback"
                                                        >
                                                            🔄 Re-analyze
                                                        </button>
                                                    </div>
                                                ) : approval?.status === 'reanalyzed' ? (
                                                    <div className="action-buttons">
                                                        <span className="status-badge reanalyzed">🔄 Re-analyzed</span>
                                                        <button
                                                            className="approve-btn"
                                                            onClick={() => handleApproveDimension(name)}
                                                            title="Approve this dimension"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            className="reject-btn"
                                                            onClick={() => handleRejectDimension(name)}
                                                            title="Reject again"
                                                        >
                                                            ✗
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="action-buttons">
                                                        <button
                                                            className="approve-btn"
                                                            onClick={() => handleApproveDimension(name)}
                                                            title="Approve this dimension"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            className="reject-btn"
                                                            onClick={() => handleRejectDimension(name)}
                                                            title="Reject and provide feedback"
                                                        >
                                                            ✗
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                        {showHistory[name] && hasHistory && (
                                            <tr className="history-row">
                                                <td colSpan="4">
                                                    <div className="history-details">
                                                        <h4>History for {name.replace(/_/g, ' ')}</h4>
                                                        {approval.history.map((entry, idx) => (
                                                            <div key={idx} className="history-entry">
                                                                <div className="history-timestamp">
                                                                    {new Date(entry.timestamp).toLocaleString()}
                                                                </div>
                                                                <div className="history-action">
                                                                    Action: <strong>{entry.action}</strong>
                                                                </div>
                                                                {entry.feedback && (
                                                                    <div className="history-feedback">
                                                                        Feedback: {entry.feedback}
                                                                    </div>
                                                                )}
                                                                <div className="history-scores">
                                                                    <span>Old Score: <strong>{entry.old_score}</strong></span>
                                                                    {' → '}
                                                                    <span>New Score: <strong>{entry.new_score}</strong></span>
                                                                </div>
                                                                {entry.old_evidence && (
                                                                    <div className="history-evidence">
                                                                        <details>
                                                                            <summary>View Evidence Changes</summary>
                                                                            <div className="evidence-comparison">
                                                                                <div>
                                                                                    <strong>Old:</strong> {entry.old_evidence}
                                                                                </div>
                                                                                <div>
                                                                                    <strong>New:</strong> {entry.new_evidence}
                                                                                </div>
                                                                            </div>
                                                                        </details>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Feedback Modal */}
            {feedbackModal.show && (
                <div className="modal-overlay" onClick={() => setFeedbackModal({ show: false, dimension: null, mode: 'reject' })}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>
                            {feedbackModal.mode === 'reanalyze' ? 'Re-analyze' : 'Reject'} Dimension: {feedbackModal.dimension?.replace(/_/g, ' ')}
                        </h3>
                        <p>Please provide feedback for {feedbackModal.mode === 'reanalyze' ? 're-analysis' : 'rejection'}:</p>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder={feedbackModal.mode === 'reanalyze' 
                                ? "E.g., The document actually contains all required sections on pages 5-7. Please reconsider the completeness score."
                                : "E.g., The document actually contains all required sections. Please re-evaluate Completeness considering pages 5-7."}
                            rows={4}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => setFeedbackModal({ show: false, dimension: null, mode: 'reject' })}>
                                Cancel
                            </button>
                            <button
                                onClick={feedbackModal.mode === 'reanalyze' ? submitReanalysis : submitRejection}
                                disabled={reanalyzing}
                                style={{ background: feedbackModal.mode === 'reanalyze' ? '#3b82f6' : '#ef4444', color: 'white' }}
                            >
                                {reanalyzing ? 'Processing...' : (feedbackModal.mode === 'reanalyze' ? 'Re-analyze Now' : 'Submit Rejection')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DimensionScoreCard;
