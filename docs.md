# 接入指南
## 开发者接入
### 开发须知
#### 接口调用规范

- **HTTPS协议、JSON数据格式和UTF-8编码**：必须使用。
- **接口域名**：`https://open-api.123pan.com`。
- **client_secret**：需安全保存，不要放在前端代码中。
- **请求头platform**：所有请求接口需带上请求头platform值为`open_platform`。

#### 公共请求头

| 请求头名称       | 是否必填 | 类型   | 示例值                | 描述                     |
|----------------|--------|-------|----------------------|------------------------|
| Authorization  | 是     | string | Bearer access_token   | 注意格式：Bearer+空格+access_token |
| Platform       | 是     | string | open_platform         | 固定值：open_platform     |
| Content-Type   | 是     | string | application/json      | 固定值：application/json |

#### 接口身份校验示例

开放API的HTTP调用，需在Header中传递Authorization参数，值为token_type + 空格 + access_token。

```bash
curl -v -x POST '域名/upload/v1/file/create' \
-H 'Authorization: Bearer access_token' \
-H 'Content-Type: application/json' \
-H 'Platform: open_platform' \
-d '{
    "parentFileID": 0,
    "filename": "测试文件.txt",
    "etag":"0a05e3dcd8ba1d14753597bc8611d0a1",
    "size":44321
}'
```

#### 接口响应参数

| 参数名称   | 是否必填 | 类型  | 示例值   | 描述                     |
|----------|--------|------|---------|------------------------|
| code     | 是     | int  | 0       | code字段等于0标识成功响应，其他code为失败响应 |
| message  | 是     | string| ok      | 请求成功为"ok"；异常时为具体异常信息 |
| data     | 是     | any  | -       | 返回的响应内容；异常时为null |
| x-traceID| 是     | string| eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 | 接口响应异常需要技术支持请提供接口返回的x-traceID |

#### 接口响应示例

所有API的响应体中都包含code、message、data字段，data字段的数据结构请查看具体接口的文档。API都使用返回的code字段等于0标识成功响应，其他code为失败响应，请根据响应的code和message排查错误具体原因。如果接口响应异常需要技术支持请提供接口返回的x-traceID。

```json
{
  "code": 0,
  "message": "ok",
  "data": null,
  "x-traceID":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
}
```

#### 常用code码

| body中的code | 描述                 |
|------------|---------------------|
| 401        | access_token无效     |
| 429        | 请求太频繁           |

#### 限流处理

为确保所有用户的使用体验，123云盘开放平台会对下面API进行限流：限制QPS（同一个client_id，每秒最大请求次数）。

| API                               | 限制QPS |
|-----------------------------------|--------|
| api/v1/user/info                  | 1      |
| api/v1/file/move                  | 1      |
| api/v1/file/delete                | 1      |
| api/v1/file/list                  | 4      |
| upload/v1/file/mkdir              | 2      |
| upload/v1/file/create             | 2      |
| api/v1/access_token               | 1      |
| api/v1/share/list                 | 10     |
| api/v1/share/list/info            | 10     |
| api/v1/transcode/folder/info      | 20     |
| api/v1/transcode/upload/from_cloud_disk | 1    |
| api/v1/transcode/delete           | 10     |
| api/v1/transcode/video/resolutions| 1      |
| api/v1/transcode/video           | 3      |
| api/v1/transcode/video/record     | 20     |
| api/v1/transcode/video/result     | 20     |
| api/v1/transcode/file/download   | 10     |
| api/v1/transcode/m3u8_ts/download | 20     |
| api/v1/transcode/file/download/all | 1      |

### 获取access_token

*API: POST 域名 +/api/v1/access_token*

注：此接口有访问频率限制。请获取到access_token后本地保存使用，并在access_token过期前及时重新获取。access_token有效期根据返回的expiredAt字段判断。

#### Header 参数

| 名称        | 类型   | 是否必填 | 说明         |
|-----------|------|------|------------|
| Authorization | string | 必填   | 鉴权access_token |

#### Body 参数

| 名称        | 类型   | 是否必填 | 说明         |
|-----------|------|------|------------|
| clientID  | string | 必填   |            |
| clientSecret | string | 必填   |            |

#### 返回数据

| 名称        | 类型   | 是否必填 | 说明         |
|-----------|------|------|------------|
| accessToken | string | 必填   | 访问凭证      |
| expiredAt | string | 必填   | access_token过期时间 |

#### 示例

##### 请求示例

```bash
curl --location 'https://open-api.123pan.com/api/v1/access_token' \
--header 'Platform: open_platform' \
--header 'Content-Type: application/json' \
--data '{
  "clientID": "123456789",
  "clientSecret": "123456789"
}'
```

```java
OkHttpClient client = new OkHttpClient().newBuilder()
.build();
MediaType mediaType = MediaType.parse("application/json");
RequestBody body = RequestBody.create(mediaType, "{\n\t\"clientID\": \"123456789\",\n\t\"clientSecret\": \"123456789\"\n}");
Request request = new Request.Builder()
.url("https://open-api.123pan.com/api/v1/access_token")
.method("POST", body)
.addHeader("Platform", "open_platform")
.addHeader("Content-Type", "application/json")
.build();
Response response = client.newCall(request).execute();
```

```javascript
var settings = {
  "url": "https://open-api.123pan.com/api/v1/access_token",
  "method": "POST",
  "timeout": 0,
  "headers": {
    "Platform": "open_platform",
    "Content-Type": "application/json"
  },
  "data": JSON.stringify({
    "clientID": "123456789",
    "clientSecret": "123456789"
  }),
};
$.ajax(settings).done(function (response) {
  console.log(response);
});
```

```javascript
const axios = require('axios');
let data = JSON.stringify({
  "clientID": "123456789",
  "clientSecret": "123456789"
});
let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://open-api.123pan.com/api/v1/access_token',
  headers: { 
    'Platform': 'open_platform', 
    'Content-Type': 'application/json'
  },
  data : data
};
axios.request(config)
  .then((response) => {
    console.log(JSON.stringify(response.data));
  })
  .catch((error) => {
    console.log(error);
  });
```

