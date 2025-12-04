import axios from 'axios';

// IMPORTANT: Port 8003 is the ONLY correct backend port
// Changed to 8003 to bypass browser cache issues
export const API_URL = 'http://localhost:8003/api';

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
        console.log('[API] getFileContent called with:', { bucket, key, region, accessKey: accessKey ? '***' : null, secretKey: secretKey ? '***' : null, roleArn });

        const params = {
            bucket,
            key,
            region,
            access_key: accessKey,
            secret_key: secretKey,
            role_arn: roleArn
        };

        // Log params with masked credentials
        console.log('[API] Calling /file-content with params:', {
            ...params,
            access_key: params.access_key ? '***' : null,
            secret_key: params.secret_key ? '***' : null
        });
        const response = await api.get('/file-content', { params });
        console.log('[API] getFileContent response received');
        return response.data;
    } catch (error) {
        console.error('[API] Error reading file content:', error);
        console.error('[API] Error response:', error.response?.data);
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

export const listHistory = async () => {
    try {
        const response = await api.get('/history');
        return response.data;
    } catch (error) {
        console.error('Error listing history:', error);
        throw error;
    }
};

export const getHistoryContent = async (filename) => {
    try {
        const response = await api.get(`/history/${filename}`);
        return response.data;
    } catch (error) {
        console.error('Error getting history content:', error);
        throw error;
    }
};

export const approveDimension = async (fileName, dimensionName) => {
    try {
        const response = await api.post('/approve-dimension', {
            file_name: fileName,
            dimension_name: dimensionName
        });
        return response.data;
    } catch (error) {
        console.error('Error approving dimension:', error);
        throw error;
    }
};

export const rejectDimension = async (fileName, dimensionName, feedback) => {
    try {
        const response = await api.post('/reject-dimension', {
            file_name: fileName,
            dimension_name: dimensionName,
            feedback: feedback
        });
        return response.data;
    } catch (error) {
        console.error('Error rejecting dimension:', error);
        throw error;
    }
};

export const reanalyzeDimension = async (fileName, dimensionName, feedback, bucket, region, accessKey, secretKey, modelId) => {
    try {
        const response = await api.post('/reanalyze-dimension', {
            file_name: fileName,
            dimension_name: dimensionName,
            feedback: feedback,
            bucket: bucket,
            region: region,
            access_key: accessKey,
            secret_key: secretKey,
            model_id: modelId
        });
        return response.data;
    } catch (error) {
        console.error('Error reanalyzing dimension:', error);
        throw error;
    }
};
