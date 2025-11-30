import axios from 'axios';

const API_URL = 'http://localhost:8001/api';

const api = axios.create({
    baseURL: API_URL,
});

export const listFiles = async (bucket, prefix = '', region = null, accessKey = null, secretKey = null, roleArn = null) => {
    try {
        const params = { prefix };
        if (region) params.region = region;
        if (accessKey) params.access_key = accessKey;
        if (secretKey) params.secret_key = secretKey;
        if (roleArn) params.role_arn = roleArn;

        const response = await api.get(`/list-files/${bucket}`, {
            params
        });
        return response.data;
    } catch (error) {
        console.error('Error listing files:', error);
        throw error;
    }
};

export const listBedrockModels = async (region = null, accessKey = null, secretKey = null) => {
    try {
        const params = {};
        if (region) params.region = region;
        if (accessKey) params.access_key = accessKey;
        if (secretKey) params.secret_key = secretKey;

        const response = await api.get('/bedrock-models', { params });
        return response.data;
    } catch (error) {
        console.error('Error listing Bedrock models:', error);
        throw error;
    }
};

export const extractMetadata = async (bucket, keys, region = null, accessKey = null, secretKey = null, roleArn = null, modelId = null) => {
    try {
        const payload = {
            bucket,
            keys,
            region,
            access_key: accessKey,
            secret_key: secretKey,
            role_arn: roleArn,
            model_id: modelId
        };
        const response = await api.post('/extract-metadata', payload);
        return response.data;
    } catch (error) {
        console.error('Error extracting metadata:', error);
        throw error;
    }
};

export default api;
export const getFileContent = async (bucket, key, region = null, accessKey = null, secretKey = null, roleArn = null) => {
    try {
        const params = {
            bucket,
            key,
            region,
            access_key: accessKey,
            secret_key: secretKey,
            role_arn: roleArn
        };
        const response = await api.get('/file-content', { params });
        return response.data;
    } catch (error) {
        console.error('Error reading file content:', error);
        throw error;
    }
};

export const getScanHistory = async (bucket, prefix = '', region = null, accessKey = null, secretKey = null, roleArn = null, limit = 10) => {
    try {
        const params = {
            bucket,
            prefix,
            region,
            access_key: accessKey,
            secret_key: secretKey,
            role_arn: roleArn,
            limit
        };
        const response = await api.get('/scan-history', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching scan history:', error);
        throw error;
    }
};