```python
import http.client
import json
conn = http.client.HTTPSConnection("open-api.123pan.com")
payload = json.dumps({
    "clientID": "123456789",
    "clientSecret": "123456789"
})
headers = {
    'Platform': 'open_platform',
    'Content-Type': 'application/json'
}
conn.request("POST", "/api/v1/access_token", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

##### 响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyxxxxx...(过长已省略)",
    "expiredAt": "2025-03-23T15:48:37+08:00"
  },
  "x-traceID": "16f60c4d-f022-42d3-b3df-85d1fe2a3ac5_kong-db-5898fdd8c6-wgsts"
}
```

## 常见问题
1. 首次申请OpenAPI后没有收到邮件？
	- 检查邮箱填写是否正确；
	- 检查邮件是否在垃圾邮件中；
	- 联系客服处理。

2. 忘记client_id或client_secret？
	- 联系客服处理；
	- 如果发生泄漏，为保证数据安全，请第一时间联系客服更换client_secret。

3. PUT请求没有返回值？
	- PUT请求上传文件分片时，上传完成后HTTP请求响应200即可，无任何返回值。

4. PUT请求异常了该怎么办？
	- 请您将截图提供给客服排查异常响应。

5. PUT请求是否需要携带Authorization和Platform？
	- 不需要。

6. 如果接口提示 tokens number has exceeded the limit 该怎么办？
	- 出现这个提示说明您的账号登录数量过多，请及时退出登录，来保证当前设备可用性。

7. API是否有QPS限制？
	- 不同的API的QPS限制不同，详情请见开发须知。

# API列表

## 图床

### 上传图片

#### 上传流程说明

##### 1. 创建文件
- **请求创建文件接口**，接口返回的`reuse`为`true`时，表示秒传成功，上传结束。
- **非秒传情况**将会返回预上传ID`preuploadID`与分片大小`sliceSize`，请将文件根据分片大小切分。

##### 2. 获取上传地址
- **非秒传时**，携带返回的`preuploadID`，自定义分片序号`sliceNo`（从数字1开始）。
- **获取上传地址**`presignedURL`。

##### 3. 上传文件
- **向返回的地址**`presignedURL`发送PUT请求，上传文件分片。
- **注**：PUT请求的header中请不要携带Authorization、Platform参数。

##### 4. 文件比对（非必需）
- **所有分片上传后**，调用列举已上传分片接口，将本地与云端的分片MD5比对。
- **注**：如果您的文件小于`sliceSize`，该操作将会返回空值，可以跳过此步。

##### 5. 上传完成
- **请求上传完毕接口**，若接口返回的`async`为`false`且`fileID`不为0时，上传完成。
- **若接口返回的`async`为`true`**，则需下一步，调用异步轮询获取上传结果接口，获取上传最终结果。

##### 6. 轮询查询
- **若异步轮询获取上传结果接口返回的`completed`为`false`**，请1秒后再次调用此接口，查询上传结果。
- **注**：该步骤需要等待，建议轮询获取结果。123云盘服务器会校验用户预上传时的MD5与实际上传成功的MD5是否一致。

##### 上传文件时序图
```mermaid
sequenceDiagram
    actor User
    participant openapi
    participant Storage as 存储
    
    User->>openapi: 1.调用创建文件接口
    
    alt
        openapi->>Storage: 秒传
        Storage-->>openapi: 
        openapi-->>User: 1.2.上传成功
    else
        openapi->>Storage: 非秒传
        Storage-->>openapi: 
        openapi-->>User: 1.1.返回preuploadID, sliceSize
    end
    
    loop
        User->>openapi: 2.调用分片上传地址接口
        openapi-->>User: 2.1.返回上传地址
        
        User->>Storage: 3.向上传地址发起PUT请求
        Storage-->>User: 3.1.返回200，上传成功
    end
    
    User->>openapi: 4.调用上传完成接口
    
    alt completed = true
        openapi-->>User: 4.2.上传成功
    else completed = false
        openapi-->>User: 4.1.需要再次上传的分片索引
    end
    
    loop
        User->>openapi: 5.调用判断上传状态接口上传是否完成
        openapi-->>User: 5.判断返回completed为false继续轮询
    end
```
##### 上传文件Demo
```php
<?php
/**
 * @throws ErrorException
 */
function open_request($path, $data, $token)
{
    $curl = curl_init('https://open-api.123pan.com' . $path);
    curl_setopt($curl, CURLOPT_POST, true);
    curl_setopt($curl, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($curl, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Platform: open_platform',
        'Authorization: Bearer ' . $token
    ]);
    $res_str = curl_exec($curl);
    curl_close($curl);
    $res = json_decode($res_str, true);
    if (!isset($res['code']) || $res['code'] != 0) {
        throw new ErrorException(isset($res['message']) ? $res['message'] : '网络错误');
    }
    return isset($res['data']) ? $res['data'] : null;
}

/**
 * @throws ErrorException
 */
function put_part($url, $part_stream, $part_size)
{
    $curl = curl_init($url);
    curl_setopt($curl, CURLOPT_PUT, true);
    curl_setopt($curl, CURLOPT_INFILE, $part_stream);
    curl_setopt($curl, CURLOPT_INFILESIZE, $part_size);
    curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
    $res_str = curl_exec($curl);
    $status_code = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if ($status_code != 200) {
        throw new ErrorException('分片传输错误，错误码：' . $status_code . '，错误信息：' . $res_str);
    }
}

function upload_file($client_id, $client_secret, $parent, $file_path)
{
    $token = '';
    try {
        $res_data = open_request('/api/v1/access_token', ['clientID' => $client_id, 'clientSecret' => $client_secret], $token);
        $token = $res_data['accessToken'];
        $filename = basename($file_path);
        $file_size = filesize($file_path);
        $file_etag = md5_file($file_path);
        $res_data = open_request('/upload/v1/file/create', [
            'parentFileID' => $parent,
            'filename' => $filename,
            'etag' => $file_etag,
            'size' => $file_size
        ], $token);
        if ($res_data['reuse']) {
            echo '极速上传成功';
            return;
        }
        $upload_id = $res_data['preuploadID'];
        $slice_size = $res_data['sliceSize'];
        $res_data = open_request('/upload/v1/file/list_upload_parts', ['preuploadID' => $upload_id], $token);
        $parts_map = [];
        foreach ($res_data['parts'] as $part) {
            $parts_map[$part['partNumber']] = ['size' => $part['size'], 'etag' => $part['etag']];
        }
        $file = fopen($file_path, 'r');
        for ($i = 0; ; $i++) {
            $part_num = $i + 1;
            $temp_stream = fopen('php://temp', 'wr');
            $temp_size = stream_copy_to_stream($file, $temp_stream, $slice_size, $i * $slice_size);
            if (!$temp_size) {
                break;
            }
            if (isset($parts_map[$part_num]) && $parts_map[$part_num]['size'] == $temp_size && $parts_map[$part_num]['etag'] == md5(stream_get_contents($temp_stream))) {
                continue;
            }
            $res_data = open_request('/upload/v1/file/get_upload_url', ['preuploadID' => $upload_id, 'sliceNo' => $part_num], $token);
            rewind($temp_stream);
            put_part($res_data['presignedURL'], $temp_stream, $temp_size);
        }
        $res_data = open_request('/upload/v1/file/upload_complete', ['preuploadID' => $upload_id], $token);
        if ($res_data['completed']) {
            echo '上传成功';
            return;
        }
        for ($j = 0; $j < 200; $j++) {
            sleep(5);
            $res_data = open_request('/upload/v1/file/upload_async_result', ['preuploadID' => $upload_id], $token);
            if ($res_data['completed']) {
                echo '上传成功';
                return;
            }
        }
        echo '上传超时';
    } catch (ErrorException $e) {
        echo '上传失败：' . $e;
    }
}

$client_id = 'myClientID'; // 用户申请到的clientID
$client_secret = 'myClientSecret'; // 用户申请到的clientSecret
$parent_file_id = 0; // 上传到的父级目录id，根目录为0
$local_file_path = 'C:\Users\admin\myFile.txt'; // 用户本地的文件绝对路径
upload_file($client_id, $client_secret, $parent_file_id, $local_file_path);
```
#### 创建目录

