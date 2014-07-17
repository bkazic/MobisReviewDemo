var analytics = require('analytics.js');

// Import modules
var Utils = {};
Utils.Data = require('Utils/importData.js');
Utils.Stores = require('Utils/defineStores.js');
Utils.Stat = require('Utils/stat.js');
Utils.Baseline = require('Utils/baselinePredictors.js');

// Create instances for Mean Absolute Error
var speedLimitMAE = Utils.Stat.newMeanAbsoluteError();
var avrValMAE = Utils.Stat.newMeanAbsoluteError();
var prevValMAE = Utils.Stat.newMeanAbsoluteError();
var linregMAE = Utils.Stat.newMeanAbsoluteError();
var ridgeRegMAE = Utils.Stat.newMeanAbsoluteError();
var svmrMAE = Utils.Stat.newMeanAbsoluteError();
var nnMAE = Utils.Stat.newMeanAbsoluteError();
var knnMAE = Utils.Stat.newMeanAbsoluteError();

// Loading store for counter Nodes
var scriptNm = process.scriptNm;
var filename_counters = "./sandbox/" + scriptNm + "/countersNodes.txt";
var CounterNode = qm.store("CounterNode");
qm.load.jsonFile(CounterNode, filename_counters);

// Define measurement store definition as a function so that it can be used several times 
var createTrafficStore = function (storeName, extraFields) {
    storeDef = [{
        "name": storeName,
        "fields": [
                { "name": "DateTime", "type": "datetime" },
                { "name": "NumOfCars", "type": "float", "null": true },
                { "name": "Gap", "type": "float", "null": true },
                { "name": "Occupancy", "type": "float", "null": true },
                { "name": "Speed", "type": "float", "null": true },
                { "name": "TrafficStatus", "type": "float", "null": true }
        ],
        "joins": [
            { "name": "measuredBy", "type": "field", "store": "CounterNode" }
        ]
    }];
    if (extraFields) {
        storeDef[0].fields = storeDef[0].fields.concat(extraFields);
    }
    qm.createStore(storeDef);
};

// Creating Store for measurements
createTrafficStore("trafficLoadStore");
createTrafficStore("trafficStore", [{ "name": "StringDateTime", "type": "string", "primary": true }]);

// Load measurements from file to store
var trafficLoadStore = qm.store('trafficLoadStore');
var trafficStore = qm.store('trafficStore');
//var filename_measurements = "./sandbox/" + scriptNm + "/oneday_measurements_0016_21.txt";
var filename_measurements = "./sandbox/" + scriptNm + "/onemonth_measurements_0016_21.txt";
qm.load.jsonFile(trafficLoadStore, filename_measurements);

// Define measurement store definition as a function so that it can be used several times 
var createWeatherStore = function (storeName, extraFields) {
    storeDef = [{
        "name": storeName,
        "fields": [
                { "name": "time", "type": "datetime" },
                { "name": "timeString", "type": "string", "null": true },
                { "name": "summary", "type": "string", "null": true },
                { "name": "icon", "type": "string", "null": true },
                { "name": "temperature", "type": "float", "null": true },
                { "name": "visibility", "type": "float", "null": true },
        ],
        "keys": [
                { "field": "timeString", "type": "value" }
        ]
    }];
    if (extraFields) {
        storeDef[0].fields = storeDef[0].fields.concat(extraFields);
    }
    qm.createStore(storeDef);
};
// create weather store
createWeatherStore("weatherLoadStore");
createWeatherStore("weatherStore", [{ "name": "StringDateTime", "type": "string", "primary": true }]);

// Load measurements from file to store
var weatherLoadStore = qm.store('weatherLoadStore');
var weatherStore = qm.store('weatherStore');
var filename_measurements = "./sandbox/" + scriptNm + "/weatherLog.txt";
qm.load.jsonFile(weatherLoadStore, filename_measurements);

// Define extra fields
var extraFields = [
            { "name": "summary", "type": "string", "null": true },
            { "name": "icon", "type": "string", "null": true },
            { "name": "temperature", "type": "float", "null": true },
            { "name": "visibility", "type": "float", "null": true },

            { "name": "Target", "type": "float", "null": true, "default": 0.0 },
            { "name": "Ema1", "type": "float", "null": true },
            { "name": "Ema2", "type": "float", "null": true },

            { "name": "SpeedLimit", "type": "float", "null": true },
            { "name": "PrevValPred", "type": "float", "null": true },
            { "name": "AvrValPred", "type": "float", "null": true },
            { "name": "LinregPred", "type": "float", "null": true },
            { "name": "RidgeRegPred", "type": "float", "null": true },
            { "name": "SvmrPred", "type": "float", "null": true },
            { "name": "NNPred", "type": "float", "null": true },
            { "name": "KNNPred", "type": "float", "null": true },

            { "name": "SpeedLimitMAE", "type": "float", "null": true },
            { "name": "PrevValPredMAE", "type": "float", "null": true },
            { "name": "AvrValPredMAE", "type": "float", "null": true },
            { "name": "LinregPredMAE", "type": "float", "null": true },
            { "name": "RidgeRegPredMAE", "type": "float", "null": true },
            { "name": "SvmrPredMAE", "type": "float", "null": true },
            { "name": "NNPredMAE", "type": "float", "null": true },
            { "name": "KNNPredMAE", "type": "float", "null": true },
]
createTrafficStore("resampledStore", extraFields);
var resampledStore = qm.store('resampledStore');

