var analytics = require('analytics.js');
var evaluation = require('evaluation.js');
var tm = require('time');
var utilities = require('utilities.js');
var viz = require('visualization.js');

// Create instance for stop watch
sw = new utilities.clsStopwatch();
sw2 = new utilities.clsStopwatch();

// Import modules from lib
var Service = {}; Service.Mobis = {}; Service.Mobis.Utils = {};
Service.Mobis.Loop = require('Service/Mobis/Loop/preprocLoop.js');
Service.Mobis.Utils.Io = require('Service/Mobis/Utils/io.js');
Service.Mobis.Utils.Data = require('Service/Mobis/Utils/importData.js');
Service.Mobis.Utils.Stores = require('Service/Mobis/Utils/defineStores.js');
Service.Mobis.Utils.Baseline = require('Service/Mobis/Utils/baselinePredictors.js');
Service.Mobis.Utils.Ftr = require('Service/Mobis/Utils/specialDays.js');
Service.Mobis.Utils.HistVals = require('Service/Mobis/Utils/histVals.js');
Service.Mobis.Utils.tmFtr = require('Service/Mobis/Utils/dateTimeFtr.js');

// Create instances for evaluation metrics
var speedLimitMAE = evaluation.newMeanAbsoluteError();
var avrValMAE = evaluation.newMeanAbsoluteError();
var prevValMAE = evaluation.newMeanAbsoluteError();
var linregMAE = evaluation.newMeanAbsoluteError();
var ridgeRegMAE = evaluation.newMeanAbsoluteError();
//var ridgeRegSVDMAE = evaluation.newMeanAbsoluteError();
var svmrMAE = evaluation.newMeanAbsoluteError();
var nnMAE = evaluation.newMeanAbsoluteError();
var knnMAE = evaluation.newMeanAbsoluteError();

// Create instances for analytics
var avrOld = Service.Mobis.Utils.Baseline.newAvrVal(); // TEMPORARAY: DELETE THIS LATER
var histVals = Service.Mobis.Utils.HistVals.newHistoricalVals(2); //TODO: This is not OK, the value is not saved in ftrSpace
var tmFtr = Service.Mobis.Utils.tmFtr.newDateTimeFtr();
var slovenianHolidayFtr = new Service.Mobis.Utils.Ftr.specialDaysFtrExtractor("Slovenian_holidays");
var fullMoonFtr = new Service.Mobis.Utils.Ftr.specialDaysFtrExtractor("Full_moon");
var weekendFtr = Service.Mobis.Utils.Ftr.newWeekendFtrExtractor();

isWorkingDay = function (rec) {
    return (rec.DateTime.dayOfWeekNum === 0 || rec.DateTime.dayOfWeekNum === 6 || slovenianHolidayFtr.getFtr(rec) === 1) ? 1 : 0
}


//// Define Stores
Service.Mobis.Utils.Stores.defineStores(); //TODO: Later use .def file instead
var CounterNode = qm.store("CounterNode");
var Evaluation = qm.store("Evaluation");
var Predictions = qm.store("Predictions");
var trafficLoadStore = qm.store('trafficLoadStore');
var trafficStore = qm.store('trafficStore');
//var mergedStore = qm.store('mergedStore'); 
var resampledStore = qm.store('resampledStore');









///////////////////// PREPROCESSING FOR TRAFFIC DATA SOURCE /////////////////////
// Replaces incorect speed values, with avr value
trafficStore.addStreamAggr({
    name: "makeCleanSpeedNoCars",
    onAdd: Service.Mobis.Loop.makeCleanSpeedNoCars(avrOld),
    saveJson: function () { }
});







//////////////////////////// RESAMPLING MERGED STORE ////////////////////////////
// This resample aggregator creates new resampled store
var resampleInterval = 60 * 60 * 1000;
//qm.newStreamAggr({ //TODO: test if it would work with this?
trafficStore.addStreamAggr({
    name: "Resampled", type: "resampler",
    outStore: resampledStore.name, timestamp: "DateTime",
    fields: [{ name: "NumOfCars", interpolator: "linear" },
             { name: "Gap", interpolator: "linear" },
             { name: "Occupancy", interpolator: "linear" },
             { name: "Speed", interpolator: "linear" },
             { name: "TrafficStatus", interpolator: "linear" },
    ],
    createStore: false, interval: resampleInterval
});