*API: POST 域名 + /upload/v1/oss/file/mkdir*

##### Header 参数

| 名称       | 类型     | 是否必填 | 说明                   |
|------------|----------|---------|------------------------|
| Authorization | string | 必填     | 鉴权access_token       |
| Platform   | string   | 必填     | 固定为:open_platform     |

##### Body 参数

| 名称     | 类型        | 是否必填 | 说明         |
|----------|------------|---------|------------|
| name     | []string    | 必填     | 目录名(注:不能重名) |
| parentID | string     | 必填     | 父目录id，上传到根目录时为空 |
| type     | number     | 必填     | 固定为 1    |

##### 示例

###### 请求示例

```shell
curl --location 'https://open-api.123pan.com/upload/v1/oss/file/mkdir' \
--header 'Content-Type: application/json' \
--header 'Platform: open_platform' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)' \
--data '{
    "name": "测试图床目录",
    "parentID": "",
    "type": 1
}'
```

```java
OkHttpClient client = new OkHttpClient().newBuilder()
.build();
MediaType mediaType = MediaType.parse("application/json");
RequestBody body = RequestBody.create(mediaType, "{\n    \"name\": \"测试图床目录\",\n    \"parentID\": \"\",\n    \"type\": 1\n}");
Request request = new Request.Builder()
.url("https://open-api.123pan.com/upload/v1/oss/file/mkdir")
.method("POST", body)
.addHeader("Content-Type", "application/json")
.addHeader("Platform", "open_platform")
.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)")
.build();
Response response = client.newCall(request).execute();
```

```javascript
var settings = {
  "url": "https://open-api.123pan.com/upload/v1/oss/file/mkdir",
  "method": "POST",
  "timeout": 0,
  "headers": {
    "Content-Type": "application/json",
    "Platform": "open_platform",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)"
  },
  "data": JSON.stringify({
    "name": "测试图床目录",
    "parentID": "",
    "type": 1
  }),
};
$.ajax(settings).done(function (response) {
  console.log(response);
});
```

```nodejs
const axios = require('axios');
let data = JSON.stringify({
  "name": "测试图床目录",
  "parentID": "",
  "type": 1
});
let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://open-api.123pan.com/upload/v1/oss/file/mkdir',
  headers: { 
    'Content-Type': 'application/json', 
    'Platform': 'open_platform', 
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
  },
  data : data
};
axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});
```

```python
import http.client
import json
conn = http.client.HTTPSConnection("open-api.123pan.com")
payload = json.dumps({
    "name": "测试图床目录",
    "parentID": "",
    "type": 1
})
headers = {
    'Content-Type': 'application/json',
    'Platform': 'open_platform',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
}
conn.request("POST", "/upload/v1/oss/file/mkdir", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

###### 响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "filename": "测试图床目录",
        "dirID": "yk6baz03t0l000d7w33fbyq51l4izkneDIYPAIDOBIY0DcxvDwFO"
      }
    ]
  },
  "x-traceID": "e572aaa3-53f1-4c93-b36f-3f162333dbaa_kong-db-5898fdd8c6-t5pvc"
}
```

#### 创建文件

*API: POST 域名 + /upload/v1/oss/file/create*

##### Header 参数

| 名称          | 类型     | 是否必填 | 说明                             |
|-------------|--------|------|-------------------------------|
| Authorization | string | 必填   | 鉴权access_token               |
| Platform    | string | 必填   | 固定为:open_platform             |

##### Body 参数

| 名称          | 类型     | 是否必填 | 说明                             |
|-------------|--------|------|-------------------------------|
| parentFileID | string | 必填   | 父目录id，上传到根目录时填写 空         |
| filename     | string | 必填   | 文件名要小于255个字符且不能包含以下任何字符："/:*?|><。（注：不能重名） |
| etag        | string | 必填   | 文件md5                         |
| size        | number | 必填   | 文件大小，单位为 byte 字节           |
| type        | number | 必填   | 固定为 1                        |

##### 返回数据

