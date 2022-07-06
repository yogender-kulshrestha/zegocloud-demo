var cors = require('cors')
var express = require('express');
const request = require('request');
const crypto = require('crypto');

var PORT = process.env.PORT || 8080;
var ZEGO_APP_ID = process.env.ZEGO_APP_ID || 1918429445;
var ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER_SECRET || '643c0179a6217bde579ce2e267ca0cd3';


if (!(ZEGO_APP_ID && ZEGO_SERVER_SECRET)) {
    throw new Error('You must set your ZEGO_APP_ID and ZEGO_SERVER_SECRET');
}

var app = express();

//Signature=md5(AppId + SignatureNonce + ServerSecret + Timestamp)
function GenerateUASignature(appId, signatureNonce, serverSecret, timestamp) {
    const hash = crypto.createHash('md5'); //Specifies the use of the MD5 algorithm in the hash algorithm
    var str = appId + signatureNonce + serverSecret + timestamp;
    hash.update(str);
    //hash.digest('hex') Indicates that the format of the output is hexadecimal
    return hash.digest('hex');
}

function nocache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
}

var cache = new Map()
const cacheExpireMS = 500
var makeCacheKey = function (index, size) {
    return `${index},${size}`
}
var describeRoomList = function (req, res) {
    res.header('Access-Control-Allow-Origin', "*")
    // set default query params
    req.query.PageIndex = req.query.PageIndex ? req.query.PageIndex : 1
    req.query.PageSize = req.query.PageSize ? req.query.PageSize : 200

    // query cache first
    var cacheKey = makeCacheKey(req.query.PageIndex, req.query.PageSize);
    var timestamp_ms = Date.now();
    if (cache[cacheKey] && (timestamp_ms - cache[cacheKey].timestamp_ms) < cacheExpireMS) {
        res.json(cache[cacheKey].body);
        return;
    }

    var timestamp = Math.round(timestamp_ms / 1000);
    var signatureNonce = crypto.randomBytes(8).toString('hex');
    var sig = GenerateUASignature(ZEGO_APP_ID, signatureNonce, ZEGO_SERVER_SECRET, timestamp)
    var roomID = encodeURIComponent('room1');
    var url = `https://rtc-api.zego.im/?Action=DescribeRoomList&RoomId[]=${roomID}&AppId=${ZEGO_APP_ID}&SignatureNonce=${signatureNonce}&Timestamp=${timestamp}&Signature=${sig}&SignatureVersion=2.0&IsTest=false&PageIndex=${req.query.PageIndex}&PageSize=${req.query.PageSize}`;

    request({
        uri: url, method: "GET", json: true
    },
        function (_err, _res, _resBody) {
            // console.log('Url: ', url)
            // console.log('StatusCode: ', _res.statusCode)
            // console.log('Error: ', _err)
            if (!_err && _res.statusCode) {
                // console.log(_resBody)
                cache[cacheKey] = {
                    body: _resBody,
                    timestamp_ms: timestamp_ms
                }
            } else {
                cache.delete[cacheKey]
            }
            res.json(_resBody)
        })
};


app.use(cors());
app.get('/describe_room_list', nocache, describeRoomList);

app.listen(PORT, function () {
    console.log('Service URL http://127.0.0.1:' + PORT + "/");
    console.log('Querry room list, /describe_room_list');
});
