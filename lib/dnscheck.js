var dns = require('dns');

// http://tools.ietf.org/html/rfc6186

module.exports.detectIMAPConnectionSettings = detectIMAPConnectionSettings;

function detectIMAPConnectionSettings(address, password, callback){
    if(!callback && typeof password == "function"){
        callback = password;
        password = undefined;
    }

    var parts = (address || "").toString().split("@"),
        user = parts.shift() || "",
        domain = parts.pop() || "";

    if(!user || !domain){
        return callback(new Error("Data missing"));
    }

    var protos = ["imap", "imaps"],
        waitingFor = protos.length,
        ready = false;

    for(var i=0, len = protos.length; i<len; i++){
        checkProtocol(protos[i], domain, function(err, data){
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

function checkProtocol(proto, domain, callback){
    dns.resolve("_"+proto+"._tcp."+domain, "SRV", function(err, addresses){
        var data = {};

        if(err){
            return callback(err);
        }
        if(!addresses || !addresses.length || !addresses[0].name || addresses[0].name == "."){
            return callback(null, null);
        }

        if(proto == "imaps"){
            data.host = addresses[0].name;
            data.port = addresses[0].port;
            data.secure = proto == "imaps";
        }

        callback(null, data);
    })
}