| 名称          | 类型     | 是否必填 | 说明                             |
|-------------|--------|------|-------------------------------|
| fileID      | string | 非必填 | 文件ID。当123云盘已有该文件,则会发生秒传。此时会将文件ID字段返回。唯一 |
| preuploadID | string | 必填   | 预上传ID(如果 reuse 为 true 时,该字段不存在) |
| reuse       | boolean | 必填   | 是否秒传，返回true时表示文件已上传成功       |
| sliceSize   | number | 必填   | 分片大小，必须按此大小生成文件分片再上传     |

##### 示例

###### 请求示例

```shell
curl --location 'https://open-api.123pan.com/upload/v1/oss/file/create' \
--header 'Content-Type: application/json' \
--header 'Platform: open_platform' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)' \
--data '{
    "parentFileID": "yk6baz03t0l000d7w33fbyq51l4izkneDIYPAIDOBIY0DcxvDwFO",
    "filename": "测试图床.jpg",
    "etag": "e62623f4906aeba8f8d8f5de19e1e34e",
    "size": 22032384,
    "type": 1
}'
```

```java
OkHttpClient client = new OkHttpClient().newBuilder()
.build();
MediaType mediaType = MediaType.parse("application/json");
RequestBody body = RequestBody.create(mediaType, "{\n    \"parentFileID\": \"yk6baz03t0l000d7w33fbyq51l4izkneDIYPAIDOBIY0DcxvDwFO\",\n    \"filename\": \"测试图床.jpg\",\n    \"etag\": \"e62623f4906aeba8f8d8f5de19e1e34e\",\n    \"size\": 22032384,\n    \"type\": 1\n}");
Request request = new Request.Builder()
.url("https://open-api.123pan.com/upload/v1/oss/file/create")
.method("POST", body)
.addHeader("Content-Type", "application/json")
.addHeader("Platform", "open_platform")
.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)")
.build();
Response response = client.newCall(request).execute();
```

```javascript
var settings = {
  "url": "https://open-api.123pan.com/upload/v1/oss/file/create",
  "method": "POST",
  "timeout": 0,
  "headers": {
    "Content-Type": "application/json",
    "Platform": "open_platform",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)"
  },
  "data": JSON.stringify({
    "parentFileID": "yk6baz03t0l000d7w33fbyq51l4izkneDIYPAIDOBIY0DcxvDwFO",
    "filename": "测试图床.jpg",
    "etag": "e62623f4906aeba8f8d8f5de19e1e34e",
    "size": 22032384,
    "type": 1
  }),
};
$.ajax(settings).done(function (response) {
  console.log(response);
});
```

```nodejs
const axios = require('axios');
let data = JSON.stringify({
  "parentFileID": "yk6baz03t0l000d7w33fbyq51l4izkneDIYPAIDOBIY0DcxvDwFO",
  "filename": "测试图床.jpg",
  "etag": "e62623f4906aeba8f8d8f5de19e1e34e",
  "size": 22032384,
  "type": 1
});
let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://open-api.123pan.com/upload/v1/oss/file/create',
  headers: { 
    'Content-Type': 'application/json', 
    'Platform': 'open_platform', 
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
  },
  data : data
};
axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});
```

```python
import http.client
import json
conn = http.client.HTTPSConnection("open-api.123pan.com")
payload = json.dumps({
  "parentFileID": "yk6baz03t0l000d7w33fbyq51l4izkneDIYPAIDOBIY0DcxvDwFO",
  "filename": "测试图床.jpg",
  "etag": "e62623f4906aeba8f8d8f5de19e1e34e",
  "size": 22032384,
  "type": 1
})
headers = {
  'Content-Type': 'application/json',
  'Platform': 'open_platform',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
}
conn.request("POST", "/upload/v1/oss/file/create", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

###### 响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "fileID": "",
    "reuse": false,
    "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gv...(过长省略)",
    "sliceSize": 104857600
  },
  "x-traceID": "854f0197-36a9-4367-8b46-206a377f4327_kong-db-5898fdd8c6-t5pvc"
}
```
#### 获取上传地址&上传分片

*API: POST 域名 + /upload/v1/oss/file/get_upload_url*

##### Header 参数

| 名称           | 类型     | 是否必填 | 说明         |
| -------------- | -------- | -------- | ------------ |
| Authorization  | string   | 必填     | 鉴权access_token |
| Platform      | string   | 必填     | 固定为:open_platform |

##### Body 参数

| 名称       | 类型    | 是否必填 | 说明             |
| ---------- | ------- | -------- | ---------------- |
| preuploadID | string  | 必填     | 预上传ID         |
| sliceNo    | number  | 必填     | 分片序号，从1开始自增 |

##### 返回数据

| 名称          | 类型     | 是否必填 | 说明             |
| ------------- | -------- | -------- | ---------------- |
| presignedURL  | string   | 必填     | 上传地址         |
| isMultipart   | boolean  | 必填     | 是否为分片上传     |

##### 示例

###### 请求示例

```shell
curl --location 'https://open-api.123pan.com/upload/v1/oss/file/get_upload_url' \
--header 'Content-Type: application/json' \
--header 'Platform: open_platform' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)' \
--data '{
    "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvf...(过长省略)",
    "sliceNo": 1
}'
```

```java
OkHttpClient client = new OkHttpClient().newBuilder()
.build();
MediaType mediaType = MediaType.parse("application/json");
RequestBody body = RequestBody.create(mediaType, "{\n    \"preuploadID\": \"h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvf...(过长省略)\",\n    \"sliceNo\": 1\n}");
Request request = new Request.Builder()
.url("https://open-api.123pan.com/upload/v1/oss/file/get_upload_url")
.method("POST", body)
.addHeader("Content-Type", "application/json")
.addHeader("Platform", "open_platform")
.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)")
.build();
Response response = client.newCall(request).execute();
```

```javascript
var settings = {
  "url": "https://open-api.123pan.com/upload/v1/oss/file/get_upload_url",
  "method": "POST",
  "timeout": 0,
  "headers": {
    "Content-Type": "application/json",
    "Platform": "open_platform",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)"
  },
  "data": JSON.stringify({
    "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvf...(过长省略)",
    "sliceNo": 1
  }),
};
$.ajax(settings).done(function (response) {
  console.log(response);
});
```

