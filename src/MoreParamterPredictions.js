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
Service.Mobis.Utils.model = require('Service/Mobis/Utils/model.js');
Service.Mobis.Utils.helper = require('Service/Mobis/Utils/helper.js');


// Create instances for analytics
var avrOld = Service.Mobis.Utils.Baseline.newAvrVal(); // TEMPORARAY: DELETE THIS LATER
var histVals = Service.Mobis.Utils.HistVals.newHistoricalVals(2); //TODO: This is not OK, the value is not saved in ftrSpace
var slovenianHolidayFtr = new Service.Mobis.Utils.Ftr.specialDaysFtrExtractor("Slovenian_holidays");
var fullMoonFtr = new Service.Mobis.Utils.Ftr.specialDaysFtrExtractor("Full_moon");
var weekendFtr = Service.Mobis.Utils.Ftr.newWeekendFtrExtractor();


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

// TODO: This should be moved somewhere. Probablly to this new module where proposed method will be implemented.
//var avrModel = function () {
//    var avr;
//    this.setModel = function (avr_in) {
//        avr = avr_in;
//    };
//    this.getVal = function () {
//        return avr.getAvr();
//    }
//}
//var getAvrVal = new avrModel();

var avrVal = Service.Mobis.Utils.helper.newDummyModel();


// Feature space
var ftrSpace = analytics.newFeatureSpace([
    { type: "constant", source: resampledStore.name, val: 1 },
    //{ type: "numeric", source: resampledStore.name, field: "Ema1", normalize: false },
    //{ type: "numeric", source: resampledStore.name, field: "Ema2", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Speed", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "NumOfCars", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Gap", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Occupancy", normalize: false },
    //{ type: "numeric", source: resampledStore.name, field: "TrafficStatus", normalize: false },
    //{ type: "jsfunc", source: resampledStore.name, name: "AvrVal", fun: getAvrVal.getVal },
    { type: "jsfunc", source: resampledStore.name, name: "AvrVal", fun: avrVal.getVal },
    
    // Can I know, which rec is calling ftrSpace?
    //{ type: "jsfunc", source: resampledStore.name, name: "AvrVal", fun: getAvrVal.getVal }

    //{ type: "multinomial", source: resampledStore.name, field: "DateTime", datetime: true }
]);


//////////////////////////////// MORE AGREGATES //////////////////////////////////

///////////////// INITIALIZING SOME STUFF //////////////////
horizons = [1, 3, 6, 9, 12, 15, 18] // if you have resampling na 1h
//horizons = [1, 6, 1*12, 3*12, 6*12, 9*12, 12*12, 15*12, 18*12] // if you hvae resampling na 5min

// Initialize RecordBuffers definiton for all horizons 
//RecordBuffers = [];
//for (var horizon in horizons) {
//    recordBuffer = {
//        name: "delay_" + horizons[horizon] + "h",
//        type: "recordBuffer",
//        horizon: horizons[horizon] + 1
//    };
//    RecordBuffers.push(recordBuffer);
//}

//// Execute buffer agregates for all horizons
//for (var horizon in horizons) {
//    var RecordBuffer = RecordBuffers[horizon]

//    resampledStore.addStreamAggr({
//        name: RecordBuffer.name, type: RecordBuffer.type, size: RecordBuffer.horizon
//    });
//}


//// Define Emas definiton for all horizons 
//Emas = [];
//for (var horizon in horizons) {
//    emas = [
//        {
//            name: "Ema1_" + horizons[horizon] + "h",
//            type: "ema",
//            inAggr: "tick",
//            emaType: "previous",
//            interval: horizons[horizon] * 1 * 60 * 60 * 1000,
//            initWindow: 60 * 60 * 1000,
//        },
//        {
//            name: "Ema2_" + horizons[horizon] + "h",
//            type: "ema",
//            inAggr: "tick",
//            emaType: "previous",
//            interval: 24 * 60 * 60 * 1000,
//            initWindow: 60 * 60 * 1000,
//        }
//    ]
//    Emas.push(emas);
//}

//// here we define on which parameter emas will be calculated ("NumOfCars" in this case)
//resampledStore.addStreamAggr({
//    name: "tick", type: "timeSeriesTick",
//    timestamp: "DateTime", value: "NumOfCars"
//});

