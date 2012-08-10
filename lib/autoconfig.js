var xml2object = require("xml2object"),
    fetch = require("fetch"),
    dns = require('dns');

module.exports.listServiceURLs = listServiceURLs;
module.exports.checkConfigUrl = checkConfigUrl;
module.exports.detectIMAPConnectionSettings = detectIMAPConnectionSettings;

// https://developer.mozilla.org/en/Thunderbird/Autoconfiguration
// http://technet.microsoft.com/en-us/library/cc511507.aspx

var serviceURLs = [
    "http://autoconfig.%DOMAIN%/mail/config-v1.1.xml?emailaddress=%USER%@%DOMAIN%",
    "http://%DOMAIN%/.well-known/autoconfig/mail/config-v1.1.xml",
    "https://autoconfig-live.mozillamessaging.com/autoconfig/v1.1/%DOMAIN%",
    "https://live.mozillamessaging.com/autoconfig/%DOMAIN%",
    "https://%DOMAIN%/autodiscover/autodiscover.xml",
    "http://%DOMAIN%/autodiscover/autodiscover.xml",
    "https://autodiscover.%DOMAIN%/autodiscover/autodiscover.xml",
    "http://autodiscover.%DOMAIN%/autodiscover/autodiscover.xml"
];

function detectIMAPConnectionSettings(address, password, callback){
    if(!callback && typeof password == "function"){
        callback = password;
        password = undefined;
    }

    listServiceURLs(address, function(err, urls){
        if(err){
            return callback(err);
        }
        checkServiceURLs(urls, address, password, callback);
    });
}

function checkServiceURLs(urls, address, password, callback){
    var waitingFor = urls.length,
        ready = false;

    for(var i=0, len = urls.length; i<len; i++){
        checkConfigUrl(urls[i], {
                username: address,
                password: password
            }, function(err, data){
                waitingFor--;

                if(ready){
                    return;
                }
                
                if(data){
                    ready = true;
                    return callback(null, data);
                }

                if(waitingFor == 0){
                    return callback(null, null);
                }
            });
    }
}

function digServiceUrl(domain, callback){
    dns.resolve("_autodiscover._tcp."+domain, "SRV", function(err, addresses){
        var url;
        if(err){
            return callback(err);
        }
        if(!addresses || !addresses.length){
            return callback(null, null);
        }

        url = (addresses[0].port == 443? "https://":"http://") + 
                addresses[0].name + 
                ([80, 443].indexOf(addresses[0].port)<0?":"+addresses[0].port:"");
        url += "/autodiscover/autodiscover.xml";

        callback(null, url);
    })
}

function listServiceURLs(address, callback){
    var parts = (address || "").toString().split("@"),
        user = parts.shift() || "",
        domain = parts.pop() || "",
        response = [];

    if(!user || !domain){
        return callback(new Error("Data missing"));
    }

    for(var i=0, len = serviceURLs.length; i<len; i++){
        response.push(serviceURLs[i].replace(/%USER%/g, user).replace(/%DOMAIN%/g, domain));
    }

    digServiceUrl(domain, function(err, url){
        if(url){
            response.push(url.replace(/%USER%/g, user).replace(/%DOMAIN%/g, domain));
        }
        return callback(null, response);
    });

}


function fetchConfigStream(url, options, callback){
    if(!callback && typeof options == "function"){
        callback = options;
        options = undefined;
    }

    options = options || {};
    options.headers = options.headers || {};
    options.timeout = 3000;

    var stream = new fetch.FetchStream(url, options);
    stream.on("error", callback);

    stream.on("meta", function(meta){
        if(meta.status == 401){
            if((meta.responseHeaders['www-authenticate'] || "").match(/\bbasic\b/i)){
                if(!options.username && !options.password){
                    return callback(new Error("401 Authorization Required"));
                }
                if(!options.headers.authorization){
                    options.headers.authorization = "Basic "+ (new Buffer(options.username+":"+options.password,"utf-8").toString("base64"));
                }else if(options.username.match(/@/)){
                    options.username = options.username.match(/^[^@]+/)[0];
                    options.headers.authorization = "Basic "+ (new Buffer(options.username+":"+options.password,"utf-8").toString("base64"));
                }else{
                    return callback(new Error("401 Authorization Required"));
                }
                return fetchConfigStream(url, options, callback);
            }
        }
        if(meta.status != 200){
            return callback(new Error("Invalid response " + meta.status));
        }
        return callback(null, stream);
    });
}

function parseConfigXML(sourceStream, callback){
    var ready = false;

    sourceStream.on("error", function(err){
        if(ready){
            return;
        }
        ready = true;
        return callback(err);
    });

    var parser = new xml2object(["Protocol", "incomingServer"]);

    parser.on("object", function(name, obj) {
        var data = {};
        if(ready){
            return;
        }
        if((obj.Type || obj.type || "").toLowerCase() == "imap"){
            ready = true;
            data.host = (obj.hostname || obj.Server || "");
            data.port = (obj.port || obj.Port || "");
            data.secure = !!(obj.socketType == "SSL" || obj.SSL == "on");
            return callback(null, data);
        }
    });

    parser.on("end", function() {
        if(ready){
            return;
        }
        ready = true;
        return callback(null, null);
    });

    parser.on("error", function(err) {
        if(ready){
            return;
        }
        ready = true;
        return callback(err);
    });

    sourceStream.pipe(parser.saxStream);
}

function checkConfigUrl(url, options, callback){

    if(!callback && typeof options == "function"){
        callback = options;
        options = undefined;
    }

    fetchConfigStream(url, options, function(err, stream){
        if(err){
            return callback(err);
        }
        if(!stream){
            return callback(null, null);
        }
        parseConfigXML(stream, callback);
    });
}
