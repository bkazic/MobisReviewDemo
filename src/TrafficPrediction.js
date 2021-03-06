var analytics = require('analytics.js');
var evaluation = require('evaluation.js');
var tm = require('time');
var utilities = require('utilities.js');
//var viz = require('visualization.js');
var viz = require('Service/Mobis/Utils/visualization.js');

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
//Service.Mobis.Utils.Stores.defineStores(); //TODO: Later use .def file instead
var CounterNode = qm.store("CounterNode");
var Evaluation = qm.store("Evaluation");
var Predictions = qm.store("Predictions");
var trafficLoadStore = qm.store('trafficLoadStore');
var trafficStore = qm.store('trafficStore');
//var mergedStore = qm.store('mergedStore'); 
var resampledStore = qm.store('resampledStore');

qm.load.jsonFile(CounterNode, "./sandbox/" + process.scriptNm + "/countersNodes.txt"); // I have to loadid here because function below needs it

var testStore = Service.Mobis.Utils.Stores.createNewTrafficStore("Test");
var stores = Service.Mobis.Utils.Stores.createMeasurementStores(CounterNode);

// Arrays with all stores
trafficStores = stores.trafficStores;
resampledStores = stores.resampledStores;
evaluationStores = stores.evaluationStores;
predictionStores = stores.predictionStores;

///////////////////// PREPROCESSING FOR TRAFFIC DATA SOURCE /////////////////////

//trafficStore.addStreamAggr({
//    name: "setStores",
//    onAdd: function (rec) {
//        // Defining variables for stores, acording to rec origin
//        //trafficStore = qm.store(rec.measuredBy.Name);
//        //if (rec == null) return;
//        id = rec.measuredBy.Name.replace("-", "_");
//        trafficStore = qm.store("trafficStore_" + id);
//        Evaluation = qm.store("Evaluation_" + id);
//        Predictions = qm.store("Predictions_" + id);
//        resampledStore = qm.store('resampledStore_' + id);

//        // Moving rec to appropriate store
//        trafficStore.add(rec.toJSON(true));
//    },
//    saveJson: function () { }
//});

///////////////////// PREPROCESSING FOR TRAFFIC DATA SOURCE /////////////////////
// Replaces incorect speed values, with avr value
trafficStores.forEach (function (store) {
    store.addStreamAggr({
        name: "makeCleanSpeedNoCars",
        onAdd: Service.Mobis.Loop.makeCleanSpeedNoCars(avrOld),
        saveJson: function () { }
    });
})

//////////////////////////// RESAMPLING MERGED STORE ////////////////////////////
// This resample aggregator creates new resampled store
var resampleInterval = 60 * 60 * 1000;

trafficStores.forEach(function (inStore, idx) {
    var outStore = resampledStores[idx];
    // set output sytore
    inStore.addStreamAggr({
        name: "Resampled", type: "resampler",
        outStore: outStore.name, timestamp: "DateTime",
        fields: [{ name: "NumOfCars", interpolator: "linear" },
                 { name: "Gap", interpolator: "linear" },
                 { name: "Occupancy", interpolator: "linear" },
                 { name: "Speed", interpolator: "linear" },
                 { name: "TrafficStatus", interpolator: "linear" },
        ],
        createStore: false, interval: resampleInterval
    });
    console.log("Inictializing resampler...");
    console.log("inStore: " + inStore.name);
    console.log("outStore: " + outStore.name);
});

// Ads a join back, since it was lost with resampler
resampledStores.forEach( function (store) {
    store.addStreamAggr({
    name: "addJoinsBack",
    onAdd: function (rec) {
        // TODO: fix resampler and joins. Most elegant would be, so that resampler preserves joins.
        var sensorId = rec.$store.name.slice(-7) // Get id to find orinigal store
        var originalStore = qm.store("trafficStore_" + id);
        rec.addJoin("measuredBy", originalStore.last.measuredBy);
    },
    saveJson: function () { }
    });
});


