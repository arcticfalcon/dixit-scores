
//function getTimeRemaining()
//{
//    var game = getCurrentGame();
//    if(!game)
//    {
//        return null;
//    }
////    1436107773345
////    Sun Jul 05 2015 11:41:42 GMT-0300 (Argentina Standard Time)
////    470469
//
//    var localEndTime = game.endTime - TimeSync.serverOffset();
//
//    if (game.paused)
//    {
//        var localPausedTime = game.pausedTime - TimeSync.serverOffset();
//        var timeRemaining = localEndTime - localPausedTime;
//    }
//    else
//    {
//        var timeRemaining = localEndTime - Session.get('time');
//    }
//
//    if (timeRemaining < 0)
//    {
//        timeRemaining = 0;
//    }
//
//    return timeRemaining;
//}


function getCurrentGame()
{
    var gameID = Session.get("gameID");

    if (gameID)
    {
        return Games.findOne(gameID);
    }
}

function getAccessLink()
{
    var game = getCurrentGame();

    if (!game)
    {
        return;
    }

    return Meteor.settings.public.url + game.accessCode + "/";
}


function getCurrentPlayers()
{
    var game = getCurrentGame();
    if (!game)
    {
        return null;
    }

    return Players.find({'gameID': game._id});
}

function getCurrentPlayer()
{
    var playerID = Session.get("playerID");

    if (playerID)
    {
        return Players.findOne(playerID);
    }
}

