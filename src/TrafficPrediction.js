var analytics = require('analytics.js');
var evaluation = require('evaluation.js')

// Import modules from lib
var Service = {}; Service.Mobis = {}; Service.Mobis.Utils = {};
Service.Mobis.Loop = require('Service/Mobis/Loop/preprocLoop.js');
Service.Mobis.Weather = require('Service/Mobis/Weather/preprocWeather.js');
Service.Mobis.Events = require('Service/Mobis/Events/preprocEvents.js');
Service.Mobis.Utils.Data = require('Service/Mobis/Utils/importData.js');
Service.Mobis.Utils.Stores = require('Service/Mobis/Utils/defineStores.js');
Service.Mobis.Utils.Stat = require('Service/Mobis/Utils/stat.js');
Service.Mobis.Utils.Baseline = require('Service/Mobis/Utils/baselinePredictors.js');
Service.Mobis.Utils.Ftr = require('Service/Mobis/Utils/specialDays.js');
Service.Mobis.Utils.HistVals = require('Service/Mobis/Utils/histVals.js');
Service.Mobis.Utils.OnlineSVMR = require('Service/Mobis/Utils/svmRegression.js');

// Create instances for Mean Absolute Error
var speedLimitMAE = evaluation.newMeanAbsoluteError();
//var speedLimitMAE = Service.Mobis.Utils.Stat.newMeanAbsoluteError();
var avrValMAE = Service.Mobis.Utils.Stat.newMeanAbsoluteError();
var prevValMAE = Service.Mobis.Utils.Stat.newMeanAbsoluteError();
var linregMAE = Service.Mobis.Utils.Stat.newMeanAbsoluteError();
var ridgeRegMAE = Service.Mobis.Utils.Stat.newMeanAbsoluteError();
var svmrMAE = Service.Mobis.Utils.Stat.newMeanAbsoluteError();
var nnMAE = Service.Mobis.Utils.Stat.newMeanAbsoluteError();
var knnMAE = Service.Mobis.Utils.Stat.newMeanAbsoluteError();
var avr = Service.Mobis.Utils.Baseline.newAvrVal();
var histVals = Service.Mobis.Utils.HistVals.newHistoricalVals(5);

// Loads stores and import data
Service.Mobis.Utils.Stores.defineStores();
var CounterNode = qm.store("CounterNode");
var trafficLoadStore = qm.store('trafficLoadStore');
var trafficStore = qm.store('trafficStore');
//var trafficStore2 = qm.store('trafficStore2');
//var trafficStoreNoDuplicates = qm.store('trafficStoreNoDuplicates');
var weatherLoadStore = qm.store('weatherLoadStore');
var weatherStore = qm.store('weatherStore');
var mergedStore = qm.store('mergedStore');
var resampledStore = qm.store('resampledStore');
var eventLoadStore = qm.store("eventLoadStore");
var eventStore = qm.store("eventStore");
var eventLogsLoadStore = qm.store("eventLogsLoadStore");
var eventLogsStore = qm.store("eventLogsStore");

// Constructor for special days feature extractor
var slovenianHolidayFtr = new Service.Mobis.Utils.Ftr.specialDaysFtrExtractor("Slovenian_holidays");
var fullMoonFtr = new Service.Mobis.Utils.Ftr.specialDaysFtrExtractor("Full_moon");


///////////////////// PREPROCESSING FOR TRAFFIC DATA SOURCE /////////////////////
// Replaces incorect speed values, with avr value
trafficStore.addStreamAggr({
    name: "makeCleanSpeedNoCars",
    onAdd: Service.Mobis.Loop.makeCleanSpeedNoCars(avr),
    saveJson: function () { }
});

//// Calls function that adds field DateTime in String format that is set to primary (unique)
//trafficStore.addStreamAggr({
//    name: "markAsDuplicate",
//    //onAdd: Service.Mobis.Loop.addPrimaryField(trafficStoreNoDuplicates)
//    onAdd: Service.Mobis.Loop.markAsDuplicate(),
//    saveJson: function () { }
//});

