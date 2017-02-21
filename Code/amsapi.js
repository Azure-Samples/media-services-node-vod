var moment = require('moment');
var request = require('request');
var uuid = require('node-uuid');
var config = require('./config');

var accessToken;
var base_url;
var headers;
var pendingRequests = {};
var mediaProcessorId;

var getAccessToken = function (callback) {
    callback = callback || function () {};
    request.post({
        uri: config.oauthurl,
        form: {
            grant_type: 'client_credentials',
            client_id: config.client_id,
            client_secret: config.client_secret,
            scope: 'urn:WindowsAzureMediaServices'
        },
        strictSSL: true
    }, function (err, res) {
        if (err) {
            return callback(err);
        }
        var result = JSON.parse(res.body);
        if (result.error) {
            return callback(result);
        }
        accessToken = 'Bearer ' + result.access_token;
        headers = {
            'Content-Type': 'application/json;odata=verbose',
            'Accept': 'application/json;odata=verbose',
            'DataServiceVersion': '3.0',
            'MaxDataServiceVersion': '3.0',
            'x-ms-version': '2.11',
            'Authorization': accessToken,
        }
        callback(err);
    });
}

var getRedirectURL = function (callback) {
    callback = callback || function () {};
    request.get({
        uri: "https://media.windows.net/",
        headers: {'Accept': 'application/json', 'Authorization': accessToken, 'x-ms-version': '2.11'},
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 301) {
            base_url = res.headers.location;
            callback(err);
        } else {
            callback(err || ': Expected 301 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var getMediaProcessors = function(callback) {
    callback = callback || function () {};
    request.get({
        uri: base_url + "MediaProcessors()?$filter=Name%20eq%20'Media%20Encoder%20Standard'",
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 200) {
            mediaProcessorId = JSON.parse(res.body).d.results[0].Id;
            callback(err);
        } else {
            callback(err || ': Expected 200 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var createAsset = function(data, callback) {
    callback = callback || function () {};
    request.post({
        uri: base_url + 'Assets',
        headers: headers,
        body: JSON.stringify(data),
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 201) {
            var assetId = JSON.parse(res.body).d.Id;
            pendingRequests[assetId] = {'assetId': assetId};
            callback(err, assetId);
        } else {
            callback(err || ': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var deleteAsset = function(assetId, callback) {
    callback = callback || function () {};
    request({
        method: 'DELETE',
        uri: base_url + "Assets('" + encodeURIComponent(assetId) + "')",
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 204) {
            callback(err);
        } else {
            callback(err || ': Expected 200 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var createAssetFile = function(data, assetId, callback) {
    callback = callback || function () {};
    request.post({
        uri: base_url + 'Files',
        headers: headers,
        body: JSON.stringify(data),
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 201) {
            var assetFileId = JSON.parse(res.body).d.Id;
            pendingRequests[assetId] = {'assetFileId': assetFileId};
            callback(err, assetId);
        } else {
            callback(err || ': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var updateAssetFile = function(assetFileId, data, callback) {
    callback = callback || function () {};
    var url = base_url + "Files('" + encodeURIComponent(assetFileId) + "')";
    request({
        method: 'MERGE',
        uri: url,
        headers: headers,
        body: JSON.stringify(data),
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 204) {
            callback(err);
        } else {
            callback(err || ': Expected 204 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var createPolicy = function(data, assetId, callback) {
    callback = callback || function () {};
    request.post({
        uri: base_url + 'AccessPolicies',
        headers: headers,
        body: JSON.stringify(data),
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 201) {
            var policyId = JSON.parse(res.body).d.Id;
            callback(err, assetId, policyId);
        } else {
            callback(err || ': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var deletePolicy = function(policyId, callback) {
    callback = callback || function () {};
    var url = base_url + "AccessPolicies('" + encodeURIComponent(policyId) + "')"
    request({
        method: 'DELETE',
        uri: url,
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 204) {
            callback(err);
        } else {
            callback(err || 'Expected 204 status, received: ' + res.statusCode);
        }
    });
}

var createLocator = function(assetId, policyId, type, callback) {
    callback = callback || function () {};
    var data = {
        "AccessPolicyId": policyId,
        "AssetId" : assetId,
        "StartTime" : moment.utc().subtract(10, 'minutes').format('M/D/YYYY hh:mm:ss A'),
        "Type":type,
    }
    request.post({
        uri: base_url + 'Locators',
        headers: headers,
        body: JSON.stringify(data),
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 201) {
            var resURL = JSON.parse(res.body).d.Path;
            var locatorId = JSON.parse(res.body).d.Id;
            pendingRequests[assetId]['policyId'] = policyId;
            pendingRequests[assetId]['locatorId'] = locatorId;
            callback(err, assetId, policyId, locatorId, resURL);
        } else {
            callback(err || ': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var deleteLocator = function(locatorId, callback) {
    callback = callback || function () {};
    var url = base_url + "Locators('" + encodeURIComponent(locatorId) + "')";
    request({
        method: 'DELETE',
        uri: url,
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 204) {
            callback(err);
        } else {
            callback(err || 'Expected 204 status, received: ' + res.statusCode);
        }
    });
}

var createJob = function(assetId, encoder, callback) {
    callback = callback || function () {};
    var url = base_url + "Assets('" + encodeURIComponent(assetId) + "')";
    var data = {
        'Name': 'EncodeVideo-' + uuid(),
        'InputMediaAssets': [{'__metadata': {'uri': url}}],
        'Tasks': [{
            'Configuration': encoder,
            'MediaProcessorId': mediaProcessorId,
            'TaskBody': "<?xml version=\"1.0\" encoding=\"utf-8\"?><taskBody><inputAsset>JobInputAsset(0)</inputAsset><outputAsset>JobOutputAsset(0)</outputAsset></taskBody>"
        }]
    }
    request.post({
        uri: base_url + "Jobs",
        headers: headers,
        body: JSON.stringify(data),
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 201) {
            var jobId = JSON.parse(res.body).d.Id;
            callback(err, jobId);
        } else {
            callback(err || ': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var getEncodeStatus = function(jobId, callback) {
    request.get({
        uri: base_url + "Jobs('" + encodeURIComponent(jobId) + "')/State",
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 200) {
            var encodeStatus = JSON.parse(res.body).d.State;
            callback(err, encodeStatus)
        } else {
            callback(err || ': Expected 200 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var getOutputAsset = function(jobId, callback) {
    request.get({
        uri: base_url + "Jobs('" + encodeURIComponent(jobId) + "')/OutputMediaAssets",
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 200) {
            var outputAssetId = JSON.parse(res.body).d.results[0].Id;
            pendingRequests[outputAssetId] = {'assetId': outputAssetId};
            callback(err, outputAssetId)
        } else {
            callback(err || ': Expected 200 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

// Not used
var getFileName = function(assetId, streamingURL, callback) {
    request.get({
        uri: base_url + "Assets('" + encodeURIComponent(assetId) + "')/Files",
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 200) {
            var filename = JSON.parse(res.body).d.results[1].Name;
            callback(err, filename, streamingURL)
        } else {
            callback(err || ': Expected 200 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

module.exports = {
    accessToken: accessToken,
    base_url: base_url,
    headers: headers,
    pendingRequests: pendingRequests,
    getAccessToken: getAccessToken,
    getRedirectURL: getRedirectURL,
    getMediaProcessors: getMediaProcessors,
    createAsset: createAsset,
    deleteAsset: deleteAsset,
    createAssetFile: createAssetFile,
    updateAssetFile: updateAssetFile,
    createPolicy: createPolicy,
    deletePolicy: deletePolicy,
    createLocator: createLocator,
    deleteLocator: deleteLocator,
    createJob: createJob,
    getEncodeStatus: getEncodeStatus,
    getOutputAsset: getOutputAsset,
    getFileName: getFileName,
};