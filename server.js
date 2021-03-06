var express = require('express'),
	fs = require('fs'),
	jQuery = require('jquery'),
	Tuiter = require('tuiter'),
	app = module.exports = express.createServer();

/*
* Configurations
*/

app.configure(function(){
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(__dirname + '/public'))
    app.use(express.logger(':remote-addr - :method :url HTTP/:http-version :status :res[content-length] - :response-time ms'));
    app.use(express.favicon());
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
    app.use(express.errorHandler()); 
});

/*
* Express
*/

app.get('/', function(req, res) {
	res.sendfile('index.html');
});

app.get('/api', function(req, res) {
	res.contentType('application/json');
 	res.end(JSON.stringify(stream));
});

app.get('/resetdb', function(req, res) {
	createDb();
	console.log("Db has been resetted.");
	res.redirect('/');
});

app.get('/restart', function(req, res) {
	console.log(" * Restarting in 5 seconds... * ");
	setTimeout(function() {
		tu = '';
		grabTwitterFeed();
		console.log(" * Triggered restart * ");
		res.redirect('/');
	}, 5000);
});

/*
* Main
*/

var	totUsers = 0;

var stream = {
	leaderboard: [],
	event: '',
	options: {},
	createdAt: '',
	updatedAt: ''
};

var tu = '',
	configs = readConfigs();

createParamsFile();
checkDb();

app.listen(8080);

grabTwitterFeed();

var interval = setInterval(function() {
	tu = '';
	grabTwitterFeed();
	console.log(" * 5 mins passed, autorestarted. * ");
}, 300000); // 5 mins

console.log("Express server listening in %s mode", app.settings.env);

/*
* Functions
*/

function resetDb() {
	var now = new Date();
	stream.createdAt = now;
	stream.updatedAt = now;

	stream.leaderboard = [];
	stream.options.forEach(function(opt) {
		stream.leaderboard.push({ option: opt.substring(1), count: 0 });
	});
}

function createDb() {
	resetDb();

    writeJSONFile("db.json", stream.leaderboard);
}

function checkDb() {
	fs.stat(__dirname +'/db.json', function(err, stat) {
		if (err == null) { // file exists
		    loadDb();
		} else if (err.code == 'ENOENT') { // file doesn't exist
			createDb();
		} else {
		    console.log('Error while reading the database file: '+ err.code);
		}
	});
}

function loadDb() {
	stream = readJSONFile("db.json");
	orderLeaderboard();
}

function saveDb() {
	orderLeaderboard();
	stream.updatedAt = new Date();
	writeJSONFile("db.json", stream);
}

// return require("./filename-with-no-extension"); could be used
function readJSONFile(filename) {
	var JSONFile = "";
	
	try {
		JSONFile = JSON.parse(fs.readFileSync(__dirname +'/'+ filename, 'utf8'));
	} catch(e) {
		console.log("Error while reading "+ filename +": "+ e);
	}

	return JSONFile;
}

function writeJSONFile(filename, contents) {
	try {
		fs.writeFileSync(__dirname +'/'+ filename, JSON.stringify(contents), 'utf8');
	} catch(e) {
		console.log("Error while writing "+ filename +": "+ e);
	}
}

function createParamsFile() {
	var keywords = readJSONFile("./configs/keywords.json");
	stream.options = keywords.options.split(",");
	stream.event = keywords.event;
	
	var value = "";
	stream.options.forEach(function(opt) {
		value += stream.event +" "+ opt +",";
	});
	value = value.substring(0, value.length - 1); // remove last ,

	var params = {
		"param": keywords.param,
		"value": value
	};

	writeJSONFile("./configs/params.json", params);
}

function readConfigs() {
	var twitterConfigs = readJSONFile("./configs/twitter.json"),
		paramsConfigs = readJSONFile("./configs/params.json");

	return {
		twitterApp : twitterConfigs,
		param : paramsConfigs.param,
		value : paramsConfigs.value
	};
}

function strencode(data) {
  return unescape(encodeURIComponent(JSON.stringify(data)));
}

function SortByCountDesc(a, b){
	var a = a.count;
	var b = b.count; 
	return ((a < b) ? 1 : ((a > b) ? -1 : 0));
}

function orderLeaderboard() {
	stream.leaderboard.sort(SortByCountDesc);
}

function lowercaseHashtags(hashtags) {
	var parsed = jQuery.map(hashtags, function(hash, i) {
		return hash.text.toLowerCase();
	});

	return parsed;
}

function parseTweetForHashtags(hashtags) {
	hashtags = lowercaseHashtags(hashtags);

	var parsed = jQuery.map(hashtags, function(hash, i) {
		if (hash !== stream.event.toLowerCase().substring(1)) {
			return hash;
		}
	});

	return parsed;
}

function elaborateStats(hashtags) {
	hashtags.forEach(function(hash) {
		stream.leaderboard.forEach(function(item) {
			if (item.option == hash) {
				item.count++;

				saveDb();

				// console.log(item.option +" has now "+ item.count);
			}
		});
	});
}
	
// Using Twitter Streaming API
function grabTwitterFeed() {
	tu = new Tuiter({
	    "consumer_key" : configs.twitterApp.consumer_key
	  , "consumer_secret" : configs.twitterApp.consumer_secret
	  , "access_token_key" : configs.twitterApp.access_token_key
	  , "access_token_secret" : configs.twitterApp.access_token_secret
	});

	tu.filter({ track: configs.value.split(",") }, function(feed) {

		console.log(" * Stream started * ");

		feed.on('tweet', function(tweet){
			var hashtags = parseTweetForHashtags(tweet.entities.hashtags);
			elaborateStats(hashtags);

			io.sockets.emit("leaderboard", strencode(stream.leaderboard));
		});

		feed.on('delete', function(del) {
			console.log("Deleted: "+ del);
		});

		feed.on('error', function(err) {
			console.log("Error: "+ err);
		});
	});
}

/*
* Socket.io
*/

var io = require('socket.io').listen(app);

io.configure(function() { 
	io.enable('browser client minification');
	io.set('log level', 1); 
	io.set('transports', [ 
			'websocket',
			'flashsocket',
			'htmlfile',
			'xhr-polling',
			'jsonp-polling'
	]);
});

io.sockets.on('connection', function(client) {
	totUsers++;
	console.log('+ User '+ client.id +' connected, total users: '+ totUsers);

	client.emit("clientId", { id: client.id });
	client.emit("filters", { event: stream.event, options: stream.options, createdAt: stream.createdAt });
	io.sockets.emit("tot", { tot: totUsers });

	io.sockets.emit("leaderboard", strencode(stream.leaderboard));

	client.on('disconnect', function() {
		totUsers--;
		console.log('- User '+ client.id +' disconnected, total users: '+ totUsers);

		io.sockets.emit("tot", { tot: totUsers });
	});
});