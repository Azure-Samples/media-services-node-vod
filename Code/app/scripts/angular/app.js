var app = angular.module('amsApp',
    [
        'ui.bootstrap',
        'ngFileUpload',
        'ngResource',
        'ui.bootstrap',
        'ngRoute'
    ]
)

app.config(['$routeProvider', function($routeProvider) {
        $routeProvider.
        when('/videos', {
            templateUrl: 'views/videos.html',
            controller: 'videoCtrl'
        }).
        when('/upload', {
            templateUrl: 'views/upload.html',
            controller: 'uploadCtrl'
        }).
        otherwise({
            redirectTo: '/videos'
        });
    }]);

app.factory('videos', ['$resource', function($resource) {
        return $resource('videos/:Id', {
            Id: '@_id'
        });
    }]);

app.factory("newVideo", function() {
    var current_data = {};
    var default_values =  {
        "assetId": "",
        "rawAssetId": "",
        "encodeJobId": "",
        "filename": "",
        "title": "",
        "description": "",
        "accessPolicyId": "",
        "locatorId": "",
        "streamingURL": "",
        "creationTime": "",
        "thumbnail": "",
        "sasURL": '',
        reset: function() {
            console.log( 'Resetting')
            return current_data = angular.extend(current_data, default_values);
        }
    };
    default_values.reset();
    return current_data;
});

app.controller('navCtrl', function ($scope, $window) {
    $scope.isCollapsed = true;

    $scope.reload = function () {
        $window.location.reload();
    }
});

app.controller('uploadCtrl', function ($scope, $http, Upload, $timeout, newVideo) {
    $scope.$watch('$viewContentLoaded', function () {
        document.getElementById('indice2').className = "active";
        document.getElementById('indice1').className = "";
    });

    newVideo.reset();
    $scope.uploaderror = false;
    $scope.uploadsuccess = false;

    var guid = function () {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }

    var uploadRequest = function (file) {
        if (file) {
            $scope.fileloader = true;
            newVideo.filename = guid() + '.' + file.name.split('.').pop();
            newVideo.title = $scope.title;
            newVideo.description = $scope.description;

            $http.post('/upload', newVideo)
                .then(function successCallback(response) {
                    newVideo.rawAssetId = response.data.rawAssetId;
                    newVideo.sasURL = response.data.sasURL;
                    return upload(file);
                }, function errorCallback(error) {
                    $scope.fileloader = false;
                    $scope.errorMsg = error;
                });
        }
    }

    var upload = function (file) {
        var path1 = newVideo.sasURL.split('?');
        console.log(path1);
        var sasKey = path1[1];
        var path2 = path1[0].split('/');
        var blobStorageUri = 'https://' + path2[2];
        var containerName = path2[3];
        var blobName = newVideo.filename;

        var fileReader = new FileReader();
        fileReader.readAsArrayBuffer(file);

        fileReader.onload = function (e) {
            if(newVideo.thumbnail === ''){
                createThumbnail(fileReader, file, newVideo);
            }
        }

        var blobService = AzureStorage.createBlobServiceWithSas(blobStorageUri, sasKey).withFilter(new AzureStorage.ExponentialRetryPolicyFilter());
        if (!blobService)
            return;

        var fileStream = new FileStream(file);
        // Make a smaller block size when uploading small blobs
        var blockSize = file.size > 1024 * 1024 * 32 ? 1024 * 1024 * 4 : 1024 * 512;
        var options = {
            storeBlobContentMD5: false,
            blockSize: blockSize
        };

        blobService.singleBlobPutThresholdInBytes = blockSize;

        var finishedOrError = false;
        var speedSummary = blobService.createBlockBlobFromStream(containerName, blobName, fileStream, file.size, options,
            function (error, result, response) {
                finishedOrError = true;
                if (error) {
                    $scope.uploaderror = true;
                    $scope.errorMsg = error;
                } else {
                    $http.post('/encode/' + newVideo.rawAssetId, {'size': file.size, 'thumbnail': newVideo.thumbnail})
                        .then(function successCallback(response){
                            $scope.uploadsuccess = true;
                        }, function errorCallback(error){
                            $scope.uploaderror = true;
                            $scope.errorMsg = error;
                        });
                }
            });

        function refreshProgress () {
            $timeout(function () {
                if (!finishedOrError) {
                    var process = speedSummary.getCompletePercent();
                    $scope.dynamic = Math.min(100, parseInt(process));
                    $scope.fileloader = false;
                    refreshProgress();
                }
            }, 200);
        }

        refreshProgress();
    }

    var createThumbnail = function (fileReader, file, newVideo) {
        var blob = new Blob([fileReader.result], {type: file.type});
        var url = URL.createObjectURL(blob);
        var video = document.createElement('video');
        video.addEventListener('loadeddata', function() {
            getThumb(function () {
                video.pause();
                video.src = "";
            });
        }, false);
        video.src = url;
        video.load();
        var getThumb = function(cb) {
            var MAX_WIDTH = 160;
            var canvas = document.createElement('canvas');
            canvas.width = MAX_WIDTH;
            canvas.height = video.videoHeight * MAX_WIDTH / video.videoWidth;
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            var image = canvas.toDataURL();
            newVideo.thumbnail = image;
            return cb();
        };
    }

    $scope.uploadBox = true;

    $scope.submit = function() {
        if ($scope.form.file.$valid && $scope.file) {
            $scope.uploadBox = false;
            uploadRequest($scope.file);
        }
    };
});

app.controller('videoCtrl', function ($scope, videos) {
    $scope.$watch('$viewContentLoaded', function () {
        document.getElementById('indice1').className = "active";
        document.getElementById('indice2').className = "";
    });

    $scope.find = function () {
        $scope.videoloader = true;
        $scope.videos = videos.query(function () {
            $scope.videoloader = false;
        });
    };

    $scope.delete = function (vid) {
        if (vid) {
            $scope.deleteloader = true;
            $scope.deletevid = vid;
            vid.$remove(function() {
                $scope.deleteloader = false;
                for (var i in $scope.videos) {
                    if ($scope.videos[i] === vid) {
                        $scope.videos.splice(i, 1);
                    }
                }
            });
        }
    };

    $scope.play = function (vid) {
        if(vid === 0){
            $scope.playVideo = false;
            var myPlayer = amp('vid1');
            myPlayer.pause();
            myPlayer.src([{
                src: ""
            }]);
        }else{
            var streamingURL = vid.streamingURL;
            var filename = vid.filename.split('.')[0] + '.ism';
            var myPlayer = amp('vid1', { /* Options */
                    logo: { "enabled": false },
                    techOrder: ["azureHtml5JS", "flashSS", "html5FairPlayHLS","silverlightSS", "html5"],
                    "nativeControlsForTouch": false,
                    autoplay: false,
                    controls: true,
                    width: "640",
                    height: "400",
                    poster: ""
                }, function() {
                    console.log('Good to go!');
                    // add an event listener
                    this.addEventListener('ended', function() {
                        console.log('Finished!');
                    });
                }
            );
            myPlayer.pause();
            myPlayer.src([{
                src: streamingURL + filename + "/manifest",
                type: "application/vnd.ms-sstr+xml"
            }]);

            myPlayer.ready(function(){
                $scope.playVideo = true;
                var myPlayer = this;
                myPlayer.play();
            });
        }
    }
});