function generateAccessCode()
{
    var code = "";
    var possible = "abcdefghijklmnopqrstuvwxyz";

    for (var i = 0; i < 4; i++)
    {
        code += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return code;
}

function generateNewGame()
{
    var game = {
        accessCode: generateAccessCode(),
        state: "waitingForPlayers",
        lengthInMinutes: 3,
        endTime: null,
        paused: false,
        pausedTime: null,
        roundResult: null
    };

    var gameID = Games.insert(game);
    game = Games.findOne(gameID);

    return game;
}

function createPlayer(game, name)
{
    var player = {
        gameID: game._id,
        name: name,
        _name: name.toLowerCase(),
        order: null,
        isStoryteller: false,
        currentCard: null,
        votedCard: null,
        score: 0
    };

    var playerID = Players.insert(player);

    return Players.findOne(playerID);
}

function resetUserState()
{
    var player = getCurrentPlayer();

    if (player)
    {
        Players.remove(player._id);
    }

    Session.set("gameID", null);
    Session.set("playerID", null);
}

function trackGameState()
{
    var gameID = Session.get("gameID");
    var playerID = Session.get("playerID");

    if (!gameID || !playerID)
    {
        resetUserState();
        return;
    }

    var game = Games.findOne(gameID);
    var player = Players.findOne(playerID);

    if (!game || !player)
    {
        Session.set("gameID", null);
        Session.set("playerID", null);
        Session.set("currentView", "startMenu");
        return;
    }

    if (game.state === "roundInProgress")
    {
        if(Session.get("currentView") != 'yourCard'
            && Session.get("currentView") != 'voting'
            && Session.get("currentView") != 'waitVoting'
            && Session.get("currentView") != 'a')
        {
            Session.set("currentView", "gameView");
        }
    }

    if (game.state === "roundEnd")
    {
        Session.set("currentView", "votingResult");
    }

    if (game.state === "waitingForPlayers")
    {
        Session.set("currentView", "lobby");
    }

    if (game.state === "truncation")
    {
        Session.set("currentView", "truncation");
    }
}

function leaveGame()
{
    Session.set("currentView", "startMenu");
    var player = getCurrentPlayer();

    Players.remove(player._id);

    Session.set("gameID", null);
    Session.set("playerID", null);

}


function checkPreviousState()
{
    var gameID = Session.get("gameID");
    var playerID = Session.get("playerID");

    if (gameID && playerID)
    {
        Session.set("loading", true);
        Meteor.call('getState', gameID, playerID, function (error, game)
        {
            if (error)
            {
                // handle error
                console.log(error);
            }
            else
            {
                if(!_.isUndefined(game))
                {
                    Meteor.subscribe('games', game.accessCode, function onReady()
                    {
                        Meteor.subscribe('players', game._id, function onReady()
                        {
                            Session.set("loading", false);
                            Tracker.autorun(trackGameState);
                        });
                    });
                }
                else
                {
                    Tracker.autorun(trackGameState);
                }
            }
        });
    }
    else
    {
        Tracker.autorun(trackGameState);
    }
}

checkPreviousState();

//Meteor.setInterval(function ()
//{
//    Session.set('time', new Date());
//}, 1000);



FlashMessages.configure({
    autoHide: true,
    autoScroll: false
});


function getUserLanguage()
{
    return "en";
}

function setUserLanguage(language)
{
    TAPi18n.setLanguage(language).done(function ()
    {
        Session.set("language", language);
//        amplify.store("language", language);
    });
}

function getLanguageList()
{
    var languages = TAPi18n.getLanguages();

    var languageList = _.map(languages, function (value, key)
    {
        var selected = "";

        if (key == getUserLanguage())
        {
            selected = "selected";
        }

        return {
            code: key,
            selected: selected,
            languageDetails: value
        };
    });

    if (languageList.length <= 1)
    {
        return null;
    }

    return languageList;
}


setUserLanguage('en');


Template.main.helpers({
    whichView: function ()
    {
        return Session.get('currentView');
    },
    language: function ()
    {
        return getUserLanguage();
    }
});

Template.footer.helpers({
    languages: getLanguageList
});

Template.footer.events({
    'click .btn-set-language': function (event)
    {
        var language = $(event.target).data('language');
        setUserLanguage(language);
    },
    'change .language-select': function (event)
    {
        var language = event.target.value;
        setUserLanguage(language);
    }
});

Template.startMenu.events({
    'click #btn-new-game': function ()
    {
//        navigator.vibrate([250,80,150,50,120,35,1000]);
        Session.set("currentView", "createGame");
    },
    'click #btn-join-game': function ()
    {
        Session.set("currentView", "joinGame");
    }
});

Template.startMenu.helpers({

});

Template.startMenu.rendered = function ()
{
//    resetUserState();
};

Template.createGame.events({
    'submit #create-game': function (event)
    {
        var playerName = event.target.playerName.value;

        if (!playerName)
        {
            return false;
        }

        var game = generateNewGame();
        var player = createPlayer(game, playerName);

        Meteor.subscribe('games', game.accessCode);

        Session.set("loading", true);

        Meteor.subscribe('players', game._id, function onReady()
        {
            Session.set("loading", false);

            Session.set("gameID", game._id);
            Session.set("playerID", player._id);
            Session.set("currentView", "lobby");
        });

        return false;
    },
    'click .btn-back': function ()
    {
        Session.set("currentView", "startMenu");
        return false;
    }
});

Template.createGame.helpers({
    isLoading: function ()
    {
        return Session.get('loading');
    }
});

Template.createGame.rendered = function (event)
{
    $("#player-name").focus();
};

Template.joinGame.events({
    'submit #join-game': function (event)
    {
        var accessCode = event.target.accessCode.value.trim().toLowerCase();
        var playerName = event.target.playerName.value.trim();

        if(playerName == '')
        {
            FlashMessages.sendError(TAPi18n.__("ui.invalid player name"));
            return false;
        }

        Session.set("loading", true);

        Meteor.subscribe('games', accessCode, function onReady()
        {
            Session.set("loading", false);

            var game = Games.findOne({
                accessCode: accessCode
            });

            if (game)
            {
                Meteor.subscribe('players', game._id, function onReady()
                {
                    var usedName = Players.findOne({_name: playerName.toLowerCase()});
                    if(usedName)
                    {
                        FlashMessages.sendError(TAPi18n.__("ui.name is used"));
                        return false;
                    }

                    player = createPlayer(game, playerName);

                    Session.set("gameID", game._id);
                    Session.set("playerID", player._id);
                    Session.set("currentView", "lobby");
                });
            }
            else
            {
                FlashMessages.sendError(TAPi18n.__("ui.invalid access code"));
            }
        });

        return false;
    },
    'click .btn-back': function ()
    {
        Session.set("currentView", "startMenu");
        return false;
    }
});

Template.joinGame.helpers({
    isLoading: function ()
    {
        return Session.get('loading');
    }
});


Template.joinGame.rendered = function (event)
{
    resetUserState();

    var urlAccessCode = Session.get('urlAccessCode');

    if (urlAccessCode)
    {
        $("#access-code").val(urlAccessCode);
        $("#access-code").hide();
        $("#player-name").focus();
        Session.set('urlAccessCode', null);
    }
    else
    {
        $("#access-code").focus();
    }
};

Template.lobby.helpers({
    game: function ()
    {
        return getCurrentGame();
    },
    accessLink: function ()
    {
        return getAccessLink();
    },
    player: function ()
    {
        return getCurrentPlayer();
    },
    players: function ()
    {
        var game = getCurrentGame();
        var currentPlayer = getCurrentPlayer();
        if (!game)
        {
            return null;
        }

        var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();

        players.forEach(function (player)
        {
            if (player._id === currentPlayer._id)
            {
                player.isCurrent = true;
            }
        });

        return players;
    }
});

Template.lobby.events({
    'click .btn-leave': leaveGame,
    'click .btn-start': function ()
    {
        var game = getCurrentGame();

        Meteor.call('startGame', game._id, function (error){

        });
    },
    'click .btn-toggle-qrcode': function ()
    {
        $(".qrcode-container").toggle();
    }
//    'click .btn-remove-player': function (event)
//    {
//        var playerID = $(event.currentTarget).data('player-id');
//        Players.remove(playerID);
//    },
//    'click .btn-edit-player': function (event)
//    {
//        var game = getCurrentGame();
//        resetUserState();
//        Session.set('urlAccessCode', game.accessCode);
//        Session.set('currentView', 'joinGame');
//    }
});

Template.lobby.rendered = function (event)
{
    var url = getAccessLink();
    var qrcodesvg = new Qrcodesvg(url, "qrcode", 250);
    qrcodesvg.draw();
};


Template.gameView.helpers({
    game: getCurrentGame,
    player: getCurrentPlayer,
    players: function ()
    {
        var game = getCurrentGame();

        if (!game)
        {
            return null;
        }

        var players = Players.find({
            'gameID': game._id
        });

        return players;
    }
//    gameFinished: function ()
//    {
//        var timeRemaining = getTimeRemaining();
//
//        return timeRemaining === 0;
//    },
//    timeRemaining: function ()
//    {
//        var timeRemaining = getTimeRemaining();
//        return moment(timeRemaining).format('mm[<span>:</span>]ss');
//    }
});

Template.gameView.events({
    'click .btn-leave': leaveGame,
    'click .btn-vote': function ()
    {
        var game = getCurrentGame();
//        Games.update(game._id, {$set: {state: 'waitingForPlayers'}});
        Session.set("currentView", "yourCard");
    },
    'click .btn-toggle-status': function ()
    {
        $(".status-container-content").toggle();
    }
//    'click .game-countdown': function ()
//    {
//        var game = getCurrentGame();
//        var currentServerTime = TimeSync.serverTime(moment());
//
//        if (game.paused)
//        {
//            var newEndTime = game.endTime - game.pausedTime + currentServerTime;
//            Games.update(game._id, {$set: {paused: false, pausedTime: null, endTime: newEndTime}});
//        }
//        else
//        {
//            Games.update(game._id, {$set: {paused: true, pausedTime: currentServerTime}});
//        }
//    }
});


Template.indicators.helpers({
    indicators: function ()
    {
        var game = getCurrentGame();
        if (!game)
        {
            return null;
        }

        var players = Players.find({
            'gameID': game._id
        });

        var counter = 0;
        return _.map(players.fetch(), function(player){
            counter++;
            return {index: counter};
        });
    }
});


Template.voting.helpers({
    options: function ()
    {
        var players = getCurrentPlayers();
        var currentPlayer = getCurrentPlayer();
        var counter = 0;
        return _.map(players.fetch(), function(player){
            counter++;
            if(currentPlayer.currentCard == counter)
            {
                return {index: null};
            }
            return {index: counter};
        });
    },
    player: getCurrentPlayer
});

Template.voting.events({
    'click .vote-option': function (event)
    {
        //save vote
        var player = getCurrentPlayer();
        Players.update(player._id, {$set: {votedCard: $(event.target).data('option')}});

        var game = getCurrentGame();
        Meteor.call('checkVotes', game._id, function (error, game)
        {
        });
        Session.set("currentView", "waitVoting");
    }
});

Template.yourCard.helpers({
    cards: function ()
    {
        var players = getCurrentPlayers();
        var counter = 0;
        return _.map(players.fetch(), function(player){
            counter++;
            return {index: counter};
        });
    }
});

Template.yourCard.events({
    'click .card-option': function (event)
    {
        // save card
        var player = getCurrentPlayer();

        Players.update(player._id, {$set: {currentCard: $(event.target).data('option')}});

        Session.set("currentView", "voting");

        var game = getCurrentGame();
        if(player.isStoryteller)
        {
            Meteor.call('checkVotes', game._id, function (error, game)
            {
//                console.log(error, game);
            });
            Session.set("currentView", "waitVoting");
            return;
        }

        Meteor.call('checkTruncation', game._id, function (error, game)
        {
//            console.log(error, game);
        });
    }
});

Template.scores.helpers({
    players: function ()
    {
        var players = getCurrentPlayers();
        if(players)
        {
            return _(players.fetch()).sortBy('score').reverse();
        }
        return null;
    }
});

Template.votingResult.helpers({
    player: getCurrentPlayer,
    game: getCurrentGame,
    allRight: function(){
        return getCurrentGame().roundResult.unanimous === true;
    },
    allWrong: function(){
        return getCurrentGame().roundResult.unanimous === false;
    },
    correct: function(){
        var correctPlayers = getCurrentGame().roundResult.correct;
        return _.reduce(correctPlayers, function(memo, correct, index){
            if(correctPlayers.length == 1 || memo == '')
            {
                return correct.name;
            }
            if(index == correctPlayers.length - 1)
            {
                return memo + TAPi18n.__("ui. and ") + correct.name;
            }
            return memo + ', ' + correct.name;
        }, "");
    }
});

Template.votingResult.events({
    'click .btn-next-round': function (event)
    {
        var game = getCurrentGame();
        Meteor.call('startNextRound', game._id, function (error, game)
        {
//            console.log(error, game);
        })
    }
});

Template.truncation.events({
    'click .btn-restart': function (event)
    {
        var game = getCurrentGame();
        Meteor.call('startNextRound', game._id, function (error, game)
        {
//            console.log(error, game);
        })
    }
});

//$(window).bind('beforeunload', function(){
//    return 'Are you sure you want to leave?';
//});