var analytics = require('analytics.js');
var evaluation = require('evaluation.js')
var tm = require('time')
var utilities = require('utilities.js');
var viz = require('visualization.js');

// Create instance for stop watch
sw = new utilities.clsStopwatch();
sw2 = new utilities.clsStopwatch();

// Import modules from lib
var Service = {}; Service.Mobis = {}; Service.Mobis.Utils = {};
Service.Mobis.Loop = require('Service/Mobis/Loop/preprocLoop.js');
Service.Mobis.Weather = require('Service/Mobis/Weather/preprocWeather.js');
Service.Mobis.Events = require('Service/Mobis/Events/preprocEvents.js');
Service.Mobis.Utils.Io = require('Service/Mobis/Utils/io.js');
Service.Mobis.Utils.Data = require('Service/Mobis/Utils/importData.js');
Service.Mobis.Utils.Stores = require('Service/Mobis/Utils/defineStores.js');
Service.Mobis.Utils.Stat = require('Service/Mobis/Utils/stat.js');
Service.Mobis.Utils.Baseline = require('Service/Mobis/Utils/baselinePredictors.js');
Service.Mobis.Utils.Ftr = require('Service/Mobis/Utils/specialDays.js');
Service.Mobis.Utils.HistVals = require('Service/Mobis/Utils/histVals.js');
Service.Mobis.Utils.OnlineSVMR = require('Service/Mobis/Utils/svmRegression.js');

// Create instances for Mean Absolute Error
var speedLimitMAE = evaluation.newMeanAbsoluteError();
var avrValMAE = evaluation.newMeanAbsoluteError();
var prevValMAE = evaluation.newMeanAbsoluteError();
var linregMAE = evaluation.newMeanAbsoluteError();
var ridgeRegMAE = evaluation.newMeanAbsoluteError();
var ridgeRegSVDMAE = evaluation.newMeanAbsoluteError();
var svmrMAE = evaluation.newMeanAbsoluteError();
var nnMAE = evaluation.newMeanAbsoluteError();
var knnMAE = evaluation.newMeanAbsoluteError();

var avr = Service.Mobis.Utils.Baseline.newAvrVal();
var histVals = Service.Mobis.Utils.HistVals.newHistoricalVals(5);
var IO = Service.Mobis.Utils.Io.newSaveToFile("sandbox/" + process.scriptNm + "/log.txt");
var IO2 = Service.Mobis.Utils.Io.newSaveToFile("sandbox/" + process.scriptNm + "/logWithTarget.txt");

//// Define Stores
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
//var eventLoadStore = qm.store("eventLoadStore");
var eventStore = qm.store("eventStore");
var eventLogsLoadStore = qm.store("eventLogsLoadStore");
var eventLogsStore = qm.store("eventLogsStore");

// Constructor for special days feature extractor
var slovenianHolidayFtr = new Service.Mobis.Utils.Ftr.specialDaysFtrExtractor("Slovenian_holidays");
var fullMoonFtr = new Service.Mobis.Utils.Ftr.specialDaysFtrExtractor("Full_moon");
var weekendFtr = Service.Mobis.Utils.Ftr.newWeekendFtrExtractor();


///////////////////// PREPROCESSING FOR TRAFFIC DATA SOURCE /////////////////////
// Replaces incorect speed values, with avr value
trafficStore.addStreamAggr({
    name: "makeCleanSpeedNoCars",
    onAdd: Service.Mobis.Loop.makeCleanSpeedNoCars(avr),
    saveJson: function () { }
});

// This cannot work anymore, since I have no duplicates anymore
//// Calls function that adds field DateTime in String format that is set to primary (unique)
//trafficStore.addStreamAggr({
//    name: "markAsDuplicate",
//    //onAdd: Service.Mobis.Loop.addPrimaryField(trafficStoreNoDuplicates)
//    onAdd: Service.Mobis.Loop.markAsDuplicate(),
//    saveJson: function () { }
//});

// This cannot work anymore since no rec is marked as duplicate (we have none)
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

        { source: 'eventLogsStore', inField: 'Distance', outField: 'Distance', interpolation: 'previous', timestamp: 'EsperTime' },
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
        { source: { store: 'eventLogsStore', join: 'EventInfo' }, inField: 'Snow', outField: 'SnowEvent', interpolation: 'previous', timestamp: 'EsperTime' },
    ]
});