////////////////////////////// DEFINING FEATURE SPACE //////////////////////////////

var ftrSpace = analytics.newFeatureSpace([
    { type: "numeric", source: resampledStore.name, field: "Ema1", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Ema2", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Speed", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "NumOfCars", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Gap", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Occupancy", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "TrafficStatus", normalize: false },

    { type: "multinomial", source: resampledStore.name, field: "DateTime", datetime: true }
]);

var ftrSpaceKNN = analytics.newFeatureSpace([
    { type: "jsfunc", source: resampledStore.name, name: "TimeFeatures", dim: 3, fun: Service.Mobis.Utils.tmFtr.getTmFtrs }
]);





///////////////// INITIALIZING SOME STUFF //////////////////
horizons = [1, 6, 12, 18]
//horizons = [12]

// Initialize RecordBuffers definiton for all horizons 
RecordBuffers = [];
for (horizon in horizons) {
    recordBuffer = {
        "name": "delay_" + horizons[horizon] + "h",
        "type": "recordBuffer",
        "horizon": horizons[horizon] + 1
    };
    RecordBuffers.push(recordBuffer);
}

// Initialize Emas definiton for all horizons 
Emas = [];
for (horizon in horizons) {
    emas = [
        {
            "name": "Ema1_" + horizons[horizon] + "h",
            "type": "ema",
            "inAggr": "tick",
            "emaType": "previous",
            "interval": horizons[horizon] * 1 * 60 * 60 * 1000,
            "initWindow": 60 * 60 * 1000,
        },
        {
            "name": "Ema2_" + horizons[horizon] + "h",
            "type": "ema",
            "inAggr": "tick",
            "emaType": "previous",
            "interval": 24 * 60 * 60 * 1000,
            "initWindow": 60 * 60 * 1000,
        }
    ]
    Emas.push(emas);
}






///////////////// INITIALIZING ANALYTIC ALGORITHMS FOR PREDICTION //////////////////
// Initialize analytics

// create 24 avr models, for every hour
var avrgs = [];
for (horizon in horizons) {
    avrgs[horizon] = [];
    for (var i = 0; i < 2; i++) { // 2 models: working day or not
        avrgs[horizon][i] = [];
        for (var j = 0; j < 24; j++) {
            avrgs[horizon][i][j] = Service.Mobis.Utils.Baseline.newAvrVal();
            avrgs[horizon][i][j]["forHour"] = j; // asign new field "forHour" to model
        }
    }
}

// create 2 * 24 linear regression models 
var linregs = []; // this will be array of objects
for (horizon in horizons) {
    linregs[horizon] = [];
    for (var i = 0; i < 2; i++) { // 2 models: working day or not
        linregs[horizon][i] = [];
        for (var j = 0; j < 24; j++) { // 24 models: for every hour in day
            linregs[horizon][i][j] = analytics.newRecLinReg({ "dim": ftrSpace.dim, "forgetFact": 1, "regFact": 10000 });
            linregs[horizon][i][j]["workingDay"] = i; // asign new field "workingDay" to model
            linregs[horizon][i][j]["forHour"] = j; // asign new field "forHour" to model
            linregs[horizon][i][j]["updateCount"] = 0; // just for testing how many times model was updated
        }
    }
}

//var linreg = analytics.newRecLinReg({ "dim": ftrSpace.dim, "forgetFact": 1, "regFact": 10000 });

// TODO
var ridgeRegressions = [];
var NNs = [];
var knns = [];
for (horizon in horizons) {
    ridgeRegressions[horizon] = new analytics.ridgeRegression(10000, ftrSpace.dim, 100);
    NNs[horizon] = analytics.newNN({ "layout": [ftrSpace.dim, 20, 1], "tFuncHidden": "tanHyper", "tFuncOut": "linear", "learnRate": 0.0005, "momentum": 0.00005 });
    knns[horizon] = analytics.newKNearestNeighbors(3, 100);
}