```javascript
const axios = require('axios');
let data = JSON.stringify({
  "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvf...(过长省略)",
  "sliceNo": 1
});
let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://open-api.123pan.com/upload/v1/oss/file/get_upload_url',
  headers: { 
    'Content-Type': 'application/json', 
    'Platform': 'open_platform', 
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
  },
  data : data
};
axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});
```

```python
import http.client
import json
conn = http.client.HTTPSConnection("open-api.123pan.com")
payload = json.dumps({
    "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvf...(过长省略)",
    "sliceNo": 1
})
headers = {
    'Content-Type': 'application/json',
    'Platform': 'open_platform',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
}
conn.request("POST", "/upload/v1/oss/file/get_upload_url", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

###### 响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "presignedURL": "https://m74.123624.com/123-846/e62623f4/1815309870-0/e62623f4906aeba8f8d8f5de19e1e34e?X-Amz-Algorithm=AWS4-HMAC-SHA256...(过长省略)",
    "isMultipart": false
  },
  "x-traceID": "b6ef3daa-f4af-407c-a8ee-4df6e9fec0ea_kong-db-5898fdd8c6-wnv6h"
}
```

##### PUT上传分片示例

###### 请求示例

```shell
curl --location --request PUT 'https://m74.123624.com/123-846/e62623f4/1815309870-0/e...(过长省略)' \
--header 'Content-Type: application/octet-stream' \
--data-binary '@/C:/Users/mfy/Downloads/测试图床.jpg'
```

```java
OkHttpClient client = new OkHttpClient().newBuilder()
.build();
MediaType mediaType = MediaType.parse("application/octet-stream");
RequestBody body = RequestBody.create(mediaType, "@/C:/Users/mfy/Downloads/测试图床.jpg");
Request request = new Request.Builder()
.url("https://m74.123624.com/123-846/e62623f4/1815309870-0/e...(过长省略)")
.method("PUT", body)
.addHeader("Content-Type", "application/octet-stream")
.build();
Response response = client.newCall(request).execute();
```

```javascript
var settings = {
  "url": "https://m74.123624.com/123-846/e62623f4/1815309870-0/e...(过长省略)",
  "method": "PUT",
  "timeout": 0,
  "headers": {
    "Content-Type": "application/octet-stream"
  },
  "data": "@/C:/Users/mfy/Downloads/测试图床.jpg",
};
$.ajax(settings).done(function (response) {
  console.log(response);
});
```

```nodejs
const axios = require('axios');
let data = '@/C:/Users/mfy/Downloads/测试图床.jpg';

let config = {
  method: 'put',
  maxBodyLength: Infinity,
  url: 'https://m74.123624.com/123-846/e62623f4/1815309870-0/e...(过长省略)',
  headers: { 
    'Content-Type': 'application/octet-stream'
  },
  data : data
};

axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});
```

