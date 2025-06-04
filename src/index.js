const https = require('https');
const crypto = require('crypto');

const pluginName = 'picgo-plugin-123pan';

// Helper function to make HTTPS requests
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsedBody = JSON.parse(body);
                    if (parsedBody.code !== 0) {
                        reject(new Error(`API Error: ${parsedBody.message} (code: ${parsedBody.code}, traceID: ${parsedBody['x-traceID']})`));
                    } else {
                        resolve(parsedBody);
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error.message}, Response body: ${body}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(data);
        }
        req.end();
    });
}

// Add a helper function to safely extract values from API responses
function safeGet(obj, path, defaultValue = null) {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
        if (result === undefined || result === null || typeof result !== 'object') {
            return defaultValue;
        }
        result = result[key];
    }
    
    return result !== undefined ? result : defaultValue;
}

// Get access token
async function getAccessToken(ctx) {
    const config = ctx.getConfig('picBed.123pan');
    if (!config || !config.clientID || !config.clientSecret) {
        throw new Error('clientID and clientSecret are required');
    }

    const options = {
        hostname: 'open-api.123pan.com',
        path: '/api/v1/access_token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Platform': 'open_platform'
        }
    };

    const data = JSON.stringify({
        clientID: config.clientID,
        clientSecret: config.clientSecret
    });

    try {
        ctx.log.info('Requesting access token from 123pan API...');
        const response = await makeRequest(options, data);
        ctx.log.info(`Access token obtained, expires at: ${response.data.expiredAt}`);
        return response.data;
    } catch (error) {
        ctx.log.error(`Failed to get access token: ${error.message}`);
        throw error; // Re-throw to be handled by caller
    }
}


async function createDirectory(ctx, accessToken, parentID, dirName) {
    if (!dirName || typeof dirName !== 'string' || dirName.trim() === '') {
        ctx.log.info('No directory name provided, using root directory');
        return { code: 0, data: { fileID: "" } }; // Return empty fileID to indicate root
    }
    
    const options = {
        hostname: 'open-api.123pan.com',
        path: '/upload/v1/oss/file/mkdir',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Platform': 'open_platform',
            'Authorization': `Bearer ${accessToken}`
        }
    };

    // Sanitize the directory name and normalize parent ID
    const sanitizedName = sanitizeFilename(dirName);
    const normalizedParentID = normalizeParentFileID(parentID);

    const data = JSON.stringify({
        name: [sanitizedName],
        parentID: normalizedParentID,
        type: 1 // Required parameter - must be 1 for directories
    });

    try {
        ctx.log.info(`Creating directory: ${sanitizedName} under parent ID: ${normalizedParentID || 'root'}`);
        const res = await makeRequest(options, data);
        ctx.log.info(`Directory created successfully with ID: ${res.data.fileID}`);
        return res;
    } catch (err) {
        // Try to handle common errors
        const errorMessage = err.message.toLowerCase();
        const isDirectoryExists = 
            errorMessage.includes('目录名') && 
            (errorMessage.includes('不能重名') || errorMessage.includes('已存在'));
        
        if (isDirectoryExists) {
            ctx.log.warn(`Directory ${sanitizedName} already exists, trying to find its ID.`);

            try {
                const fileList = await getFileList(ctx, accessToken, normalizedParentID);
                
                if (fileList && fileList.data && Array.isArray(fileList.data.fileList)) {
                    for (const file of fileList.data.fileList) {
                        if (file.filename === sanitizedName && file.type === 1) {
                            ctx.log.info(`Found existing directory ID: ${file.fileID}`);
                            return { code: 0, data: { fileID: file.fileID } };
                        }
                    }
                } else {
                    ctx.log.warn(`File list response format unexpected: ${JSON.stringify(fileList)}`);
                }
                
                // Couldn't find the directory in the list, return root as fallback
                ctx.log.warn(`Directory ${sanitizedName} mentioned as existing but not found in listing, using root directory`);
                return { code: 0, data: { fileID: "" } };
            } catch (listError) {
                ctx.log.error(`Error getting file list: ${listError.message}`);
                // Fallback to root directory
                return { code: 0, data: { fileID: "" } };
            }
        }
        
        ctx.log.error(`Failed to create or find directory: ${err.message}`);
        // In case of error, fall back to root directory
        return { code: 0, data: { fileID: "" } };
    }
}


async function getFileList(ctx, accessToken, parentFileID = "") {
    const options = {
        hostname: 'open-api.123pan.com',
        path: '/api/v1/oss/file/list',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Platform': 'open_platform',
            'Authorization': `Bearer ${accessToken}`
        }
    };
    
    const normalizedParentID = normalizeParentFileID(parentFileID);
    
    const data = JSON.stringify({
        parentFileID: normalizedParentID,
        limit: 100,
    });

    try {
        ctx.log.info(`Getting file list for parent ID: ${normalizedParentID || 'root'}`);
        const res = await makeRequest(options, data);
        
        // Ensure the response has the expected structure
        if (!res.data || !res.data.fileList) {
            res.data = res.data || {};
            res.data.fileList = res.data.fileList || [];
            ctx.log.warn('File list response missing expected data structure, using empty list');
        }
        
        return res;
    } catch (error) {
        ctx.log.error(`Error getting file list: ${error.message}`);
        // Return a valid empty structure to avoid further errors
        return { code: 0, data: { fileList: [], lastFileID: '-1' } };
    }
}

async function createFile(ctx, accessToken, parentFileID, filename, etag, size) {
    const options = {
        hostname: 'open-api.123pan.com',
        path: '/upload/v1/oss/file/create',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Platform': 'open_platform',
            'Authorization': `Bearer ${accessToken}`
        }
    };

    const data = JSON.stringify({
        parentFileID: parentFileID,
        filename: filename,
        etag: etag,
        size: size,
        type: 1
    });
    return makeRequest(options, data);
}

