function assignOrder(gameID)
{
    var players = Players.find({gameID: gameID});
    var order = 1;
    players.forEach(function (player)
    {
        Players.update(player._id, {$set: {order: order}});
        order++;
    });
}

function assignNextStoryteller(gameID)
{
    var players = Players.find({gameID: gameID});
    var currentStoryteller = _.findWhere(players.fetch(), {isStoryteller: true});
    if(currentStoryteller)
    {
        Players.update(currentStoryteller._id, {$set: {isStoryteller: false}});
        var newSt = _.findWhere(players.fetch(), {order: currentStoryteller.order + 1 });
        if(newSt)
        {
            Players.update(newSt._id, {$set: {isStoryteller: true}});
        }
        else
        {
            newSt = _.findWhere(players.fetch(), {order: 1});
            Players.update(newSt._id, {$set: {isStoryteller: true}});
        }
    }
    else
    {
        newSt = _.first(_.sortBy(players.fetch(), 'order'));
        Players.update(newSt._id, {$set: {isStoryteller: true}});
    }
}

function scoreVotes(gameID)
{
    var players = Players.find({gameID: gameID});

    var storyteller = _.chain(players.fetch()).where({isStoryteller: true}).first().value();

    var votes = _.map(players.fetch(), function(player){
        return player.votedCard;
    });

    // remove storyteller
    var otherPlayers = _.where(players.fetch(), {isStoryteller: false});

    var correctVoters = _.filter(otherPlayers, function(player){
        return player.votedCard == storyteller.currentCard;
    });

    var incorrectVoters = _.filter(otherPlayers, function(player){
        return player.votedCard != storyteller.currentCard;
    });

    var result = {correct: [], voted: [], storyteller: null, unanimous: null};
    result.storyteller = {id: storyteller._id, name: storyteller.name};

    if(correctVoters.length == otherPlayers.length || incorrectVoters.length == otherPlayers.length)
    {
        if(correctVoters.length == otherPlayers.length)
        {
            result.unanimous = true;
        }
        if(incorrectVoters.length == otherPlayers.length)
        {
            result.unanimous = false;
        }
        // all but storyteller scores 2
        _(otherPlayers).each(function(player){
            player.score = player.score + 2;
            Players.update(player._id, {$set: {score: player.score, currentCard: null, votedCard: null}});
        });
        Players.update(storyteller._id, {$set: {currentCard: null}});
    }
    else
    {
        // storyteller scores 3
        Players.update(storyteller._id, {$set: {score: storyteller.score + 3, currentCard: null}});
        // correct votes score 3
        _(correctVoters).each(function(player){
            player.score = player.score + 3;
            Players.update(player._id, {$set: {score: player.score, currentCard: null, votedCard: null}});

            result.correct.push({id: player._id, name: player.name});
        });
    }

    _(otherPlayers).each(function(player){
        // score 1 for each one that voted your card, up to 3
        var bonusPoints = _.where(otherPlayers, {votedCard: player.currentCard}).length;
        bonusPoints = Math.min(bonusPoints, 3);
        Players.update(player._id, {$set: {score: player.score + bonusPoints, currentCard: null, votedCard: null}});

        if(bonusPoints > 0)
        {
            result.voted.push({id: player._id, name: player.name, bonus: bonusPoints});
        }

    });
    assignNextStoryteller(gameID);
    Games.update(gameID, {$set: {state: 'roundEnd', roundResult: result, endTime: null, paused: false, pausedTime: null}});
}


function isTruncated(players)
{
    var currentCards = _.chain(players.fetch())
        .filter(function(player){
            return player.currentCard != null;
        })
        .map(function(player){
            return player.currentCard;
        })
        .value();

    return currentCards.length != _.uniq(currentCards).length;
}

Meteor.methods({
    getState: function (gameId, playerId) {
        var game = Games.findOne(gameId);
        var player = Players.findOne(playerId);
        if(game && player && player.gameID == game._id)
        {
            return game;
        }
    },

    startNextRound: function (gameID)
    {
        var game = Games.findOne(gameID);
        var gameEndTime = moment().add(game.lengthInMinutes, 'minutes').valueOf();

        Games.update(gameID, {$set: {state: 'roundInProgress', endTime: gameEndTime, paused: false, pausedTime: null}});
    },

    startGame: function (gameID)
    {
        assignOrder(gameID);
        assignNextStoryteller(gameID);

        var game = Games.findOne(gameID);
        var gameEndTime = moment().add(game.lengthInMinutes, 'minutes').valueOf();

        Games.update(gameID, {$set: {state: 'roundInProgress', endTime: gameEndTime, paused: false, pausedTime: null}});
    },

    assignOrder: function (gameID)
    {
        assignOrder(gameID);
    },

    checkTruncation: function (gameID)
    {
        var players = Players.find({gameID: gameID});
        if(isTruncated(players))
        {
            Games.update(gameID, {$set: {state: 'truncation'}});
            players.forEach(function(player){
                Players.update(player._id, {$set: {currentCard: null, votedCard: null}});
            });
        }
    },

    checkVotes: function(gameID)
    {
        var players = Players.find({gameID: gameID});

        if(isTruncated(players))
        {
            Games.update(gameID, {$set: {state: 'truncation'}});
            _(players).each(function(player){
                Players.update(player._id, {$set: {currentCard: null, votedCard: null}});
            });
            return false;
        }

        var remainingVoters = _.findWhere(players.fetch(), {isStoryteller: false, votedCard: null});
        var remainingStoryteller = _.findWhere(players.fetch(), {isStoryteller: true, currentCard: null});

        if(!remainingVoters && !remainingStoryteller)
        {
            scoreVotes(gameID);
            return true;
        }
//        throw new Meteor.Error("e", "desc");
        return false;
    }


});