// OLD CODE. DELE THIS LATER.
//var NN = analytics.newNN({ "layout": [ftrSpace.dim, 20, 1], "tFuncHidden": "tanHyper", "tFuncOut": "linear", "learnRate": 0.0005, "momentum": 0.00005 });
//var knn = analytics.newKNearestNeighbors(3, 100);






//////////////////////////////// MORE AGREGATES //////////////////////////////////



// insert testStoreResampled store aggregates
resampledStore.addStreamAggr({
    name: "tick", type: "timeSeriesTick",
    timestamp: "DateTime", value: "NumOfCars"
});

//for (horizon in horizons) {
//    for (ema in Emas[horizon]) {
//        var Ema = Emas[horizon][ema];

//        resampledStore.addStreamAggr({
//            name: Ema.name, type: Ema.type, inAggr: Ema.inAggr,
//            emaType: Ema.emaType, interval: Ema.interval, initWindow: Ema.initWindow
//        });
//    }
//}

for (horizon in horizons) {
    Emas[horizon].forEach(function (Ema) {

        resampledStore.addStreamAggr({
            name: Ema.name, type: Ema.type, inAggr: Ema.inAggr,
            emaType: Ema.emaType, interval: Ema.interval, initWindow: Ema.initWindow
        });
    })
}

// Original
//resampledStore.addStreamAggr({
//    name: "Ema1", type: "ema", inAggr: "tick",
//    emaType: "previous", interval: 3 * 60 * 60 * 1000, initWindow: 60 * 60 * 1000
//});
//resampledStore.addStreamAggr({
//    name: "Ema2", type: "ema", inAggr: "tick",
//    emaType: "previous", interval: 12 * 60 * 60 * 1000, initWindow: 60 * 60 * 1000
//});

// Buffer defines for how many records infront prediction will be learned (2 is one step ahaed)




// Execute buffer agregates for all horizons
for (horizon in horizons) {
    var RecordBuffer = RecordBuffers[horizon]

    resampledStore.addStreamAggr({
        name: RecordBuffer.name, type: RecordBuffer.type, size: RecordBuffer.horizon
    });
}

// Original
//resampledStore.addStreamAggr({
//    name: "delay", type: "recordBuffer", size: 13
//});




sw.tic();
sw2.tic();

