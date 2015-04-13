/*
 * index.js
 * Mary Lewis
 * February 13, 2015
 * to
 * March 2, 2015
 * Machi Koro Online server-side code
 
 to do:
 check for winner
 process purples
 when someone tries to buy or roll make sure it's that person's turn
 
Contents: 
 Initialize Server
 Functions
 Card Stuff
 Listening
 
 
 
 card types:
 supply
 establishment
 landmark
 
 primary industry
 secondary industry
 restaurant
 major establishment
 landmark
 
 stages:
 roll dice
 coin transactions
 earn income
 construction
 
 */

/* Initialize Server */
 
var app = require('express')();
var http = require('http').Server(app);
var url = require('url');
var io = require('socket.io')(http);

//this is supposed to help with CSS
//app.use(express.static());

//make a menu to have here instead of game page
app.get('/', function(req, res){
	res.sendFile(__dirname + '/public/game.html');
});

app.get('/game/:id', function(req, res) {
	res.sendFile(__dirname + '/public/game.html');
});

http.listen(3000, function(){
	console.log('listening on *:3000');
});

/*
 * initialize game things
 */
var clients = {};
var games = {};

/* Functions */

/*
 * roll dice, lead to construct
 */
function roll(game, die1, die2){
	
	if(game.currentPlayer["Amusement Park"] && die1 == die2) {
		game.goAgain = true;
	}
	
	//adjusts coin amounts based on what was rolled
	processRoll(game, die1 + die2);
	
	//at this point we might be waiting for a TV Station or Business Center decision, and therefore can't just plow right along.
	//ToDo
	
	//update game stage once everything is done
	io.sockets.in(game.room).emit('render game', JSON.stringify(game));
	displayConstructibles(game);
	//only do this when it's time
	clients[game.currentPlayer.socket].emit('construct');
}

/*
 * what cards were activated by this roll?
 */
function processRoll(game, result) {
	//restaurants
	for(var i = game.turn; i < game.players.length + game.turn; ++i) {
		//start on the player before the player whose turn it is
		playerIndex = game.players.length - i - 1;
		if(playerIndex < 0) {
			playerIndex += game.players.length;
		}
		for(var j = 0; j < game.players[playerIndex].cards.length; j++) {
			var cardDef = cards[game.players[playerIndex].cards[j].name];
			//right number and not the roller's card and is a restaurant
			if(cardDef.numbers.indexOf(result) != -1 && playerIndex != game.turn && cardDef["class"] == "restaurant") {
				restaurantPayout(game, cardDef, game.players[playerIndex].cards[j].count, playerIndex);
			}
		}
	}
	
	//primary and secondary industry
	for(var i = 0; i < game.players.length; i++) {
		for(var j = 0; j < game.players[i].cards.length; j++) {
			var cardDef = cards[game.players[i].cards[j].name];
			//right number and (roller's card and secondary industry OR anyone's card, primary industry
			if(cardDef.numbers.indexOf(result) != -1 &&
			((game.players[i] == game.currentPlayer && cardDef["class"] == "secondary-industry") || 
			cardDef["class"] == "primary-industry")) {
				if(cardDef.icon == "factory" || cardDef.icon == "fruit") {
					factoryPayout(game, cardDef, game.players[i].cards[j].count, i);
				} else {
					payout(game, cardDef, game.players[i].cards[j].count, i);
				}
			}
		}
	}
	
	//purples - change this to only go through current player's cards
	for(var j = 0; j < game.currentPlayer.cards.length; j++) {
		var cardDef = cards[game.currentPlayer.cards[j].name];
		//right number
		if(cardDef.numbers.indexOf(result) != -1 && cardDef["class"] == "major-establishment")
		{
			sendMessage(game, game.currentPlayer.name + "'s " + game.currentPlayer.cards[j].name + " was activated by the " + result + ".", "game");
			if(cardDef.name == "Stadium") {
				stadiumPayout(game);
			} else if (cardDef.name == "TV Station") {
				tvStationPayout(game);
			} else if (cardDef.name == "Business Center") {
				businessCenterPayout(game);
			}
		}
	}
}

