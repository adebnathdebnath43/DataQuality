import React from 'react';
import './QualityScoreChart.css';

const QualityScoreChart = ({ scans }) => {
    if (!scans || scans.length === 0) {
        return (
            <div className="quality-chart-empty">
                <p>No scan data available</p>
            </div>
        );
    }

    // Get the most recent 10 scans for the chart
    const chartData = scans.slice(0, 10).reverse();
    const maxScore = 100;

    return (
        <div className="quality-score-chart">
            <div className="chart-header">
                <h3>Quality Score Trend</h3>
                <div className="chart-legend">
                    <span className="legend-item">
                        <span className="legend-color excellent"></span>
                        Excellent (80-100)
                    </span>
                    <span className="legend-item">
                        <span className="legend-color good"></span>
                        Good (60-79)
                    </span>
                    <span className="legend-item">
                        <span className="legend-color fair"></span>
                        Fair (40-59)
                    </span>
                    <span className="legend-item">
                        <span className="legend-color poor"></span>
                        Poor (0-39)
                    </span>
                </div>
            </div>

            <div className="chart-container">
                <div className="chart-y-axis">
                    <span>100</span>
                    <span>75</span>
                    <span>50</span>
                    <span>25</span>
                    <span>0</span>
                </div>

                <div className="chart-bars">
                    {chartData.map((scan, index) => {
                        const score = scan.quality_score || 0;
                        const height = (score / maxScore) * 100;
                        const barClass = score >= 80 ? 'excellent' :
                            score >= 60 ? 'good' :
                                score >= 40 ? 'fair' : 'poor';

                        return (
                            <div key={index} className="chart-bar-wrapper">
                                <div className="chart-bar-container">
                                    <div
                                        className={`chart-bar ${barClass}`}
                                        style={{ height: `${height}%` }}
                                        title={`${scan.file_name}: ${score}%`}
                                    >
                                        <span className="bar-value">{score}</span>
                                    </div>
                                </div>
                                <div className="chart-label">
                                    {new Date(scan.processed_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default QualityScoreChart;