//////////////////////////// PREDICTION AND EVALUATION ////////////////////////////
resampledStore.addStreamAggr({
    name: "analytics",
    onAdd: function (rec) {
        for (horizon in horizons) {
            rec.Ema1 = resampledStore.getStreamAggr(Emas[horizon][0].name).val.Val;
            rec.Ema2 = resampledStore.getStreamAggr(Emas[horizon][1].name).val.Val;


            // Get rec for training
            trainRecId = rec.$store.getStreamAggr(RecordBuffers[horizon].name).val.first;

            // Add target for batch method
            // resampledStore.add({ $id: trainRecId, Target: rec.NumOfCars }); //DELETE THIS. THIS IS WRONG


            // Get prediction interval and time
            var predInter = rec.DateTime.timestamp - rec.$store[trainRecId].DateTime.timestamp;
            var predTime = tm.parse(rec.DateTime.string).add(predInter);


            ///////////////// PREDICT ///////////////// 

            // Select correct linregs model
            var hour = rec.DateTime.hour;
            var work = isWorkingDay(rec);
            var linreg = linregs[horizon][work][hour];

            // Select correct avr model
            var predHour = predTime.hour;
            var predWork = isWorkingDay({ "DateTime": predTime });
            var avr = avrgs[horizon][predWork][predHour];

            // Select correct models
            var ridgeRegression = ridgeRegressions[horizon];
            var NN = NNs[horizon];
            var knn = knns[horizon];

            // Create prediction record
            var predictionRec = {};
            predictionRec.PredictionTime = predTime.string;
            predictionRec.PredictionHorizon = RecordBuffers[horizon].horizon - 1;
            predictionRec.SpeedLimit = trafficStore.last.measuredBy.MaxSpeed;
            predictionRec.AvrValPred = avr.getAvr();
            predictionRec.PrevValPred = rec.NumOfCars;
            predictionRec.LinregPred = linreg.predict(ftrSpace.ftrVec(rec));
            predictionRec.RidgeRegPred = ridgeRegression.predict(ftrSpace.ftrVec(rec));
            predictionRec.NNPred = NN.predict(ftrSpace.ftrVec(rec)).at(0);
            predictionRec.KNNPred = knn.predict(ftrSpaceKNN.ftrVec(rec));
            // Add prediction record to Prediction store
            Predictions.add(predictionRec);
            // Join this record to resampledStore record
            rec.addJoin("Predictions", Predictions.last)

            ///////////////// UPDATE ///////////////// 
            if (trainRecId > 0) {
             
                var target = rec.NumOfCars;
                var predTrainId = resampledStore[trainRecId].Predictions[horizon].$id
                Predictions.add({ $id: predTrainId, Target: target})
                //eval(breakpoint)

                // Select correct linregs model
                var trainRec = resampledStore[trainRecId];
                var trainHour = trainRec.DateTime.hour;
                var trainWork = isWorkingDay(trainRec);
                var linreg = linregs[horizon][trainWork][trainHour];

                // Select correct avrgs model
                avr = avrgs[horizon][trainWork][trainHour];

                // Testing///
                //histVals.update(trainRec.NumOfCars);

                // update models
                linreg.learn(ftrSpace.ftrVec(trainRec), rec.NumOfCars);
                ////// JUST FOR TESTING
                linreg.updateCount++;

                //svmr.learn(ftrSpace.ftrVec(trainRec), rec.NumOfCars);
                ridgeRegression.addupdate(ftrSpace.ftrVec(trainRec), rec.NumOfCars);
                NN.learn(ftrSpace.ftrVec(trainRec), la.newVec([rec.NumOfCars]));
                avr.update(trainRec.NumOfCars);
                avrOld.update(trainRec.NumOfCars); // TEMPORARAY: because is beeing used in preprocessing. DELETE THIS LATER and use the new method.
                knn.update(ftrSpaceKNN.ftrVec(trainRec), rec.NumOfCars);

                // EXCEPTION: I have to do this here and not where other predictions are made
                // trainRec.AvrValPred = avrgs[horizon][work][hour].getAvr();

                //IO.saveToFile(ftrSpace.ftrVec(resampledStore[trainRecId]));
                //IO2.saveToFile(ftrSpace.ftrVec(resampledStore[trainRecId]), rec.NumOfCars);

                //This is how you get to the predictions
                //resampledStore[n].Predictions[0].Linreg

                ///////////////// EVALUATE ///////////////// 

                // skip first few iterations because the error of svmr is to high
                if (rec.$id > 50) {
                    // Update error metrics
                    speedLimitMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[horizon].SpeedLimit);
                    avrValMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[horizon].AvrValPred);
                    prevValMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[horizon].NumOfCars);
                    linregMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[horizon].LinregPred);
                    ridgeRegMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[horizon].RidgeRegPred);
                    svmrMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[horizon].SvmrPred);
                    nnMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[horizon].NNPred);
                    knnMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[horizon].KNNPred);


                    // Collect MAE errors
                    var predMAE = {};
                    predMAE.Name = "MAE";
                    predMAE.SpeedLimitErr = speedLimitMAE.getError();
                    predMAE.PrevValErr = prevValMAE.getError();
                    predMAE.AvrValErr = avrValMAE.getError();
                    predMAE.LinregErr = linregMAE.getError();
                    predMAE.RidgeRegErr = ridgeRegMAE.getError();
                    predMAE.SvmrErr = svmrMAE.getError();
                    predMAE.NNErr = nnMAE.getError();
                    predMAE.KNNErr = knnMAE.getError();
                    // Write record to Evaluation store
                    Evaluation.add(predMAE);
                    // Join rec with record from predictions
                    resampledStore[trainRecId].Predictions[horizon].addJoin("Evaluation", Evaluation.last);

                    // JUST A TEST: Collect MSRE errors. WORKS FINE.
                    //var predMSRE = {};
                    //predMSRE.Name = "MSRE";
                    //predMSRE.SpeedLimitErr = speedLimitMAE.getError();
                    //predMSRE.PrevValErr = prevValMAE.getError();
                    //predMSRE.AvrValErr = avrValMAE.getError();
                    //predMSRE.LinregErr = linregMAE.getError();
                    //predMSRE.RidgeRegErr = ridgeRegMAE.getError();
                    //predMSRE.SvmrErr = svmrMAE.getError();
                    //predMSRE.NNErr = nnMAE.getError();
                    //predMSRE.KNNErr = knnMAE.getError();
                    //// Write record to Evaluation store
                    //Evaluation.add(predMSRE);
                    //// Join rec with record from predictions
                    //rec.$store[trainRecId].Predictions[horizon].addJoin("Evaluation", Evaluation.last);

                }
                // Reporting results
                // Only one report per day
                //if (rec.DateTime.day !== prevRecDay && resampledStore[trainRecId].Predictions[0] !== null && resampledStore[trainRecId].Predictions[0].Evaluation[0] !== null) {
                var print = resampledStore[resampledStore.length - 1].DateTime.day !== resampledStore[resampledStore.length - 2].DateTime.day;
                if (print && resampledStore[trainRecId].Predictions[horizon] !== null && resampledStore[trainRecId].Predictions[horizon].Evaluation[0] !== null) {
                    sw2.toc("Leap time");
                    sw2.tic();
                    ftrSpace.ftrVec(rec).print();
                    console.log("Working on rec: " + rec.DateTime.string );
                    console.log("Prediction for: " + predTime.string);
                    // Write predictions to console
                    console.log("Flow:" + rec.NumOfCars);
                    console.log("AvrVal: " + resampledStore[trainRecId].Predictions[horizon].AvrValPred);
                    console.log("PrevVal: " + resampledStore[trainRecId].Predictions[horizon].PrevValPred);
                    console.log("LinReg: " + resampledStore[trainRecId].Predictions[horizon].LinregPred);
                    console.log("RidgeReg: " + resampledStore[trainRecId].Predictions[horizon].RidgeRegPred);
                    console.log("Svmr: " + resampledStore[trainRecId].Predictions[horizon].SvmrPred);
                    console.log("NN: " + resampledStore[trainRecId].Predictions[horizon].NNPred);
                    console.log("KNN: " + resampledStore[trainRecId].Predictions[horizon].KNNPred + "\n");

                    // Write errors to console
                    console.log("SpeedLimit MAE Error: " + resampledStore[trainRecId].Predictions[horizon].Evaluation[0].SpeedLimitErr);
                    console.log("AvrVal MAE Error: " + resampledStore[trainRecId].Predictions[horizon].Evaluation[0].AvrValErr);
                    console.log("PrevVal MAE Error: " + resampledStore[trainRecId].Predictions[horizon].Evaluation[0].PrevValErr);
                    console.log("LinReg MAE Error: " + resampledStore[trainRecId].Predictions[horizon].Evaluation[0].LinregErr);
                    console.log("RidgeReg MAE Error: " + resampledStore[trainRecId].Predictions[horizon].Evaluation[0].RidgeRegErr);
                    console.log("Svmr MAE Error: " + resampledStore[trainRecId].Predictions[horizon].Evaluation[0].SvmrErr);
                    console.log("NN MAE Error: " + resampledStore[trainRecId].Predictions[horizon].Evaluation[0].NNErr);
                    console.log("KNN MAE Error: " + resampledStore[trainRecId].Predictions[horizon].Evaluation[0].KNNErr + "\n");

                    ////// Write errors to console
                    //console.log("Working with rec: " + rec.DateTime.string);
                    //console.log("SpeedLimit MAE Error: " + speedLimitMAE.getError());
                    //console.log("AvrVal MAE Error: " + avrValMAE.getError());
                    //console.log("PrevVal MAE Error: " + prevValMAE.getError());
                    //console.log("LinReg MAE Error: " + linregMAE.getError());
                    //console.log("RidgeReg MAE Error: " + ridgeRegMAE.getError());
                    //console.log("Svmr MAE Error: " + svmrMAE.getError());
                    //console.log("NN MAE Error: " + nnMAE.getError());
                    //console.log("KNN MAE Error: " + knnMAE.getError() + "\n");

                    // set new prevRecDay
                    prevRecDay = rec.DateTime.day;
                }
            }
        }
    },
    saveJson: function () { }
});