//// Initialize EMAs
//for (var horizon in horizons) {
//    Emas[horizon].forEach(function (Ema) {

//        resampledStore.addStreamAggr({
//            name: Ema.name, type: Ema.type, inAggr: Ema.inAggr,
//            emaType: Ema.emaType, interval: Ema.interval, initWindow: Ema.initWindow
//        });
//    })
//}



///////////////// INITIALIZING ANALYTIC ALGORITHMS FOR PREDICTION //////////////////
// Initialize analytics

//// create 2 * 24 avr models, for every hour
//var avrgs = [];
//for (var horizon in horizons) {
//    avrgs[horizon] = [];
//    for (var i = 0; i < 2; i++) { // 2 models: working day or not
//        avrgs[horizon][i] = [];
//        for (var j = 0; j < 24; j++) {
//            avrgs[horizon][i][j] = Service.Mobis.Utils.Baseline.newAvrVal();
//            avrgs[horizon][i][j]["forHour"] = j; // asign new field "forHour" to model
//        }
//    }
//}

//// create 2 * 24 linear regression models 
//var linregs = []; // this will be array of objects
//for (var horizon in horizons) {
//    linregs[horizon] = [];
//    for (var i = 0; i < 2; i++) { // 2 models: working day or not
//        linregs[horizon][i] = [];
//        for (var j = 0; j < 24; j++) { // 24 models: for every hour in day
//            linregs[horizon][i][j] = analytics.newRecLinReg({ "dim": ftrSpace.dim, "forgetFact": 1, "regFact": 10000 });
//            linregs[horizon][i][j]["workingDay"] = i; // asign new field "workingDay" to model
//            linregs[horizon][i][j]["forHour"] = j; // asign new field "forHour" to model
//            linregs[horizon][i][j]["updateCount"] = 0; // just for testing how many times model was updated
//        }
//    }
//}

/// TESING
var modelConf = {
    store: resampledStore,
    predictionStore: Predictions, // Not used yet
    evaluationStore: Evaluation, // Not used yet
    evaluationOffset : 50, // Not used yet
    target: resampledStore.field("NumOfCars"),
    ftrSpace: ftrSpace, // this ftrSpace should be an object
    horizons: [1, 3, 6, 9, 12, 15, 18],
    //recLinRegParameters: { "dim": ftrSpace.dim, "forgetFact": 1, "regFact": 10000 }, //Have to think about it how to use this
    errorMetrics: [
        { name: "MAE", constructor: function () { return evaluation.newMeanAbsoluteError() } },
        { name: "RMSE", constructor: function () { return evaluation.newRootMeanSquareError() } },
        { name: "MAPE", constructor: function () { return evaluation.newMeanAbsolutePercentageError() } },
        { name: "R2", constructor: function () { return evaluation.newRSquareScore() } }
    ]
}


// this two configuration files shoud be probabl merged into one?

// Testing confing file
var confMain = {
    fields: [
        { name: "NumOfCars" }, //ITS NOT BEEING USED YET. ITS JUST A PROTOTYPE.
        //{ name: "Gap" },
        { name: "Occupancy" },
        { name: "Speed" },
        { name: "TrafficStatus" },
    ],
    predictionFields: [
        { name: "NumOfCars" },
        //{ name: "Occupancy" },
    ],
    errorFields: [
        { name: "NumOfCars", predictionField: "NumOfCars" }, // YOU DONT NEED predictionField IN THIS CASE
        //{ name: "Occupancy", predictionField: "Occupancy" },
    ],
    errorMetrics: [
        { name: "MAE", constructor: function () { return evaluation.newMeanAbsoluteError() } },
        { name: "RMSE", constructor: function () { return evaluation.newRootMeanSquareError() } },
        { name: "MAPE", constructor: function () { return evaluation.newMeanAbsolutePercentageError() } },
        { name: "R2", constructor: function () { return evaluation.newRSquareScore() } }
    ]
}



var mobisModel = Service.Mobis.Utils.model.newModel(modelConf);
//eval(breakpoint)


//// Create instances for evaluation metrics
//errorModels = [];
//for (var horizon in horizons) {
//    errorModels[horizon] = [];
//    for (var errMetric in confMain.errorMetrics) {
//        errorModels[horizon][errMetric] = [];
//        for (var field in confMain.errorFields) {
//            errorModels[horizon][errMetric][field] = confMain.errorMetrics[errMetric].constructor();
//            errorModels[horizon][errMetric][field]["metric"] = confMain.errorMetrics[errMetric].name;
//        }
//    }
//}