```python
import http.client

conn = http.client.HTTPSConnection("m74.123624.com")
payload = "@/C:/Users/mfy/Downloads/测试图床.jpg"
headers = {
  'Content-Type': 'application/octet-stream'
}
conn.request("PUT", "/123-846/e62623f4/1815309870-0/e...(过长省略)", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

###### 响应示例

无响应内容，请求响应200表示分片上传成功

#### 上传完毕

*API：POST 域名 + /upload/v1/oss/file/upload_complete*

说明：文件上传完成后请求

建议：调用该接口前，请优先列举已上传的分片，在本地进行md5比对。

##### Header 参数

| 名称         | 类型   | 是否必填 | 说明                     |
| ------------ | ------ | -------- | ------------------------ |
| Authorization | string | 必填     | 鉴权access_token         |
| Platform     | string | 必填     | 固定为：open_platform      |

##### Body 参数

| 名称       | 类型   | 是否必填 | 说明             |
| ---------- | ------ | -------- | ---------------- |
| preuploadID | string | 必填     | 预上传ID         |

##### 返回数据

| 名称     | 类型   | 是否必填 | 说明                             |
| -------- | ------ | -------- | -------------------------------- |
| fileID   | string | 非必填   | 当下方completed字段为true时，此处的fileID就为文件的真实ID（唯一） |
| async    | bool   | 必填     | 是否需要异步查询上传结果。false为无需异步查询，已经上传完毕。true为需要异步查询上传结果。 |
| completed | bool   | 必填     | 上传是否完成                       |

##### 示例

###### 请求示例

```shell
curl --location 'https://open-api.123pan.com/upload/v1/oss/file/upload_complete' \
--header 'Content-Type: application/json' \
--header 'Platform: open_platform' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)' \
--data '{
    "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvfEykuOr...(过长省略)"
}'
```

```java
OkHttpClient client = new OkHttpClient().newBuilder()
.build();
MediaType mediaType = MediaType.parse("application/json");
RequestBody body = RequestBody.create(mediaType, "{\n    \"preuploadID\": \"h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvfEykuOr...(过长省略)\"\n}");
Request request = new Request.Builder()
.url("https://open-api.123pan.com/upload/v1/oss/file/upload_complete")
.method("POST", body)
.addHeader("Content-Type", "application/json")
.addHeader("Platform", "open_platform")
.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)")
.build();
Response response = client.newCall(request).execute();
```

```javascript
var settings = {
  "url": "https://open-api.123pan.com/upload/v1/oss/file/upload_complete",
  "method": "POST",
  "timeout": 0,
  "headers": {
    "Content-Type": "application/json",
    "Platform": "open_platform",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)"
  },
  "data": JSON.stringify({
    "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvfEykuOr...(过长省略)"
  }),
};
$.ajax(settings).done(function (response) {
  console.log(response);
});
```

```javascript
const axios = require('axios');
let data = JSON.stringify({
  "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvfEykuOr...(过长省略)"
});
let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://open-api.123pan.com/upload/v1/oss/file/upload_complete',
  headers: { 
    'Content-Type': 'application/json', 
    'Platform': 'open_platform', 
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
  },
  data : data
};
axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});
```

```python
import http.client
import json
conn = http.client.HTTPSConnection("open-api.123pan.com")
payload = json.dumps({
    "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvfEykuOr...(过长省略)"
})
headers = {
    'Content-Type': 'application/json',
    'Platform': 'open_platform',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
}
conn.request("POST", "/upload/v1/oss/file/upload_complete", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

###### 响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "async": true,
    "completed": false,
    "fileID": ""
  },
  "x-traceID": "27bde78d-228d-4c24-b616-d4ea9c361f54_kong-db-5898fdd8c6-wgsts"
}
```

#### 异步轮询获取上传结果

*API： POST 域名 + /upload/v1/oss/file/upload_async_result*

说明：异步轮询获取上传结果

##### Header 参数

| 名称       | 类型     | 是否必填 | 说明         |
|------------|----------|---------|------------|
| Authorization | string | 必填 | 鉴权access_token |
| Platform   | string   | 必填 | 固定为:open_platform |

##### Body 参数

| 名称       | 类型     | 是否必填 | 说明           |
|------------|----------|---------|------------|
| preuploadID | string | 必填 | 预上传ID |

##### 返回数据

| 名称       | 类型     | 是否必填 | 说明           |
|------------|----------|---------|------------|
| completed  | bool     | 必填 | 上传合并是否完成,如果为false,请至少1秒后发起轮询 |
| fileID     | string   | 必填 | 上传成功的文件ID |

##### 示例

###### 请求示例

```shell
curl --location 'https://open-api.123pan.com/upload/v1/oss/file/upload_async_result' \
--header 'Content-Type: application/json' \
--header 'Platform: open_platform' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)' \
--data '{
    "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvfEykuOrfsL...(过长省略)"
}'
```

```java
OkHttpClient client = new OkHttpClient().newBuilder()
.build();
MediaType mediaType = MediaType.parse("application/json");
RequestBody body = RequestBody.create(mediaType, "{\n    \"preuploadID\": \"h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvfEykuOrfsL...(过长省略)\"\n}");
Request request = new Request.Builder()
.url("https://open-api.123pan.com/upload/v1/oss/file/upload_async_result")
.method("POST", body)
.addHeader("Content-Type", "application/json")
.addHeader("Platform", "open_platform")
.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)")
.build();
Response response = client.newCall(request).execute();
```

```javascript
var settings = {
  "url": "https://open-api.123pan.com/upload/v1/oss/file/upload_async_result",
  "method": "POST",
  "timeout": 0,
  "headers": {
    "Content-Type": "application/json",
    "Platform": "open_platform",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)"
  },
  "data": JSON.stringify({
    "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvfEykuOrfsL...(过长省略)"
  }),
};
$.ajax(settings).done(function (response) {
  console.log(response);
});
```

```javascript
const axios = require('axios');
let data = JSON.stringify({
  "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvfEykuOrfsL...(过长省略)"
});
let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://open-api.123pan.com/upload/v1/oss/file/upload_async_result',
  headers: { 
    'Content-Type': 'application/json', 
    'Platform': 'open_platform', 
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
  },
  data : data
};
axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});
```

```python
import http.client
import json
conn = http.client.HTTPSConnection("open-api.123pan.com")
payload = json.dumps({
  "preuploadID": "h1Kiaaaaaaac/0IDD87IFbIf8T0UWrTNwNNGbGoeklBYFtnlDwBIhd9OfdMjm4abJfDPccrScqQIPdjFasHxGxV//V7bzfUbEEaEt8N6RT2PI/dC/gvyvfEykuOrfsL...(过长省略)"
})
headers = {
  'Content-Type': 'application/json',
  'Platform': 'open_platform',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
}
conn.request("POST", "/upload/v1/oss/file/upload_async_result", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

###### 响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "completed": true,
    "fileID": "rehu6baz03t0l000d7freterfbyq51l4izkneDIYPAIDOBIY0DcxvDwFO"
  },
  "x-traceID": "1f8a00aa-1d95-4bfb-8908-2ccec540b06f_kong-db-5898fdd8c6-wnv6h"
}
```

### 删除图片

*API：POST 域名 + /api/v1/oss/file/delete*

#### Header 参数

| 名称         | 类型   | 是否必填 | 说明         |
|------------|------|------|------------|
| Authorization | string | 必填   | 鉴权access_token |
| Platform    | string | 必填   | 固定为:open_platform |

#### Body 参数

| 名称     | 类型   | 是否必填 | 说明         |
|--------|------|------|------------|
| fileIDs | array | 必填   | 文件id数组,参数长度最大不超过 100 |

#### 示例

##### 请求示例

```shell
curl --location 'https://open-api.123pan.com/api/v1/oss/file/delete' \
--header 'Content-Type: application/json' \
--header 'Platform: open_platform' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)' \
--data '{
    "fileIDs": [
        "yk6baz03t0l000d7w33fbyt8704m2bohDIYPAIDOBIY0DcxvDwFO"
    ]
}'
```

```java
OkHttpClient client = new OkHttpClient().newBuilder()
.build();
MediaType mediaType = MediaType.parse("application/json");
RequestBody body = RequestBody.create(mediaType, "{\n    \"fileIDs\": [\n        \"yk6baz03t0l000d7w33fbyt8704m2bohDIYPAIDOBIY0DcxvDwFO\"\n    ]\n}");
Request request = new Request.Builder()
.url("https://open-api.123pan.com/api/v1/oss/file/delete")
.method("POST", body)
.addHeader("Content-Type", "application/json")
.addHeader("Platform", "open_platform")
.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)")
.build();
Response response = client.newCall(request).execute();
```

```javascript
var settings = {
  "url": "https://open-api.123pan.com/api/v1/oss/file/delete",
  "method": "POST",
  "timeout": 0,
  "headers": {
    "Content-Type": "application/json",
    "Platform": "open_platform",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)"
  },
  "data": JSON.stringify({
    "fileIDs": [
      "yk6baz03t0l000d7w33fbyt8704m2bohDIYPAIDOBIY0DcxvDwFO"
    ]
  }),
};
$.ajax(settings).done(function (response) {
  console.log(response);
});
```

```javascript
const axios = require('axios');
let data = JSON.stringify({
  "fileIDs": [
    "yk6baz03t0l000d7w33fbyt8704m2bohDIYPAIDOBIY0DcxvDwFO"
  ]
});
let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://open-api.123pan.com/api/v1/oss/file/delete',
  headers: { 
    'Content-Type': 'application/json', 
    'Platform': 'open_platform', 
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
  },
  data : data
};
axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});
```

```python
import http.client
import json
conn = http.client.HTTPSConnection("open-api.123pan.com")
payload = json.dumps({
    "fileIDs": [
        "yk6baz03t0l000d7w33fbyt8704m2bohDIYPAIDOBIY0DcxvDwFO"
    ]
})
headers = {
    'Content-Type': 'application/json',
    'Platform': 'open_platform',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
}
conn.request("POST", "/api/v1/oss/file/delete", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

##### 响应示例

```json
{
    "code": 0,
    "message": "ok",
    "data": null,
    "x-traceID": "821c1654-3f6f-4536-b4a1-59bfb714b82b_kong-db-5898fdd8c6-d258b"
}
```

### 获取图片信息

#### 获取图片详情

*API: GET 域名 + /api/v1/oss/file/detail*

##### Header 参数

| 名称         | 类型     | 是否必填 | 说明                 |
|------------|--------|------|---------------------|
| Authorization | string | 必填   | 鉴权access_token     |
| Platform    | string | 必填   | 固定为:open_platform  |

##### QueryString 参数

| 名称     | 类型     | 是否必填 | 说明         |
|--------|--------|------|------------|
| fileID  | string | 必填   | 文件ID       |

##### 返回数据

| 名称         | 类型     | 是否必填 | 说明                 |
|------------|--------|------|---------------------|
| fileId     | string | 必填   | 文件ID               |
| filename   | string | 必填   | 文件名               |
| type       | number | 必填   | 0-文件 1-文件夹       |
| size       | number | 必填   | 文件大小             |
| etag       | string | 必填   | md5                 |
| status     | number | 必填   | 文件审核状态。大于100为审核驳回文件 |
| createAt   | string | 必填   | 创建时间             |
| updateAt   | string | 必填   | 更新时间             |
| downloadURL| string | 必填   | 下载链接             |
| userSelfURL| string | 必填   | 自定义域名链接         |
| totalTraffic| number | 必填   | 流量统计             |
| parentFileId| string | 必填   | 父级ID               |
| parentFilename| string | 必填   | 父级文件名称         |
| extension  | string | 必填   | 后缀名称             |

##### 示例

###### 请求示例

```bash
curl --location --request GET 'https://open-api.123pan.com/api/v1/oss/file/detail' \
--header 'Content-Type: application/json' \
--header 'Platform: open_platform' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)' \
--data '{
    "fileID": "ymjew503t0m000d7w32xormjidkak3rgDIYPAIDOBIY0DcxvDwFO"
}'
```

```java
OkHttpClient client = new OkHttpClient().newBuilder()
.build();
MediaType mediaType = MediaType.parse("application/json");
RequestBody body = RequestBody.create(mediaType, "{\n    \"fileID\": \"ymjew503t0m000d7w32xormjidkak3rgDIYPAIDOBIY0DcxvDwFO\"\n}");
Request request = new Request.Builder()
.url("https://open-api.123pan.com/api/v1/oss/file/detail")
.method("GET", body)
.addHeader("Content-Type", "application/json")
.addHeader("Platform", "open_platform")
.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)")
.build();
Response response = client.newCall(request).execute();
```

```javascript
var settings = {
  "url": "https://open-api.123pan.com/api/v1/oss/file/detail",
  "method": "GET",
  "timeout": 0,
  "headers": {
    "Content-Type": "application/json",
    "Platform": "open_platform",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)"
  },
  "data": JSON.stringify({
    "fileID": "ymjew503t0m000d7w32xormjidkak3rgDIYPAIDOBIY0DcxvDwFO"
  }),
};
$.ajax(settings).done(function (response) {
  console.log(response);
});
```

```javascript
const axios = require('axios');
let data = JSON.stringify({
  "fileID": "ymjew503t0m000d7w32xormjidkak3rgDIYPAIDOBIY0DcxvDwFO"
});
let config = {
  method: 'get',
  maxBodyLength: Infinity,
  url: 'https://open-api.123pan.com/api/v1/oss/file/detail',
  headers: { 
    'Content-Type': 'application/json', 
    'Platform': 'open_platform', 
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
  },
  data : data
};
axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});
```

```python
import http.client
import json
conn = http.client.HTTPSConnection("open-api.123pan.com")
payload = json.dumps({
  "fileID": "ymjew503t0m000d7w32xormjidkak3rgDIYPAIDOBIY0DcxvDwFO"
})
headers = {
  'Content-Type': 'application/json',
  'Platform': 'open_platform',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
}
conn.request("GET", "/api/v1/oss/file/detail", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

###### 响应示例

```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "fileId": "ymjew503t0m000d7w32xormjidkak3rgDIYPAIDOBIY0DcxvDwFO",
        "filename": "测试图床.jpg",
        "parentFileId": "yk6baz03t0l000d7w33fbyq51l4izkneDIYPAIDOBIY0DcxvDwFO",
        "type": 0,
        "etag": "e62623f4906aeba8f8d8f5de19e1e34e",
        "size": 22027358,
        "status": 2,
        "s3KeyFlag": "1817178140-0",
        "storageNode": "m76",
        "createAt": "2025-03-03 16:38:26",
        "updateAt": "2025-03-03 16:38:26",
        "downloadURL": "https://vip.123pan.cn/1815309870/ymjew503t0m000d7w32xormjidkak3rgDIYPAIDOBIY0DcxvDwFO.jpg",
        "ossIndex": 43,
        "totalTraffic": 0,
        "parentFilename": "测试图床目录",
        "extension": "jpg",
        "userSelfURL": "https://vip.123pan.cn/1815309870/ymjew503t0m000d7w32xormjidkak3rgDIYPAIDOBIY0DcxvDwFO.jpg"
    },
    "x-traceID": "fe8e8c6e-e7bd-44f2-bc83-3243e7e07ee5_kong-db-5898fdd8c6-wgsts"
}
```

#### 获取图片列表

*API: POST 域名 + /api/v1/oss/file/list*

##### Header 参数

| 名称         | 类型    | 是否必填 | 说明         |
|------------|-------|------|------------|
| Authorization | string | 必填   | 鉴权access_token |
| Platform   | string | 必填   | 固定为:open_platform |

##### Body 参数

| 名称         | 类型    | 是否必填 | 说明         |
|------------|-------|------|------------|
| parentFileId | string | 选填   | 父级目录Id, 默认为空表示筛选根目录下的文件 |
| limit      | number | 必填   | 每页文件数量，最大不超过100 |
| startTime  | number | 选填   | 筛选开始时间（时间戳格式，例如 1730390400） |
| endTime    | number | 选填   | 筛选结束时间（时间戳格式，例如 1730390400） |
| lastFileId | string | 选填   | 翻页查询时需要填写 |
| type       | number | 必填   | 固定为1       |

##### 返回数据

| 名称         | 类型    | 是否必填 | 说明         |
|------------|-------|------|------------|
| lastFileId | string | 必填   | -1代表最后一页（无需再翻页查询）其他代表下一页开始的文件id，携带到请求参数中 |
| fileList   | array  | 必填   | 文件列表     |

###### fileList 内容

| 名称         | 类型    | 是否必填 | 说明         |
|------------|-------|------|------------|
| fileId     | string | 必填   | 文件ID      |
| filename   | string | 必填   | 文件名      |
| type       | number | 必填   | 0-文件 1-文件夹 |
| size       | number | 必填   | 文件大小    |
| etag       | string | 必填   | md5        |
| status     | number | 必填   | 文件审核状态。 大于 100 为审核驳回文件 |
| createAt   | string | 必填   | 创建时间    |
| updateAt   | string | 必填   | 更新时间    |
| downloadURL| string | 必填   | 下载链接    |
| userSelfURL| string | 必填   | 自定义域名链接 |
| totalTraffic| number | 必填   | 流量统计    |
| parentFileId| string | 必填   | 父级ID      |
| parentFilename| string | 必填   | 父级文件名称 |
| extension | string | 必填   | 后缀名称    |

##### 示例

###### 请求示例

```shell
curl --location 'https://open-api.123pan.com/api/v1/oss/file/list' \
--header 'Content-Type: application/json' \
--header 'Platform: open_platform' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)' \
--data '{
    "parentFileId": "ymjew503t0m000d5qavemj7c19gu1js0DIYPAIDOBIY0DcxvDwFO",
    "limit": 100,
    "type": 1
}'
```

```java
OkHttpClient client = new OkHttpClient().newBuilder()
.build();
MediaType mediaType = MediaType.parse("application/json");
RequestBody body = RequestBody.create(mediaType, "{\n    \"parentFileId\": \"ymjew503t0m000d5qavemj7c19gu1js0DIYPAIDOBIY0DcxvDwFO\",\n    \"limit\": 100,\n    \"type\": 1\n}");
Request request = new Request.Builder()
.url("https://open-api.123pan.com/api/v1/oss/file/list")
.method("POST", body)
.addHeader("Content-Type", "application/json")
.addHeader("Platform", "open_platform")
.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)")
.build();
Response response = client.newCall(request).execute();
```

```javascript
var settings = {
  "url": "https://open-api.123pan.com/api/v1/oss/file/list",
  "method": "POST",
  "timeout": 0,
  "headers": {
    "Content-Type": "application/json",
    "Platform": "open_platform",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)"
  },
  "data": JSON.stringify({
    "parentFileId": "ymjew503t0m000d5qavemj7c19gu1js0DIYPAIDOBIY0DcxvDwFO",
    "limit": 100,
    "type": 1
  }),
};
$.ajax(settings).done(function (response) {
  console.log(response);
});
```

```javascript
const axios = require('axios');
let data = JSON.stringify({
  "parentFileId": "ymjew503t0m000d5qavemj7c19gu1js0DIYPAIDOBIY0DcxvDwFO",
  "limit": 100,
  "type": 1
});
let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://open-api.123pan.com/api/v1/oss/file/list',
  headers: { 
    'Content-Type': 'application/json', 
    'Platform': 'open_platform', 
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
  },
  data : data
};
axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});
```

```python
import http.client
import json