// Original
//////////////////////////// PREDICTION AND EVALUATION ////////////////////////////
//resampledStore.addStreamAggr({
//    name: "analytics",
//    onAdd: function (rec) {
//        // Adds ema-s to rec
//        rec.Ema1 = resampledStore.getStreamAggr("Ema1").val.Val;
//        rec.Ema2 = resampledStore.getStreamAggr("Ema2").val.Val;
        
//        // Get rec for training
//        trainRecId = rec.$store.getStreamAggr("delay").val.first;

//        // Add target for batch method
//        resampledStore.add({ $id: trainRecId, Target: rec.NumOfCars });

//        if (trainRecId > 0) {
//            // Get prediction interval and time
//            var predInter = rec.DateTime.timestamp - rec.$store[trainRecId].DateTime.timestamp;
//            var predTime = tm.parse(rec.DateTime.string).add(predInter);

//            ///////////////// PREDICT ///////////////// 

//            // Select correct linregs model
//            var hour = rec.DateTime.hour;
//            var work = isWorkingDay(rec);
//            var linreg = linregs[work][hour];

//            // Select correct avr model
//            var predHour = predTime.hour;
//            var predWork = isWorkingDay({ "DateTime": predTime });
//            var avr = avrgs[predWork][predHour];

//            // Create prediction record
//            var predictionRec = {};
//            predictionRec.PredictionTime = predTime.String;
//            predictionRec.PredictionHorizon = 1 //TODO: this offcourse will have to be automatic later
//            predictionRec.SpeedLimit = trafficStore.last.measuredBy.MaxSpeed;
//            predictionRec.AvrValPred = avr.getAvr();
//            predictionRec.PrevValPred = rec.NumOfCars;
//            predictionRec.LinregPred = linreg.predict(ftrSpace.ftrVec(rec));
//            predictionRec.RidgeRegPred = ridgeRegression.predict(ftrSpace.ftrVec(rec));
//            predictionRec.NNPred = NN.predict(ftrSpace.ftrVec(rec)).at(0);
//            predictionRec.KNNPred = knn.predict(ftrSpaceKNN.ftrVec(rec));
//            // Add prediction record to Prediction store
//            Predictions.add(predictionRec);
//            // Join this record to resampledStore record
//            rec.addJoin("Predictions", Predictions.last)