//var streamInterval = 5 * 60; // timestamp specified in seconds
//trafficStore.addStreamAggr({
//    name: "replaceMissingVals",
//    onAdd: Service.Mobis.Loop.replaceMissingVals(streamInterval, 1, "hour"), //this should be changed to "day" later
//    saveJson: function () { }
//});


/////////////////////////// PREPROCESSING FOR WEATHER ///////////////////////////
weatherStore.addStreamAggr({
    name: "discretizeIcon",
    onAdd: Service.Mobis.Weather.discretizeIcon(),
    //onAdd: Service.Mobis.Weather.discretizeIconToVec(),
    saveJson: function () { }
});


/////////////////////////// PREPROCESSING FOR EVENTS ///////////////////////////
eventStore.addStreamAggr({
    name: "roadPriorotyToFlt",
    onAdd: Service.Mobis.Events.makeRadPriorotyToFloat(),
    saveJson: function () { }
});

eventStore.addStreamAggr({
    name: "categorizeEventCause",
    onAdd: Service.Mobis.Events.makeEventCauseCategorization(),
    saveJson: function () { }
});

///////////////////////// MERGING DIFFERENT DATA SOURCES /////////////////////////
// This merger aggregator creates new merged store
qm.newStreamAggr({
    type: 'stmerger', name: 'merged',
    outStore: 'mergedStore', createStore: false,
    timestamp: 'DateTime',
    fields: [
        { source: 'trafficStore', inField: 'NumOfCars', outField: 'NumOfCars', interpolation: 'linear', timestamp: 'DateTime'},
        { source: 'trafficStore', inField: 'Gap', outField: 'Gap', interpolation: 'linear', timestamp: 'DateTime' },
        { source: 'trafficStore', inField: 'Occupancy', outField: 'Occupancy', interpolation: 'linear', timestamp: 'DateTime' },
        { source: 'trafficStore', inField: 'Speed', outField: 'Speed', interpolation: 'linear', timestamp: 'DateTime' },
        //{ source: { store: 'trafficStore', join: 'measuredBy' }, inField: 'MaxSpeed', outField: 'Speed', interpolation: 'linear', timestamp: 'DateTime' },
        { source: 'trafficStore', inField: 'TrafficStatus', outField: 'TrafficStatus', interpolation: 'linear', timestamp: 'DateTime' },
        { source: 'weatherStore', inField: 'temperature', outField: 'temperature', interpolation: 'linear', timestamp: 'time' },
        { source: 'weatherStore', inField: 'visibility', outField: 'visibility', interpolation: 'linear', timestamp: 'time' },
        { source: 'weatherStore', inField: 'icon', outField: 'visibility', interpolation: 'previous', timestamp: 'time' },
        { source: 'weatherStore', inField: 'clearDay', outField: 'clearDay', interpolation: 'previous', timestamp: 'time' },
        { source: 'weatherStore', inField: 'clearNight', outField: 'clearNight', interpolation: 'previous', timestamp: 'time' },
        { source: 'weatherStore', inField: 'rain', outField: 'rain', interpolation: 'previous', timestamp: 'time' },
        { source: 'weatherStore', inField: 'snow', outField: 'snow', interpolation: 'previous', timestamp: 'time' },
        { source: 'weatherStore', inField: 'sleet', outField: 'sleet', interpolation: 'previous', timestamp: 'time' },
        { source: 'weatherStore', inField: 'wind', outField: 'wind', interpolation: 'previous', timestamp: 'time' },
        { source: 'weatherStore', inField: 'fog', outField: 'fog', interpolation: 'previous', timestamp: 'time' },
        { source: 'weatherStore', inField: 'cloudy', outField: 'cloudy', interpolation: 'previous', timestamp: 'time' },
        { source: 'weatherStore', inField: 'partlyCloudyDay', outField: 'partlyCloudyDay', interpolation: 'previous', timestamp: 'time' },
        { source: 'weatherStore', inField: 'parltlyCloudyNight', outField: 'parltlyCloudyNight', interpolation: 'previous', timestamp: 'time' },
        { source: { store: 'eventLogsStore', join: 'EventInfo' }, inField: 'Priority', outField: 'Priority', interpolation: 'previous', timestamp: 'EsperTime' },
        { source: { store: 'eventLogsStore', join: 'EventInfo' }, inField: 'RoadPriorityFlt', outField: 'RoadPriorityFlt', interpolation: 'previous', timestamp: 'EsperTime' },
        { source: { store: 'eventLogsStore', join: 'EventInfo' }, inField: 'TrafficJam', outField: 'TrafficJam', interpolation: 'previous', timestamp: 'EsperTime' },
        { source: { store: 'eventLogsStore', join: 'EventInfo' }, inField: 'RoadClosure', outField: 'RoadClosure', interpolation: 'previous', timestamp: 'EsperTime' },
        { source: { store: 'eventLogsStore', join: 'EventInfo' }, inField: 'TrafficAccident', outField: 'TrafficAccident', interpolation: 'previous', timestamp: 'EsperTime' },
        { source: { store: 'eventLogsStore', join: 'EventInfo' }, inField: 'OtherEvents', outField: 'OtherEvents', interpolation: 'previous', timestamp: 'EsperTime' },
        { source: { store: 'eventLogsStore', join: 'EventInfo' }, inField: 'Ice', outField: 'Ice', interpolation: 'previous', timestamp: 'EsperTime' },
        { source: { store: 'eventLogsStore', join: 'EventInfo' }, inField: 'Roadworks', outField: 'Roadworks', interpolation: 'previous', timestamp: 'EsperTime' },
        { source: { store: 'eventLogsStore', join: 'EventInfo' }, inField: 'Wind', outField: 'Wind', interpolation: 'previous', timestamp: 'EsperTime' },
        { source: { store: 'eventLogsStore', join: 'EventInfo' }, inField: 'NoFreightTraffic', outField: 'NoFreightTraffic', interpolation: 'previous', timestamp: 'EsperTime' },
        { source: { store: 'eventLogsStore', join: 'EventInfo' }, inField: 'Snow', outField: 'Snow', interpolation: 'previous', timestamp: 'EsperTime' },
    ]
});