//// Just for debuging, delete this later
//resampledStores.forEach(function (store) {
//    store.addStreamAggr({
//    name: "test5",
//    onAdd: function (rec) {
//        console.log("\n\n\n== Fifth Test ==");
//        console.log("We are in: " + resampledStore.name);
//        console.log("Record comes from: " + rec.$store.name);
//        printj(rec.toJSON(true));
//    },
//    saveJson: function () { }
//    });
//});

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


//// Feature space
//var ftrSpace = analytics.newFeatureSpace([
//    { type: "constant", source: resampledStore.name, val: 1 },
//    //{ type: "numeric", source: resampledStore.name, field: "Ema1", normalize: false },
//    //{ type: "numeric", source: resampledStore.name, field: "Ema2", normalize: false },
//    { type: "numeric", source: resampledStore.name, field: "Speed", normalize: false },
//    { type: "numeric", source: resampledStore.name, field: "NumOfCars", normalize: false },
//    { type: "numeric", source: resampledStore.name, field: "Gap", normalize: false },
//    { type: "numeric", source: resampledStore.name, field: "Occupancy", normalize: false },
//    { type: "numeric", source: resampledStore.name, field: "TrafficStatus", normalize: false },
//    //{ type: "jsfunc", source: resampledStore.name, name: "AvrVal", fun: getAvrVal.getVal },
//    { type: "jsfunc", source: resampledStore.name, name: "AvrVal", fun: avrVal.getVal },
    
//    // Can I know, which rec is calling ftrSpace?
//    //{ type: "jsfunc", source: resampledStore.name, name: "AvrVal", fun: getAvrVal.getVal }

//    //{ type: "multinomial", source: resampledStore.name, field: "DateTime", datetime: true }
//]);

//////////////////////////////// MORE AGREGATES //////////////////////////////////

///////////////// INITIALIZING SOME STUFF //////////////////
//horizons = [1, 3, 6, 9, 12, 15, 18] // if you have resampling na 1h
//horizons = [1, 6, 1*12, 3*12, 6*12, 9*12, 12*12, 15*12, 18*12] // if you hvae resampling na 5min
horizons = [];
for (var i = 1; i < 25; i++) {
    horizons.push(i);
}

// Create hashtable for models
//var mobisModels = utilities.newHashTable();
var mobisModels = {};

resampledStores.forEach(function (store, idx) {

    /// CONFIGURATION OBJECT
    var modelConf = {
        stores: {
            //"sourceStore": resampledStore,
            //"predictionStore": Predictions,
            //"evaluationStore": Evaluation,
            "sourceStore": resampledStores[idx],
            "predictionStore": predictionStores[idx],
            "evaluationStore": evaluationStores[idx],
        },
        fields: [ // From this, feature space could be build.
            { name: "NumOfCars" },
            { name: "Gap" },
            { name: "Occupancy" },
            { name: "Speed" },
            { name: "TrafficStatus" },
        ],

        featureSpace: [
            { type: "constant", source: store.name, val: 1 },
            //{ type: "numeric", source: store.name, field: "Ema1", normalize: false },
            //{ type: "numeric", source: store.name, field: "Ema2", normalize: false },
            { type: "numeric", source: store.name, field: "Speed", normalize: false },
            { type: "numeric", source: store.name, field: "NumOfCars", normalize: false },
            { type: "numeric", source: store.name, field: "Gap", normalize: false },
            { type: "numeric", source: store.name, field: "Occupancy", normalize: false },
            { type: "numeric", source: store.name, field: "TrafficStatus", normalize: false },
            //{ type: "jsfunc", source: store.name, name: "AvrVal", fun: getAvrVal.getVal },
            { type: "jsfunc", source: store.name, name: "AvrVal", fun: avrVal.getVal },
        ],

        predictionFields: [ //TODO: Not sure, if I want to use names of fields or fields??
            { field: store.field("NumOfCars") },
            { field: store.field("Occupancy") },
            { field: store.field("Speed") },
        ],

        //ftrSpace: ftrSpace, //TODO: Later this will be done automatically

        target: store.field("NumOfCars"),

        otherParams: { // This are optional parameters
            evaluationOffset: 10, // It was 50 before
        },

        //predictionHorizons: [1, 3, 6, 9, 12, 15, 18],
        predictionHorizons: horizons,

        //recLinRegParameters: { "dim": ftrSpace.dim, "forgetFact": 1, "regFact": 10000 }, // Not used yet. //Have to think about it how to use this
        errorMetrics: [
            { name: "MAE", constructor: function () { return evaluation.newMeanAbsoluteError() } },
            { name: "RMSE", constructor: function () { return evaluation.newRootMeanSquareError() } },
            { name: "MAPE", constructor: function () { return evaluation.newMeanAbsolutePercentageError() } },
            { name: "R2", constructor: function () { return evaluation.newRSquareScore() } }
        ]
    }

    // Create model instances
    var mobisModel = Service.Mobis.Utils.model.newModel(modelConf);

    mobisModel["sourceStore"] = modelConf.stores.sourceStore;
    mobisModel["predictionStore"] = modelConf.stores.predictionStore;
    mobisModel["evaluationStore"] = modelConf.stores.evaluationStore;

    console.log("Initializing mobisModels...");
    console.log("sourceStore: " + mobisModel.sourceStore.name);
    console.log("predictionStore: " + mobisModel.predictionStore.name);
    console.log("evaluationStore: " + mobisModel.evaluationStore.name);

    //mobisModels.put(mobisModel.sourceStore.name, mobisModel);
    mobisModels[mobisModel.sourceStore.name] = mobisModel;
});