//            // Debuging
//            //eval(breakpoint);

//            ///////////////// UPDATE ///////////////// 

//            // Select correct linregs model
//            var trainRec = resampledStore[trainRecId];
//            var trainHour = trainRec.DateTime.hour;
//            var trainWork = isWorkingDay(trainRec);
//            var linreg = linregs[trainWork][trainHour];

//            // Select correct avrgs model
//            avr = avrgs[trainWork][trainHour];

//            // Testing///
//            //histVals.update(trainRec.NumOfCars);

//            // update models
//            linreg.learn(ftrSpace.ftrVec(trainRec), rec.NumOfCars);
//            ////// JUST FOR TESTING
//            linreg.updateCount++;

//            //svmr.learn(ftrSpace.ftrVec(trainRec), rec.NumOfCars);
//            ridgeRegression.addupdate(ftrSpace.ftrVec(trainRec), rec.NumOfCars);
//            NN.learn(ftrSpace.ftrVec(trainRec), la.newVec([rec.NumOfCars]));
//            avr.update(trainRec.NumOfCars);
//            avrOld.update(trainRec.NumOfCars); // TEMPORARAY: because is beeing used in preprocessing. DELETE THIS LATER and use the new method.
//            knn.update(ftrSpaceKNN.ftrVec(trainRec), rec.NumOfCars);

//            // EXCEPTION: I have to do this here and not where other predictions are made
//            // trainRec.AvrValPred = avrgs[work][hour].getAvr();

//            //IO.saveToFile(ftrSpace.ftrVec(resampledStore[trainRecId]));
//            //IO2.saveToFile(ftrSpace.ftrVec(resampledStore[trainRecId]), rec.NumOfCars);

//            //This is how you get to the predictions
//            //resampledStore[n].Predictions[0].Linreg

//            ///////////////// EVALUATE ///////////////// 