qm.addStreamAggr({
    type: 'stmerger',
    name: 'merged',
    outStore: 'resampledStore',
    createStore: false,
    timestamp: 'DateTime',
    mergingMapV: [
        { inStore: 'trafficStore', inField: 'NumOfCars', outField: 'NumOfCars', interpolation: 'linear' },
        { inStore: 'trafficStore', inField: 'Gap', outField: 'Gap', interpolation: 'linear' },
        { inStore: 'trafficStore', inField: 'Occupancy', outField: 'Occupancy', interpolation: 'linear' },
        { inStore: 'trafficStore', inField: 'Speed', outField: 'Speed', interpolation: 'linear' },
        { inStore: 'trafficStore', inField: 'TrafficStatus', outField: 'TrafficStatus', interpolation: 'linear' },
        { inStore: 'weatherStore', inField: 'temperature', outField: 'temperature', interpolation: 'linear' },
        { inStore: 'weatherStore', inField: 'visibility', outField: 'visibility', interpolation: 'linear' },
    ]
});

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

// define features
var features = [
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

// Initialize analytics
var avr = Utils.Baseline.newAvrVal();
var linreg = analytics.newRecLinReg({ "dim": ftrSpace.dim, "forgetFact": 0.98, "regFact": 10000 });
var ridgeRegression = new analytics.ridgeRegression(10000, ftrSpace.dim);
//var svmr = Utils.Svmr.newSvmRegression(features, resampledStore.field("Target"), 100, { "c": 2.0, "eps": 1.0 });
var NN = analytics.newNN({ "layout": [ftrSpace.dim, 4, 1], "tFuncHidden": "sigmoid", "tFuncOut": "linear", "learnRate": 0.2, "momentum": 0.2 });
var knn = analytics.newKNearestNeighbors(2, 100, 1);


resampledStore.addTrigger({
    onAdd: function (rec) {
        // Adds ema-s to rec
        rec.Ema1 = resampledStore.getStreamAggr("Ema1").EMA;
        rec.Ema2 = resampledStore.getStreamAggr("Ema2").EMA;

        //console.log("\nRec for time: " + rec.DateTime.string);
        //ftrSpace.ftrVec(rec).print()
        //console.start()

        // Predict and add to rec
        rec.SpeedLimit = 50;
        rec.PrevValPred = rec.Speed;
        rec.AvrValPred = avr.getAvr();
        rec.LinregPred = linreg.predict(ftrSpace.ftrVec(rec));
        rec.RidgeRegPred = ridgeRegression.predict(ftrSpace.ftrVec(rec));
        //rec.SvmrPred = svmr.predict(rec);
        rec.NNPred = NN.predict(ftrSpace.ftrVec(rec)).at(0);
        rec.KNNPred = knn.predict(ftrSpace.ftrVec(rec));

        // Get rec for training
        trainRecId = resampledStore.getStreamAggr("delay").first;

        // Add target for batch method
        resampledStore.add({ $id: trainRecId, Target: rec.Speed });

        if (trainRecId > 0) {
            // update models
            linreg.learn(ftrSpace.ftrVec(resampledStore[trainRecId]), rec.Speed);
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
            //console.log("Svmr: " + resampledStore[trainRecId].SvmrPred);
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
                //svmrMAE.update(rec.Speed - resampledStore[trainRecId].SvmrPred);
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
        //rec.SvmrPredMAE = svmrMAE.getError();
        rec.NNPredMAE = nnMAE.getError();
        rec.KNNPredMAE = nnMAE.getError();

        // Write errors to console
        console.log("Working with rec: " + rec.DateTime.string);
        console.log("SpeedLimit MAE Error: " + speedLimitMAE.getError());
        console.log("AvrVal MAE Error: " + avrValMAE.getError());
        console.log("PrevVal MAE Error: " + prevValMAE.getError());
        console.log("LinReg MAE Error: " + linregMAE.getError());
        console.log("RidgeReg MAE Error: " + ridgeRegMAE.getError());
        //console.log("Svmr MAE Error: " + svmrMAE.getError());
        console.log("NN MAE Error: " + nnMAE.getError());
        console.log("KNN MAE Error: " + knnMAE.getError() + "\n");

    }
});

// Imports data from loadstores according to timestamp
var loadStores = [trafficLoadStore, weatherLoadStore];
var targetStores = [trafficStore, weatherStore];
Utils.Data.importData(loadStores, targetStores);

// DEBUGGING
console.start()


// ONLINE SERVICES
http.onGet("query", function (req, resp) {
    jsonData = JSON.parse(req.args.data);
    console.say("" + JSON.stringify(jsonData));
    var recs = qm.search(jsonData);
    return http.jsonp(req, resp, recs);
});