/*
 * payout - adjusts everyone's money based on what card was played
 * card, roller and winner
 */
function restaurantPayout(game, cardDef, count, winnerIndex) {
	var payout = cardDef.payout;
	if (game.players[winnerIndex]["Shopping Mall"]) {
		payout += 1;
	}
	payout *= count;
	if (payout > game.currentPlayer.coins) {
		payout = game.currentPlayer.coins;
	}
	game.currentPlayer.coins -= payout;
	game.players[winnerIndex].coins += payout;
	sendMessage(game, game.currentPlayer.name + " visited " + game.players[winnerIndex].name + "'s " + cardDef.name + " losing " + payout + "coins.", "game");
}

function payout(game, cardDef, count, winnerIndex) {
	var payout =  cardDef.payout;
	if (cardDef.icon == "shop" && game.players[winnerIndex]["Shopping Mall"]) {
		payout += 1;
	}
	payout *= count;
	game.players[winnerIndex].coins += payout;
	sendMessage(game, game.players[winnerIndex].name + " got " + payout + " from " + cardDef.name + ".", "game");
}

function factoryPayout(game, cardDef, count, winnerIndex) {
	var payout = cardDef.payout * count;
	var triggerCount = 0;
	for( var i = 0; i < game.players[winnerIndex].cards.length; i++) {
		if(cards[game.players[winnerIndex].cards[i].name].icon == cardDef["trigger-icon"]) {
			triggerCount += game.players[winnerIndex].cards[i].count;
		}
	}
	payout *= triggerCount;
	game.players[winnerIndex].coins += payout;
	sendMessage(game, game.players[winnerIndex].name + " got " + payout + " from " + cardDef.name + ".", "game");
}

/* purple payouts! */
function tvStationPayout(game) {
	//need to select a player other than self
	//ToDo
}

function businessCenterPayout(game) {
	//need to select a card owned by another player
	//ToDo
}

function stadiumPayout(game) {
	var payout = 0;
	var payoutString = "";
	for(var i = 0; i < game.players.length; i++) {
		if (i != winnerIndex) {
			if(game.players[i].coins >= 2) {
				payoutString += ", 2 from " + game.players[i].name;
				payout += 2;
				game.players[i].coins -= 2;
			} else {
				payoutString += game.players[i].coins + " from " + game.players[i].name + ", ";
				payout += game.players[i].coins;
				game.players[i].coins = 0;
			}
		}
	}
	game.currentPlayer.coins += payout;
	sendMessage(game, game.currentPlayer.name + "'s Stadium got " + payoutString, "game");
}

/*
 * Construct section
 * ToDo split "display" into a more generic function that can be used for purples, plox
 */
function displayConstructibles(game) {
	//supply
	var modifiedSupply = [];
	for(var i = 0; i < game.supply.length; i++) {
		modifiedSupply.push({"name" : game.supply[i].name, "count" : game.supply[i].count});
		if(cards[modifiedSupply[i].name].cost <= game.currentPlayer.coins)
			modifiedSupply[i].available = true;
		else
			modifiedSupply[i].available = false;
	}
	//landmarks
	var modifiedLandmarks = [];
	for(var i = 0; i < game.currentPlayer.landmarks.length; i++) {
		//console.log("name " + game.currentPlayer.landmarks[i].name + " count " + game.currentPlayer.landmarks[i].count);
		modifiedLandmarks.push({"name" : game.currentPlayer.landmarks[i].name, "count" : game.currentPlayer.landmarks[i].count, "active" : game.currentPlayer.landmarks[i].active });
		if(cards[modifiedLandmarks[i].name].cost <= game.currentPlayer.coins && modifiedLandmarks[i].active == false)
			modifiedLandmarks[i].available = true;
		else
			modifiedLandmarks[i].available = false;
	}
	//this is going to the wrong socket
	console.log("Render constructibles for " +game.currentPlayer.socket);
	clients[game.currentPlayer.socket].emit('render constructibles', JSON.stringify({"supply" : modifiedSupply, "landmarks" : modifiedLandmarks}));
}
/*
 * Construct an establishment or finish construction on a landmark
	msg is the card name
 * add:
	error checking to make sure it's that person's turn
	if it was an activation, check to see if the player won AND actually end the game.  Maybe cause some fireworks.
 */