//            // skip first few iterations because the error of svmr is to high
//            if (rec.$id > 50) {
//                // Update error metrics
//                speedLimitMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[0].SpeedLimit);
//                avrValMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[0].AvrValPred);
//                prevValMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[0].NumOfCars);
//                linregMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[0].LinregPred);
//                ridgeRegMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[0].RidgeRegPred);
//                svmrMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[0].SvmrPred);
//                nnMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[0].NNPred);
//                knnMAE.update(rec.NumOfCars, resampledStore[trainRecId].Predictions[0].KNNPred);

//                // Collect MAE errors
//                var predMAE = {};
//                predMAE.Name = "MAE";
//                predMAE.SpeedLimitErr = speedLimitMAE.getError();
//                predMAE.PrevValErr = prevValMAE.getError();
//                predMAE.AvrValErr = avrValMAE.getError();
//                predMAE.LinregErr = linregMAE.getError();
//                predMAE.RidgeRegErr = ridgeRegMAE.getError();
//                predMAE.SvmrErr = svmrMAE.getError();
//                predMAE.NNErr = nnMAE.getError();
//                predMAE.KNNErr = knnMAE.getError();
//                // Write record to Evaluation store
//                Evaluation.add(predMAE);
//                // Join rec with record from predictions
//                rec.$store[trainRecId].Predictions[0].addJoin("Evaluation", Evaluation.last);

//                // JUST A TEST: Collect MSRE errors. WORKS FINE.
//                //var predMSRE = {};
//                //predMSRE.Name = "MSRE";
//                //predMSRE.SpeedLimitErr = speedLimitMAE.getError();
//                //predMSRE.PrevValErr = prevValMAE.getError();
//                //predMSRE.AvrValErr = avrValMAE.getError();
//                //predMSRE.LinregErr = linregMAE.getError();
//                //predMSRE.RidgeRegErr = ridgeRegMAE.getError();
//                //predMSRE.SvmrErr = svmrMAE.getError();
//                //predMSRE.NNErr = nnMAE.getError();
//                //predMSRE.KNNErr = knnMAE.getError();
//                //// Write record to Evaluation store
//                //Evaluation.add(predMSRE);
//                //// Join rec with record from predictions
//                //rec.$store[trainRecId].Predictions[0].addJoin("Evaluation", Evaluation.last);

//            }

//            // Reporting results
//            // Only one report per day
//            if (rec.DateTime.day !== prevRecDay && resampledStore[trainRecId].Predictions[0] !== null && resampledStore[trainRecId].Predictions[0].Evaluation[0] !== null) {
//                sw2.toc("Leap time");
//                sw2.tic();
//                ftrSpace.ftrVec(rec).print();
//                console.log("Working on rec: " + rec.DateTime.dateString + "\n");
//                // Write predictions to console
//                console.log("Flow:" + rec.NumOfCars);
//                console.log("AvrVal: " + resampledStore[trainRecId].Predictions[0].AvrValPred);
//                console.log("PrevVal: " + resampledStore[trainRecId].Predictions[0].PrevValPred);
//                console.log("LinReg: " + resampledStore[trainRecId].Predictions[0].LinregPred);
//                console.log("RidgeReg: " + resampledStore[trainRecId].Predictions[0].RidgeRegPred);
//                console.log("Svmr: " + resampledStore[trainRecId].Predictions[0].SvmrPred);
//                console.log("NN: " + resampledStore[trainRecId].Predictions[0].NNPred);
//                console.log("KNN: " + resampledStore[trainRecId].Predictions[0].KNNPred + "\n");

//                // Write errors to console
//                console.log("Working with rec: " + rec.DateTime.string);
//                console.log("SpeedLimit MAE Error: " + resampledStore[trainRecId].Predictions[0].Evaluation[0].SpeedLimitErr);
//                console.log("AvrVal MAE Error: " + resampledStore[trainRecId].Predictions[0].Evaluation[0].AvrValErr);
//                console.log("PrevVal MAE Error: " + resampledStore[trainRecId].Predictions[0].Evaluation[0].PrevValErr);
//                console.log("LinReg MAE Error: " + resampledStore[trainRecId].Predictions[0].Evaluation[0].LinregErr);
//                console.log("RidgeReg MAE Error: " + resampledStore[trainRecId].Predictions[0].Evaluation[0].RidgeRegErr);
//                console.log("Svmr MAE Error: " + resampledStore[trainRecId].Predictions[0].Evaluation[0].SvmrErr);
//                console.log("NN MAE Error: " + resampledStore[trainRecId].Predictions[0].Evaluation[0].NNErr);
//                console.log("KNN MAE Error: " + resampledStore[trainRecId].Predictions[0].Evaluation[0].KNNErr + "\n");