//////////////////////////// RESAMPLING MERGED STORE ////////////////////////////
// This resample aggregator creates new resampled store
var resampleInterval = 5 * 60 * 1000;
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
             { name: "clearDay", interpolator: "previous" },
             { name: "clearNight", interpolator: "previous" },
             { name: "rain", interpolator: "previous" },
             { name: "snow", interpolator: "previous" },
             { name: "sleet", interpolator: "previous" },
             { name: "wind", interpolator: "previous" },
             { name: "fog", interpolator: "previous" },
             { name: "cloudy", interpolator: "previous" },
             { name: "partlyCloudyDay", interpolator: "previous" },
             { name: "parltlyCloudyNight", interpolator: "previous" },

             { name: "Distance", interpolator: "previous" },
             { name: "Priority", interpolator: "previous" },
             { name: "RoadPriorityFlt", interpolator: "previous" },
             { name: "TrafficJam", interpolator: "previous" },
             { name: "RoadClosure", interpolator: "previous" },
             { name: "TrafficAccident", interpolator: "previous" },
             { name: "OtherEvents", interpolator: "previous" },
             { name: "Ice", interpolator: "previous" },
             { name: "Wind", interpolator: "previous" },
             { name: "NoFreightTraffic", interpolator: "previous" },
             { name: "SnowEvent", interpolator: "previous" }
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

// Buffer defines for how many records infront prediction will be learned (2 is one step ahaed)
resampledStore.addStreamAggr({ name: "delay", type: "recordBuffer", size: 7 });

