//Imports
var Service = {}; Service.Mobis = {}; Service.Mobis.Utils = {};
Service.Mobis.Utils.Baseline = require('Service/Mobis/Utils/baselinePredictors.js');
var analytics = require('analytics.js');

// TODO: this is currently not used. Delete later if ti turns out to be redundant
createAvrgModels = function () {
    // create 2 * 24 avr models, for every hour
    var avrgs = [];
    for (var horizon in horizons) {
        avrgs[horizon] = [];
        for (var i = 0; i < 2; i++) { // 2 models: working day or not
            avrgs[horizon][i] = [];
            for (var j = 0; j < 24; j++) {
                avrgs[horizon][i][j] = Service.Mobis.Utils.Baseline.newAvrVal();
                avrgs[horizon][i][j]["forHour"] = j; // asign new field "forHour" to model
            }
        }
    }
}

// TODO: this is currently not used. Delete later if ti turns out to be redundant
createLinRegModels = function () {
    // create 2 * 24 linear regression models 
    var linregs = []; // this will be array of objects
    for (var horizon in horizons) {
        linregs[horizon] = [];
        for (var i = 0; i < 2; i++) { // 2 models: working day or not
            linregs[horizon][i] = [];
            for (var j = 0; j < 24; j++) { // 24 models: for every hour in day
                linregs[horizon][i][j] = analytics.newRecLinReg({ "dim": ftrSpace.dim, "forgetFact": 1, "regFact": 10000 });
                linregs[horizon][i][j]["workingDay"] = i; // asign new field "workingDay" to model (just for demonstrational use)
                linregs[horizon][i][j]["forHour"] = j; // asign new field "forHour" to model (just for demonstrational use)
                linregs[horizon][i][j]["updateCount"] = 0; // how many times model was updated (just for demonstrational use)
            }
        }
    }
}


createLocalModels = function () {
    // create 2 * 24 linear regression models 
    var linregs = []; // this will be array of objects
    var avrgs = [];
    for (var horizon in horizons) {
        linregs[horizon] = [];
        avrgs[horizon] = [];
        for (var i = 0; i < 2; i++) { // 2 models: working day or not
            linregs[horizon][i] = [];
            avrgs[horizon][i] = [];
            for (var j = 0; j < 24; j++) { // 24 models: for every hour in day
                avrgs[horizon][i][j] = Service.Mobis.Utils.Baseline.newAvrVal();
                avrgs[horizon][i][j]["workingDay"] = i; // asign new field "workingDay" to model
                avrgs[horizon][i][j]["forHour"] = j; // asign new field "forHour" to model
                avrgs[horizon][i][j]["updateCount"] = 0; // just for testing how many times model was updated

                linregs[horizon][i][j] = analytics.newRecLinReg({ "dim": ftrSpace.dim, "forgetFact": 1, "regFact": 10000 });              
                linregs[horizon][i][j]["workingDay"] = i; // asign new field "workingDay" to model
                linregs[horizon][i][j]["forHour"] = j; // asign new field "forHour" to model
                linregs[horizon][i][j]["updateCount"] = 0; // just for testing how many times model was updated
            }
        }
    }
    // Maybe I should return linregs and avrgs, if I cannot see this models inside model function bellow.
}

model = function (horizons, ftrSpace) {

    this.hors = horizons; // TODO: I think I dont need this because the variable is seen allready from the input parameter
    this.featureSpace = ftrSpace;

    // Initialize set of models
    //createAvrgModels();
    //createLinRegModels(); // TODO: here we could add optional parameters for linreg
    createLocalModels(); // TODO: now the question is, if this models are only for this models or for everyone?

    this.update = function () {
        // TODO
        console.log("TODO: update function")
        linregs[0][0][0].updateCount++; //TODO: testin... delete this later
        return linregs[0][0][0].updateCount;
    }

    this.predict = function () {
        // TODO
        console.log("TODO: predict function")
        return JSON.stringify({"first:" : linregs[0][0][0].updateCount, "second" :linregs[0][0][1].updateCount})  //TODO: testin... delete this later
    }

}


// TODO: Delete this. Its just an example.
// Example of modelConf:
var modelConf = {
    target: "", //TODO
    ftrSpace: ftrSpace, // this ftrSpace should be an object
    horizons: [1, 3, 6, 9, 12, 15, 18],
    //recLinRegParameters: { "dim": ftrSpace.dim, "forgetFact": 1, "regFact": 10000 }, //Have to think about it how to use this
}


newModel = function (modelConf) {

    var horizons = (modelConf.horizons == null) ? 1 : modelConf.horizons;
    var ftrSpace = modelConf.ftrSpace; // TODO: what to do if it is not defined (if it is null) ?????

    return new model(horizons, ftrSpace)
}

exports.newModel = newModel;

// About this module
exports.about = function () {
    var description = "Module with baseline predictions.";
    return description;
};