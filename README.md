# IMAP AutoConfig

Detect e-mail connection settings

## Usage

Require imap-autoconfig

    var autoconfig = require("imap-autoconfig");

### Autoconfig object

Create new autoconfig object

    var detector = autoconfig.createIMAPSettingsDetector(config);

Where config is an optional (if not set, predefined values will be used) 
configuration object with following properties:

  * **redis** - Redis configuration object (host, port, db)
  * **cacheExpire** - Cache expiration in seconds for checked keys (set 0 for eternity, defaults to 24h)

### Check connection settings

Check IMAP connection settings with autoconfig.detect

    detector.detect(address, password, cached, callback)

Where

  * **address** is the e-mail address to check
  * **password** is the password for the user
  * **cached** is a boolean indicator - if set to true, checks the data from a cache, otherwise checks the server
  * **callback** is the callback function to run with an error object and imap settings object

Example

    detector.detect("pipemail@node.ee", "zzzzz", true, function(err, data){
        console.log(err || data);
    });

Response data object has the following properties

  * **host** is the IMAP hostname
  * **port** is the port to the host
  * **secure** indicates if the connection should be started with SSL (usually true for port 993 and false for 143)
  * **user** indicates the format of the username, if it's *%EMAIL%* then, the IMAP username is also the email address, if it's *%USER%* then the local part of the user is the correct username, if it was unable to detect (password was not provided), it's set to false
  * **expires** if the result came from cache, then this property indicates when the cache will be expired

Example value

    { 
        host: 'imap.mail.yahoo.com',
        port: '993',
        secure: 'true',
        user: '%EMAIL%',
        expires: Thu Aug 09 2012 11:43:14 GMT+0300 (EEST) // Date object, not a String value
    }