//////////////////////////// PREDICTION AND EVALUATION ////////////////////////////

//resampledStore.addStreamAggr({
resampledStores.forEach( function (store) {
    store.addStreamAggr({
    name: "analytics",
    onAdd: function (rec) {
        //console.log("\nWorking on rec from: " +  rec.$store.name + ". \nDateTime: "+ rec.DateTime.string + "\n");
        //printj(rec.toJSON(true));
        //eval(breakpoint)
        //if (rec.$id % 100 == 0) {
        //    console.log("== 100 records down ==");
        //    eval(breakpoint)
        //};

        //var predictions = mobisModel.predict(rec);    
        //printj(predictions);

        //mobisModel = mobisModels.get(rec.$store.name);
        mobisModel = mobisModels[rec.$store.name];
        //mobisModel = mobisModels.get(resampledStore.name);
        //console.log("mobisModel selected: " + mobisModel.sourceStore.name);
        //eval(breakpoint)

        mobisModel.predict(rec);
        //var pred = mobisModel.predict(rec);
        //printj(pred);

        mobisModel.update(rec);

        mobisModel.evaluate(rec);
        //var eval = mobisModel.evaluate(rec);
        //printj(eval);

        //mobisModel.consoleReport(rec);

        //console.log("\n\n\n------ CONSOLE MODE -------");
        //eval(breakpoint);
    },
    saveJson: function () { }
    })
});

//// Load Stores from log files
//Service.Mobis.Utils.Stores.loadStores();

// Imports data from loadstores according to timestamp
//var loadStores = [trafficLoadStore, weatherLoadStore, eventLogsLoadStore];
var loadStores = [trafficLoadStore];
//var targetStores = [trafficStore, weatherStore, eventLogsStore];
var targetStores = [trafficStores];

//Service.Mobis.Utils.Data.importData(loadStores, targetStores, 100);
Service.Mobis.Utils.Data.importData(loadStores, targetStores, 10000);
//Service.Mobis.Utils.Data.importData(loadStores, targetStores, 50000);
//Service.Mobis.Utils.Data.importData(loadStores, targetStores);

// DEBUGGING
//console.log("Console mode...")
//eval(breakpoint)

var getLatestEvalRec = function () {
    var maxHorizon = horizons.indexOf(Math.max.apply(null, horizons));
    var lastEvaluatedRecId = resampledStore.getStreamAggr(RecordBuffers[maxHorizon].name).val.oldest.$id;
    return resampledStore[lastEvaluatedRecId]; //last record with evaluations for all horizons
}