conn = http.client.HTTPSConnection("open-api.123pan.com")
payload = json.dumps({
    "parentFileId": "ymjew503t0m000d5qavemj7c19gu1js0DIYPAIDOBIY0DcxvDwFO",
    "limit": 100,
    "type": 1
})
headers = {
    'Content-Type': 'application/json',
    'Platform': 'open_platform',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJl...(过长省略)'
}
conn.request("POST", "/api/v1/oss/file/list", payload, headers)
res = conn.getresponse()
data = res.read()
print(data.decode("utf-8"))
```

###### 响应示例
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "lastFileId": "-1",
        "fileList": [
            {
                "fileId": "ymjew503t0l000d7w32x751ex14jo8adDIYPAIDOBIY0DcxvDwFO",
                "filename": "测试图床目录1",
                "parentFileId": "ymjew503t0m000d5qavemj7c19gu1js0DIYPAIDOBIY0DcxvDwFO",
                "type": 1,
                "etag": "",
                "size": 0,
                "status": 0,
                "s3KeyFlag": "",
                "storageNode": "",
                "createAt": "2025-03-03 15:43:46",
                "updateAt": "2025-03-03 15:43:46",
                "downloadURL": "",
                "ossIndex": 42,
                "totalTraffic": 0,
                "parentFilename": "img_oss",
                "extension": "",
                "userSelfURL": ""
            },
            {
                "fileId": "yk6baz03t0l000d7w33fbyq51l4izkneDIYPAIDOBIY0DcxvDwFO",
                "filename": "测试图床目录",
                "parentFileId": "ymjew503t0m000d5qavemj7c19gu1js0DIYPAIDOBIY0DcxvDwFO",
                "type": 1,
                "etag": "",
                "size": 0,
                "status": 0,
                "s3KeyFlag": "",
                "storageNode": "",
                "createAt": "2025-03-03 15:07:54",
                "updateAt": "2025-03-03 15:07:54",
                "downloadURL": "",
                "ossIndex": 42,
                "totalTraffic": 0,
                "parentFilename": "img_oss",
                "extension": "",
                "userSelfURL": ""
            }
        ]
    },
    "x-traceID": "5e0aa7b9-b430-41d0-bca0-647e28f47ec6_kong-db-5898fdd8c6-wnv6h"
}
```