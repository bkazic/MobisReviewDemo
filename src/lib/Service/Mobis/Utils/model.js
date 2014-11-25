//Imports
var Service = {}; Service.Mobis = {}; Service.Mobis.Utils = {};
Service.Mobis.Utils.Baseline = require('Service/Mobis/Utils/baselinePredictors.js');
Service.Mobis.Utils.tmFtr = require('Service/Mobis/Utils/dateTimeFtr.js');
var analytics = require('analytics.js');

createBuffers = function (horizons, store) {
    // Initialize RecordBuffers definiton for all horizons 
    RecordBuffers = [];
    for (var horizon in horizons) {
        recordBuffer = {
            name: "delay_" + horizons[horizon] + "h",
            type: "recordBuffer",
            horizon: horizons[horizon] + 1
        };
        RecordBuffers.push(recordBuffer);
    }

    // Execute buffer agregates for all horizons
    for (var horizon in horizons) {
        var RecordBuffer = RecordBuffers[horizon]

        store.addStreamAggr({
            name: RecordBuffer.name, type: RecordBuffer.type, size: RecordBuffer.horizon
        });
    }
    return RecordBuffers;
};


createAvrgModels = function (horizons) {
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
    return avrgs;
};


createLinRegModels = function (horizons) {
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
    return linregs;
};


///////////////////////////////// 
// LOCALIZED LINEAR REGRESSION //
///////////////////////////////// 

// If its possible this model should have optional parameter, reather to use recLinReg or RidgeReg
locLinRegs = function (ftrSpace, horizons) {

    this.linRegs = createLinRegModels (horizons)

    var selectLinReg = function (rec, horizon) {

        var horizon = horizon;
        var hour = rec.DateTime.hour;
        var work = Service.Mobis.Utils.tmFtr.isWorkingDay(rec);

        return this.linRegs[horizon][trainWork][trainHour];
    }

    this.learn = function (rec, horizon) {
        // Select correct linregs model to update
        linreg = selectLinReg(rec, horizon)

        // update models
        linreg.learn(ftrSpace.ftrVec(trainRec), targetVal);
        linreg.updateCount++;
    }

    this.predict = function () {

        return
    }

}

newLocLinRegs = function (ftrSpace, horizons) {

    return new locLinRegs(ftrSpace, horizons);
}

createErrorModels = function (horizon, errMetrics) {
    var errorModels = [];
    for (var horizon in horizons) {
        errorModels[horizon] = [];
        for (var errMetric in errMetrics) {
            errorModels[horizon][errMetric] = errMetrics[errMetric].constructor();
            errorModels[horizon][errMetric]["MetricName"] = errMetrics[errMetric].name;
        }
    }
    return errorModels;
};


//createLocalModels = function () {
//    // create 2 * 24 linear regression models 
//    var linregs = []; // this will be array of objects
//    var avrgs = [];
//    for (var horizon in horizons) {
//        linregs[horizon] = [];
//        avrgs[horizon] = [];
//        for (var i = 0; i < 2; i++) { // 2 models: working day or not
//            linregs[horizon][i] = [];
//            avrgs[horizon][i] = [];
//            for (var j = 0; j < 24; j++) { // 24 models: for every hour in day
//                avrgs[horizon][i][j] = Service.Mobis.Utils.Baseline.newAvrVal();
//                avrgs[horizon][i][j]["workingDay"] = i; // asign new field "workingDay" to model
//                avrgs[horizon][i][j]["forHour"] = j; // asign new field "forHour" to model
//                avrgs[horizon][i][j]["updateCount"] = 0; // just for testing how many times model was updated

//                linregs[horizon][i][j] = analytics.newRecLinReg({ "dim": ftrSpace.dim, "forgetFact": 1, "regFact": 10000 });              
//                linregs[horizon][i][j]["workingDay"] = i; // asign new field "workingDay" to model
//                linregs[horizon][i][j]["forHour"] = j; // asign new field "forHour" to model
//                linregs[horizon][i][j]["updateCount"] = 0; // just for testing how many times model was updated
//            }
//        }
//    }
//    // Maybe I should return linregs and avrgs, if I cannot see this models inside model function bellow.
//}