var visualize = function (htmlName, displayParam, _source) {
    viz.makeHighChartsTemplate(htmlName, 2);
    var store = qm.store(_source);

    var converterParams = {
        timeField: "DateTime",
        fields: [
            { name: "Actual", get: function (rec) { return rec[displayParam] }, getTm: function (rec) { return rec.DateTime } },
            { name: "Predicted", get: function (rec) { return rec.Predictions[0][displayParam] }, getTm: function (rec) { return rec.Predictions[0].PredictionTime } },
        ]
    }

    //if (fs.exists(htmlName)) { fs.del(htmlName); }
    ////if (fs.exists("flowSimple.html")) { fs.del("flowSimple.html"); }
    ////viz.drawHighChartsTimeSeries(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: localized linear regression models" }, chart: { type: 'spline', zoomType: 'x' }, });
    ////viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: localized linear regression models" }, chart: { type: 'spline', zoomType: 'x' }, });
    //viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(30), 2)), htmlName, { title: { text: "Predictions: 1h" }, chart: { type: 'spline', zoomType: 'x' }, colors: ['#74d8da', '#0a5a8c'] });

    //viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), htmlName, { title: { text: "Predictions: 1h" }, chart: { type: 'spline', zoomType: 'x' }, colors: ['#74d8da', '#0a5a8c'] });
    viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterPro(converterParams, toJSON(store.tail(30), 2)), htmlName, { title: { text: "Predictions: 1h" }, chart: { type: 'spline', zoomType: 'x' }, colors: ['#74d8da', '#0a5a8c'] });

    var converterParams = {
        timeField: "DateTime",
        fields: [
            { name: "Actual", get: function (rec) { return rec[displayParam] }, getTm: function (rec) { return rec.DateTime } },
            { name: "Predicted", get: function (rec) { return rec.Predictions[6][displayParam] }, getTm: function (rec) { return rec.Predictions[6].PredictionTime } },
        ]
    }

    ////viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: errors" }, chart: { type: 'spline', zoomType: 'x' }, });
    //viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), htmlName, { title: { text: "Predictions: 18h" }, chart: { type: 'spline', zoomType: 'x' }, colors: ['#74d8da', '#0a5a8c'] });
    viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterPro(converterParams, toJSON(store.tail(30), 2)), htmlName, { title: { text: "Predictions: 18h" }, chart: { type: 'spline', zoomType: 'x' }, colors: ['#74d8da', '#0a5a8c'] });

    //var getLatestEvalRec = function () {
    //    var maxHorizon = horizons.indexOf(Math.max.apply(null, horizons));
    //    var lastEvaluatedRecId = resampledStore.getStreamAggr(RecordBuffers[maxHorizon].name).val.oldest.$id;
    //    return resampledStore[lastEvaluatedRecId]; //last record with evaluations for all horizons
    //}

    ////TODO: this could as well be automatized
    //var converterParams = {
    //    fields: [
    //        { name: displayParam[0].field.name, get: function (rec) { try { return rec.Evaluation[0][displayParam[0].field.name] } catch (err) { return null } } },
    //        { name: displayParam[1].field.name, get: function (rec) { try { return rec.Evaluation[0][displayParam[1].field.name] } catch (err) { return null } } },
    //        { name: displayParam[2].field.name, get: function (rec) { try { return rec.Evaluation[0][displayParam[2].field.name] } catch (err) { return null } } },
    //    ]        
    //}
    //////viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: errors" }, chart: { type: 'spline', zoomType: 'x' }, });
    //viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterColumn(converterParams, toJSON(getLatestEvalRec(), 2)), htmlName,
    //    {
    //        title: { text: "Model Comparisons" }, chart: { type: 'column' }, xAxis: { categories: horizons, title: { text: 'Horizon' } },
    //        yAxis: { min: 0, title: { text: 'MAE' } }, plotOptions: {
    //            column: {
    //                pointPadding: 0.2, borderWidth: 0, dataLabels: {
    //                    enabled: true, rotation: -90, align: 'left', x: 4, y: -10, format: '{point.y:.1f}'
    //                }
    //            }
    //        },
    //    });

    //var converterParams = {
    //    fields: [
    //        { name: displayParam[0].field.name, get: function (rec) { try { return rec.Evaluation[3][displayParam[0].field.name] } catch (err) { return null } } },
    //        { name: displayParam[1].field.name, get: function (rec) { try { return rec.Evaluation[0][displayParam[1].field.name] } catch (err) { return null } } },
    //        { name: displayParam[2].field.name, get: function (rec) { try { return rec.Evaluation[0][displayParam[2].field.name] } catch (err) { return null } } },
    //    ]
    //}
    //////viz.drawHighChartsTimeSeries2(viz.highchartsConverterPro(converterParams, toJSON(resampledStore.tail(300), 2)), "flowSimple.html", { title: { text: "Flow predictions: errors" }, chart: { type: 'spline', zoomType: 'x' }, });
    //viz.drawMultipleHighChartsTimeSeries(viz.highchartsConverterColumn(converterParams, toJSON(getLatestEvalRec(), 2)), htmlName,
    //    {
    //        title: { text: "Model Comparisons" }, chart: { type: 'column' }, xAxis: { categories: horizons, title: { text: 'Horizon' } },
    //        yAxis: { min: 0, title: { text: 'R2' } }, plotOptions: {
    //            column: {
    //                pointPadding: 0.2, borderWidth: 0, dataLabels: {
    //                    enabled: true, rotation: -90, align: 'left', x: 4, y: -10, format: '{point.y:.3f}'
    //                }
    //            }
    //        },
    //    });
}


