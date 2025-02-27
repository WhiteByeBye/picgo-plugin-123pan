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
        const response = await makeRequest(options, data);
        return response.data;
    } catch (error) {
        ctx.log.error(`Failed to get access token: ${error.message}`);
        throw error; // Re-throw to be handled by caller
    }
}


async function createDirectory(ctx, accessToken, parentID, dirName) {
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
        return res;
    } catch (err) {
        if (err.message.includes('目录名') && err.message.includes('不能重名') || err.message.includes('已存在')) { //Directory already existed, we should find and use existed directory
            ctx.log.warn(`Directory ${sanitizedName} already exists, trying to find its ID.`);

            const fileList = await getFileList(ctx, accessToken, normalizedParentID);

            for (const file of fileList.data.fileList) {
                if (file.filename === sanitizedName && file.type === 1) {
                    ctx.log.info(`Found existed directory ID: ${file.fileID}`);

                    return { code: 0, data: { fileID: file.fileID } };
                }
            }
            throw new Error(`Directory ${sanitizedName} not found.`); // Directory exists, but we couldn't find it.

        }
        ctx.log.error(`Failed to create or find directory: ${err.message}`);
        throw err; // Re-throw the original error if it's not a duplicate directory
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

    const res = await makeRequest(options, data);
    return res;
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

    const data = JSON.stringify({
        preuploadID: preuploadID
    });

    return makeRequest(options, data);
}

async function uploadAsyncResult(ctx, accessToken, preuploadID) {
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
    const data = JSON.stringify({
        preuploadID: preuploadID
    });
    return makeRequest(options, data);
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
    // Remove characters not allowed by 123pan: "V:*?|><
    let sanitized = filename.replace(/["\V:*?|><]/g, '_');
    
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
    const userConfig = ctx.getConfig('picBed.123pan');
    if (!userConfig) {
        throw new Error('123pan uploader configuration is missing.');
    }

    let imgList = ctx.output;

    // 1. Get access token (reuse if available and not expired)
    let accessTokenData = ctx.getConfig(pluginName);

    if (!accessTokenData || !accessTokenData.accessToken || new Date(accessTokenData.expiredAt) <= new Date()) {
        ctx.log.info('Getting new access token...');
        accessTokenData = await getAccessToken(ctx);
        ctx.saveConfig({
            [pluginName]: accessTokenData
        });
        ctx.log.info(`Access token obtained: ${accessTokenData.accessToken}`);
    }

    const accessToken = accessTokenData.accessToken;

    // Resolve parentFileID
    let parentFileID = ""; // root as default
    if (userConfig.parentFileID) {
        try {
            // Attempt to create/find the directory using the provided NAME.
            const result = await createDirectory(ctx, accessToken, "", userConfig.parentFileID);
            parentFileID = result.data.fileID; // Get the ID.
            ctx.log.info(`Using directory with ID: ${parentFileID}`);
        } catch (e) {
            ctx.log.error(`Failed to get/create directory ${userConfig.parentFileID}: ${e.message}`);
            throw new Error(`Failed to get/create directory: ${userConfig.parentFileID}`);
        }
    }

    const failedList = [];

    for (let i = 0; i < imgList.length; i++) {
        let img = imgList[i];
        try {
            const buffer = img.buffer ? img.buffer : await ctx.request(img.url);
            const md5 = crypto.createHash('md5').update(buffer).digest('hex');
            const fileSize = buffer.length;
            const fileName = sanitizeFilename(img.fileName);

            ctx.log.info(`Uploading ${fileName}, size: ${fileSize} bytes, MD5: ${md5}`);

            // 2. Create file
            const normalizedParentID = normalizeParentFileID(parentFileID);
            let createRes = await createFile(ctx, accessToken, normalizedParentID, fileName, md5, fileSize);
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
                    const fileDetails = await getFileDetails(ctx, accessToken, uploadResult.fileID);
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
                continue; // Skip to the next image
            }

            // 4. Verify preuploadID is present
            if (!uploadResult.preuploadID) {
                throw new Error('PreuploadID is missing in the create file response');
            }

            ctx.log.info(`Got preuploadID: ${uploadResult.preuploadID}, sliceSize: ${uploadResult.sliceSize}`);

            // 5. Upload file slices
            let sliceNo = 1;
            while (true) {
                const uploadUrlRes = await getUploadUrl(ctx, accessToken, uploadResult.preuploadID, sliceNo);
                
                const start = (sliceNo - 1) * uploadResult.sliceSize;
                const end = Math.min(sliceNo * uploadResult.sliceSize, fileSize);
                const sliceBuffer = buffer.slice(start, end);
                
                if (sliceBuffer.length === 0) break;
                
                ctx.log.info(`Uploading slice ${sliceNo}, size: ${sliceBuffer.length} bytes`);
                await uploadFileSlice(ctx, uploadUrlRes.data.presignedURL, sliceBuffer);
                
                sliceNo++;
                if (end >= fileSize) break; // Finished uploading all slices
            }

            // 6. Complete upload
            ctx.log.info(`Completing upload for ${fileName}`);
            let completeRes = await uploadComplete(ctx, accessToken, uploadResult.preuploadID);
            uploadResult = completeRes.data;

            // 7. Check if async result is needed
            if (uploadResult.async) {
                ctx.log.info(`Async processing required, polling for results...`);
                let retries = 0;
                const maxRetries = 10;
                
                while (retries < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                    let asyncRes = await uploadAsyncResult(ctx, accessToken, uploadResult.preuploadID);
                    
                    if (asyncRes.data.completed) {
                        uploadResult = asyncRes.data;
                        ctx.log.info(`Async upload completed after ${retries + 1} checks`);
                        break;
                    }
                    
                    retries++;
                    ctx.log.info(`Waiting for async completion (${retries}/${maxRetries})`);
                }
                
                if (retries >= maxRetries) {
                    throw new Error(`Async upload did not complete after ${maxRetries} attempts`);
                }
            }

            // 8. Verify fileID and set final URL
            if (!uploadResult.fileID) {
                throw new Error('Upload completed but fileID is missing in the response');
            }

            // Get the proper download URL from file details
            try {
                const fileDetails = await getFileDetails(ctx, accessToken, uploadResult.fileID);
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

        } catch (error) {
            ctx.log.error(`Failed to upload ${img.fileName}: ${error.message}`);
            failedList.push(img.fileName);
            
            // Mark this image as failed but continue with others
            img.imgUrl = '';
            img.url = '';
            delete img.buffer;
            
            ctx.emit('notification', {
                title: 'Upload Failed',
                body: `Error uploading ${img.fileName}: ${error.message}`,
                text: ''
            });
        }
    }

    if (failedList.length > 0) {
        ctx.log.error(`Failed to upload ${failedList.length} images: ${failedList.join(', ')}`);
    }

    return ctx;
}


module.exports = (ctx) => {
    const register = () => {
        ctx.helper.uploader.register('123pan', {
            handle: handleUpload,
            name: '123Pan',
            config: config
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
        register
    };
};