async function getUploadUrl(ctx, accessToken, preuploadID, sliceNo) {
    const options = {
        hostname: 'open-api.123pan.com',
        path: '/upload/v1/oss/file/get_upload_url',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Platform': 'open_platform',
            'Authorization': `Bearer ${accessToken}`
        }
    };

    const data = JSON.stringify({
        preuploadID: preuploadID,
        sliceNo: sliceNo
    });

    return makeRequest(options, data);
}

async function uploadComplete(ctx, accessToken, preuploadID) {
    if (!preuploadID) {
        throw new Error('Empty preuploadID passed to uploadComplete function');
    }
    
    const options = {
        hostname: 'open-api.123pan.com',
        path: '/upload/v1/oss/file/upload_complete',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Platform': 'open_platform',
            'Authorization': `Bearer ${accessToken}`
        }
    };

    ctx.log.info(`Completing upload with preuploadID: ${preuploadID}`);
    
    const data = JSON.stringify({
        preuploadID: preuploadID
    });

    try {
        return await makeRequest(options, data);
    } catch (error) {
        // Enhanced error with context
        const enhancedError = new Error(`uploadComplete failed: ${error.message} (preuploadID: ${preuploadID})`);
        enhancedError.originalError = error;
        throw enhancedError;
    }
}

async function uploadAsyncResult(ctx, accessToken, preuploadID) {
    if (!preuploadID) {
        throw new Error('Empty preuploadID passed to uploadAsyncResult function');
    }
    
    const options = {
        hostname: 'open-api.123pan.com',
        path: '/upload/v1/oss/file/upload_async_result',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Platform': 'open_platform',
            'Authorization': `Bearer ${accessToken}`
        }
    };
    
    // Log the request being made
    ctx.log.info(`Calling upload_async_result API with preuploadID: ${preuploadID}`);
    
    const data = JSON.stringify({
        preuploadID: preuploadID
    });
    
    try {
        const result = await makeRequest(options, data);
        return result;
    } catch (error) {
        // Enhance error with more context
        const enhancedError = new Error(`uploadAsyncResult failed: ${error.message} (preuploadID: ${preuploadID})`);
        enhancedError.originalError = error;
        throw enhancedError;
    }
}

// Get file details to obtain the proper download URL
async function getFileDetails(ctx, accessToken, fileID) {
    const options = {
        hostname: 'open-api.123pan.com',
        path: `/api/v1/oss/file/detail?fileID=${fileID}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Platform': 'open_platform',
            'Authorization': `Bearer ${accessToken}`
        }
    };

    try {
        const response = await makeRequest(options);
        if (!response.data.downloadURL) {
            ctx.log.warn(`File details API returned no downloadURL for fileID: ${fileID}`);
        }
        return response;
    } catch (error) {
        ctx.log.error(`Failed to get file details: ${error.message}`);
        throw error;
    }
}

// Utility function to generate fallback URLs if needed
function generateFallbackUrl(fileID) {
    // Generate multiple possible URLs to try
    return {
        main: `https://www.123pan.com/s/${fileID}`,
        alternate: `https://www.123pan.com/b/${fileID}`,
        api: `https://www.123pan.com/open-api/${fileID}`
    };
}

async function uploadFileSlice(ctx, url, buffer) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { method: 'PUT', headers: { 'Content-Length': buffer.length } }, (res) => { // Add Content-Length
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body);
                } else {
                    reject(new Error(`Upload slice failed with status code: ${res.statusCode}, response: ${body}`));
                }
            });
        });
        req.on('error', reject);
        req.write(buffer);
        req.end();
    });
}