////var htmlName = "Occupancy.html"
//var htmlName = modelConf.target.name + ".html";
////var displayParam = modelConf.target.name; //TODO: this cannot work anymore. Update this part
////var displayParam = "NumOfCars";
//var displayParams = modelConf.predictionFields
//visualize(htmlName, displayParams);

//////////////////////////// ONLINE (REST) SERVICES ////////////////////////////
// Query records
http.onGet("query", function (req, resp) {
    jsonData = JSON.parse(req.args.data);
    console.say("" + JSON.stringify(jsonData));
    var recs = qm.search(jsonData);
    return http.jsonp(req, resp, recs);
});

// Example1: http://localhost:8080/TrafficPrediction/makeOfflineGraph htmlName default is "graph".
// Example2: http://localhost:8080/TrafficPrediction/makeOfflineGraph?htmlName=test Set htmlName
// Example3: http://localhost:8080/TrafficPrediction/makeOfflineGraph?htmlName=Flow&displayParam=NumOfCars Set htmlName
// Example4: http://localhost:8080/TrafficPrediction/makeOfflineGraph?htmlName=Test&displayParam=NumOfCars&id=0011_11 Set htmlName
http.onGet("makeOfflineGraph", function (req, resp) {

    var htmlName = (req.args.htmlName != null) ? req.args.htmlName[0] : "graph";
    htmlName = htmlName.concat(".html");
    console.log("htmlName: " + htmlName)

    var displayParam = (req.args.displayParam != null) ? req.args.displayParam[0] : "NumOfCars";
    //console.log("displayParam: " + displayParam)

    var id = (req.args.id != null) ? req.args.id[0] : "0011_11";
    id = id.replace("-", "_"); // Just in case..
    var source = "resampledStore_" + id;
    console.log("source: " + source)

    visualize(htmlName, displayParam, source);

    var msg = "Ok.";
    //console.log(msg);
    return http.jsonp(req, resp, msg);
});

