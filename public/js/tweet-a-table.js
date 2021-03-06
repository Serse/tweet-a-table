/*
* This app has been made for the H-ack012 http://www.facebook.com/h.ack.012
* Authors: Fabrizio Codello, Marco Sors, Nicola De Lazzari
* License: GPLv3
*
*/

$(document).ready(function() {
	var Debug = {

		log: function (msg) {
			console.log(new Date().toJSON() +": "+ msg);
		},

		toggle: function(speed) {
			speed = speed || 'fast';
			defaultDebug.slideToggle(speed);
		}
	};

	function init() {
		Debug.log("Connecting...");

		$(document).keyup(function(e) {
			if (e.keyCode === 220) { //backslash
				Debug.toggle();
			}
		});
	}

	function calcMaxPerSecond() {
		maxPerSecondInterval = setInterval(function() {
			speed.html(tweetsAmount);

			if (maxTweetsAmount < tweetsAmount) {
				maxTweetsAmount = tweetsAmount;
			}

			maxSpeed.html(maxTweetsAmount);

			tweetsAmount = 0;
		}, 1000);
	}

	/*
	* Main
	*/

	var socket = new io.connect(window.location.href);
	
	var leaderboardHandle = $("#tweets ul"),
		defaultDebug = $("#stats"),
		speed = $("#speed"),
		maxSpeed = $("#maxSpeed"),
		maxPerSecondInterval = null,
		tweetsAmount = 0,
		maxTweetsAmount = 0;
	
	init();
	calcMaxPerSecond();

	/* 
	* Socket stuff	
	*/
	    
    socket.on('connect', function() {
		Debug.log("Connected.");
	});
			
	socket.on('disconnect', function() {
		Debug.log("Disconnected.");
		clearInterval(maxPerSecondInterval);
	});
		
	socket.on('tot', function(data) {	
		Debug.log("Current viewers: "+ data.tot);
	});

	socket.on('filters', function(data) {	
		Debug.log("Event: "+ data.event +", options: "+ data.options.join(", ") +", created at: "+ data.createdAt);
	});

	function strdecode(data) {
		return JSON.parse(decodeURIComponent(escape(data)));
	}

	function updateLeaderboard(leaderboard) {
		leaderboardHandle.html('');
		leaderboard.forEach(function(item, index) {
			//console.log(index +"# "+ item.option +" has "+ item.count);
			leaderboardHandle.append("<li class=\"g"+ index +"\">"+ item.option +": "+ item.count +"</li>");
		});
	}

	socket.on('leaderboard', function(leaderboard) {	
		leaderboard = strdecode(leaderboard);

		updateLeaderboard(leaderboard);

		tweetsAmount++;
	});
});