sw.tic();
sw2.tic();

//////////////////////////// PREDICTION AND EVALUATION ////////////////////////////
resampledStore.addStreamAggr({
    name: "analytics",
    onAdd: function (rec) {    

        console.log("Working on rec: " + rec.DateTime.string);
        //eval(breakpoint)

        var predictions = mobisModel.predict(rec);
        
        // Add prediction records (one by one) to Prediction store and join it to original record
        //predictions.forEach(function (prediction) {
        //    Predictions.add(prediction);
        //    rec.addJoin("Predictions", Predictions.last)
        //})

        //printj(predictions);

        mobisModel.update(rec);

        mobisModel.evaluate(rec);

        if (rec.$id % 100 == 0) {
            console.log("== 100 records down ==")
        }
        
        //eval(breakpoint);

        //for (var horizon in horizons) {
        //    //rec.Ema1 = resampledStore.getStreamAggr(Emas[horizon][0].name).val.Val;
        //    //rec.Ema2 = resampledStore.getStreamAggr(Emas[horizon][1].name).val.Val;

        //    // Get rec for training
        //    trainRecId = rec.$store.getStreamAggr(RecordBuffers[horizon].name).val.oldest.$id;

        //    // Get prediction interval and time
        //    var predInter = rec.DateTime.timestamp - rec.$store[trainRecId].DateTime.timestamp;
        //    var predTime = tm.parse(rec.DateTime.string).add(predInter);

        //    ///////////////// PREDICTION STEP ///////////////// 
              // This should be defined in the wrapper?
        //    // Select correct avr model
        //    var predHour = predTime.hour;
        //    var predWork = Service.Mobis.Utils.tmFtr.isWorkingDay({ "DateTime": predTime });
        //    var avr = avrgs[horizon][predWork][predHour];
        //    getAvrVal.setModel(avr)

        //    // Select correct linregs model
        //    var hour = rec.DateTime.hour;
        //    var work = Service.Mobis.Utils.tmFtr.isWorkingDay(rec);
        //    var linreg = linregs[horizon][work][hour];

        //    // Create prediction record
        //    var predictionRec = {};
        //    predictionRec.OriginalTime = rec.DateTime.string;
        //    predictionRec.PredictionTime = predTime.string;
        //    predictionRec.PredictionHorizon = RecordBuffers[horizon].horizon - 1;
        //    predictionRec.SpeedLimit = trafficStore.last.measuredBy.MaxSpeed;
        //    predictionRec.AvrValPred = avr.getAvr();
        //    predictionRec.PrevValPred = rec.NumOfCars;
        //    predictionRec.NumOfCars = linreg.predict(ftrSpace.ftrVec(rec));
        //    // Add prediction record to Prediction store
        //    Predictions.add(predictionRec);
        //    // Join this record to resampledStore record
        //    rec.addJoin("Predictions", Predictions.last)

        //    ///////////////// UPDATE STEP ///////////////// 
        //    if (trainRecId > 0) {
        //        var trainRec = resampledStore[trainRecId];
        //        var target = rec.NumOfCars; // THIS SHOULD BE DEFINED SOMEWHERE ELSE

        //        var trainHour = trainRec.DateTime.hour;
        //        var trainWork = Service.Mobis.Utils.tmFtr.isWorkingDay(trainRec);

        //        trainRec.Predictions[horizon].Target = target;

        //        // Select correct linregs model to update
        //        linreg = linregs[horizon][trainWork][trainHour];
             
        //        // Select correct avrgs model to update
        //        avr = avrgs[horizon][trainWork][trainHour];


                  // This should be defined in the wrapper?
        //        // Select correct avrgs model for ftr value
        //        var hourAvrFtr = rec.DateTime.hour;
        //        var workAvrFtr = Service.Mobis.Utils.tmFtr.isWorkingDay(rec);
        //        var avrFtr = avrgs[horizon][workAvrFtr][hourAvrFtr];
        //        getAvrVal.setModel(avrFtr)

        //        // update models
        //        linreg.learn(ftrSpace.ftrVec(trainRec), target); // target could be replaced with trainRec.Predictions[horizon].Target

        //        avr.update(trainRec.NumOfCars);
        //        avrOld.update(trainRec.NumOfCars); // TEMPORARAY: because is beeing used in preprocessing. DELETE THIS LATER and use the new method.

        //        eval(breakpoint)

        //        ///////////////// EVALUATE STEP ///////////////// 

        //        // skip first few iterations because the error of svmr is to high
        //        if (rec.$id > 50) { // Shouldnt this be (trainRec.$id) { return; }?

        //            // Update and write error metrics
        //            confMain.errorMetrics.forEach(function (errorMetric, metricIdx) {
        //                // create record with all the errors and write it to Evaluation store.
        //                var errRec = {};
        //                errRec.Name = errorMetric.name;
        //                // Update and write all error fields.
        //                confMain.errorFields.forEach(function (errorField, fieldIdx) {
        //                    var errorModel = errorModels[horizon][metricIdx][fieldIdx];
        //                    var prediction = trainRec.Predictions[horizon][errorField.name] // Not sure if there is any other way than with prediction Field. Yes, now it is. It has the same name.
        //                    // update model and write to errRec
        //                    errorModel.update(target, prediction)
        //                    errRec[errorField.name] = errorModel.getError();
        //                });
        //                // Add errRec to Evaluation sore, and add join to Predictions store which is linked to Original store
        //                Evaluation.add(errRec);
        //                trainRec.Predictions[horizon].addJoin("Evaluation", Evaluation.last);
        //            });

        //        }

        //        ///////////////// REPORTING STEP ///////////////// 

        //        // Only one report per day
        //        var print = resampledStore[resampledStore.length - 1].DateTime.day !== resampledStore[resampledStore.length - 2].DateTime.day;
        //        if (print && resampledStore[trainRecId].Predictions[horizon] !== null && resampledStore[trainRecId].Predictions[horizon].Evaluation[0] !== null) {
        //            sw2.toc("Leap time");
        //            sw2.tic();
        //            ftrSpace.ftrVec(rec).print(); // Just for Debuging

        //            // Report current predictions in the console
        //            console.println("");
        //            console.log("=== Predictions ===");
        //            console.log("Working on rec: " + rec.DateTime.string );
        //            console.log("Prediction from: " + trainRec.Predictions[horizon].OriginalTime.string); // Same as trainRec.DateTime.string
        //            console.log("Target: " + target); // Same as rec.NumOfCars

        //            confMain.predictionFields.forEach(function (predField) {
        //                var predValue = trainRec.Predictions[horizon][predField.name];
        //                console.log(predField.name + ": " + predValue);
        //            });

        //            // Report evaluation metrics in the console
        //            confMain.errorMetrics.forEach(function (errorMetric, metricIdx) {
        //                console.println("");
        //                console.log("=== Evaluation metric: " + errorMetric.name + " ===");
        //                // Print out all evaluation fields for this metric.
        //                confMain.errorFields.forEach(function (errorField, fieldIdx) {
        //                    var errorValue = trainRec.Predictions[horizon].Evaluation[metricIdx][errorField.name];
        //                    console.log(errorField.name + ": " + errorValue);
        //                });

        //            });
        //        }
        //    }
        //}
    },
    saveJson: function () { }
});