model = function (horizons, ftrSpace, store, predictionStore, evaluationStore, target, evalOffset, errorMetrics) {

    //this.horizons = horizons; // TODO: I think I dont need this because the variable is seen allready from the input parameter
    //this.featureSpace = ftrSpace;
    this.target = target.name;
    var recordBuffers = createBuffers(horizons, store);

    this.locAvrgs = Service.Mobis.Utils.Baseline.newLocAvrgs({ fields: store.field("NumOfCars") });
    this.linregs = createLinRegModels(horizons); // TODO: here we could add optional parameters for linreg
    //this.errorModels = createErrorModels(horizons, errorMetrics);
    var errorModels = createErrorModels(horizons, errorMetrics);

    //////////////// UPDATE STEP /////////////////
    this.update = function (rec) {

        // Update localized average with new record
        this.locAvrgs.update(rec);

        for (var horizon in horizons) {
            // Get rec for training
            var trainRecId = rec.$store.getStreamAggr(RecordBuffers[horizon].name).val.oldest.$id;

            if (trainRecId > 0) {

                var trainRec = store[trainRecId];
                var trainHour = trainRec.DateTime.hour;
                var trainWork = Service.Mobis.Utils.tmFtr.isWorkingDay(trainRec);
                var targetVal = rec[target.name]
                trainRec.Predictions[horizon].Target = targetVal;

                // Select correct linregs model to update
                linreg = this.linregs[horizon][trainWork][trainHour];

                // Update models
                avrVal.setVal(this.locAvrgs.getVal(rec)) // Set avrVal that is used by ftrExtractor (avrVal.getVal())
                linreg.learn(ftrSpace.ftrVec(trainRec), targetVal);
                linreg.updateCount++;
            }

        }
    };

    ///////////////// PREDICTION STEP ///////////////// 
    this.predict = function (rec) {

        var predictionRecs = [];

        for (var horizon in horizons) {
            // Get rec for training
            var trainRecId = rec.$store.getStreamAggr(RecordBuffers[horizon].name).val.oldest.$id;

            // Get prediction interval and time
            var predInter = rec.DateTime.timestamp - rec.$store[trainRecId].DateTime.timestamp;
            var predTime = tm.parse(rec.DateTime.string).add(predInter);

            // Select correct linregs model
            var hour = rec.DateTime.hour;
            var work = Service.Mobis.Utils.tmFtr.isWorkingDay(rec);
            var linreg = this.linregs[horizon][work][hour];

            // Set avrVal that is used by ftrExtractor (avrVal.getVal())
            var predAvrVal = this.locAvrgs.getVal({ "DateTime": predTime })
            avrVal.setVal(predAvrVal)

            // Create prediction record
            var predictionRec = {};
            predictionRec.OriginalTime = rec.DateTime.string;
            predictionRec.PredictionTime = predTime.string;
            predictionRec.PredictionHorizon = RecordBuffers[horizon].horizon - 1;
            predictionRec.SpeedLimit = trafficStore.last.measuredBy.MaxSpeed;
            predictionRec.AvrValPred = predAvrVal;
            predictionRec.PrevValPred = rec[target.name];
            predictionRec.NumOfCars = linreg.predict(ftrSpace.ftrVec(rec));

            // Add prediction record to predictions array
            predictionRecs.push(predictionRec);

            predictionStore.add(predictionRec);
            rec.addJoin("Predictions", predictionStore.last)
        };

        return predictionRecs;
    };

    ///////////////// EVALUATION STEP ///////////////// 
    this.evaluate = function (rec) {

        if (rec.$id < evalOffset) return; // If condition is true, stop function here.

        for (horizon in horizons) {

            var trainRecId = rec.$store.getStreamAggr(RecordBuffers[horizon].name).val.oldest.$id;
            var trainRec = rec.$store[trainRecId]

            errorMetrics.forEach(function (errorMetric, metricIdx) {
                var errRec = {};
                errRec["Name"] = errorMetric.name;

                // find correct model and prediction
                //var errorModel = this.errorModels[horizon][metricIdx];
                var errorModel = errorModels[horizon][metricIdx];
                var prediction = trainRec.Predictions[horizon][target.name];
                // update model and write to errRec
                errorModel.update(rec[target.name], prediction);
                errRec[target.name] = errorModel.getError();
                // add errRec to Evaluation sore, and add join to Predictions store which is linked to Original store
                evaluationStore.add(errRec);
                trainRec.Predictions[horizon].addJoin("Evaluation", evaluationStore.last);
            })
        }
    }

    this.consoleReport = function (rec) {

        if (rec.$id < evalOffset) return; // If condition is true, stop function here.
        if (resampledStore[resampledStore.length - 1].DateTime.day !== resampledStore[resampledStore.length - 2].DateTime.day) {
            console.println("");
            console.log("\n==================================\n=== REC: " + rec.DateTime.string + " ===\n==================================");
        }
        
        for (horizon in horizons) {

            var trainRecId = rec.$store.getStreamAggr(RecordBuffers[horizon].name).val.oldest.$id;
            var trainRec = rec.$store[trainRecId]

            // Only one report per day
            var print = resampledStore[resampledStore.length - 1].DateTime.day !== resampledStore[resampledStore.length - 2].DateTime.day;
            if (print && resampledStore[trainRecId].Predictions[horizon] !== null && resampledStore[trainRecId].Predictions[horizon].Evaluation[0] !== null) {

                // Report current predictions in the console
                console.println("");
                console.log("=== Predictions ===");
                console.log("Working on rec: " + rec.DateTime.string);
                console.log("Prediction from: " + trainRec.Predictions[horizon].OriginalTime.string); // Same as trainRec.DateTime.string             
                console.log("Prediction horizon: " + trainRec.Predictions[horizon].PredictionHorizon)
                console.log("Target: " + trainRec.Predictions[horizon].Target); // Same as rec[target.name]
                confMain.predictionFields.forEach(function (predField) {
                    var predValue = trainRec.Predictions[horizon][predField.name];
                    console.log(predField.name + ": " + predValue);
                });

                // Report evaluation metrics in the console
                console.println("");
                console.log("=== Evaluation ===");
                errorMetrics.forEach(function (errorMetric, metricIdx) {
                    confMain.errorFields.forEach(function (errorField, fieldIdx) {
                        var errorValue = trainRec.Predictions[horizon].Evaluation[metricIdx][errorField.name];
                        console.log(errorMetric.name + ": " + errorValue);
                    });
                });
            }
        }
    }
};

exports.newModel = function (modelConf) {

    var horizons = (modelConf.horizons == null) ? 1 : modelConf.horizons;
    var ftrSpace = modelConf.ftrSpace; // TODO: what to do if it is not defined (if it is null) ?????
    var store = modelConf.store;
    var predictionStore = modelConf.predictionStore;
    var evaluationStore = modelConf.evaluationStore;
    var target = modelConf.target;
    var evalOffset = (modelConf.horizons == null) ? 50 : modelConf.evaluationOffset;
    var errorMetrics = modelConf.errorMetrics;

    return new model(horizons, ftrSpace, store, predictionStore, evaluationStore, target, evalOffset, errorMetrics);
}

// About this module
exports.about = function () {
    var description = "Module with baseline predictions.";
    return description;
};