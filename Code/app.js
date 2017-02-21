var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var ejs = require('ejs');
var async = require('async');
var request = require('request');
var mongoose = require('mongoose');
var config = require('./config');
var video = require('./video');
var api = require('./amsapi');

var options = { server: { socketOptions: { keepAlive: 300000, connectTimeoutMS: 30000 } },
  replset: { socketOptions: { keepAlive: 300000, connectTimeoutMS : 30000 } } };

var mongodbUri = config.db;

mongoose.connect(mongodbUri, options);

var conn = mongoose.connection;

conn.on('error', function (err) {
  console.log(err);
  mongoose.connect(mongodbUri, options);
});

conn.once('open', function() {
  // Wait for the database connection to establish, then start the app.
});

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.engine('.html', ejs.__express);
app.set('view engine', 'html');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'app')));

// angular
app.get('/', function (req, res) {
  res.sendfile('app/index.html');
});

var init = function () {
  async.waterfall([
    function (cb) {
      api.getAccessToken(cb);
    },
    function (cb) {
      api.getRedirectURL(cb);
    },
    function (cb) {
      api.getMediaProcessors(cb);
    }
  ], function (err) {
    console.log(err);
  });
}

init();

setInterval(function () {
  init();
}, 21599*1000);

app.get('/videos', video.list);
app.delete('/videos/:id', video.delete);
app.post('/video', video.create);

app.post('/upload', function (req, res) {
  var filename = req.body.filename;
  var title = req.body.title;
  var description = req.body.description;
  async.waterfall([
    function (cb) {
      api.createAsset({"Name": filename}, cb);
    },
    function (assetId, cb) {
      api.createAssetFile({
        "IsEncrypted":"false",
        "IsPrimary":"false",
        "MimeType":"video/mp4",
        "Name":filename,
        "ParentAssetId":assetId,
      }, assetId, cb);
    },
    function (assetId, cb) {
      api.createPolicy({
        "Name": "UploadPolicy",
        "DurationInMinutes" : "100",
        "Permissions" : 2
      }, assetId, cb);
    },
    function (assetId, policyId, cb) {
      api.createLocator(assetId, policyId, 1, cb);
    },
  ], function (err, assetId, policyId, locatorId, sasURL) {
    res.json({'rawAssetId': assetId, 'sasURL': sasURL});
    return video.create({
      'rawAssetId': assetId,
      'filename': filename,
      'title': title,
      'description': description,
    });
  });
});

var mes = [
  'H264 Multiple Bitrate 1080p Audio 5.1',
  'H264 Multiple Bitrate 1080p',
  'H264 Multiple Bitrate 16x9 for iOS',
  'H264 Multiple Bitrate 16x9 SD Audio 5.1',
  'H264 Multiple Bitrate 16x9 SD',
  'H264 Multiple Bitrate 4K Audio 5.1',
  'H264 Multiple Bitrate 4K',
  'H264 Multiple Bitrate 4x3 for iOS',
  'H264 Multiple Bitrate 4x3 SD Audio 5.1',
  'H264 Multiple Bitrate 4x3 SD',
  'H264 Multiple Bitrate 720p Audio 5.1',
  'H264 Multiple Bitrate 720p',
  'H264 Single Bitrate 1080p Audio 5.1',
  'H264 Single Bitrate 1080p',
  'H264 Single Bitrate 4K Audio 5.1',
  'H264 Single Bitrate 4K',
  'H264 Single Bitrate 4x3 SD Audio 5.1',
  'H264 Single Bitrate 4x3 SD',
  'H264 Single Bitrate 16x9 SD Audio 5.1',
  'H264 Single Bitrate 16x9 SD',
  'H264 Single Bitrate 720p Audio 5.1',
  'H264 Single Bitrate 720p for Android',
  'H264 Single Bitrate 720p',
  'H264 Single Bitrate High Quality SD',
  'H264 Single Bitrate Low Quality SD',
];

app.post('/encode/:id', function (req, res) {
  var assetId = req.params.id;
  var size = req.body.size;
  var thumbnail = req.body.thumbnail;
  async.waterfall([
    function (cb) {
      api.updateAssetFile(
          api.pendingRequests[assetId]['assetFileId'],
          {"ContentFileSize":size.toString()}, cb);
    },
    function (cb) {
      api.deleteLocator(api.pendingRequests[assetId]['locatorId'], cb);
    },
    function (cb) {
      api.deletePolicy(api.pendingRequests[assetId]['policyId'], cb);
    },
    function (cb) {
      api.createJob(assetId, mes[9], cb);
    },
  ], function (err, jobId) {
    res.json({'encodeJobId': jobId});
    return video.update({'rawAssetId': assetId}, {'encodeJobId': jobId, 'thumbnail': thumbnail});
  });
});

/* encodeStatus
{
 0: 'Queued',
 1: 'Scheduled',
 2: 'Processing',
 3: 'Finished',
 4: 'Error',
 5: 'Canceled',
 6: 'Canceling',
 };*/

setInterval(function () {
  video.listEncodeJobs(function (jobs) {
    jobs.forEach(function(job) {
      api.getEncodeStatus(job, function (err, encodeStatus) {
        if(encodeStatus == 3){
          async.waterfall([
            function (cb) {
              api.getOutputAsset(job, cb);
            },
            function (assetId, cb) {
              api.createPolicy({
                "Name": "DownloadPolicy",
                "DurationInMinutes" : "43200",
                "Permissions" : 1
              }, assetId, cb);
            },
            function (assetId, policyId, cb) {
              api.createLocator(assetId, policyId, 2, cb);
            },
          ], function (err, assetId, policyId, locatorId, streamingURL) {
            return video.update({'encodeJobId': job}, {
              'assetId': assetId,
              'encodeJobId': undefined,
              'policyId': policyId,
              'locatorId': locatorId,
              'streamingURL': streamingURL,
            });
          });
        }
      });
    });
  });
}, 300*1000);

module.exports = app;