//////////////////////////// RESAMPLING MERGED STORE ////////////////////////////
// This resample aggregator creates new resampled store
var resampleInterval = 10 * 60 * 1000;
mergedStore.addStreamAggr({
    name: "Resampled", type: "resampler",
    outStore: resampledStore.name, timestamp: "DateTime",
    fields: [{ name: "NumOfCars", interpolator: "linear" },
             { name: "Gap", interpolator: "linear" },
             { name: "Occupancy", interpolator: "linear" },
             { name: "Speed", interpolator: "linear" },
             { name: "TrafficStatus", interpolator: "linear" },
             { name: "temperature", interpolator: "linear" },
             { name: "visibility", interpolator: "linear" },
             { name: "Priority", interpolator: "linear" }
    ],
    createStore: false, interval: resampleInterval
});

//////////////////////////////// MORE AGREGATES //////////////////////////////////
// insert testStoreResampled store aggregates
resampledStore.addStreamAggr({
    name: "tick", type: "timeSeriesTick",
    timestamp: "DateTime", value: "Speed"
});
resampledStore.addStreamAggr({
    name: "Ema1", type: "ema", inAggr: "tick",
    emaType: "previous", interval: 30 * 60 * 1000, initWindow: 10 * 60 * 1000
});
resampledStore.addStreamAggr({
    name: "Ema2", type: "ema", inAggr: "tick",
    emaType: "previous", interval: 120 * 60 * 1000, initWindow: 10 * 60 * 1000
});

