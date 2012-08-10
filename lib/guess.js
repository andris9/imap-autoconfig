var dns = require('dns'),
    net = require("net"),
    tls = require("tls");

module.exports.detectIMAPConnectionSettings = detectIMAPConnectionSettings;

var domains = [
        "imap.%DOMAIN%",
        "mail.%DOMAIN%",
        "%DOMAIN%"
    ],

    ports = [
        993,
        143
    ],

    autoroute = {
        "aspmx.l.google.com":{
            port: 993,
            host: "imap.gmail.com",
            secure: true
        },
        "alt1.aspmx.l.google.com":{
            port: 993,
            host: "imap.gmail.com",
            secure: true
        },
        "alt2.aspmx.l.google.com":{
            port: 993,
            host: "imap.gmail.com",
            secure: true
        }
    };



function detectIMAPConnectionSettings(address, password, callback){
    if(!callback && typeof password == "function"){
        callback = password;
        password = undefined;
    }

    var checkdomains = [],
        parts = (address || "").toString().split("@"),
        user = parts.shift() || "",
        domain = parts.pop() || "",
        matrix;

    if(!user || !domain){
        return callback(new Error("Data missing"));
    }

    for(var i=0, len = domains.length; i<len; i++){
        checkdomains.push(domains[i].replace(/%USER%/g, user).replace(/%DOMAIN%/g, domain));
    }

    getMXDomain(domain, function(err, mxdomain){
        if(mxdomain){
            if(autoroute[mxdomain]){
                return callback(null, autoroute[mxdomain]);
            }

            checkdomains.push(mxdomain.replace(/%USER%/g, user).replace(/%DOMAIN%/g, domain));       
        }

        matrix = generateCheckMatrix(checkdomains);

        checkMatrix(matrix, callback);
    });
}

function checkMatrix(matrix, callback){
    var waitingFor = matrix.length,
        ready = false;
    for(var i=0, len = matrix.length; i<len; i++){
        checkConnection(matrix[i], function(err, data){
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

function checkConnection(connectionData, callback){
    var func, socket, ready = false;
    
    if(connectionData.secure){
        func = tls.connect.bind(tls, {
            port: connectionData.port || 993,
            host: connectionData.host
        });
    }else{
        func = net.connect.bind(net, connectionData.port || 143, connectionData.host);
    }

    socket = func();
    socket.setTimeout(1500);

    socket.on("timeout", function(){
        if(!ready){
            callback(new Error("Timeout"));
        }
        if(socket && !socket.destroyed){
            socket.destroy();
        }
    });

    socket.on("error", function(err){
        if(!ready){
            callback(err);    
        }
        if(socket && !socket.destroyed){
            socket.destroy();
        }
    });

    socket.on("data", function(chunk){
        if(ready){
            return;
        }
        ready = true;
        if((chunk || "").toString("utf-8").substr(0,4) == "* OK"){
            callback(null, connectionData);
            if(socket && !socket.destroyed){
                socket.destroy();
            }
        }else{
            callback(null, null);
            if(socket && !socket.destroyed){
                socket.destroy();
            }
        }
    });
}

function generateCheckMatrix(checkdomains){
    var matrix = [];
    
    ports.forEach(function(port){
        checkdomains.forEach(function(domain){
            matrix.push({
                host: domain,
                port: port,
                secure: port == 993
            });
        });
    });

    return matrix;
}

function getMXDomain(domain, callback){
     dns.resolve(domain, "MX", function(err, addresses){
        if(err){
            return callback(err);
        }
        if(!addresses || !addresses.length){
            return callback(null, null);
        }

        addresses.sort(function(a,b){
            return a.priority - b.priority;
        });

        callback(null, (addresses[0].exchange || "").toString().toLowerCase().trim());
    });
}