function construct(game, msg) {
	var winner = false;
	if( msg != null ) {
		var cardDef = cards[msg];
		//can you afford that?
		if( cardDef.cost > game.currentPlayer.coins ) {
			console.log("Card error: player can't afford card");
		} else {
			if (cardDef.class == "landmark") {
				//completing a landmark
				//eradicate this
				for(var i = 0; i < game.currentPlayer.landmarks.length; i++) {
					if(game.currentPlayer.landmarks[i].name == msg ) {
						game.currentPlayer.landmarks[i].active = true;
					}
				}
				game.currentPlayer[msg] = true;
				game.currentPlayer.coins -= cardDef.cost;
				sendMessage(game, game.currentPlayer.name + " completed construction on the " + msg, "game");
						
				//check for win!
				winner = true;
				for (var i = 0; i < game.currentPlayer.landmarks.length; i++)
					if(game.currentPlayer.landmarks[i].active == false)
						winner = false;
			} else {
				//constructing an establishment
				var supplyIndex = null;
				//find card in back, check for count > 0
				for(var i = 0; i < game.supply.length; i++)
					if (game.supply[i].name == msg)
						supplyIndex = i;
				
				//card is not in supply, there are 0 of that card in the supply, or the player cannot afford card
				if( supplyIndex == null || game.supply[supplyIndex].count < 1 ) {
					console.log("Card error: supply is out of card");
				} else {
					//decrement the count in the supply by one.
					game.supply[supplyIndex].count -= 1;
					//if that was the last one, remove from list
					if( game.supply[supplyIndex].count == 0) {
						game.supply.splice(supplyIndex, 1);
					}
					//Does the player have this card?
					var playerCardIndex = null;
					for(var i = 0; i < game.currentPlayer.cards.length; i++)
						if (game.currentPlayer.cards[i].name == msg)
							playerCardIndex = i;

					//if the player has the card, increment the count. Else, add it to the player's card list.
					if( playerCardIndex == null)
						game.currentPlayer.cards.push({"name" : msg, "count" : 1});
					else
						game.currentPlayer.cards[playerCardIndex].count += 1;
					
					//pay the man.
					game.currentPlayer.coins -= cardDef.cost;
					//sort by roll numbers
					game.currentPlayer.cards = game.currentPlayer.cards.sort(compareCards);
					
					sendMessage(game, game.currentPlayer.name + " constructed a " + msg, "game");
				}
			}
		}
	}
	return winner;
}


function passTurn(game) {
	var passMessage = ""
	if(game.goAgain) {
		//amusement park as activated, your turn again
		game.goAgain = false;
		passMessage = game.currentPlayer.name + " gets another turn for rolling doubles.";
	} else {
		//next player's turn!
		passMessage = game.currentPlayer.name + " passed turn to ";
		game.turn = (game.turn + 1) % game.players.length;
		//console.log(game.turn);
		game.currentPlayer = game.players[game.turn];
		//console.log(game.currentPlayer);
		passMessage += game.currentPlayer.name + ".";
	}
	sendMessage(game, passMessage, "game");		
	io.sockets.in(game.room).emit('render game', JSON.stringify(game));

	//reset rolls this turn
	game.rollsThisTurn = 0;
	//start next turn with a die roll
	var diceCount = 1;
	if(game.currentPlayer["Train Station"]) {
		diceCount = 2;
	}
	clients[game.currentPlayer.socket].emit("choose dice", diceCount);
}

/*
* "type" is either "chat", "system" or "game"
*/
function sendMessage(game, text, type) {
	var message = { "text" : text, "type" : type };
	io.sockets.in(game.room).emit('chat message', JSON.stringify(message));
	return false;
}


/*
 * Card Stuff
 */
//start a new game -- change to create new game? add a "recycle game" function?
function initializeGame(roomID) {
	var game = {};
	game.id = 1;
	game.turn = 0;
	game.state = "not started";
	game.players = [];
	game.supply = [];
	game.die1 = 0;
	game.die2 = 0;
	game.goAgain = false;
	game.rollsThisTurn = 0;
	game.room = roomID;
	
	for (var cardName in cards) {
		//console.log(cardName);
		var cardDef = cards[cardName];
		if( cardDef.class != 'landmark' ) {
			game.supply.push({name: cardName, count: 6});
		}
	}

	return game;
}

