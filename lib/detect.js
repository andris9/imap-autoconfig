var autoconfig = require("./autoconfig"),
    dnscheck = require("./dnscheck"),
    guess = require("./guess"),
    inbox = require("inbox");

module.exports.detectIMAPSettings = detectIMAPSettings;

function detectIMAPConnectionSettings(address, password, callback){
    if(!callback && typeof password == "function"){
        callback = password;
        password = undefined;
    }

    var funcs = [
            autoconfig.detectIMAPConnectionSettings.bind(autoconfig),
            dnscheck.detectIMAPConnectionSettings.bind(dnscheck),
            guess.detectIMAPConnectionSettings.bind(guess)
        ],
        ready = false,
        waitingFor = funcs.length;

    for(var i=0, len = funcs.length; i<len; i++){
        funcs[i](address, password, function(err, data){
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

function checkLoginData(port, host, options, callback){
    var client = inbox.createConnection(port, host, options),
        done = false;
    client.connect();
    client.on("connect", function(){
        if(done){return;}
        done = true;
        client.close();
        callback(null, true);
    });

    client.on("error", function(err){
        if(done){return;}
        done = true;
        client.close();
        callback(err);
    });
}

function detectIMAPUserSettings(address, password, settings, callback){

    var inboxSettings = {
            secureConnection: !!settings.secure,
            auth: {
                pass: password
            }
        };

    inboxSettings.auth.user = address;

    checkLoginData(settings.port, settings.host, inboxSettings, function(err, success){
        if(err){
            inboxSettings.auth.user = address.split("@")[0];
            checkLoginData(settings.port, settings.host, inboxSettings, function(err, success){
                if(err){
                    return callback(err);
                }
                callback(null, "%USER%");
            });
        }else{
            callback(null, "%EMAIL%");
        }
    });

}


function detectIMAPSettings(address, password, callback){
    if(!callback && typeof password == "function"){
        callback = password;
        password = undefined;
    }

    detectIMAPConnectionSettings(address, password, function(err, settings){
        if(err){
            return callback(err);
        }

        if(password){
            detectIMAPUserSettings(address, password, settings, function(err, user){
                if(err){
                    settings.user = false;
                    settings.error = err.message;
                }else{
                    settings.user = user;
                }

                callback(null, settings);
            });
        }else{
            callback(null, settings);
        }
    });
}