//                ////// Write errors to console
//                //console.log("Working with rec: " + rec.DateTime.string);
//                //console.log("SpeedLimit MAE Error: " + speedLimitMAE.getError());
//                //console.log("AvrVal MAE Error: " + avrValMAE.getError());
//                //console.log("PrevVal MAE Error: " + prevValMAE.getError());
//                //console.log("LinReg MAE Error: " + linregMAE.getError());
//                //console.log("RidgeReg MAE Error: " + ridgeRegMAE.getError());
//                //console.log("Svmr MAE Error: " + svmrMAE.getError());
//                //console.log("NN MAE Error: " + nnMAE.getError());
//                //console.log("KNN MAE Error: " + knnMAE.getError() + "\n");

//                // set new prevRecDay
//                prevRecDay = rec.DateTime.day;
//            }
//        }
//    },
//    saveJson: function () { }
//});






//// Load Stores from log files
Service.Mobis.Utils.Stores.loadStores();

// Imports data from loadstores according to timestamp
//var loadStores = [trafficLoadStore, weatherLoadStore, eventLogsLoadStore];
var loadStores = [trafficLoadStore];
//var targetStores = [trafficStore, weatherStore, eventLogsStore];
var targetStores = [trafficStore];
Service.Mobis.Utils.Data.importData(loadStores, targetStores, 1000);
//Service.Mobis.Utils.Data.importData(loadStores, targetStores);

// DEBUGGING
eval(breakpoint)

//var fields = [resampledStore.field("DateTime"),
//              //resampledStore.field("NumOfCars"),
//              //resampledStore.field("Speed"),
//              //resampledStore.field("temperature"),
//              //resampledStore.field("visibility"),
//              //resampledStore.field("priority"),
//              //resampledStore.field("Target"),
//              resampledStore.field("AvrValPred"),
//              resampledStore.field("PrevValPred"),
//              resampledStore.field("LinregPred"),
//              resampledStore.field("RidgeRegPred"),
//              resampledStore.field("NNPred"),
//              resampledStore.field("KNNPred")
//]

//viz.drawHighChartsTimeSeries(viz.highchartsConverter(fields, resampledStore.tail(300).toJSON()), "flowSimple.html", { title: { text: "Simple \"Flow\" Prediction model" }, chart: { type: 'spline', zoomType: 'x' }, });
//viz.drawHighChartsTimeSeries(viz.highchartsConverter(fields, resampledStore.recs.toJSON(true,true)), "flowSimple.html", { title: { text: "Simple \"Flow\" Prediction model" }, chart: { type: 'spline', zoomType: 'x' }, });

//////////////////////////// ONLINE (REST) SERVICES ////////////////////////////
// Query records
http.onGet("query", function (req, resp) {
    jsonData = JSON.parse(req.args.data);
    console.say("" + JSON.stringify(jsonData)); // toJSON(true,true) ne dela
    var recs = qm.search(jsonData);
    return http.jsonp(req, resp, recs);
});

// Resampled store with measurements
// Example1: http://localhost:8080/MoreHorizons/resampledStore No predictions are seen.
// Example2: http://localhost:8080/MoreHorizons/resampledStore?printJoins=true With predictions.
http.onGet("resampledStore", function (req, resp) {
    var store = qm.store("resampledStore");
    //var recs = store.recs.toJSON(true, true);
    // Check if parameter "printJoins" is "true".
    var printJoins = (req.args.printJoins == "true") ? 1 : 0;
    var recs = (printJoins) ? store.recs.toJSON(true, true) : store.recs.toJSON(); //How to go two levels deep?
    console.say("printJoins: " + printJoins);
    console.say("" + JSON.stringify(recs)); 
    return http.jsonp(req, resp, recs);
});