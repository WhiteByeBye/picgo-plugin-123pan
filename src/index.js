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

    const data = JSON.stringify({
        name: [dirName],
        parentID: parentID,
        type: 1 // Required parameter - must be 1 for directories
    });

    try {
        const res = await makeRequest(options, data);
        return res;
    } catch (err) {
        if (err.message.includes('目录名') && err.message.includes('不能重名') || err.message.includes('已存在')) { //Directory already existed, we should find and use existed directory
            ctx.log.warn(`Directory ${dirName} already exists, trying to find its ID.`);

            const fileList = await getFileList(ctx, accessToken, parentID);

            for (const file of fileList.data.fileList) {
                if (file.filename === dirName && file.type === 1) {
                    ctx.log.info(`Found existed directory ID: ${file.fileld}`);

                    return { code: 0, data: { fileID: file.fileld } };
                }
            }
            throw new Error(`Directory ${dirName} not found.`); // Directory exists, but we couldn't find it.

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
    const data = JSON.stringify({
        parentFileld: parentFileID, // Corrected parameter name
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



async function handleUpload(ctx) {
    const userConfig = ctx.getConfig('picBed.123pan');
    if (!userConfig) {
        throw new Error('123pan uploader configuration is missing.');
    }

    let imgList = ctx.output;

    // 1. Get access token (reuse if available and not expired)
    let accessTokenData = ctx.getConfig(pluginName);

    if (!accessTokenData || new Date(accessTokenData.expiredAt) <= new Date()) {
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



    for (let i = 0; i < imgList.length; i++) {
        let img = imgList[i];
        try {
            const buffer = img.buffer ? img.buffer : await ctx.request(img.url);
            const md5 = crypto.createHash('md5').update(buffer).digest('hex');
            const fileSize = buffer.length;
            const fileName = img.fileName;

            // 2. Create file
            let createRes = await createFile(ctx, accessToken, parentFileID, fileName, md5, fileSize);
            let uploadResult = createRes.data;


            // 3. Check if it's a fast upload (reuse = true)
            if (uploadResult.reuse) {
                img.imgUrl = `https://www.123pan.com/b/${uploadResult.fileID}`;
                img.url = img.imgUrl
                delete img.buffer; // Clean up buffer
                continue; // Skip to the next image
            }

            // 4. If not fast upload, get upload URL and upload slices
            let sliceNo = 1;

            while (true) {

                const uploadUrlRes = await getUploadUrl(ctx, accessToken, uploadResult.preuploadID, sliceNo);

                const start = (sliceNo - 1) * uploadResult.sliceSize;
                const end = sliceNo * uploadResult.sliceSize;
                const sliceBuffer = buffer.slice(start, end);
                if (sliceBuffer.length === 0) break;

                await uploadFileSlice(ctx, uploadUrlRes.data.presignedURL, sliceBuffer);
                sliceNo++;
                if (end >= fileSize) break; //finish uploading all slices

            }


            // 5. Complete upload
            let completeRes = await uploadComplete(ctx, accessToken, uploadResult.preuploadID);
            uploadResult = completeRes.data;

            // 6. Check if async result is needed
            if (uploadResult.async) {
                while (true) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                    let asyncRes = await uploadAsyncResult(ctx, accessToken, uploadResult.preuploadID);
                    if (asyncRes.data.completed) {
                        uploadResult = asyncRes.data;
                        break;
                    }
                }
            }

            // 7. Set image URL
            img.imgUrl = `https://www.123pan.com/b/${uploadResult.fileID}`;
            img.url = img.imgUrl
            delete img.buffer; // Clean up buffer
            ctx.log.info(`File uploaded successfully: ${img.imgUrl}`);

        } catch (error) {
            ctx.log.error(`Failed to upload ${img.fileName}: ${error.message}`);
            ctx.emit('notification', {
                title: 'Upload Failed',
                body: `Error uploading ${img.fileName}: ${error.message}`,
                text: ''
            });
        }
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