// Utility function to validate and sanitize filenames
function sanitizeFilename(filename) {
    // Remove characters not allowed by 123pan or Windows filesystems
    // Characters: \ / : * ? " < > |
    let sanitized = filename.replace(/[\/:*?"<>|]/g, '_');
    
    // Ensure the filename is under 255 characters
    if (sanitized.length > 254) {
        const extension = sanitized.includes('.') 
            ? sanitized.substring(sanitized.lastIndexOf('.')) 
            : '';
        sanitized = sanitized.substring(0, 254 - extension.length) + extension;
    }
    
    return sanitized;
}

// Ensure parentFileID is in the correct format
function normalizeParentFileID(parentFileID) {
    // If it's empty or null/undefined, return an empty string
    if (!parentFileID) return "";
    
    // Otherwise ensure it's a string
    return String(parentFileID);
}

async function handleUpload(ctx) {
    // Log full environment information to help with debugging
    ctx.log.info(`PicGo-plugin-123pan version: ${require('../package.json').version}`);
    ctx.log.info(`PicGo upload source: ${ctx.getConfig('picBed.current') || 'unknown'}`);
    const isGuiMode = Boolean(ctx.gui);
    ctx.log.info(`Running in environment: ${isGuiMode ? 'GUI' : 'CLI'}`);
    
    // Detect if we're likely being called by Typora
    const isTypora = !isGuiMode && process.argv.some(arg => arg.includes('typora'));
    if (isTypora) {
        ctx.log.info('Detected Typora as the likely caller, using Typora-specific optimizations');
        // For debugging - log all process arguments to help identify Typora patterns
        ctx.log.info(`Process arguments: ${JSON.stringify(process.argv)}`);
    }

    // For debugging - log the context properties to help understand what Typora passes
    try {
        ctx.log.info(`Context output paths: ${ctx.output.map(img => img.fileName || 'unnamed').join(', ')}`);
    } catch (e) {
        ctx.log.warn(`Error logging context output: ${e.message}`);
    }
    
    const userConfig = ctx.getConfig('picBed.123pan');
    if (!userConfig) {
        throw new Error('123pan uploader configuration is missing.');
    }

    // Make sure output is properly initialized
    let imgList = ctx.output;
    if (!imgList || !Array.isArray(imgList) || imgList.length === 0) {
        ctx.log.warn('No images to upload');
        return ctx;
    }

    // Store success/failure stats
    const stats = {
        total: imgList.length,
        success: 0,
        failed: 0,
        retries: 0
    };

    // Track if this is potentially a first-time upload in the session
    // We'll handle these uploads with extra care and retries
    let isFirstUploadThisSession = false;
    
    // Get and check the upload history flag
    try {
        const uploadState = ctx.getConfig(`${pluginName}.uploadState`) || {};
        if (!uploadState.lastUploadTime) {
            isFirstUploadThisSession = true;
            ctx.log.info('This appears to be the first upload in this session, will use extra care');
        } else {
            // If the last upload was more than 5 minutes ago, treat as a first upload
            const lastUploadTime = new Date(uploadState.lastUploadTime);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (lastUploadTime < fiveMinutesAgo) {
                isFirstUploadThisSession = true;
                ctx.log.info('Last upload was more than 5 minutes ago, treating as first upload');
            }
        }
        
        // Update the upload state
        ctx.saveConfig({
            [`${pluginName}.uploadState`]: {
                lastUploadTime: new Date().toISOString(),
                uploadCount: (uploadState.uploadCount || 0) + 1
            }
        });
    } catch (error) {
        // If we can't check/update the upload state, assume it's a first upload to be safe
        isFirstUploadThisSession = true;
        ctx.log.warn(`Error checking upload state: ${error.message}, treating as first upload`);
    }

    // Add delay function to avoid overwhelming the API
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    // For first uploads in Typora auto mode, add an extra initial delay
    if (isFirstUploadThisSession && isTypora) {
        ctx.log.info('Adding extended delay (5s) for Typora first upload stability...');
        await delay(5000);
    } else if (isFirstUploadThisSession) {
        ctx.log.info('Adding standard delay (2s) for first upload stability...');
        await delay(2000);
    }

    // 1. Get access token (reuse if available and not expired)
    let accessTokenData = ctx.getConfig(pluginName);
    let tokenExpiration = null;
    
    try {
        if (accessTokenData && accessTokenData.expiredAt) {
            tokenExpiration = new Date(accessTokenData.expiredAt);
            // Add a 5-minute buffer to avoid token expiration during upload
            const fiveMinutes = 5 * 60 * 1000;
            const bufferExpiration = new Date(tokenExpiration.getTime() - fiveMinutes);
            
            if (bufferExpiration <= new Date()) {
                ctx.log.info(`Access token expiring soon (${accessTokenData.expiredAt}), refreshing...`);
                accessTokenData = null; // Force refresh
            }
        }
    } catch (error) {
        ctx.log.warn(`Error checking token expiration: ${error.message}, will get a new token`);
        accessTokenData = null; // Force refresh if there's an error checking expiration
    }

    if (!accessTokenData || !accessTokenData.accessToken) {
        ctx.log.info('No access token found, obtaining a new one...');
        accessTokenData = await getAccessToken(ctx);
        ctx.saveConfig({
            [pluginName]: accessTokenData
        });
        ctx.log.info(`Access token obtained and saved: ${accessTokenData.accessToken.substring(0, 10)}...`);
    }

    const accessToken = accessTokenData.accessToken;

    // Add overall upload timeout for Typora to prevent indefinite hanging
    let uploadTimeout = null;
    if (isTypora) {
        // Set a timeout to force completion after 60 seconds for Typora
        uploadTimeout = setTimeout(() => {
            ctx.log.warn('Upload timeout reached (60s) - forcing completion for Typora');
            
            // Find any images that don't have URLs and set fallback values
            for (const img of imgList) {
                if (!img.imgUrl || !img.url) {
                    ctx.log.warn(`Setting fallback URL for timed-out image: ${img.fileName || 'unnamed'}`);
                    
                    // Set a placeholder URL to ensure Typora knows the upload completed
                    const placeholderUrl = `https://www.123pan.com/timeout-placeholder-${Date.now()}`;
                    img.imgUrl = placeholderUrl;
                    img.url = placeholderUrl;
                    
                    // Mark as failed in our stats
                    stats.failed++;
                    
                    // Emit a notification about the timeout
                    ctx.emit('notification', {
                        title: 'Upload Timeout',
                        body: `The upload timed out after 60 seconds. Please try again by right-clicking the image.`,
                        text: ''
                    });
                }
            }
            
            // Force the return of the context to complete the upload cycle
            ctx.log.info('Returning context to PicGo after timeout');
        }, 60000); // 60 second timeout
    }

    try {
        // Process images with retry capability
        await processImages(ctx, imgList, {
            accessToken,
            parentFileID: userConfig.parentFileID,
            isFirstUploadThisSession,
            isTypora,
            stats
        });
        
        // Clear the timeout if we finished normally
        if (uploadTimeout) {
            clearTimeout(uploadTimeout);
            uploadTimeout = null;
        }

        // Report final statistics
        ctx.log.info(`Upload complete: ${stats.success}/${stats.total} successful, ${stats.failed} failed, ${stats.retries} retries`);
        if (stats.failed > 0) {
            ctx.log.error(`Failed to upload ${stats.failed} images`);
            
            // Special Typora handling for failed uploads
            if (isTypora && isFirstUploadThisSession && stats.failed > 0) {
                ctx.log.warn('First Typora upload failed - this is a known issue. Please try again by right-clicking the image.');
            }
        }
        
        // For Typora uploads, ensure each image has url/imgUrl properties set
        // This is critical as Typora specifically looks for these values
        if (isTypora) {
            for (const img of imgList) {
                if (!img.imgUrl || !img.url) {
                    ctx.log.warn(`Missing URL for image ${img.fileName} after upload - setting fallback`);
                    const fallbackUrl = `https://www.123pan.com/typora-fallback-${Date.now()}`;
                    img.imgUrl = fallbackUrl;
                    img.url = fallbackUrl;
                }
            }
            
            // Log the final image URLs that will be returned to Typora
            ctx.log.info(`Returning URLs to Typora: ${imgList.map(img => img.url).join(', ')}`);
        }
    } catch (error) {
        // Clear the timeout if we errored out
        if (uploadTimeout) {
            clearTimeout(uploadTimeout);
            uploadTimeout = null;
        }
        
        ctx.log.error(`Unexpected error in upload process: ${error.message}`);
        
        // Ensure we mark all uploads as failed if we hit a catastrophic error
        for (const img of imgList) {
            if (!img.imgUrl || !img.url) {
                img.imgUrl = '';
                img.url = '';
            }
        }
        
        // Emit a notification about the error
        ctx.emit('notification', {
            title: 'Upload Error',
            body: `An unexpected error occurred: ${error.message}`,
            text: ''
        });
    }

    // Ensure the context is returned for PicGo to process
    return ctx;
}

// Separate function to process images with retry capability
async function processImages(ctx, imgList, options) {
    const { accessToken, parentFileID: configParentFileID, isFirstUploadThisSession, isTypora, stats } = options;
    const failedList = [];
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Add a timeout Promise utility for individual operations
    const withTimeout = (promise, timeoutMs, errorMessage) => {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
        });
        
        return Promise.race([
            promise,
            timeoutPromise
        ]).finally(() => clearTimeout(timeoutId));
    };

    // Resolve parentFileID - with improved error handling
    let parentFileID = ""; // root as default
    if (configParentFileID) {
        try {
            // Attempt to create/find the directory using the provided NAME.
            const result = await createDirectory(ctx, accessToken, "", configParentFileID);
            if (result && result.data && result.data.fileID) {
                parentFileID = result.data.fileID; // Get the ID.
                ctx.log.info(`Using directory with ID: ${parentFileID}`);
            } else {
                ctx.log.warn(`Directory operation returned unexpected result, using root directory: ${JSON.stringify(result)}`);
                // Fall back to root directory
                parentFileID = "";
            }
        } catch (e) {
            ctx.log.error(`Failed to get/create directory ${configParentFileID}: ${e.message}`);
            ctx.log.info(`Falling back to root directory for uploads`);
            // Don't throw here, just use root directory
            parentFileID = "";
        }
    }

    // Set up automatic retry for Typora first uploads
    const maxAutoRetries = isTypora && isFirstUploadThisSession ? 3 : 0;
    
    for (let i = 0; i < imgList.length; i++) {
        let img = imgList[i];
        let retryCount = 0;
        let uploadSuccess = false;
        
        // For Typora, add extra logging to help diagnose issues
        if (isTypora) {
            ctx.log.info(`Typora image details: fileName=${img.fileName}, path=${img.path || 'none'}, extname=${img.extname || 'none'}`);
        }
        
        while (retryCount <= maxAutoRetries && !uploadSuccess) {
            if (retryCount > 0) {
                const retryDelay = 3000 * retryCount; // 3s, 6s, 9s for retries
                ctx.log.info(`Automatic retry ${retryCount}/${maxAutoRetries} for ${img.fileName} after ${retryDelay}ms delay...`);
                await delay(retryDelay);
                stats.retries++;
            }
            
            try {
                // Add a small delay between uploads to avoid API rate limits
                if (i > 0 && retryCount === 0) await delay(500);
                
                // Log detailed information about the image
                ctx.log.info(`Processing image ${i+1}/${imgList.length}: ${img.fileName || 'unnamed'} (attempt ${retryCount + 1})`);
                
                // Ensure the image has required properties
                if (!img.fileName) {
                    const ext = img.extname || '.png'; // Default to .png if no extension
                    img.fileName = `${Date.now()}${ext}`;
                    ctx.log.warn(`Image missing fileName, generated: ${img.fileName}`);
                }
                
                // Get the image buffer
                let buffer;
                try {
                    // Timeout the buffer request to prevent hanging
                    buffer = await withTimeout(
                        img.buffer ? Promise.resolve(img.buffer) : ctx.request(img.url),
                        15000,  // 15 second timeout
                        'Timed out while getting image buffer'
                    );
                } catch (bufferError) {
                    ctx.log.error(`Failed to get image buffer: ${bufferError.message}`);
                    throw new Error(`Failed to get image data: ${bufferError.message}`);
                }
                
                if (!buffer || buffer.length === 0) {
                    throw new Error('Image buffer is empty or invalid');
                }
                
                const md5 = crypto.createHash('md5').update(buffer).digest('hex');
                const fileSize = buffer.length;
                const fileName = sanitizeFilename(img.fileName);

                ctx.log.info(`Uploading ${fileName}, size: ${fileSize} bytes, MD5: ${md5}`);

                // 2. Create file
                const normalizedParentID = normalizeParentFileID(parentFileID);
                let createRes = await withTimeout(
                    createFile(ctx, accessToken, normalizedParentID, fileName, md5, fileSize),
                    20000,  // 20 second timeout
                    'Timed out while creating file on 123pan'
                );
                let uploadResult = createRes.data;
                
                if (!uploadResult) {
                    throw new Error(`Failed to create file: No result data returned`);
                }

                // 3. Check if it's a fast upload (reuse = true)
                if (uploadResult.reuse) {
                    ctx.log.info(`Fast upload for ${fileName} (reuse=true)`);
                    if (!uploadResult.fileID) {
                        throw new Error('Fast upload succeeded but fileID is missing');
                    }
                    
                    // Get the proper download URL for fast upload
                    try {
                        const fileDetails = await withTimeout(
                            getFileDetails(ctx, accessToken, uploadResult.fileID),
                            15000,  // 15 second timeout
                            'Timed out while getting file details after fast upload'
                        );
                        if (fileDetails.data.downloadURL) {
                            img.imgUrl = fileDetails.data.downloadURL;
                        } else {
                            // Fallback to generated URL if downloadURL is missing
                            const fallbackUrls = generateFallbackUrl(uploadResult.fileID);
                            img.imgUrl = fallbackUrls.main;
                            ctx.log.warn(`Using fallback URL: ${img.imgUrl}`);
                        }
                    } catch (error) {
                        // If file details API fails, use fallback URL
                        const fallbackUrls = generateFallbackUrl(uploadResult.fileID);
                        img.imgUrl = fallbackUrls.main;
                        ctx.log.warn(`File details API failed, using fallback URL: ${img.imgUrl}`);
                    }
                    
                    img.url = img.imgUrl;
                    ctx.log.info(`Fast upload download URL: ${img.imgUrl}`);
                    delete img.buffer; // Clean up buffer
                    uploadSuccess = true;
                    break; // Exit retry loop
                }

                // 4. Verify preuploadID is present
                if (!uploadResult.preuploadID) {
                    throw new Error('PreuploadID is missing in the create file response');
                }

                ctx.log.info(`Got preuploadID: ${uploadResult.preuploadID}, sliceSize: ${uploadResult.sliceSize}`);

                // 5. Upload file slices
                let sliceNo = 1;
                while (true) {
                    const uploadUrlRes = await withTimeout(
                        getUploadUrl(ctx, accessToken, uploadResult.preuploadID, sliceNo),
                        15000,  // 15 second timeout
                        `Timed out while getting upload URL for slice ${sliceNo}`
                    );
                    
                    const start = (sliceNo - 1) * uploadResult.sliceSize;
                    const end = Math.min(sliceNo * uploadResult.sliceSize, fileSize);
                    const sliceBuffer = buffer.slice(start, end);
                    
                    if (sliceBuffer.length === 0) break;
                    
                    ctx.log.info(`Uploading slice ${sliceNo}, size: ${sliceBuffer.length} bytes`);
                    await withTimeout(
                        uploadFileSlice(ctx, uploadUrlRes.data.presignedURL, sliceBuffer),
                        30000,  // 30 second timeout for actual upload
                        `Timed out while uploading slice ${sliceNo}`
                    );
                    
                    sliceNo++;
                    if (end >= fileSize) break; // Finished uploading all slices
                }

                // 6. Complete upload
                ctx.log.info(`Completing upload for ${fileName}`);
                let completeRes = await withTimeout(
                    uploadComplete(ctx, accessToken, uploadResult.preuploadID),
                    20000,  // 20 second timeout
                    'Timed out while completing upload'
                );
                uploadResult = completeRes.data;

                // 7. Check if async result is needed
                if (uploadResult.async) {
                    ctx.log.info(`Async processing required, polling for results...`);
                    
                    // For Typora first uploads with multiple retries, use even more aggressive polling strategy
                    const pollingStrategy = isTypora && isFirstUploadThisSession ? 
                        { initialDelay: 2000, maxRetries: 10, retryDelay: 2000, lookupInterval: 2, totalTimeoutMs: 45000 } :
                        { initialDelay: 2000, maxRetries: 15, retryDelay: 1500, lookupInterval: 3, totalTimeoutMs: 60000 };
                    
                    // Store the original preuploadID for safe keeping
                    const originalPreuploadID = uploadResult.preuploadID;
                    ctx.log.info(`Original preuploadID: ${originalPreuploadID}`);
                    
                    // Add a delay before starting async polling to allow server processing
                    await delay(pollingStrategy.initialDelay);
                    
                    // Try to handle async polling with better error recovery and timeout
                    const asyncResult = await withTimeout(
                        handleAsyncPolling(ctx, {
                            accessToken,
                            originalPreuploadID,
                            fileName,
                            parentFileID,
                            uploadResult,
                            ...pollingStrategy
                        }),
                        pollingStrategy.totalTimeoutMs,
                        'Timed out during async polling'
                    );
                    
                    // Update the upload result with the async result
                    if (asyncResult && asyncResult.fileID) {
                        uploadResult = asyncResult;
                    } else {
                        throw new Error('Async polling failed to retrieve a valid fileID');
                    }
                }

                // 8. Verify fileID and set final URL
                if (!uploadResult.fileID) {
                    throw new Error('Upload completed but fileID is missing in the response');
                }

                // Get the proper download URL from file details
                try {
                    const fileDetails = await withTimeout(
                        getFileDetails(ctx, accessToken, uploadResult.fileID),
                        15000,  // 15 second timeout
                        'Timed out while getting file details'
                    );
                    if (fileDetails.data.downloadURL) {
                        img.imgUrl = fileDetails.data.downloadURL;
                    } else {
                        // Fallback to generated URL if downloadURL is missing
                        const fallbackUrls = generateFallbackUrl(uploadResult.fileID);
                        img.imgUrl = fallbackUrls.main;
                        ctx.log.warn(`File details API returned no downloadURL, using fallback URL: ${img.imgUrl}`);
                    }
                } catch (error) {
                    // If file details API fails, use fallback URL
                    const fallbackUrls = generateFallbackUrl(uploadResult.fileID);
                    img.imgUrl = fallbackUrls.main;
                    ctx.log.warn(`File details API failed, using fallback URL: ${img.imgUrl}. Error: ${error.message}`);
                }
                
                img.url = img.imgUrl;
                delete img.buffer; // Clean up buffer
                ctx.log.info(`File uploaded successfully: ${img.imgUrl}`);

                // Mark as success and update stats
                uploadSuccess = true;
                stats.success++;
                
            } catch (error) {
                if (retryCount < maxAutoRetries) {
                    ctx.log.warn(`Upload attempt ${retryCount + 1} failed: ${error.message}. Will retry automatically.`);
                    retryCount++;
                } else {
                    // This was the last attempt, mark as failed
                    stats.failed++;
                    ctx.log.error(`Failed to upload ${img.fileName} after ${retryCount} retries: ${error.message}`);
                    
                    // For Typora, always set a URL even on failure to avoid hanging
                    if (isTypora) {
                        const errorUrl = `https://www.123pan.com/upload-failed-${Date.now()}`;
                        img.imgUrl = errorUrl;
                        img.url = errorUrl;
                        ctx.log.warn(`Set error URL for Typora: ${errorUrl}`);
                    }
                    
                    // Specific handling for empty preuploadID errors
                    if (error.message.includes('预上传ID不能为空') || error.message.includes('preuploadID')) {
                        if (isTypora) {
                            ctx.log.warn('This is a known issue with Typora first uploads. Please try uploading again by right-clicking the image.');
                        } else {
                            ctx.log.warn('This is a known issue with first uploads. Try uploading again.');
                        }
                    }
                    
                    failedList.push(img.fileName);
                    
                    // Mark this image as failed but continue with others
                    if (!isTypora) {
                        img.imgUrl = '';
                        img.url = '';
                    }
                    delete img.buffer;
                    
                    ctx.emit('notification', {
                        title: 'Upload Failed',
                        body: `Error uploading ${img.fileName}: ${error.message}`,
                        text: ''
                    });
                    break; // Exit retry loop
                }
            }
        }
    }
    
    return { failedList };
}