//// Load Stores from log files
Service.Mobis.Utils.Stores.loadStores();

// Imports data from loadstores according to timestamp
//var loadStores = [trafficLoadStore, weatherLoadStore, eventLogsLoadStore];
var loadStores = [trafficLoadStore];
//var targetStores = [trafficStore, weatherStore, eventLogsStore];
var targetStores = [trafficStore];
Service.Mobis.Utils.Data.importData(loadStores, targetStores, 10000);
//Service.Mobis.Utils.Data.importData(loadStores, targetStores, 26000);
//Service.Mobis.Utils.Data.importData(loadStores, targetStores);

// DEBUGGING
//eval(breakpoint)

viz.makeHighChartsTemplate("Comparisons.html", 4);
var converterParams = {
    timeField: "DateTime",
    fields: [
        { name: "Flow", get: function (rec) { return rec.NumOfCars }, getTm: function (rec) { return rec.DateTime } },
        { name: "PredictedFlow", get: function (rec) { return rec.Predictions[0].NumOfCars }, getTm: function (rec) { return rec.Predictions[0].PredictionTime } },
    ]
}

////if (fs.exists("flowSimple.html")) { fs.del("flowSimple.html"); }
////viz.drawHighChartsTimeSeries(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: localized linear regression models" }, chart: { type: 'spline', zoomType: 'x' }, });
////viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: localized linear regression models" }, chart: { type: 'spline', zoomType: 'x' }, });

viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "Comparisons.html", { title: { text: "Flow predictions: 1h" }, chart: { type: 'spline', zoomType: 'x' }, });

var converterParams = {
    timeField: "DateTime",
    fields: [
        { name: "Flow", get: function (rec) { return rec.NumOfCars }, getTm: function (rec) { return rec.DateTime } },
        { name: "PredictedFlow", get: function (rec) { return rec.Predictions[6].NumOfCars }, getTm: function (rec) { return rec.Predictions[6].PredictionTime } },
    ]
}

////viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: errors" }, chart: { type: 'spline', zoomType: 'x' }, });
viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "Comparisons.html", { title: { text: "Flow predictions: 18h" }, chart: { type: 'spline', zoomType: 'x' }, });

var getLatestEvalRec = function () {
    var maxHorizon = horizons.indexOf(Math.max.apply(null, horizons));
    var lastEvaluatedRecId = resampledStore.getStreamAggr(RecordBuffers[maxHorizon].name).val.oldest.$id;
    return resampledStore[lastEvaluatedRecId]; //last record with evaluations for all horizons
}

//TODO: this could as well be automatized
var converterParams = {
    fields: [
        { name: "NumOfCars", get: function (rec) { try { return rec.Evaluation[0].NumOfCars } catch (err) { return null } } },
    ]
}
////viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: errors" }, chart: { type: 'spline', zoomType: 'x' }, });
viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterColumn(converterParams, toJSON(getLatestEvalRec(), 2)), "Comparisons.html",
    {
        title: { text: "Model Comparisons" }, chart: { type: 'column' }, xAxis: { categories: horizons, title: { text: 'Horizon' } },
        yAxis: { min: 0, title: { text: 'MAE' } }, plotOptions: { column: { pointPadding: 0.2, borderWidth: 0, dataLabels: {
                    enabled: true, rotation: -90, align: 'left', x: 4, y: -10, format: '{point.y:.1f}' } } }, 
    });

var converterParams = {
    fields: [
        { name: "NumOfCars", get: function (rec) { try { return rec.Evaluation[3].NumOfCars } catch (err) { return null } } },
    ]
}
////viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: errors" }, chart: { type: 'spline', zoomType: 'x' }, });
viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterColumn(converterParams, toJSON(getLatestEvalRec(), 2)), "Comparisons.html",
    {
        title: { text: "Model Comparisons" }, chart: { type: 'column' }, xAxis: { categories: horizons, title: { text: 'Horizon' } },
        yAxis: { min: 0, title: { text: 'R2' } }, plotOptions: { column: { pointPadding: 0.2, borderWidth: 0, dataLabels: {
                    enabled: true, rotation: -90, align: 'left', x: 4, y: -10, format: '{point.y:.3f}' } } },
    });



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
// Example2: http://localhost:8080/MoreHorizons/resampledStore?printJoins=true With predictions. (Optional parameter that sets )
// Example3: http://localhost:8080/MoreHorizons/resampledStore?printJoins=true&depth=2 With evalueations.
http.onGet("resampledStore", function (req, resp) {
    var store = qm.store("resampledStore");
    var depth = 0;
    depth = (req.args.printJoins == "true") ? 1 : 0;
    if (req.args.depth != null) { depth = req.args.depth; }
    // convert to json
    var recs = toJSON(store.recs, depth);
    return http.jsonp(req, resp, recs);
});

http.onGet("evaluation", function (req, resp) {
    var depth = 2;
    if (req.args.depth != null) { depth = req.args.depth; }
    var maxHorizon = horizons.indexOf(Math.max.apply(null, horizons));
    var lastEvaluatedRecId = resampledStore.getStreamAggr(RecordBuffers[maxHorizon].name).val.oldest.$id;
    var lastEvaluatedRec = resampledStore[lastEvaluatedRecId]; //last record with evaluations for all horizons
    var rec = toJSON(lastEvaluatedRec, depth);
    return http.jsonp(req, resp, rec)
});