////////////////////////////// DEFINING FEATURE SPACE //////////////////////////////
// define features
var features = [
    //{ type: "constant", source: resampledStore.name, val: 1 },
    { type: "jsfunc", source: resampledStore.name, name: "slovanianHolidays", dim: 1, fun: slovenianHolidayFtr.getFtr },
    { type: "jsfunc", source: resampledStore.name, name: "foolMoon", dim: 1, fun: fullMoonFtr.getFtr },
    //{ type: "jsfunc", source: resampledStore.name, name: "weekend", dim: 1, fun: weekendFtr.getFtr },
    { type: "jsfunc", source: resampledStore.name, name: "weekend", dim: 1, fun: function (rec) {return (rec.DateTime.dayOfWeekNum == 0 || rec.DateTime.dayOfWeekNum == 6) ? 1 : 0 } },
    { type: "jsfunc", source: resampledStore.name, name: "historicalValues", dim: histVals.getSize(), fun: histVals.getVals },

    //{ type: "numeric", source: resampledStore.name, field: "Speed", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Ema1", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Ema2", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "NumOfCars", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Gap", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Occupancy", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "TrafficStatus", normalize: false },

    { type: "numeric", source: resampledStore.name, field: "temperature", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "visibility", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "clearDay", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "clearNight", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "rain", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "snow", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "sleet", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "wind", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "fog", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "cloudy", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "partlyCloudyDay", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "parltlyCloudyNight", normalize: false },

    { type: "numeric", source: resampledStore.name, field: "Priority", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "RoadPriorityFlt", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "TrafficJam", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "RoadClosure", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "TrafficAccident", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "OtherEvents", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Ice", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "Wind", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "NoFreightTraffic", normalize: false },
    { type: "numeric", source: resampledStore.name, field: "SnowEvent", normalize: false },

    { type: "multinomial", source: resampledStore.name, field: "DateTime", datetime: true }
];
// Feature extractors for feature space
var ftrSpace = analytics.newFeatureSpace(features);

// load truncated svd decomposition matrix U
//var fin = fs.openRead("sandbox/" + process.scriptNm + "/U91")
//var fin = fs.openRead("sandbox/" + process.scriptNm + "/U70")
//var fin = fs.openRead("sandbox/" + process.scriptNm + "/U50")
//var fin = fs.openRead("sandbox/" + process.scriptNm + "/U20")
var fin = fs.openRead("sandbox/" + process.scriptNm + "/U5")
//var fin = fs.openRead("sandbox/" + process.scriptNm + "/U3")
//var fin = fs.openRead("sandbox/" + process.scriptNm + "/U2")
var U = la.newMat().load(fin);

///////////////// INITIALIZING ANALYTIC ALGORITHMS FOR PREDICTION //////////////////
// Initialize analytics
//var avr = Service.Mobis.Utils.Baseline.newAvrVal();
var linreg = analytics.newRecLinReg({ "dim": ftrSpace.dim, "forgetFact": 0.98, "regFact": 10000 });
var ridgeRegression = new analytics.ridgeRegression(10000, ftrSpace.dim, 100);
//var svmr = Service.Mobis.Utils.OnlineSVMR.newSvmRegression(ftrSpace.dim, { "c": 0.01, "eps": 0.00001, "maxTime": 0.1, "maxIterations": 100000, batchSize: 100}, 10);
var NN = analytics.newNN({ "layout": [ftrSpace.dim, 4, 1], "tFuncHidden": "sigmoid", "tFuncOut": "linear", "learnRate": 0.2, "momentum": 0.2 });
var knn = analytics.newKNearestNeighbors(3, 100);
var ridgeRegressionSVD = new analytics.ridgeRegression(1, U.cols, 100);

sw.tic();
sw2.tic();
var prevRecDay = null;

//////////////////////////// PREDICTION AND EVALUATION ////////////////////////////
resampledStore.addStreamAggr({
    name: "analytics",
    onAdd: function (rec) {
        // Adds ema-s to rec
        rec.Ema1 = resampledStore.getStreamAggr("Ema1").val.Val;
        rec.Ema2 = resampledStore.getStreamAggr("Ema2").val.Val;

        //console.log("Tu sn...")
        //console.pause();
        //eval(breakpoint);
        //console.log("\nFtrVec for time: " + rec.DateTime.string);
        //ftrSpace.ftrVec(rec).print()
        //console.log("\nRec for time: " + rec.DateTime.string);
        //printj(rec);
        //console.startx(function (x) { return eval(x); })
        //console.log("X cols for SVMR: " + knn.X.cols)
        //knn.X.print()
        //console.start()

        histVals.update(rec.Speed);
        // Predict and add to rec
        rec.SpeedLimit = trafficStore.last.measuredBy.MaxSpeed;
        rec.PrevValPred = rec.Speed;
        rec.AvrValPred = avr.getAvr();
        rec.LinregPred = linreg.predict(ftrSpace.ftrVec(rec));
        rec.RidgeRegPred = ridgeRegression.predict(ftrSpace.ftrVec(rec));
        //rec.SvmrPred = svmr.predict(ftrSpace.ftrVec(rec));
        rec.NNPred = NN.predict(ftrSpace.ftrVec(rec)).at(0);
        rec.KNNPred = knn.predict(ftrSpace.ftrVec(rec));
        rec.RidgeRegSVDPred = ridgeRegressionSVD.predict(U.multiplyT(ftrSpace.ftrVec(rec)))

        // Get rec for training
        trainRecId = resampledStore.getStreamAggr("delay").val.first;

        // Add target for batch method
        resampledStore.add({ $id: trainRecId, Target: rec.Speed });

        //console.log("\nReference FtrVec for time: " + resampledStore[trainRecId].DateTime.string);
        //ftrSpace.ftrVec(resampledStore[trainRecId]).print()

        //console.log("\nRefenrence Rec for time: " + resampledStore[trainRecId].DateTime.string);
        //printj(resampledStore[trainRecId]);


        if (trainRecId > 0) {
            // update models
            linreg.learn(ftrSpace.ftrVec(resampledStore[trainRecId]), rec.Speed);
            //svmr.learn(ftrSpace.ftrVec(resampledStore[trainRecId]), rec.Speed);
            ridgeRegression.addupdate(ftrSpace.ftrVec(resampledStore[trainRecId]), rec.Speed);
            NN.learn(ftrSpace.ftrVec(resampledStore[trainRecId]), la.newVec([rec.Speed]));
            avr.update(resampledStore[trainRecId].Speed);
            knn.update(ftrSpace.ftrVec(resampledStore[trainRecId]), rec.Speed);
            ridgeRegressionSVD.addupdate(U.multiplyT(ftrSpace.ftrVec(resampledStore[trainRecId])), rec.Speed);

            IO.saveToFile(ftrSpace.ftrVec(resampledStore[trainRecId]));
            IO2.saveToFile(ftrSpace.ftrVec(resampledStore[trainRecId]), rec.Speed);

            // skip first few iterations because the error of svmr is to high
            if (rec.$id > 50) {
                // Update error metrics
                speedLimitMAE.update(rec.Speed, resampledStore[trainRecId].SpeedLimit)
                avrValMAE.update(rec.Speed, resampledStore[trainRecId].AvrValPred);
                prevValMAE.update(rec.Speed, resampledStore[trainRecId].Speed);
                linregMAE.update(rec.Speed, resampledStore[trainRecId].LinregPred);
                ridgeRegMAE.update(rec.Speed, resampledStore[trainRecId].RidgeRegPred);
                svmrMAE.update(rec.Speed, resampledStore[trainRecId].SvmrPred);
                nnMAE.update(rec.Speed, resampledStore[trainRecId].NNPred);
                knnMAE.update(rec.Speed, resampledStore[trainRecId].KNNPred);
                ridgeRegSVDMAE.update(rec.Speed, resampledStore[trainRecId].RidgeRegSVDPred);
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
        rec.RidgeRegSVDPredMAE = ridgeRegSVDMAE.getError();

        // Reporting results
        // Only one report per day
        if (rec.DateTime.day != prevRecDay) {
            sw2.toc("Leap time");
            sw2.tic();
            ftrSpace.ftrVec(rec).print()
            console.log("Working on rec: " + rec.DateTime.dateString+ "\n");

            // Write predictions to console
            console.log("Speed:" + rec.Speed);
            console.log("SpeedLimit: " + rec.SpeedLimit);
            console.log("AvrVal: " + resampledStore[trainRecId].AvrValPred);
            console.log("PrevVal: " + resampledStore[trainRecId].PrevValPred);
            console.log("LinReg: " + resampledStore[trainRecId].LinregPred);
            console.log("RidgeReg: " + resampledStore[trainRecId].RidgeRegPred);
            console.log("RidgeRegSVD: " + resampledStore[trainRecId].RidgeRegSVDPred);
            console.log("Svmr: " + resampledStore[trainRecId].SvmrPred);
            console.log("NN: " + resampledStore[trainRecId].NNPred);
            console.log("KNN: " + resampledStore[trainRecId].KNNPred + "\n");

            // Write errors to console
            console.log("Working with rec: " + rec.DateTime.string);
            console.log("SpeedLimit MAE Error: " + speedLimitMAE.getError());
            console.log("AvrVal MAE Error: " + avrValMAE.getError());
            console.log("PrevVal MAE Error: " + prevValMAE.getError());
            console.log("LinReg MAE Error: " + linregMAE.getError());
            console.log("RidgeReg MAE Error: " + ridgeRegMAE.getError());
            console.log("RidgeRegSVD MAE Error: " + ridgeRegSVDMAE.getError());
            console.log("Svmr MAE Error: " + svmrMAE.getError());
            console.log("NN MAE Error: " + nnMAE.getError());
            console.log("KNN MAE Error: " + knnMAE.getError() + "\n");

            // set new prevRecDay
            prevRecDay = rec.DateTime.day;
        }
    },
    saveJson: function () { }
});

//// Load Stores from log files
Service.Mobis.Utils.Stores.loadStores();

// Imports data from loadstores according to timestamp
var loadStores = [trafficLoadStore, weatherLoadStore, eventLogsLoadStore];
var targetStores = [trafficStore, weatherStore, eventLogsStore];
//Service.Mobis.Utils.Data.importData(loadStores, targetStores, 10000);
Service.Mobis.Utils.Data.importData(loadStores, targetStores);

// DEBUGGING
eval(breakpoint)

var fields = [resampledStore.field("DateTime"),
              //resampledStore.field("NumOfCars"),
              resampledStore.field("Speed"),
              //resampledStore.field("temperature"),
              //resampledStore.field("visibility"),
              //resampledStore.field("priority")
]

viz.drawHighChartsTimeSeries(viz.highchartsConverter(fields, resampledStore.recs.toJSON()), "test.html", { title: { text: "Testing testing.." }, chart: { type: 'spline', zoomType: 'x' }, });

//////////////////////////// ONLINE (REST) SERVICES ////////////////////////////
// Query records
http.onGet("query", function (req, resp) {
    jsonData = JSON.parse(req.args.data);
    console.say("" + JSON.stringify(jsonData));
    var recs = qm.search(jsonData);
    return http.jsonp(req, resp, recs);
});