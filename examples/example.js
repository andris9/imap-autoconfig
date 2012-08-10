var autoconfig = require("../index");

var detector = autoconfig.createIMAPSettingsDetector();

detector.detect("pipemail@node.ee", "zzzzz", true, function(err, data){
    console.log(err || data);
});