////client page with the visualization: http://localhost:8080/www/client.html
// Example1: http://localhost:8080/TrafficPrediction/makeOnlineGraph default is displayParam:NumOfCars, id:0011_11
// Example2: http://localhost:8080/TrafficPrediction/makeOnlineGraph?displayParam=NumOfCars Set htmlName
// Example3: http://localhost:8080/TrafficPrediction/makeOnlineGraph?displayParam=NumOfCars&id=0011_11
// Example4: http://localhost:8080/TrafficPrediction/makeOnlineGraph?displayParam=NumOfCars&id=0011_11&numOfRecs=30
// Example4: http://localhost:8080/TrafficPrediction/makeOnlineGraph?displayParam=NumOfCars&id=0011_11&evaluation=true
http.onGet("makeOnlineGraph", function (req, resp) {

    var displayParam = (req.args.displayParam != null) ? req.args.displayParam[0] : "NumOfCars";
    //console.log("displayParam: " + displayParam)

    var id = (req.args.id != null) ? req.args.id[0] : "0011_11";
    id = id.replace("-", "_"); // Just in case..
    var source = "resampledStore_" + id;
    //console.log("source: " + source)

    var numOfRecs = (req.args.numOfRecs != null) ? req.args.numOfRecs[0] : 120; //default record size to return is 30
    //console.log("numOfRecs: " + numOfRecs);

    var store = qm.store(source);

    // parameter converter used for traffic data predictions
    var converterParams = {
        timeField: "DateTime",
        fields: [
            { name: "Actual", get: function (rec) { return rec[displayParam] }, getTm: function (rec) { return rec.DateTime } },
            { name: "Predicted", get: function (rec) { return rec.Predictions[0][displayParam] }, getTm: function (rec) { return rec.Predictions[0].PredictionTime } },
        ]
    }
    res = viz.highchartsConverterPro(converterParams, toJSON(store.tail(numOfRecs).reverse(), 2))

    //if (req.args.evaluation != null) {
    //    // parameter converter used for evalueation of predictions
    //    var converterParams = {
    //        fields: [
    //            { name: "MAE (" + displayParam + ")", get: function (rec) { try { return rec.Evaluation[0][displayParam] } catch (err) { return null } } },
    //            { name: "MAPE (" + displayParam + ")", get: function (rec) { try { return rec.Evaluation[2][displayParam] } catch (err) { return null } } },
    //            { name: "R2 (" + displayParam + ")", get: function (rec) { try { return rec.Evaluation[3][displayParam] } catch (err) { return null } } },
    //        ]
    //    }
    //    try {
    //        res = viz.highchartsConverterColumn(converterParams, toJSON(getLatestEvalRec(), 2));
    //    } catch (err) {
    //        res = "Pocak mal! ERROR: " + err;
    //    }
    //}

    return http.jsonp(req, resp, res);
});

http://localhost:8080/TrafficPrediction/debug
http.onGet("debug", function (req, resp) {
    console.log("Debug mode...");
    eval(breakpoint);
    return http.jsonp(req, resp, "Debug mode...");
})

// Example1: http://localhost:8080/TrafficPrediction/importData?data={"speed":60}
http.onGet("importData", function (req, resp) {
    try {
        var rec = JSON.parse(req.args.data);
        //console.say("Recieved:\n" + JSON.stringify(rec, undefined, 2));

        //TODO: Logic to add recieved store to correct store. 
        id = rec.measuredBy.Name.replace("-", "_");
        trafficStore = qm.store("trafficStore_" + id);

        //console.log("Getting rec with id: " + id);
        //console.log("Saving it to store: " + trafficStore.name);

        // Moving rec to appropriate store
        //trafficStore.add(rec.toJSON(true));
        trafficStore.add(rec);

        resp.setStatusCode(200);
        return http.jsonp(req, resp, "OK");
    }
    catch (err) {
        console.log("Error", err);

        resp.setStatusCode(404);
        return http.jsonp(req, resp, "Error");
    }
});


//http.onGet("resampledStore", function (req, resp) {
//    var store = qm.store("resampledStore");
//    var depth = 0;
//    depth = (req.args.printJoins == "true") ? 1 : 0;
//    if (req.args.depth != null) { depth = req.args.depth; }
//    // convert to json
//    var recs = toJSON(store.recs, depth);
//    return http.jsonp(req, resp, recs);
//});