/*
 * adds a new player to the list of players
 16777216 is the max color number, needs leading 0s
 */
function addPlayer(game, nickname, socket) {
	game.players.push({
		"name" : nickname,
		"socket" : socket,
		"color" : "#" + (( '00000' + Math.floor((Math.random() * 16777216)).toString(16))).substr(-6),
		"connected" : true,
		"coins" : 30,
		"cards" : [{name: "Wheat Field", count: 1}, {name: "Bakery", count: 1 }],
		"landmarks" : [{name: "Train Station", active: false},{name: "Shopping Mall", active: false}, {name: "Amusement Park", active: false}, {name: "Radio Tower", active: false}],
		"Train Station" : false,
		"Shopping Mall" : false,
		"Amusement Park" : false,
		"Radio Tower" : false
	});
}

/* 
 primary industry
 secondary industry
 restaurant
 major establishment
 landmark
 */

const cards =
{
	"Train Station" : {
		"name" :"Train Station",
		"class" :"landmark",
		"text" : "You may roll 1 or 2 dice.",
		"cost" : 4
	},
	"Shopping Mall" : {
		"name" :"Shopping Mall",
		"class" :"landmark",
		"text" : "Each of your [restaurant icon] and [shop icon] establishments earn +1 coin.",
		"cost" : 10
	},
	"Amusement Park" : {
		"name" :"Amusement Park",
		"class" :"landmark",
		"text" : "If you roll doubles, take another turn after this one.",
		"cost" : 16
	},
	"Radio Tower" : {
		"name" :"Radio Tower",
		"class" :"landmark",
		"text" : "Once every turn, you can choose to re-roll your dice.",
		"cost" : 22
	},
	"Wheat Field" :
	{
		"name" :"Wheat Field",
		"class" :"primary-industry",
		"icon" : "agriculture",
		"text" : "Get 1 coin from the bank, on anyone's turn.",
		"numbers" : [1],
		"payout" : 1,
		"cost" : 1
	},
	"Ranch" :
	{
		"name" :"Ranch",
		"class" :"primary-industry",
		"icon" : "cow-farming",
		"text" : "Get 1 coin from the bank, on anyone's turn.",
		"numbers" : [2],
		"payout" : 1,
		"cost" : 1
	},
	"Bakery" :
	{
		"name" :"Bakery",
		"class" :"secondary-industry",
		"icon" : "shop",
		"text" : "Get 1 coin from the bank, on your turn only.",
		"numbers" : [2,3],
		"payout" : 1,
		"cost" : 1
	},
	"Cafe" :
	{
		"name" :"Cafe",
		"class" :"restaurant",
		"icon" : "restaurant",
		"text" : "Get 1 coin from the player who rolled the dice.",
		"numbers" : [3],
		"payout" : 1,
		"cost" : 2
	},
	"Convenience Store" :
	{
		"name" : "Convenience Store",
		"class" :"secondary-industry",
		"icon" : "shop",
		"text" : "Get 3 coins from the bank, on your turn only.",
		"numbers" : [3],
		"payout" : 3,
		"cost" : 2
	},
	"Forest" :
	{
		"name" : "Forest",
		"class" :"primary-industry",
		"icon" : "natural-resources",
		"text" : "Get 1 coin from the bank, on anyone's turn.",
		"numbers" : [5],
		"payout" : 1,
		"cost" : 3
	},
	"Business Center" :
	{
		"name" : "Business Center",
		"class" : "major-establishment",
		"icon" : "major-establishment",
		"text" : "Trade one non [major establishment icon] establishment with another player, on your turn only.",
		"numbers" : [6],
		"payout" : 0,
		"cost" : 8
	},
	"Stadium" :
	{
		"name" : "Stadium",
		"class" : "major-establishment",
		"icon" : "major-establishment",
		"text" : "Get 2 coins from all players, on your turn only.",
		"numbers" : [6],
		"payout" : 0,
		"cost" : 6
	},
	"TV Station" :
	{
		"name" : "TV Station",
		"class" : "major-establishment",
		"icon" : "major-establishment",
		"text" : "Take 5 coins from any one player, on your turn only.",
		"numbers" : [6],
		"payout" : 0,
		"cost" : 7
	},
	"Cheese Factory" :
	{
		"name" : "Cheese Factory",
		"class" :"secondary-industry",
		"icon" : "factory",
		"text" : "Get 3 coins from the bank for each [cow-farming icon] establishment that you own, on your turn only.",
		"numbers" : [7],
		"trigger-icon" : "cow-farming",
		"payout" : 3,
		"cost" : 5
	},
	"Furniture Factory" :
	{
		"name" : "Furniture Factory",
		"class" :"secondary-industry",
		"icon" : "factory",
		"text" : "Get 3 coins from the bank for each [natural-resources icon] establishment that you own, on your turn only.",
		"numbers" : [8],
		"trigger-icon" : "natural-resources",
		"payout" : 3,
		"cost" : 3
	},
	"Mine" :
	{
		"name" : "Mine",
		"class" :"primary-industry",
		"icon" : "natural-resources",
		"text" : "Get 5 coins from the bank, on anyone's turn.",
		"numbers" : [9],
		"payout" : 5,
		"cost" : 6
	},
	"Family Restaurant" :
	{
		"name" :"Family Restaurant",
		"class" :"restaurant",
		"icon" : "restaurant",
		"text" : "Get 1 coin from the player who rolled the dice.",
		"numbers" : [9,10],
		"payout" : 2,
		"cost" : 3
	},
	"Apple Orchard" :
	{
		"name" :"Apple Orchard",
		"class" :"primary-industry",
		"icon" : "agriculture",
		"text" : "Get 3 coins from the bank, on anyone's turn.",
		"numbers" : [10],
		"payout" : 3,
		"cost" : 3
	},
	"Farmers Market" :
	{
		"name" : "Fruit and Vegetable Stand",
		"class" :"secondary-industry",
		"icon" : "fruit",
		"text" : "Get 2 coins from the bank for each [agriculture icon] establishment that you own, on your turn only.",
		"numbers" : [11,12],
		"payout" : 2,
		"trigger-icon" : "agriculture",
		"cost" : 2
	},
};