// Buffer defines for how many records infront prediction will be learned
resampledStore.addStreamAggr({ name: "delay", type: "recordBuffer", size: 7 });

////////////////////////////// DEFINING FEATURE SPACE //////////////////////////////
// define features
var features = [
    { type: "constant", source: resampledStore.name, val: 1 },
    { type: "jsfunc", source: resampledStore.name, name: "slovanianHolidays", dim: 1, fun: slovenianHolidayFtr.getFtr },
    { type: "jsfunc", source: resampledStore.name, name: "foolMoon", dim: 1, fun: fullMoonFtr.getFtr },
    { type: "jsfunc", source: resampledStore.name, name: "historicalValues", dim: histVals.getSize(), fun: histVals.getVals },
    { type: "numeric", source: resampledStore.name, field: "Speed", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Ema1", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Ema2", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "NumOfCars", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Gap", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Occupancy", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "TrafficStatus", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "temperature", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "visibility", normalize: false },
    { type: "multinomial", source: resampledStore.name, field: "DateTime", datetime: true }
];
// Feature extractors for feature space
var ftrSpace = analytics.newFeatureSpace(features);


///////////////// INITIALIZING ANALYTIC ALGORITHMS FOR PREDICTION //////////////////
// Initialize analytics
//var avr = Service.Mobis.Utils.Baseline.newAvrVal();
var linreg = analytics.newRecLinReg({ "dim": ftrSpace.dim, "forgetFact": 0.98, "regFact": 10000 });
var ridgeRegression = new analytics.ridgeRegression(10000, ftrSpace.dim);
//var svmr = Service.Mobis.Utils.OnlineSVMR.newSvmRegression(ftrSpace.dim, { "c": 0.01, "eps": 0.00001, "maxTime": 0.1, "maxIterations": 100000, batchSize: 100}, 10);
var NN = analytics.newNN({ "layout": [ftrSpace.dim, 4, 1], "tFuncHidden": "sigmoid", "tFuncOut": "linear", "learnRate": 0.2, "momentum": 0.2 });
var knn = analytics.newKNearestNeighbors(3, 100);