// Resampled store with measurements
// Example1: http://localhost:8080/TrafficPrediction/demo No predictions are seen.
// Example2: http://localhost:8080/TrafficPrediction/demo?printJoins=true With predictions. (Optional parameter that sets )
// Example3: http://localhost:8080/TrafficPrediction/demo?printJoins=true&depth=2 With evalueations.
http.onGet("demo", function (req, resp) {
    //var store = qm.store("resampledStore");
    var store = resampledStores[0];
    var depth = 0;
    depth = (req.args.printJoins == "true") ? 1 : 0;
    if (req.args.depth != null) { depth = req.args.depth; }

    // If id is given, find that store.
    if (req.args.id != null) {
        var id = req.args.id[0];
        id = id.replace("-", "_"); // Just in case..
        // Get store from Id
        var key = "resampledStore_" + id;
        if (mobisModels.hasOwnProperty(key)) {
            model = mobisModels[key];
            store = model.sourceStore;
        } else {
            resp.setStatusCode(400);
            resp.send("ERROR: Wrong id!");
        }
    }
    
    // convert to json
    var recs = toJSON(store.tail(100), depth);
    return http.jsonp(req, resp, recs);
});

// Example1: http://localhost:8080/TrafficPrediction/evaluation No predictions are seen.
// Example1: http://localhost:8080/TrafficPrediction/evaluation?id=0011_11
http.onGet("evaluation", function (req, resp) {
    var store = resampledStores[0];
    var depth = 2;
    if (req.args.depth != null) { depth = req.args.depth; }
    var maxHorizon = horizons.indexOf(Math.max.apply(null, horizons));

    // If id is given, find that store.
    if (req.args.id != null) {
        var id = req.args.id[0];
        id = id.replace("-", "_"); // Just in case..
        // Get store from Id
        var key = "resampledStore_" + id;
        if (mobisModels.hasOwnProperty(key)) {
            model = mobisModels[key];
            store = model.sourceStore;
        } else {
            resp.setStatusCode(400);
            resp.send("ERROR: Wrong id!");
        }
    }

    var lastEvaluatedRecId = store.getStreamAggr(RecordBuffers[maxHorizon].name).val.oldest.$id;
    var lastEvaluatedRec = store[lastEvaluatedRecId]; //last record with evaluations for all horizons
    var rec = toJSON(lastEvaluatedRec, depth);
    return http.jsonp(req, resp, rec)
});

// Resampled store with measurements
// Example1: http://localhost:8080/MoreSensors/predictions
// Example2: http://localhost:8080/MoreSensors/predictions?depth=1
http.onGet("predictions", function (req, resp) {
    var depth = (req.args.depth == null) ? 0 : req.args.depth;
    var recs = [];
    resampledStores.forEach(function (store) {
        recs.push(toJSON(store.last, depth));
    })
    return http.jsonp(req, resp, recs);
});

// Resampled store with measurements
// Example1: http://localhost:8080/MoreSensors/prediction?id=0011_11
// Example1: http://localhost:8080/MoreSensors/prediction?id=0011_11&horizon=1
http.onGet("prediction", function (req, resp) {
    var id = null;
    var horizon = null;
    var model = null;
    var rec = null;

    // If id and horizon are not defined
    if (req.args.id == null && req.args.horizon == null) {
        var recs = [];
        resampledStores.forEach(function (store) {
            recs.push(toJSON(store.last, 1));
        })
        return http.jsonp(req, resp, recs);
    }

    // Get Id from input arguments
    if (req.args.id != null) {
        id = req.args.id[0];
        //console.log("DEBUG")
        //eval(breakpoint)
        id = id.replace("-", "_"); // Just in case..
    } else {
        //resp.setStatusCode(400);
        //resp.send("ERROR: Wrong argument.");
    }

    // Get model from Id
    var key = "resampledStore_" + id;
    if (mobisModels.hasOwnProperty(key)) {
        model = mobisModels[key];
        rec = toJSON(model.sourceStore.last, 1);
    } else {
        resp.setStatusCode(400);
        resp.send("ERROR: Wrong id!");
    }

    // Get prediction horizon
    if (req.args.horizon != null) {
        horizon = parseInt(req.args.horizon);
        var predictionIdx = model.horizons.indexOf(horizon);
        if (predictionIdx != -1) {
            rec = rec.Predictions[predictionIdx]
        }
    }




    return http.jsonp(req, resp, rec);
});