var mongoose = require('mongoose');
var async = require('async');
var api = require('./amsapi');
var Schema = mongoose.Schema;

var VideoSchema = new Schema({
    assetId: {
        type: String,
        trim: true
    },
    rawAssetId: {
        type: String,
        trim: true
    },
    encodeJobId: {
        type: String,
        trim: true
    },
    filename:{
        type: String,
        default: '',
        trim: true
    },
    title:{
        type: String,
        default: '',
        trim: true
    },
    description:{
        type: String,
        default: '',
        trim: true
    },
    accessPolicyId:{
        type: String,
        trim: true
    },
    locatorId:{
        type: String,
        trim: true
    },
    streamingURL:{
        type: String,
        trim: true
    },
    creationTime:{
        type: Date,
        default: Date.now
    },
    thumbnail:{
        type: String,
        default: '',
        trim: true
    }
});

mongoose.model('Video', VideoSchema);

var Video = mongoose.model('Video');

exports.create = function (data) {
    var video = new Video(data);
    video.save(function(err) {
        if (err) {
            console.log(err);
        } else {
            console.log('success');
        }
    });
}

exports.update = function (query, data) {
    Video.findOneAndUpdate(query, data, {upsert:true}, function(err, video){
        if (err) {
            console.log(err);
        } else {
            console.log(video);
        }
    });
}

exports.list = function(req, res) {
    Video.find().sort('-creationTime').exec(function(err, videos) {
        if (err) {
            return res.status(400).send(err);
        } else {
            res.json(videos);
        }
    });
}

exports.delete = function(req, res) {
    Video.find({_id: req.params.id}, function(err, video){
        var assetId = video[0]._doc.assetId;
        var rawAssetId = video[0]._doc.rawAssetId;
        var accessPolicyId = video[0]._doc.accessPolicyId;
        var locatorId = video[0]._doc.locatorId;

        async.waterfall([
            function (cb) {
                if(locatorId){
                    api.deleteLocator(locatorId, cb);
                }else{
                    cb();
                }
            },
            function (cb) {
                if(accessPolicyId){
                    api.deletePolicy(accessPolicyId, cb);
                }else{
                    cb();
                }
            },
            function (cb) {
                if(rawAssetId){
                    api.deleteAsset(rawAssetId, cb);
                }else{
                    cb();
                }
            },
            function (cb) {
                if(assetId){
                    api.deleteAsset(assetId, cb);
                }else{
                    cb();
                }
            },
        ], function (err) {
            video[0].remove(function(err) {
                if (err) {
                    return res.status(400).send(err);
                } else {
                    res.json(video[0]);
                }
            });
        });
    });
};

exports.listEncodeJobs = function(cb) {
    Video.find({encodeJobId: {$gt: []}}).exec(function(err, videoes){
        if (err) {
            console.log(err);
        } else {
            var jobs = [];
            videoes.forEach(function(video) {
                jobs.push(video.encodeJobId);
            });
            return cb(jobs);
        }
    });
}