// Dedicated function for async polling with better error handling
async function handleAsyncPolling(ctx, options) {
    const { 
        accessToken, 
        originalPreuploadID, 
        fileName, 
        parentFileID, 
        uploadResult,
        maxRetries = 15,
        initialDelay = 2000,
        retryDelay = 1500,
        lookupInterval = 3,  // How often to try file lookup
        totalTimeoutMs = 60000 // Maximum time for this entire polling operation
    } = options;
    
    let retries = 0;
    let consecutiveEmptyPreuploadErrors = 0;
    const maxEmptyPreuploadRetries = 3;
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
    // Calculate maximum processing time to avoid hanging
    const startTime = Date.now();
    const endTime = startTime + totalTimeoutMs;
    
    // First attempt direct lookup - this might find the file if it was already processed
    try {
        ctx.log.info(`Initial file lookup attempt for ${fileName}`);
        const fileList = await getFileList(ctx, accessToken, parentFileID);
        if (fileList && fileList.data && Array.isArray(fileList.data.fileList)) {
            for (const file of fileList.data.fileList) {
                if (file.filename === fileName) {
                    ctx.log.info(`Found uploaded file immediately in directory: ${file.fileID}`);
                    return {
                        completed: true,
                        fileID: file.fileID
                    };
                }
            }
        }
    } catch (lookupError) {
        ctx.log.warn(`Initial file lookup failed: ${lookupError.message}`);
    }
    
    // Initialize result with the original data
    let result = { ...uploadResult, preuploadID: originalPreuploadID };
    
    while (retries < maxRetries && Date.now() < endTime) {
        // Check for overall timeout
        const timeRemaining = endTime - Date.now();
        if (timeRemaining <= 1000) {  // Less than 1 second remaining
            ctx.log.warn(`Approaching polling timeout, ${timeRemaining}ms remaining - making final attempt`);
        }
        
        try {
            // Always use the original preuploadID for polling
            ctx.log.info(`Polling with preuploadID: ${originalPreuploadID} (attempt ${retries + 1}/${maxRetries})`);
            let asyncRes = await getUploadAsyncResultWithRetry(ctx, accessToken, originalPreuploadID);
            
            // Reset consecutive error counter on successful request
            consecutiveEmptyPreuploadErrors = 0;
            
            if (asyncRes.data && asyncRes.data.completed) {
                // Merge results while preserving the original preuploadID
                result = {
                    ...result,
                    ...asyncRes.data,
                    preuploadID: originalPreuploadID
                };
                ctx.log.info(`Async upload completed after ${retries + 1} checks`);
                return result;
            } else {
                ctx.log.info(`Async upload not yet complete, data: ${JSON.stringify(asyncRes.data || {})}`);
            }
            
            // Periodically try file lookup as an alternative
            if (retries % lookupInterval === 0) {
                try {
                    ctx.log.info(`Periodic file lookup attempt for ${fileName} (retry ${retries})`);
                    const fileList = await getFileList(ctx, accessToken, parentFileID);
                    if (fileList && fileList.data && Array.isArray(fileList.data.fileList)) {
                        for (const file of fileList.data.fileList) {
                            if (file.filename === fileName) {
                                ctx.log.info(`Found uploaded file in directory during polling: ${file.fileID}`);
                                return {
                                    completed: true,
                                    fileID: file.fileID
                                };
                            }
                        }
                    }
                } catch (lookupError) {
                    ctx.log.warn(`File lookup failed during polling: ${lookupError.message}`);
                }
            }
            
            retries++;
            // Calculate delay based on retry count and remaining time
            const timeLeft = endTime - Date.now();
            const idealDelay = retryDelay + (retries * 100); // Slightly increase delay with each retry
            const actualDelay = Math.min(idealDelay, timeLeft / 2); // Don't delay more than half of remaining time
            
            if (actualDelay <= 0) {
                ctx.log.warn(`No time left for polling delay, continuing immediately`);
            } else {
                ctx.log.info(`Waiting ${actualDelay}ms before next check (${timeLeft}ms remaining in timeout budget)...`);
                await delay(actualDelay);
            }
        } catch (error) {
            retries++;
            // Special handling for empty preuploadID errors
            if (error.message.includes('预上传ID不能为空') || error.message.includes('preuploadID')) {
                consecutiveEmptyPreuploadErrors++;
                ctx.log.warn(`PreuploadID error (${consecutiveEmptyPreuploadErrors}/${maxEmptyPreuploadRetries}): ${error.message}`);
                
                if (consecutiveEmptyPreuploadErrors >= maxEmptyPreuploadRetries) {
                    // Final attempt - try a direct file lookup
                    ctx.log.warn(`Multiple preuploadID errors, making final file lookup attempt...`);
                    
                    try {
                        const fileList = await getFileList(ctx, accessToken, parentFileID);
                        if (fileList && fileList.data && Array.isArray(fileList.data.fileList)) {
                            for (const file of fileList.data.fileList) {
                                if (file.filename === fileName) {
                                    ctx.log.info(`Found uploaded file in final lookup: ${file.fileID}`);
                                    return {
                                        completed: true,
                                        fileID: file.fileID
                                    };
                                }
                            }
                        }
                        
                        // If we've exhausted all retries and still haven't found the file
                        if (retries >= maxRetries) {
                            throw new Error(`Failed to recover from preuploadID errors after ${maxEmptyPreuploadRetries} attempts`);
                        }
                    } catch (lookupError) {
                        ctx.log.error(`Final file lookup failed: ${lookupError.message}`);
                        throw new Error(`Failed to recover from preuploadID errors: ${lookupError.message}`);
                    }
                }
                
                // Progressive backoff for preuploadID errors, but respect remaining time
                const timeLeft = endTime - Date.now();
                const errorDelay = Math.min(2000 * (consecutiveEmptyPreuploadErrors + 1), timeLeft / 2);
                
                if (errorDelay <= 0) {
                    ctx.log.warn(`No time left for error delay, continuing immediately`);
                } else {
                    ctx.log.info(`Retrying after ${errorDelay}ms delay (${timeLeft}ms remaining)...`);
                    await delay(errorDelay);
                }
            } else {
                // For other errors, log and continue with normal retries
                ctx.log.error(`Error during async check: ${error.message}`);
                
                // Shorter delay for non-preuploadID errors
                const timeLeft = endTime - Date.now();
                const errorDelay = Math.min(retryDelay, timeLeft / 3);
                
                if (errorDelay > 0) {
                    await delay(errorDelay);
                }
            }
        }
    }
    
    // Check if we timed out
    if (Date.now() >= endTime) {
        ctx.log.warn(`Async polling timed out after ${(Date.now() - startTime) / 1000}s`);
        
        // Try one final lookup before giving up
        try {
            ctx.log.info(`Final timeout file lookup attempt for ${fileName}`);
            const fileList = await getFileList(ctx, accessToken, parentFileID);
            if (fileList && fileList.data && Array.isArray(fileList.data.fileList)) {
                for (const file of fileList.data.fileList) {
                    if (file.filename === fileName) {
                        ctx.log.info(`Found uploaded file in timeout lookup: ${file.fileID}`);
                        return {
                            completed: true,
                            fileID: file.fileID
                        };
                    }
                }
            }
        } catch (err) {
            ctx.log.error(`Timeout lookup failed: ${err.message}`);
        }
        
        throw new Error(`Async polling timed out after ${totalTimeoutMs / 1000} seconds`);
    }
    
    // If we reach here without returning, we've failed to get a valid result
    if (!result.fileID) {
        throw new Error(`Async upload did not complete after ${maxRetries} attempts`);
    }
    
    return result;
}