/*
 * a and b are card objects, bro
 *
 * 2 < 3
 * 2 < 2,3
 * 2,3 < 3
 * 2,3 < 2,4
 */
function compareCards(aCard, bCard) {
	var a = cards[aCard.name];
	var b = cards[bCard.name];
	if (
		a.numbers[0] < b.numbers[0] && a.numbers[a.numbers.length - 1] < b.numbers[b.numbers.length - 1] ||
		a.numbers[0] == b.numbers[0] && a.numbers[a.numbers.length - 1] < b.numbers[b.numbers.length - 1] ||
		a.numbers[0] < b.numbers[0] && a.numbers[a.numbers.length - 1] == b.numbers[b.numbers.length - 1]) {
		return -1;
	}
	if (
		a.numbers[0] > b.numbers[0] && a.numbers[a.numbers.length - 1] > b.numbers[b.numbers.length - 1] ||
		a.numbers[0] == b.numbers[0] && a.numbers[a.numbers.length - 1] > b.numbers[b.numbers.length - 1] ||
		a.numbers[0] > b.numbers[0] && a.numbers[a.numbers.length - 1] == b.numbers[b.numbers.length - 1]) {
		return 1;
	}
	// a must be equal to b
	return 0;
}

/* listening and responding */

//io.sockets.in('room1').emit('whatever');
//io.sockets.socket(socketid).emit('message', 'for your eyes only');

