import React, { useState } from 'react';
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
import api from '../services/api';
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

const DimensionScoreCard = ({ dimensions, recommendedAction, overallScore, fileName, fileData }) => {
    const [dimensionApprovals, setDimensionApprovals] = useState(fileData?.dimension_approvals || {});
    const [feedbackModal, setFeedbackModal] = useState({ show: false, dimension: null });
    const [feedback, setFeedback] = useState('');
    const [reanalyzing, setReanalyzing] = useState(false);

    if (!dimensions || Object.keys(dimensions).length === 0) {
        return null;
    }

    // Prepare data for radar chart
    const dimensionNames = Object.keys(dimensions);
    const scores = dimensionNames.map(name => dimensions[name]?.score || 0);

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
            await api.post('/approve-dimension', {
                file_name: fileName,
                dimension_name: dimensionName
            });

            setDimensionApprovals(prev => ({
                ...prev,
                [dimensionName]: { status: 'approved', timestamp: new Date().toISOString() }
            }));
        } catch (error) {
            console.error('Error approving dimension:', error);
            alert('Failed to approve dimension');
        }
    };

    // Handle dimension rejection
    const handleRejectDimension = (dimensionName) => {
        setFeedbackModal({ show: true, dimension: dimensionName });
        setFeedback('');
    };

    // Submit rejection with feedback
    const submitRejection = async () => {
        try {
            await api.post('/reject-dimension', {
                file_name: fileName,
                dimension_name: feedbackModal.dimension,
                feedback: feedback
            });

            setDimensionApprovals(prev => ({
                ...prev,
                [feedbackModal.dimension]: {
                    status: 'rejected',
                    feedback: feedback,
                    timestamp: new Date().toISOString()
                }
            }));

            setFeedbackModal({ show: false, dimension: null });
        } catch (error) {
            console.error('Error rejecting dimension:', error);
            alert('Failed to reject dimension');
        }
    };

    // Handle re-analysis
    const handleReanalyze = async () => {
        const rejectedDimensions = Object.entries(dimensionApprovals)
            .filter(([_, approval]) => approval.status === 'rejected')
            .reduce((acc, [dim, approval]) => {
                acc[dim] = approval.feedback;
                return acc;
            }, {});

        if (Object.keys(rejectedDimensions).length === 0) {
            alert('No rejected dimensions to re-analyze');
            return;
        }

        setReanalyzing(true);
        try {
            // This would need file metadata from parent component
            alert('Re-analysis feature requires file metadata. Please implement in parent component.');
        } catch (error) {
            console.error('Error re-analyzing:', error);
            alert('Failed to re-analyze file');
        } finally {
            setReanalyzing(false);
        }
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
                                const dim = dimensions[name];
                                const score = dim?.score || 0;
                                const approval = dimensionApprovals[name];

                                return (
                                    <tr key={name} className={approval?.status === 'rejected' ? 'rejected-row' : ''}>
                                        <td className="dimension-name">{name.replace(/_/g, ' ')}</td>
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
                                                <span className="status-badge rejected">✗ Rejected</span>
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
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Feedback Modal */}
            {feedbackModal.show && (
                <div className="modal-overlay" onClick={() => setFeedbackModal({ show: false, dimension: null })}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Reject Dimension: {feedbackModal.dimension?.replace(/_/g, ' ')}</h3>
                        <p>Please provide feedback for re-analysis:</p>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="E.g., The document actually contains all required sections. Please re-evaluate Completeness considering pages 5-7."
                            rows={4}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => setFeedbackModal({ show: false, dimension: null })}>
                                Cancel
                            </button>
                            <button
                                onClick={submitRejection}
                                style={{ background: '#ef4444', color: 'white' }}
                            >
                                Submit Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DimensionScoreCard;
