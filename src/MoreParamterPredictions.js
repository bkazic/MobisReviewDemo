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
    { type: "numeric", source: resampledStore.name, field: "TrafficStatus", normalize: false },
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

/// CONFIGURATION OBJECT
var modelConf = {
    stores: {
        "sourceStore": resampledStore,
        "predictionStore": Predictions,
        "evaluationStore": Evaluation,
    },
    //ITS NOT BEEING USED YET. ITS JUST A PROTOTYPE.
    fields: [ // From this, feature space could be build.
        { name: "NumOfCars" },
        { name: "Gap" }, 
        { name: "Occupancy" },
        { name: "Speed" },
        { name: "TrafficStatus" },
    ],
    //ITS NOT BEEING USED YET. ITS JUST A PROTOTYPE.
    predictionFields: [ //TODO: Not sure, if I want to use names of fields or fields??
        { field: resampledStore.field("NumOfCars") },
        { field: resampledStore.field("Occupancy") },
        { field: resampledStore.field("Speed") },
    ],

    ftrSpace: ftrSpace, //TODO: Later this will be done automatically
    target: resampledStore.field("NumOfCars"),

    otherParams: { // This are optional parameters
        evaluationOffset: 50,
    },
    
    predictionHorizons: [1, 3, 6, 9, 12, 15, 18],

    //recLinRegParameters: { "dim": ftrSpace.dim, "forgetFact": 1, "regFact": 10000 }, // Not used yet. //Have to think about it how to use this
    errorMetrics: [
        { name: "MAE", constructor: function () { return evaluation.newMeanAbsoluteError() } },
        { name: "RMSE", constructor: function () { return evaluation.newRootMeanSquareError() } },
        { name: "MAPE", constructor: function () { return evaluation.newMeanAbsolutePercentageError() } },
        { name: "R2", constructor: function () { return evaluation.newRSquareScore() } }
    ]
}


// this two configuration files shoud be probabl merged into one?

// Testing confing file
//ITS NOT BEEING USED YET. ITS JUST A PROTOTYPE.
var confMain = {
    fields: [ // From this, feature space could be build.
        { name: "NumOfCars" }, 
        //{ name: "Gap" }, 
        { name: "Occupancy" },
        { name: "Speed" }, 
        { name: "TrafficStatus" }, 
    ],
    predictionFields: [
        { name: "Speed" }, 
        //{ name: "Occupancy" },
    ],
    errorFields: [
        { name: "Speed", predictionField: "Speed" }, // YOU DONT NEED predictionField IN THIS CASE
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

//////////////////////////// PREDICTION AND EVALUATION ////////////////////////////
resampledStore.addStreamAggr({
    name: "analytics",
    onAdd: function (rec) {
        //console.log("Working on rec: " + rec.DateTime.string);
        //eval(breakpoint)
        //if (rec.$id % 100 == 0) {
        //    console.log("== 100 records down ==");
        //    eval(breakpoint)
        //};

        var predictions = mobisModel.predict(rec);    
        printj(predictions);

        //mobisModel.predict(rec);

        mobisModel.update(rec);

        //mobisModel.evaluate(rec);

        //mobisModel.consoleReport(rec);

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

var visualize = function (htmlName, displayParam) {
    viz.makeHighChartsTemplate(htmlName, 4);
    var converterParams = {
        timeField: "DateTime",
        fields: [
            { name: "Actual", get: function (rec) { return rec[displayParam] }, getTm: function (rec) { return rec.DateTime } },
            { name: "Predicted", get: function (rec) { return rec.Predictions[0][displayParam] }, getTm: function (rec) { return rec.Predictions[0].PredictionTime } },
        ]
    }

    ////if (fs.exists("flowSimple.html")) { fs.del("flowSimple.html"); }
    ////viz.drawHighChartsTimeSeries(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: localized linear regression models" }, chart: { type: 'spline', zoomType: 'x' }, });
    ////viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: localized linear regression models" }, chart: { type: 'spline', zoomType: 'x' }, });

    viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), htmlName, { title: { text: "Predictions: 1h" }, chart: { type: 'spline', zoomType: 'x' }, });

    var converterParams = {
        timeField: "DateTime",
        fields: [
            { name: "Actual", get: function (rec) { return rec[displayParam] }, getTm: function (rec) { return rec.DateTime } },
            { name: "Predicted", get: function (rec) { return rec.Predictions[6][displayParam] }, getTm: function (rec) { return rec.Predictions[6].PredictionTime } },
        ]
    }

    ////viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: errors" }, chart: { type: 'spline', zoomType: 'x' }, });
    viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), htmlName, { title: { text: "Predictions: 18h" }, chart: { type: 'spline', zoomType: 'x' }, });

    var getLatestEvalRec = function () {
        var maxHorizon = horizons.indexOf(Math.max.apply(null, horizons));
        var lastEvaluatedRecId = resampledStore.getStreamAggr(RecordBuffers[maxHorizon].name).val.oldest.$id;
        return resampledStore[lastEvaluatedRecId]; //last record with evaluations for all horizons
    }

    //TODO: this could as well be automatized
    var converterParams = {
        fields: [
            { name: displayParam, get: function (rec) { try { return rec.Evaluation[0][displayParam] } catch (err) { return null } } },
        ]
    }
    ////viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: errors" }, chart: { type: 'spline', zoomType: 'x' }, });
    viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterColumn(converterParams, toJSON(getLatestEvalRec(), 2)), htmlName,
        {
            title: { text: "Model Comparisons" }, chart: { type: 'column' }, xAxis: { categories: horizons, title: { text: 'Horizon' } },
            yAxis: { min: 0, title: { text: 'MAE' } }, plotOptions: {
                column: {
                    pointPadding: 0.2, borderWidth: 0, dataLabels: {
                        enabled: true, rotation: -90, align: 'left', x: 4, y: -10, format: '{point.y:.1f}'
                    }
                }
            },
        });

    var converterParams = {
        fields: [
            { name: displayParam, get: function (rec) { try { return rec.Evaluation[3][displayParam] } catch (err) { return null } } },
        ]
    }
    ////viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: errors" }, chart: { type: 'spline', zoomType: 'x' }, });
    viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterColumn(converterParams, toJSON(getLatestEvalRec(), 2)), htmlName,
        {
            title: { text: "Model Comparisons" }, chart: { type: 'column' }, xAxis: { categories: horizons, title: { text: 'Horizon' } },
            yAxis: { min: 0, title: { text: 'R2' } }, plotOptions: {
                column: {
                    pointPadding: 0.2, borderWidth: 0, dataLabels: {
                        enabled: true, rotation: -90, align: 'left', x: 4, y: -10, format: '{point.y:.3f}'
                    }
                }
            },
        });
}

//var htmlName = "Occupancy.html"
var htmlName = modelConf.target.name + ".html"
var displayParam = modelConf.target.name;
visualize(htmlName, displayParam);

//////////////////////////// ONLINE (REST) SERVICES ////////////////////////////
// Query records
http.onGet("query", function (req, resp) {
    jsonData = JSON.parse(req.args.data);
    console.say("" + JSON.stringify(jsonData));
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