io.on('connection', function(socket){
	//arrange this based on the url they're coming in through
	u = url.parse(socket.request.headers.referer);
	socket.join(u.path);
	if( games[u.path] == null) {
		//create a new room and a new game
		games[u.path] = initializeGame(u.path);
		console.log("Creating game at " + u.path);
	}
	console.log("Connection at " + u.path);
	game = games[u.path];
	/* someone has joined the game and sent us their name */
	socket.on('new player', function(msg){
		game = games[url.parse(socket.request.headers.referer).path];
		clients[socket.id] = socket;
		//ToDo: if there is a disconnected user, offer that user's seat
		//var address = socket.request.connection.remoteAddress;
		var fill = false;
		for(var i = 0; i < game.players.length; i++) {
			if(game.players[i].connected == false && fill == false) {
				game.players[i].name = msg;
				game.players[i].socket = socket.id;
				game.players[i].connected = true;
				fill = true;
				socket.emit("set index", i);
			}
		}
		if(fill == false) {
			addPlayer(game, msg, socket.id);
			socket.emit("set index", game.players.length - 1);
		}
		sendMessage(game, msg + " joined the game.", "system");
		socket.emit('card definitions', JSON.stringify(cards));
		io.sockets.in(game.room).emit('render game', JSON.stringify(game));
	});
	
	//not sure what to do this this
	socket.on('disconnect', function(){
		game = games[url.parse(socket.request.headers.referer).path];
		for(var i = 0; i < game.players.length; i++) {
			if(game.players[i] .socket == socket.id) {
				console.log(game.players[i].name + " disconnected.");
				game.players[i].connected = false;
			}
		}
	});
	
	/* someone has clicked the start game button which will exist */
	socket.on('start game', function(){
		game = games[url.parse(socket.request.headers.referer).path];
		console.log("Start game for " + game.players[0].socket);
		game.currentPlayer = game.players[0];
		game.state = "in progress";
		//socket.broadcast.in(game.room).emit('update', "The game has begun! It's " + game.currentPlayer.name + "'s turn to roll.");
		sendMessage(game, "It's " + game.currentPlayer.name + "'s turn.", "game" );
		clients[game.currentPlayer.socket].emit("choose dice", "1");
	});
	
	/* someone rolled the dice 
	 * - add error checking to see if it's that person's turn and train station is active
	 */
	socket.on('roll', function(msgString){
		game = games[url.parse(socket.request.headers.referer).path];
		if(game.rollsThisTurn == 0 || (game.currentPlayer["Radio Tower"] && game.rollsThisTurn == 1)) {
			var result = 0;
			var die1 = 0;
			var die2 = 0;
			var msg = parseInt(msgString);
			die1 = Math.floor((Math.random() * 6) + 1);
			var updateText = game.currentPlayer.name + " rolled " + die1;
			if (msg == 2 && game.currentPlayer["Train Station"]) {
				die2 = Math.floor((Math.random() * 6) + 1);
				updateText += " and " + die2;
			}
			result = die1 + die2;
			//socket.broadcast.in(game.room).emit('update', updateText + ".");
			sendMessage(game, updateText + ".", "game");
			
			if(game.currentPlayer["Radio Tower"] && game.rollsThisTurn == 0) {
				game.die1 = die1;
				game.die2 = die2;
				clients[game.currentPlayer.socket].emit('roll again', JSON.stringify({ "die1" : die1, "die2" : die2 }));
			} else {
				roll(game, die1, die2);
			}
		}
	});
	
	/* player had option to re-roll and chose not to */
	socket.on('keep roll', function(diceString){
		game = games[url.parse(socket.request.headers.referer).path];
		roll(game, game.die1, game.die2);
	});
	
	/* player chose to re-roll */
	socket.on('roll again', function(diceString){
		game = games[url.parse(socket.request.headers.referer).path];
		game.rollsThisTurn += 1
		//re-select number of dice
		var diceCount = 1;
		if(game.currentPlayer["Train Station"]) {
			diceCount = 2;
		}
		clients[game.currentPlayer.socket].emit("choose dice", diceCount);
	});
	 
	socket.on('construct', function(msg){
		game = games[url.parse(socket.request.headers.referer).path];
		var winner = construct(game, msg);
		if(winner) {
			sendMessage(game, game.currentPlayer.name + " won the game!", "game");
		}
		passTurn(game);
	});
	
	/* chat messages */
	socket.on('chat message', function(msg){
		game = games[url.parse(socket.request.headers.referer).path];
		sendMessage(game, msg, "chat");
	});
});