// Helper function to retry the async result with built-in retry
async function getUploadAsyncResultWithRetry(ctx, accessToken, preuploadID, maxRetries = 2) {
    let lastError = null;
    
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await uploadAsyncResult(ctx, accessToken, preuploadID);
        } catch (error) {
            lastError = error;
            if (i < maxRetries) {
                ctx.log.warn(`uploadAsyncResult failed (attempt ${i+1}/${maxRetries+1}): ${error.message}, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between retries
            }
        }
    }
    
    // If we get here, all retries failed
    throw lastError;
}

// Add a function to handle image deletion
async function handleRemove(files, ctx) {
    ctx.log.info(`Attempting to delete ${files.length} file(s) from 123pan`);
    
    if (!files || files.length === 0) {
        return;
    }

    // Filter only 123pan images
    const panFiles = files.filter(file => file.type === '123pan');
    if (panFiles.length === 0) {
        ctx.log.info('No 123pan files to delete');
        return;
    }

    try {
        // Get access token
        let accessTokenData = ctx.getConfig(pluginName);
        if (!accessTokenData || !accessTokenData.accessToken || new Date(accessTokenData.expiredAt) <= new Date()) {
            ctx.log.info('Getting new access token for deletion...');
            accessTokenData = await getAccessToken(ctx);
            ctx.saveConfig({
                [pluginName]: accessTokenData
            });
        }
        const accessToken = accessTokenData.accessToken;

        // Delete each file
        for (const file of panFiles) {
            try {
                ctx.log.info(`Attempting to delete file: ${file.fileName}`);
                
                // Extract the fileID from the URL or other file properties
                // Note: This is a placeholder - you'll need to modify based on how your URLs are structured
                const fileIDMatch = file.imgUrl.match(/\/([a-zA-Z0-9]+)(?:\?|$)/);
                if (!fileIDMatch || !fileIDMatch[1]) {
                    ctx.log.error(`Could not extract fileID from URL: ${file.imgUrl}`);
                    continue;
                }
                
                const fileID = fileIDMatch[1];
                
                // Delete file API call
                const options = {
                    hostname: 'open-api.123pan.com',
                    path: '/api/v1/oss/file/delete',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Platform': 'open_platform',
                        'Authorization': `Bearer ${accessToken}`
                    }
                };
                
                const data = JSON.stringify({
                    fileID: [fileID]
                });
                
                const response = await makeRequest(options, data);
                ctx.log.info(`File deletion response: ${JSON.stringify(response)}`);
                ctx.emit('notification', {
                    title: 'File Deleted',
                    body: `Successfully deleted ${file.fileName} from 123pan`
                });
            } catch (error) {
                ctx.log.error(`Failed to delete file ${file.fileName}: ${error.message}`);
                ctx.emit('notification', {
                    title: 'Deletion Failed',
                    body: `Error deleting ${file.fileName}: ${error.message}`
                });
            }
        }
    } catch (error) {
        ctx.log.error(`Error in deletion process: ${error.message}`);
    }
}

// GUI menu for GUI-specific functionality
const guiMenu = ctx => {
    return [
        {
            label: 'Open API Configuration',
            async handle(ctx, guiApi) {
                const config = ctx.getConfig('picBed.123pan') || {};
                
                // Show client ID input box
                const clientID = await guiApi.showInputBox({
                    title: 'Configure 123pan Client ID',
                    placeholder: config.clientID || 'Enter your Client ID'
                });
                
                if (!clientID) return; // User cancelled
                
                // Show client secret input box
                const clientSecret = await guiApi.showInputBox({
                    title: 'Configure 123pan Client Secret',
                    placeholder: 'Enter your Client Secret'
                });
                
                if (!clientSecret) return; // User cancelled
                
                // Show parent folder input box (optional)
                const parentFolderName = await guiApi.showInputBox({
                    title: 'Configure Parent Folder (Optional)',
                    placeholder: config.parentFileID || 'Enter folder name or leave empty'
                });
                
                // Save the configuration
                ctx.saveConfig({
                    'picBed.123pan': {
                        clientID,
                        clientSecret,
                        parentFileID: parentFolderName
                    }
                });
                
                guiApi.showNotification({
                    title: 'Configuration Saved',
                    body: '123pan configuration has been updated!'
                });
            }
        },
        {
            label: 'Upload from URL',
            async handle(ctx, guiApi) {
                const url = await guiApi.showInputBox({
                    title: 'Upload from URL',
                    placeholder: 'Enter image URL to upload'
                });
                
                if (!url) return; // User cancelled
                
                try {
                    // Validate URL
                    new URL(url);
                    
                    // Start upload process
                    guiApi.showNotification({
                        title: 'Uploading',
                        body: 'Downloading and uploading image...'
                    });
                    
                    // Use the upload API
                    await guiApi.upload([url]);
                } catch (error) {
                    guiApi.showNotification({
                        title: 'Error',
                        body: `Invalid URL or upload failed: ${error.message}`
                    });
                }
            }
        },
        {
            label: 'Upload from Local Files',
            async handle(ctx, guiApi) {
                const files = await guiApi.showFileExplorer({
                    properties: ['openFile', 'multiSelections'],
                    filters: [
                        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
                    ]
                });
                
                if (!files || !files.length) return; // User cancelled
                
                // Start upload process
                guiApi.showNotification({
                    title: 'Uploading',
                    body: `Uploading ${files.length} image(s)...`
                });
                
                // Use the upload API
                await guiApi.upload(files);
            }
        }
    ];
};

// Keyboard shortcuts
const commands = ctx => {
    return [
        {
            label: 'Quick Upload from Clipboard',
            name: 'quickUpload123pan',
            key: 'Ctrl+Alt+1',
            async handle(ctx, guiApi) {
                // Notify user
                guiApi.showNotification({
                    title: '123pan Upload',
                    body: 'Uploading image from clipboard...'
                });
                
                // Upload from clipboard
                ctx.upload();
            }
        }
    ];
};

module.exports = (ctx) => {
    const register = () => {
        ctx.helper.uploader.register('123pan', {
            handle: handleUpload,
            name: '123Pan',
            config: config
        });
        
        // Register the event listener for image deletion
        ctx.on('remove', (files, guiApi) => {
            handleRemove(files, ctx);
        });
    };

    const config = ctx => {
        let userConfig = ctx.getConfig('picBed.123pan')
        if (!userConfig) {
            userConfig = {}
        }
        return [
            {
                name: 'clientID',
                type: 'input',
                default: userConfig.clientID,
                required: true,
                message: 'clientID',
                alias: 'Client ID'
            },
            {
                name: 'clientSecret',
                type: 'password',
                default: userConfig.clientSecret,
                required: true,
                message: 'clientSecret',
                alias: 'Client Secret'
            },
            {
                name: 'parentFileID',
                type: 'input',
                default: userConfig.parentFileID,
                required: false,
                message: 'typora(Optional, create if not exists)',
                alias: 'Parent Folder Name'
            }
        ]
    }

return {
        uploader: '123pan',
        register,
        guiMenu,    // Add guiMenu for GUI features
        commands    // Add keyboard shortcuts
    };
};

// Export utility functions for testing purposes
module.exports.sanitizeFilename = sanitizeFilename;