//////////////////////////// PREDICTION AND EVALUATION ////////////////////////////
resampledStore.addTrigger({
    onAdd: function (rec) {
        // Adds ema-s to rec
        rec.Ema1 = resampledStore.getStreamAggr("Ema1").val.Val;
        rec.Ema2 = resampledStore.getStreamAggr("Ema2").val.Val;

        //console.log("\nRec for time: " + rec.DateTime.string);
        //ftrSpace.ftrVec(rec).print()
        //console.startx(function (x) { return eval(x); })
        //console.log("X cols for SVMR: " + knn.X.cols)
        //knn.X.print()
        //console.start()

        histVals.update(rec.Speed);
        // Predict and add to rec
        rec.SpeedLimit = 50;
        rec.PrevValPred = rec.Speed;
        rec.AvrValPred = avr.getAvr();
        rec.LinregPred = linreg.predict(ftrSpace.ftrVec(rec));
        rec.RidgeRegPred = ridgeRegression.predict(ftrSpace.ftrVec(rec));
        //rec.SvmrPred = svmr.predict(ftrSpace.ftrVec(rec));
        rec.NNPred = NN.predict(ftrSpace.ftrVec(rec)).at(0);
        rec.KNNPred = knn.predict(ftrSpace.ftrVec(rec));

        // Get rec for training
        trainRecId = resampledStore.getStreamAggr("delay").val.first;

        // Add target for batch method
        resampledStore.add({ $id: trainRecId, Target: rec.Speed });

        if (trainRecId > 0) {
            // update models
            linreg.learn(ftrSpace.ftrVec(resampledStore[trainRecId]), rec.Speed);
            //svmr.learn(ftrSpace.ftrVec(resampledStore[trainRecId]), rec.Speed);
            ridgeRegression.addupdate(ftrSpace.ftrVec(resampledStore[trainRecId]), rec.Speed);
            NN.learn(ftrSpace.ftrVec(resampledStore[trainRecId]), la.newVec([rec.Speed]));
            avr.update(resampledStore[trainRecId].Speed);
            knn.update(ftrSpace.ftrVec(resampledStore[trainRecId]), rec.Speed);

            console.log("Speed:" + rec.Speed);
            console.log("SpeedLimit: " + 50.0);
            console.log("AvrVal: " + resampledStore[trainRecId].AvrValPred);
            console.log("PrevVal: " + resampledStore[trainRecId].PrevValPred);
            console.log("LinReg: " + resampledStore[trainRecId].LinregPred);
            console.log("RidgeReg: " + resampledStore[trainRecId].RidgeRegPred);
            console.log("Svmr: " + resampledStore[trainRecId].SvmrPred);
            console.log("NN: " + resampledStore[trainRecId].NNPred);
            console.log("KNN: " + resampledStore[trainRecId].KNNPred + "\n");

            // skip first few iterations because the error of svmr is to high
            if (rec.$id > 30) {
                // Calculate mean
                speedLimitMAE.update(rec.Speed - resampledStore[trainRecId].SpeedLimit)
                avrValMAE.update(rec.Speed - resampledStore[trainRecId].AvrValPred);
                prevValMAE.update(rec.Speed - resampledStore[trainRecId].Speed);
                linregMAE.update(rec.Speed - resampledStore[trainRecId].LinregPred);
                ridgeRegMAE.update(rec.Speed - resampledStore[trainRecId].RidgeRegPred);
                svmrMAE.update(rec.Speed - resampledStore[trainRecId].SvmrPred);
                nnMAE.update(rec.Speed - resampledStore[trainRecId].NNPred);
                knnMAE.update(rec.Speed - resampledStore[trainRecId].KNNPred);
            }
        }
        // Write errors to store
        rec.SpeedLimitMAE = speedLimitMAE.getError();
        rec.PrevValPredMAE = avrValMAE.getError();
        rec.AvrValPredMAE = prevValMAE.getError();
        rec.LinregPredMAE = linregMAE.getError();
        rec.RidgeRegPredMAE = ridgeRegMAE.getError();
        rec.SvmrPredMAE = svmrMAE.getError();
        rec.NNPredMAE = nnMAE.getError();
        rec.KNNPredMAE = knnMAE.getError();

        // Write errors to console
        console.log("Working with rec: " + rec.DateTime.string);
        console.log("SpeedLimit MAE Error: " + speedLimitMAE.getError());
        console.log("AvrVal MAE Error: " + avrValMAE.getError());
        console.log("PrevVal MAE Error: " + prevValMAE.getError());
        console.log("LinReg MAE Error: " + linregMAE.getError());
        console.log("RidgeReg MAE Error: " + ridgeRegMAE.getError());
        console.log("Svmr MAE Error: " + svmrMAE.getError());
        console.log("NN MAE Error: " + nnMAE.getError());
        console.log("KNN MAE Error: " + knnMAE.getError() + "\n");

    }
});

//Load all records from eventLoadStore to eventStore so that the trigers will be triggered
for (var ii = 0; ii < eventLoadStore.length - 1; ii++) {
    var currentRec = eventLoadStore[ii];
    var val = currentRec.toJSON(true);
    delete val.$id;
    eventStore.add(val);
}

// Imports data from loadstores according to timestamp
var loadStores = [trafficLoadStore, weatherLoadStore, eventLogsLoadStore];
var targetStores = [trafficStore, weatherStore, eventLogsStore];
Service.Mobis.Utils.Data.importData(loadStores, targetStores);

// DEBUGGING
console.start()


//////////////////////////// ONLINE (REST) SERVICES ////////////////////////////
// Query records
http.onGet("query", function (req, resp) {
    jsonData = JSON.parse(req.args.data);
    console.say("" + JSON.stringify(jsonData));
    var recs = qm.search(jsonData);
    return http.jsonp(req, resp, recs);
});