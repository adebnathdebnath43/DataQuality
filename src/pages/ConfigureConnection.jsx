import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Card from '../components/Card';
import './ConfigureConnection.css';

const ConfigureConnection = () => {
    const { sourceId } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({});
    const [authMethod, setAuthMethod] = useState('iam'); // 'iam', 'assume_role', 'keys'

    // Reset auth method when source changes
    useEffect(() => {
        if (sourceId === 'aws') {
            setAuthMethod('iam');
        }
    }, [sourceId]);

    const getFields = () => {
        if (sourceId === 'aws') {
            const commonFields = [
                { name: 'connectionName', label: 'Connection Name (Optional)', type: 'text', placeholder: 'e.g., Production Account, Dev Environment', required: false },
                { name: 'bucket', label: 'Bucket Name', type: 'text', required: true },
                { name: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1', required: true },
            ];

            if (authMethod === 'keys') {
                return [
                    ...commonFields,
                    { name: 'accessKey', label: 'Access Key ID', type: 'text', required: true },
                    { name: 'secretKey', label: 'Secret Access Key', type: 'password', required: true },
                ];
            } else if (authMethod === 'assume_role') {
                return [
                    ...commonFields,
                    { name: 'roleArn', label: 'Role ARN', type: 'text', placeholder: 'arn:aws:iam::123456789012:role/MyRole', required: true },
                    { name: 'externalId', label: 'External ID (Optional)', type: 'text', required: false },
                ];
            }
            // 'iam' - no extra fields
            return commonFields;
        }

        // Return default fields for other sources
        const sourceConfig = {
            snowflake: [
                { name: 'account', label: 'Account URL', type: 'text', placeholder: 'xy12345.snowflakecomputing.com', required: true },
                { name: 'username', label: 'Username', type: 'text', required: true },
                { name: 'password', label: 'Password', type: 'password', required: true },
                { name: 'warehouse', label: 'Warehouse', type: 'text', required: true },
                { name: 'database', label: 'Database', type: 'text', required: true },
                { name: 'schema', label: 'Schema', type: 'text', required: true },
            ],
            postgres: [
                { name: 'host', label: 'Host', type: 'text', placeholder: 'db.example.com', required: true },
                { name: 'port', label: 'Port', type: 'number', placeholder: '5432', required: true },
                { name: 'database', label: 'Database Name', type: 'text', required: true },
                { name: 'username', label: 'Username', type: 'text', required: true },
                { name: 'password', label: 'Password', type: 'password', required: true },
            ],
            default: [
                { name: 'connectionString', label: 'Connection String', type: 'text', required: true },
                { name: 'username', label: 'Username', type: 'text', required: true },
                { name: 'password', label: 'Password', type: 'password', required: true },
            ]
        };
        return sourceConfig[sourceId] || sourceConfig.default;
    };

    const getSourceDetails = () => {
        const details = {
            snowflake: { name: 'Snowflake', icon: '❄️' },
            postgres: { name: 'PostgreSQL', icon: '🐘' },
            aws: { name: 'AWS S3', icon: '🟧' },
            default: { name: 'Data Source', icon: '🔌' }
        };
        return details[sourceId] || details.default;
    };

    const sourceDetails = getSourceDetails();
    const fields = getFields();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Create a unique source name for S3
        let displayName = sourceDetails.name;
        if (sourceId === 'aws') {
            if (formData.connectionName) {
                // Use custom connection name if provided
                displayName = formData.connectionName;
            } else if (formData.bucket) {
                // Fall back to bucket name
                displayName = `S3_${formData.bucket}`;
            }
        }

        const connectionData = {
            id: Date.now().toString(),
            sourceId,
            sourceName: displayName,
            icon: sourceDetails.icon,
            connectedAt: new Date().toISOString(),
            ...formData,
            authMethod: sourceId === 'aws' ? authMethod : undefined
        };

        // Simulate saving to backend (LocalStorage)
        const existing = JSON.parse(localStorage.getItem('connectedSources') || '[]');
        localStorage.setItem('connectedSources', JSON.stringify([connectionData, ...existing]));

        console.log('Connected:', connectionData);

        // Show loading state (simulated)
        const btn = e.target.querySelector('button[type="submit"]');
        if (btn) btn.textContent = 'Connecting...';

        setTimeout(() => {
            navigate('/');
        }, 1500);
    };

    return (
        <div className="configure-page fade-in">
            <div className="config-header">
                <div className="config-icon">{sourceDetails.icon}</div>
                <h1>Connect to {sourceDetails.name}</h1>
                <p>Enter your credentials to establish a secure connection.</p>
            </div>

            <Card className="config-form-card">
                <form onSubmit={handleSubmit}>
                    {sourceId === 'aws' && (
                        <div className="form-group">
                            <label>Authentication Method</label>
                            <div className="auth-options">
                                <button
                                    type="button"
                                    className={`auth-option ${authMethod === 'iam' ? 'active' : ''}`}
                                    onClick={() => setAuthMethod('iam')}
                                >
                                    IAM Role (Recommended)
                                </button>
                                <button
                                    type="button"
                                    className={`auth-option ${authMethod === 'assume_role' ? 'active' : ''}`}
                                    onClick={() => setAuthMethod('assume_role')}
                                >
                                    Assume Role
                                </button>
                                <button
                                    type="button"
                                    className={`auth-option ${authMethod === 'keys' ? 'active' : ''}`}
                                    onClick={() => setAuthMethod('keys')}
                                >
                                    Access Keys
                                </button>
                            </div>
                            {authMethod === 'iam' && (
                                <p className="auth-hint">
                                    Using credentials from the environment (EC2 Instance Profile or ECS/EKS Task Role).
                                    Ensure this application's host has permission to access the S3 bucket.
                                </p>
                            )}
                        </div>
                    )}

                    {fields.map((field) => (
                        <div key={field.name} className="form-group">
                            <label htmlFor={field.name}>{field.label}</label>
                            <input
                                id={field.name}
                                name={field.name}
                                type={field.type}
                                placeholder={field.placeholder}
                                onChange={handleChange}
                                className="form-input"
                                required={field.required}
                            />
                        </div>
                    ))}

                    <div className="form-actions">
                        <Button type="button" variant="secondary" onClick={() => navigate('/connect')}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary">
                            Test & Connect
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default ConfigureConnection;
